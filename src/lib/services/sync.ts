import { prisma } from '@/lib/prisma';

export const SYNCABLE_SOURCES = ['CROSSREF', 'PUBMED', 'ORCID', 'GOOGLE_SCHOLAR'] as const;
export const MANUAL_ONLY_SOURCES = ['RESEARCHGATE'] as const;

type AutomaticSyncSource = (typeof SYNCABLE_SOURCES)[number];
type SyncSource = AutomaticSyncSource | (typeof MANUAL_ONLY_SOURCES)[number];

type ResearcherWithAliases = Awaited<ReturnType<typeof getResearchersForSync>>[number];

type PublicationCandidate = {
  source: AutomaticSyncSource;
  externalId: string | null;
  doi: string | null;
  pubmedId: string | null;
  title: string;
  journalName: string | null;
  abstract: string | null;
  publicationDate: Date | null;
  publicationYear: number | null;
  authorNames: string[];
  citationCount: number | null;
};

const hostRequestSpacing = new Map<string, number>();

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function paceRequest(url: string) {
  const target = new URL(url);
  const host = target.host;

  let minIntervalMs = 0;
  if (host.includes('eutils.ncbi.nlm.nih.gov')) {
    minIntervalMs = process.env.NCBI_API_KEY ? 150 : 500;
  } else if (host.includes('serpapi.com')) {
    minIntervalMs = 250;
  } else if (host.includes('api.crossref.org')) {
    minIntervalMs = 150;
  } else if (host.includes('pub.orcid.org')) {
    minIntervalMs = 150;
  }

  if (minIntervalMs <= 0) return;

  const lastAt = hostRequestSpacing.get(host) || 0;
  const now = Date.now();
  const waitMs = Math.max(0, lastAt + minIntervalMs - now);
  if (waitMs > 0) {
    await sleep(waitMs);
  }

  hostRequestSpacing.set(host, Date.now());
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeName(value: string) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '');
}

function normalizeTitle(value: string) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '');
}

function normalizeDoi(value: string | null | undefined) {
  if (!value) return null;
  return value
    .trim()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')
    .replace(/^doi:/i, '')
    .toLowerCase();
}

function buildDate(year?: number | null, month?: number | null, day?: number | null) {
  if (!year) return null;
  return new Date(Date.UTC(year, (month || 1) - 1, day || 1));
}

function parseLooseDate(value: string | undefined) {
  if (!value) return null;
  const full = new Date(value);
  if (!Number.isNaN(full.getTime())) return full;

  const yearMatch = value.match(/\b(19|20)\d{2}\b/);
  if (!yearMatch) return null;
  const year = Number(yearMatch[0]);
  const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const lower = value.toLowerCase();
  const monthIndex = monthNames.findIndex(month => lower.includes(month));
  return buildDate(year, monthIndex >= 0 ? monthIndex + 1 : 1, 1);
}

function extractPubmedId(articleIds: Array<{ idtype?: string; value?: string }> | undefined) {
  return articleIds?.find(id => id.idtype === 'pubmed')?.value ?? null;
}

function extractDoi(articleIds: Array<{ idtype?: string; value?: string }> | undefined) {
  return normalizeDoi(articleIds?.find(id => id.idtype === 'doi')?.value ?? null);
}

function getResearcherSearchNames(researcher: ResearcherWithAliases) {
  const names = new Set<string>([researcher.canonicalName]);
  for (const alias of researcher.aliases) names.add(alias.aliasName);
  return Array.from(names).filter(Boolean).slice(0, 5);
}

function getResearcherIdentifier(researcher: ResearcherWithAliases, identifierTypes: string[]) {
  const normalizedTypes = new Set(identifierTypes.map(type => type.toUpperCase()));
  return (
    researcher.identifiers.find(identifier => normalizedTypes.has(identifier.identifierType.toUpperCase()))?.value?.trim() || null
  );
}

