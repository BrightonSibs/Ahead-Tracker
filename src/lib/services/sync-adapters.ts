import { dedupeCandidates } from '@/lib/services/sync-deduping';
import {
  buildDate,
  buildOpenAlexAbstract,
  extractDoi,
  extractPubmedId,
  fetchJson,
  getResearcherIdentifier,
  getResearcherOrcid,
  getResearcherSearchNames,
  normalizeDoi,
  normalizeOpenAlexId,
  normalizePmcid,
  normalizePubmedId,
  normalizeWhitespace,
  parseLooseDate,
  splitAuthorList,
} from '@/lib/services/sync-shared';
import type {
  AutomaticSyncSource,
  PublicationCandidate,
  ResearcherWithAliases,
  SyncSource,
  SyncSourceAdapter,
} from '@/lib/services/sync-types';

async function fetchCrossrefCandidates(researcher: ResearcherWithAliases) {
  const candidates: PublicationCandidate[] = [];
  const mailto = process.env.CROSSREF_EMAIL || 'research@slu.edu';

  for (const searchName of getResearcherSearchNames(researcher).slice(0, 3)) {
    const url = new URL('https://api.crossref.org/works');
    url.searchParams.set('query.author', searchName);
    url.searchParams.set('rows', '15');
    url.searchParams.set('select', 'DOI,title,author,issued,container-title,abstract,is-referenced-by-count');
    url.searchParams.set('mailto', mailto);

    const data = await fetchJson<{
      message?: {
        items?: Array<{
          DOI?: string;
          title?: string[];
          author?: Array<{ given?: string; family?: string; name?: string }>;
          issued?: { 'date-parts'?: number[][] };
          'container-title'?: string[];
          abstract?: string;
          'is-referenced-by-count'?: number;
        }>;
      };
    }>(url.toString(), {
      headers: {
        'User-Agent': `ahead-tracker/1.0 (${mailto})`,
      },
    });

    for (const item of data.message?.items || []) {
      const title = item.title?.[0];
      const year = item.issued?.['date-parts']?.[0]?.[0] ?? null;
      const month = item.issued?.['date-parts']?.[0]?.[1] ?? null;
      const day = item.issued?.['date-parts']?.[0]?.[2] ?? null;

      if (!title) continue;

      candidates.push({
        source: 'CROSSREF',
        externalId: normalizeDoi(item.DOI),
        doi: normalizeDoi(item.DOI),
        pubmedId: null,
        title,
        journalName: item['container-title']?.[0] ?? null,
        abstract: item.abstract || null,
        publicationDate: buildDate(year, month, day),
        publicationYear: year,
        authorNames:
          item.author
            ?.map(author => normalizeWhitespace([author.given, author.family, author.name].filter(Boolean).join(' ')))
            .filter(Boolean) || [],
        citationCount: item['is-referenced-by-count'] ?? null,
      });
    }
  }

  return dedupeCandidates(candidates);
}

async function fetchPubmedCandidates(researcher: ResearcherWithAliases) {
  const ids = new Set<string>();
  const apiKey = process.env.NCBI_API_KEY || '';

  for (const searchName of getResearcherSearchNames(researcher).slice(0, 3)) {
    const searchUrl = new URL('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi');
    searchUrl.searchParams.set('db', 'pubmed');
    searchUrl.searchParams.set('retmode', 'json');
    searchUrl.searchParams.set('sort', 'relevance');
    searchUrl.searchParams.set('retmax', '15');
    searchUrl.searchParams.set('term', `"${searchName}"[Author]`);
    if (apiKey) searchUrl.searchParams.set('api_key', apiKey);

    const searchData = await fetchJson<{ esearchresult?: { idlist?: string[] } }>(searchUrl.toString());
    for (const id of searchData.esearchresult?.idlist || []) ids.add(id);
  }

  if (ids.size === 0) return [];

  const summaryUrl = new URL('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi');
  summaryUrl.searchParams.set('db', 'pubmed');
  summaryUrl.searchParams.set('retmode', 'json');
  summaryUrl.searchParams.set('id', Array.from(ids).slice(0, 50).join(','));
  if (apiKey) summaryUrl.searchParams.set('api_key', apiKey);

  const summaryData = await fetchJson<{
    result?: {
      uids?: string[];
      [uid: string]: any;
    };
  }>(summaryUrl.toString());

  const candidates: PublicationCandidate[] = [];

  for (const uid of summaryData.result?.uids || []) {
    const item = summaryData.result?.[uid];
    if (!item?.title) continue;

    candidates.push({
      source: 'PUBMED',
      externalId: uid,
      doi: extractDoi(item.articleids),
      pubmedId: extractPubmedId(item.articleids) || uid,
      title: item.title,
      journalName: item.fulljournalname || item.source || null,
      abstract: null,
      publicationDate: parseLooseDate(item.pubdate),
      publicationYear: parseLooseDate(item.pubdate)?.getUTCFullYear() ?? null,
      authorNames: item.authors?.map((author: { name?: string }) => author.name).filter(Boolean) || [],
      citationCount: null,
    });
  }

  return dedupeCandidates(candidates);
}

async function fetchOrcidCandidates(researcher: ResearcherWithAliases) {
  const researcherOrcid = getResearcherOrcid(researcher);
  if (!researcherOrcid) return [];

  const worksUrl = `https://pub.orcid.org/v3.0/${researcherOrcid}/works`;
  const worksData = await fetchJson<{
    group?: Array<{
      'work-summary'?: Array<any>;
    }>;
  }>(worksUrl, {
    headers: {
      Accept: 'application/json',
    },
  });

  const candidates: PublicationCandidate[] = [];

  for (const group of worksData.group || []) {
    const summary = group['work-summary']?.[0];
    if (!summary?.title?.title?.value) continue;

    const externalIds = summary['external-ids']?.['external-id'] || [];
    const doi = normalizeDoi(
      externalIds.find((externalId: any) => externalId['external-id-type'] === 'doi')?.['external-id-value'] || null,
    );
    const year = Number(summary['publication-date']?.year?.value || 0) || null;
    const month = Number(summary['publication-date']?.month?.value || 0) || null;
    const day = Number(summary['publication-date']?.day?.value || 0) || null;

    candidates.push({
      source: 'ORCID',
      externalId: String(summary['put-code'] || doi || summary.title.title.value),
      doi,
      pubmedId: null,
      title: summary.title.title.value,
      journalName: summary['journal-title']?.value || null,
      abstract: null,
      publicationDate: buildDate(year, month, day),
      publicationYear: year,
      authorNames: [researcher.canonicalName],
      citationCount: null,
    });
  }

  return dedupeCandidates(candidates);
}

async function resolveOpenAlexAuthorId(researcher: ResearcherWithAliases) {
  const directId = normalizeOpenAlexId(
    getResearcherIdentifier(researcher, ['OPENALEX_AUTHOR_ID', 'OPENALEX_ID', 'OPENALEX_AUTHOR']),
  );
  if (directId) return directId;

  const researcherOrcid = getResearcherOrcid(researcher);
  if (!researcherOrcid) return null;

  const mailto = process.env.OPENALEX_EMAIL || process.env.CROSSREF_EMAIL || 'research@slu.edu';
  const url = new URL('https://api.openalex.org/authors');
  url.searchParams.set('filter', `orcid:https://orcid.org/${researcherOrcid}`);
  url.searchParams.set('per-page', '1');
  url.searchParams.set('mailto', mailto);

  const data = await fetchJson<{ results?: Array<{ id?: string }> }>(url.toString(), {
    headers: {
      'User-Agent': `ahead-tracker/1.0 (${mailto})`,
    },
  });

  return normalizeOpenAlexId(data.results?.[0]?.id || null);
}

async function fetchOpenAlexCandidates(researcher: ResearcherWithAliases) {
  const authorId = await resolveOpenAlexAuthorId(researcher);
  if (!authorId) return [];

  const mailto = process.env.OPENALEX_EMAIL || process.env.CROSSREF_EMAIL || 'research@slu.edu';
  const url = new URL('https://api.openalex.org/works');
  url.searchParams.set('filter', `author.id:https://openalex.org/${authorId}`);
  url.searchParams.set('sort', 'publication_date:desc');
  url.searchParams.set('per-page', '50');
  url.searchParams.set('mailto', mailto);

  const data = await fetchJson<{
    results?: Array<{
      id?: string;
      doi?: string;
      ids?: { doi?: string; pmid?: string };
      display_name?: string;
      title?: string;
      publication_date?: string;
      publication_year?: number;
      primary_location?: { source?: { display_name?: string | null } | null };
      authorships?: Array<{ author?: { display_name?: string | null } | null; raw_author_name?: string | null }>;
      abstract_inverted_index?: Record<string, number[]>;
      cited_by_count?: number;
    }>;
  }>(url.toString(), {
    headers: {
      'User-Agent': `ahead-tracker/1.0 (${mailto})`,
    },
  });

  const candidates: PublicationCandidate[] = [];

  for (const item of data.results || []) {
    const title = item.display_name || item.title;
    if (!title) continue;

    const publicationDate = parseLooseDate(item.publication_date || String(item.publication_year || ''));
    candidates.push({
      source: 'OPENALEX',
      externalId: normalizeOpenAlexId(item.id || null),
      alternateExternalIds: [],
      doi: normalizeDoi(item.doi || item.ids?.doi || null),
      pubmedId: normalizePubmedId(item.ids?.pmid || null),
      title,
      journalName: item.primary_location?.source?.display_name || null,
      abstract: buildOpenAlexAbstract(item.abstract_inverted_index),
      publicationDate,
      publicationYear: item.publication_year || publicationDate?.getUTCFullYear() || null,
      authorNames:
        item.authorships
          ?.map(authorship => normalizeWhitespace(authorship.author?.display_name || authorship.raw_author_name || ''))
          .filter(Boolean) || [],
      citationCount: typeof item.cited_by_count === 'number' ? item.cited_by_count : null,
    });
  }

  return dedupeCandidates(candidates);
}