function surnameOf(value: string) {
  const parts = normalizeWhitespace(value).split(' ');
  return parts[parts.length - 1]?.toLowerCase() || '';
}

function firstInitialOf(value: string) {
  return normalizeWhitespace(value).charAt(0).toLowerCase();
}

function resolveAuthorMatch(researcher: ResearcherWithAliases, authorNames: string[], source: SyncSource) {
  if (source === 'ORCID' && researcher.orcid) {
    return { matchType: 'ORCID_MATCH', confidence: 1.0 };
  }

  const canonical = normalizeName(researcher.canonicalName);
  const aliases = new Set(researcher.aliases.map(alias => normalizeName(alias.aliasName)));
  const researcherSurname = surnameOf(researcher.canonicalName);
  const researcherInitial = firstInitialOf(researcher.canonicalName);

  for (const authorName of authorNames) {
    const normalizedAuthor = normalizeName(authorName);
    if (!normalizedAuthor) continue;

    if (normalizedAuthor === canonical) {
      return { matchType: 'EXACT_NAME_MATCH', confidence: 0.98 };
    }

    if (aliases.has(normalizedAuthor)) {
      return { matchType: 'ALIAS_MATCH', confidence: 0.92 };
    }

    if (surnameOf(authorName) === researcherSurname && firstInitialOf(authorName) === researcherInitial) {
      return { matchType: 'FUZZY_MATCH', confidence: 0.78 };
    }
  }

  return null;
}

async function fetchJson<T>(url: string, init?: RequestInit) {
  for (let attempt = 0; attempt < 3; attempt++) {
    await paceRequest(url);

    const response = await fetch(url, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init?.headers || {}),
      },
      cache: 'no-store',
    });

    if (response.ok) {
      return response.json() as Promise<T>;
    }

    if (response.status === 429) {
      const retryAfterSeconds = Number(response.headers.get('retry-after') || 0);
      const waitMs = retryAfterSeconds > 0 ? retryAfterSeconds * 1000 : 1500 * (attempt + 1);
      if (attempt < 2) {
        await sleep(waitMs);
        continue;
      }

      const host = new URL(url).host;
      if (host.includes('eutils.ncbi.nlm.nih.gov')) {
        throw new Error(
          process.env.NCBI_API_KEY
            ? 'NCBI PubMed rate limit reached. Wait a minute and retry.'
            : 'NCBI PubMed rate limit reached. Add NCBI_API_KEY to .env.local or wait a minute and retry.',
        );
      }

      throw new Error(`Rate limit reached for ${host}. Please wait and retry.`);
    }

    throw new Error(`Request failed (${response.status}) for ${url}`);
  }
  throw new Error(`Request failed for ${url}`);
}

function dedupeCandidates(candidates: PublicationCandidate[]) {
  const deduped = new Map<string, PublicationCandidate>();

  for (const candidate of candidates) {
    const key =
      candidate.doi ||
      candidate.pubmedId ||
      `${normalizeTitle(candidate.title)}::${candidate.publicationYear || 'unknown'}`;

    if (!deduped.has(key)) {
      deduped.set(key, candidate);
    }
  }

  return Array.from(deduped.values());
}

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
          item.author?.map(author => normalizeWhitespace([author.given, author.family, author.name].filter(Boolean).join(' '))).filter(Boolean) ||
          [],
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
  if (!researcher.orcid) return [];

  const worksUrl = `https://pub.orcid.org/v3.0/${researcher.orcid}/works`;
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
              .replace(/,\s*\d.*$/g, '')
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
    url.searchParams.set('q', `author:"${searchName}"`);
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
        summary.split(' - ')[0]?.split(',').map(author => normalizeWhitespace(author)).filter(Boolean) ||
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