async function fetchEuropePmcCandidates(researcher: ResearcherWithAliases) {
  const candidates: PublicationCandidate[] = [];

  for (const searchName of getResearcherSearchNames(researcher).slice(0, 3)) {
    const url = new URL('https://www.ebi.ac.uk/europepmc/webservices/rest/search');
    url.searchParams.set('query', `AUTH:\"${searchName}\"`);
    url.searchParams.set('format', 'json');
    url.searchParams.set('pageSize', '25');
    url.searchParams.set('resultType', 'core');

    const data = await fetchJson<{
      resultList?: {
        result?: Array<{
          id?: string;
          pmid?: string;
          pmcid?: string;
          doi?: string;
          title?: string;
          journalTitle?: string;
          abstractText?: string;
          firstPublicationDate?: string;
          pubYear?: string;
          authorString?: string;
          authorList?: { author?: Array<{ fullName?: string; firstName?: string; lastName?: string }> };
          citedByCount?: number;
        }>;
      };
    }>(url.toString());

    for (const item of data.resultList?.result || []) {
      if (!item.title) continue;

      const pmid = normalizePubmedId(item.pmid || null);
      const pmcid = normalizePmcid(item.pmcid || null);
      const publicationDate = parseLooseDate(item.firstPublicationDate || item.pubYear || undefined);
      const authorNames =
        item.authorList?.author
          ?.map(author => normalizeWhitespace(author.fullName || [author.firstName, author.lastName].filter(Boolean).join(' ')))
          .filter(Boolean) ||
        splitAuthorList(item.authorString);

      candidates.push({
        source: 'EUROPE_PMC',
        externalId: pmcid || pmid || normalizeWhitespace(item.id || item.title),
        alternateExternalIds: [pmcid, pmid].filter(Boolean) as string[],
        doi: normalizeDoi(item.doi || null),
        pubmedId: pmid,
        title: item.title,
        journalName: item.journalTitle || null,
        abstract: item.abstractText || null,
        publicationDate,
        publicationYear: publicationDate?.getUTCFullYear() || (item.pubYear ? Number(item.pubYear) : null),
        authorNames,
        citationCount: typeof item.citedByCount === 'number' ? item.citedByCount : null,
      });
    }
  }

  return dedupeCandidates(candidates);
}