async function getResearchersForSync(researcherId?: string) {
  return prisma.researcher.findMany({
    where: {
      activeStatus: true,
      ...(researcherId ? { id: researcherId } : {}),
    },
    include: {
      aliases: true,
      identifiers: true,
    },
    orderBy: { canonicalName: 'asc' },
  });
}

async function fetchCandidatesForSource(source: SyncSource, researcher: ResearcherWithAliases) {
  if (source === 'CROSSREF') return fetchCrossrefCandidates(researcher);
  if (source === 'PUBMED') return fetchPubmedCandidates(researcher);
  if (source === 'ORCID') return fetchOrcidCandidates(researcher);
  if (source === 'GOOGLE_SCHOLAR') return fetchGoogleScholarCandidates(researcher);

  throw new Error(`${source} is not configured for automatic ingestion.`);
}

async function persistCandidate(researcher: ResearcherWithAliases, candidate: PublicationCandidate) {
  const authorMatch = resolveAuthorMatch(researcher, candidate.authorNames, candidate.source);
  if (!authorMatch) return { created: 0, updated: 0 };

  const normalizedTitle = normalizeTitle(candidate.title);
  if (!normalizedTitle) return { created: 0, updated: 0 };

  let publication =
    (candidate.doi
      ? await prisma.publication.findUnique({ where: { doi: candidate.doi } })
      : null) ||
    (candidate.pubmedId
      ? await prisma.publication.findUnique({ where: { pubmedId: candidate.pubmedId } })
      : null) ||
    (await prisma.publication.findFirst({
      where: {
        normalizedTitle,
        ...(candidate.publicationYear ? { publicationYear: candidate.publicationYear } : {}),
      },
    }));

  let created = 0;
  let updated = 0;

  if (!publication) {
    publication = await prisma.publication.create({
      data: {
        title: candidate.title,
        normalizedTitle,
        doi: candidate.doi,
        pubmedId: candidate.pubmedId,
        publicationDate: candidate.publicationDate,
        publicationYear: candidate.publicationYear,
        journalName: candidate.journalName,
        abstract: candidate.abstract,
        sourcePrimary: candidate.source,
        verifiedStatus: 'UNVERIFIED',
      },
    });
    created = 1;
  } else {
    const updateData: Record<string, string | number | Date | null> = {};
    if (!publication.doi && candidate.doi) updateData.doi = candidate.doi;
    if (!publication.pubmedId && candidate.pubmedId) updateData.pubmedId = candidate.pubmedId;
    if (!publication.journalName && candidate.journalName) updateData.journalName = candidate.journalName;
    if (!publication.abstract && candidate.abstract) updateData.abstract = candidate.abstract;
    if (!publication.publicationDate && candidate.publicationDate) updateData.publicationDate = candidate.publicationDate;
    if (!publication.publicationYear && candidate.publicationYear) updateData.publicationYear = candidate.publicationYear;
    if (publication.sourcePrimary === 'MANUAL') updateData.sourcePrimary = candidate.source;

    if (Object.keys(updateData).length > 0) {
      publication = await prisma.publication.update({
        where: { id: publication.id },
        data: updateData,
      });
      updated = 1;
    }
  }

  const existingAuthors = await prisma.publicationAuthor.count({
    where: { publicationId: publication.id },
  });
  if (existingAuthors === 0 && candidate.authorNames.length > 0) {
    await prisma.publicationAuthor.createMany({
      data: candidate.authorNames.map((authorName, index) => ({
        publicationId: publication!.id,
        authorName,
        authorOrder: index + 1,
        isCorresponding: index === 0,
      })),
    });
  }

  const existingSourceRecord = await prisma.sourceRecord.findFirst({
    where: {
      publicationId: publication.id,
      source: candidate.source,
      externalId: candidate.externalId,
    },
  });
  if (!existingSourceRecord) {
    await prisma.sourceRecord.create({
      data: {
        publicationId: publication.id,
        source: candidate.source,
        externalId: candidate.externalId,
        rawData: JSON.stringify(candidate),
        normalizedAt: new Date(),
      },
    });
  }

  const includedInSluOutput =
    !researcher.sluStartDate || !candidate.publicationDate || candidate.publicationDate >= researcher.sluStartDate;

  await prisma.publicationResearcherMatch.upsert({
    where: {
      publicationId_researcherId: {
        publicationId: publication.id,
        researcherId: researcher.id,
      },
    },
    update: {
      matchType: authorMatch.matchType,
      matchConfidence: authorMatch.confidence,
      includedInSluOutput,
      manuallyExcluded: false,
      exclusionReason: null,
      sluTenureNote:
        includedInSluOutput || !researcher.sluStartDate || !candidate.publicationDate
          ? null
          : `Published before researcher's SLU start date (${researcher.sluStartDate.toISOString().split('T')[0]})`,
    },
    create: {
      publicationId: publication.id,
      researcherId: researcher.id,
      matchType: authorMatch.matchType,
      matchConfidence: authorMatch.confidence,
      manuallyConfirmed: authorMatch.matchType === 'ORCID_MATCH',
      includedInSluOutput,
      sluTenureNote:
        includedInSluOutput || !researcher.sluStartDate || !candidate.publicationDate
          ? null
          : `Published before researcher's SLU start date (${researcher.sluStartDate.toISOString().split('T')[0]})`,
    },
  });

  if (candidate.citationCount != null) {
    const latestCitation = await prisma.citation.findFirst({
      where: {
        publicationId: publication.id,
        source: candidate.source,
      },
      orderBy: { capturedAt: 'desc' },
    });

    if (!latestCitation || latestCitation.citationCount !== candidate.citationCount) {
      await prisma.citation.create({
        data: {
          publicationId: publication.id,
          source: candidate.source,
          citationCount: candidate.citationCount,
          capturedAt: new Date(),
        },
      });
      if (!created) updated = 1;
    }
  }

  return { created, updated };
}

export async function runSyncJob(source: SyncSource, triggeredBy?: string, researcherId?: string) {
  const job = await prisma.syncJob.create({
    data: {
      source,
      status: 'RUNNING',
      researcherId: researcherId || null,
      startedAt: new Date(),
      triggeredBy: triggeredBy || 'system',
      logs: JSON.stringify([]),
    },
  });

  try {
    if (!SYNCABLE_SOURCES.includes(source as (typeof SYNCABLE_SOURCES)[number])) {
      throw new Error(`${source} does not have automatic ingestion wired into the platform.`);
    }

    const researchers = await getResearchersForSync(researcherId);
    if (researchers.length === 0) {
      throw new Error('No active researchers available for sync.');
    }

    let recordsFound = 0;
    let recordsCreated = 0;
    let recordsUpdated = 0;
    const errors: string[] = [];

    for (const researcher of researchers) {
      try {
        const candidates = await fetchCandidatesForSource(source, researcher);
        recordsFound += candidates.length;

        for (const candidate of candidates) {
          const result = await persistCandidate(researcher, candidate);
          recordsCreated += result.created;
          recordsUpdated += result.updated;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown sync error';
        errors.push(`${researcher.canonicalName}: ${message}`);
      }
    }

    const status =
      errors.length === 0 ? 'COMPLETED' : recordsFound > 0 || recordsCreated > 0 || recordsUpdated > 0 ? 'PARTIAL' : 'FAILED';

    return prisma.syncJob.update({
      where: { id: job.id },
      data: {
        status,
        completedAt: new Date(),
        recordsFound,
        recordsCreated,
        recordsUpdated,
        errorMessage: errors.length > 0 ? errors.join(' | ').slice(0, 1000) : null,
        logs: JSON.stringify(errors),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown sync failure';
    return prisma.syncJob.update({
      where: { id: job.id },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        errorMessage: message,
        logs: JSON.stringify([message]),
      },
    });
  }
}