async function fetchGoogleScholarCandidates(researcher: ResearcherWithAliases) {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    throw new Error('SERPAPI_KEY is not configured.');
  }

  const scholarAuthorId = getResearcherIdentifier(researcher, [
    'GOOGLE_SCHOLAR_AUTHOR_ID',
    'SCHOLAR_AUTHOR_ID',
    'SCHOLAR_PROFILE_ID',
  ]);

  if (scholarAuthorId) {
    const authorUrl = new URL('https://serpapi.com/search.json');
    authorUrl.searchParams.set('engine', 'google_scholar_author');
    authorUrl.searchParams.set('author_id', scholarAuthorId);
    authorUrl.searchParams.set('sort', 'pubdate');
    authorUrl.searchParams.set('hl', 'en');
    authorUrl.searchParams.set('api_key', apiKey);

    const authorData = await fetchJson<{
      articles?: Array<{
        title?: string;
        citation_id?: string;
        authors?: string;
        publication?: string;
        cited_by?: { value?: number; cites_id?: string };
        year?: string;
      }>;
    }>(authorUrl.toString());

    const authorCandidates: PublicationCandidate[] = [];

    for (const item of authorData.articles || []) {
      if (!item.title) continue;

      const publicationYear = item.year ? Number(item.year) : null;
      const authorNames = item.authors
        ? item.authors.split(',').map(author => normalizeWhitespace(author)).filter(Boolean)
        : [researcher.canonicalName];
      const publicationText = normalizeWhitespace(item.publication || '');
      const journalName = publicationText
        ? normalizeWhitespace(
            publicationText
              .replace(/\b(19|20)\d{2}\b/g, '')
              .replace(/\d+\s*\([^)]*\),?\s*\d.*$/g, '')
              .replace(/,\s*\d.*$/g, ''),
          ) || null
        : null;

      authorCandidates.push({
        source: 'GOOGLE_SCHOLAR',
        externalId: item.citation_id || item.cited_by?.cites_id || item.title,
        doi: null,
        pubmedId: null,
        title: item.title,
        journalName,
        abstract: null,
        publicationDate: publicationYear ? buildDate(publicationYear, 1, 1) : null,
        publicationYear,
        authorNames,
        citationCount: item.cited_by?.value ?? null,
      });
    }

    if (authorCandidates.length > 0) {
      return dedupeCandidates(authorCandidates);
    }
  }

  const candidates: PublicationCandidate[] = [];

  for (const searchName of getResearcherSearchNames(researcher).slice(0, 3)) {
    const url = new URL('https://serpapi.com/search.json');
    url.searchParams.set('engine', 'google_scholar');
    url.searchParams.set('q', `author:\"${searchName}\"`);
    url.searchParams.set('num', '20');
    url.searchParams.set('hl', 'en');
    url.searchParams.set('as_sdt', '0');
    url.searchParams.set('as_vis', '1');
    url.searchParams.set('api_key', apiKey);

    const data = await fetchJson<{
      organic_results?: Array<{
        title?: string;
        result_id?: string;
        publication_info?: {
          summary?: string;
          authors?: Array<{ name?: string }>;
        };
        snippet?: string;
        inline_links?: {
          cited_by?: {
            total?: number;
            cites_id?: string;
          };
          versions?: {
            cluster_id?: string;
          };
        };
      }>;
    }>(url.toString());

    for (const item of data.organic_results || []) {
      if (!item.title) continue;

      const summary = item.publication_info?.summary || '';
      const yearMatch = summary.match(/\b(19|20)\d{2}\b/);
      const publicationYear = yearMatch ? Number(yearMatch[0]) : null;
      const authorNames =
        item.publication_info?.authors?.map(author => author.name).filter((author): author is string => Boolean(author)) ||
        summary
          .split(' - ')[0]
          ?.split(',')
          .map(author => normalizeWhitespace(author))
          .filter(Boolean) ||
        [];
      const journalName = summary.includes(' - ')
        ? normalizeWhitespace(summary.split(' - ').slice(1).join(' - ').replace(/\b(19|20)\d{2}\b/g, '').replace(/^-|-$|,+$/g, ''))
        : null;
      const externalId =
        item.inline_links?.versions?.cluster_id ||
        item.inline_links?.cited_by?.cites_id ||
        item.result_id ||
        item.title;

      candidates.push({
        source: 'GOOGLE_SCHOLAR',
        externalId,
        doi: null,
        pubmedId: null,
        title: item.title,
        journalName: journalName || null,
        abstract: item.snippet || null,
        publicationDate: publicationYear ? buildDate(publicationYear, 1, 1) : null,
        publicationYear,
        authorNames,
        citationCount: item.inline_links?.cited_by?.total ?? null,
      });
    }
  }

  return dedupeCandidates(candidates);
}

const syncSourceAdapters: Record<AutomaticSyncSource, SyncSourceAdapter> = {
  CROSSREF: {
    source: 'CROSSREF',
    fetchCandidates: fetchCrossrefCandidates,
  },
  PUBMED: {
    source: 'PUBMED',
    fetchCandidates: fetchPubmedCandidates,
  },
  EUROPE_PMC: {
    source: 'EUROPE_PMC',
    fetchCandidates: fetchEuropePmcCandidates,
  },
  ORCID: {
    source: 'ORCID',
    fetchCandidates: fetchOrcidCandidates,
  },
  OPENALEX: {
    source: 'OPENALEX',
    fetchCandidates: fetchOpenAlexCandidates,
  },
  GOOGLE_SCHOLAR: {
    source: 'GOOGLE_SCHOLAR',
    fetchCandidates: fetchGoogleScholarCandidates,
  },
};

export async function fetchCandidatesForSource(source: SyncSource, researcher: ResearcherWithAliases) {
  const adapter = syncSourceAdapters[source as AutomaticSyncSource];
  if (!adapter) {
    throw new Error(`${source} is not configured for automatic ingestion.`);
  }

  return adapter.fetchCandidates(researcher);
}
