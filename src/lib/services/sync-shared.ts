import type { AuthorMatch, ResearcherWithAliases, SyncSource } from '@/lib/services/sync-types';

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
  } else if (host.includes('api.openalex.org')) {
    minIntervalMs = 120;
  } else if (host.includes('europepmc.org') || host.includes('ebi.ac.uk')) {
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

export function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

export function normalizeName(value: string) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '');
}

export function normalizeTitle(value: string) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '');
}

export function normalizeJournalName(value: string | null | undefined) {
  if (!value) return null;
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '');
}

export function normalizeDoi(value: string | null | undefined) {
  if (!value) return null;
  return value
    .trim()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')
    .replace(/^doi:/i, '')
    .toLowerCase();
}

export function normalizeOrcid(value: string | null | undefined) {
  if (!value) return null;
  return value
    .trim()
    .replace(/^https?:\/\/orcid\.org\//i, '')
    .replace(/^orcid\.org\//i, '')
    .toUpperCase();
}

export function normalizePubmedId(value: string | null | undefined) {
  if (!value) return null;
  const match = value.trim().match(/\d+/);
  return match?.[0] ?? null;
}

export function normalizePmcid(value: string | null | undefined) {
  if (!value) return null;
  const compact = value.trim().toUpperCase().replace(/^PMC/, '');
  return compact ? `PMC${compact}` : null;
}

export function normalizeOpenAlexId(value: string | null | undefined) {
  if (!value) return null;
  return value
    .trim()
    .replace(/^https?:\/\/openalex\.org\//i, '')
    .toUpperCase();
}

export function buildDate(year?: number | null, month?: number | null, day?: number | null) {
  if (!year) return null;
  return new Date(Date.UTC(year, (month || 1) - 1, day || 1));
}

export function parseLooseDate(value: string | undefined) {
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

export function extractPubmedId(articleIds: Array<{ idtype?: string; value?: string }> | undefined) {
  return normalizePubmedId(articleIds?.find(id => id.idtype === 'pubmed')?.value ?? null);
}

export function extractDoi(articleIds: Array<{ idtype?: string; value?: string }> | undefined) {
  return normalizeDoi(articleIds?.find(id => id.idtype === 'doi')?.value ?? null);
}

export function getResearcherSearchNames(researcher: ResearcherWithAliases) {
  const names = new Set<string>([researcher.canonicalName]);
  for (const alias of researcher.aliases) names.add(alias.aliasName);
  return Array.from(names).filter(Boolean).slice(0, 5);
}

export function getResearcherIdentifier(researcher: ResearcherWithAliases, identifierTypes: string[]) {
  const normalizedTypes = new Set(identifierTypes.map(type => type.toUpperCase()));
  return (
    researcher.identifiers.find(identifier => normalizedTypes.has(identifier.identifierType.toUpperCase()))?.value?.trim() || null
  );
}

export function getResearcherOrcid(researcher: ResearcherWithAliases) {
  return normalizeOrcid(researcher.orcid) || normalizeOrcid(getResearcherIdentifier(researcher, ['ORCID']));
}

export function splitAuthorList(rawValue: string | null | undefined) {
  if (!rawValue) return [];

  const normalized = normalizeWhitespace(rawValue.replace(/\s+and\s+/gi, '; '));
  const parts = normalized.includes(';')
    ? normalized.split(/\s*;\s*/)
    : normalized.split(/\s*,\s*/);

  return Array.from(
    new Set(
      parts
        .map(part => part.trim().replace(/\.$/, ''))
        .filter(Boolean),
    ),
  );
}

export function buildOpenAlexAbstract(abstractIndex: Record<string, number[]> | null | undefined) {
  if (!abstractIndex || typeof abstractIndex !== 'object') return null;

  const words: string[] = [];
  for (const [word, positions] of Object.entries(abstractIndex)) {
    for (const position of positions || []) {
      if (typeof position === 'number' && position >= 0) {
        words[position] = word;
      }
    }
  }

  const abstract = words.filter(Boolean).join(' ').trim();
  return abstract || null;
}

export function resolveAuthorMatch(researcher: ResearcherWithAliases, authorNames: string[], source: SyncSource): AuthorMatch | null {
  if (source === 'ORCID' && getResearcherOrcid(researcher)) {
    return { matchType: 'ORCID_MATCH', confidence: 1.0 };
  }

  const canonical = normalizeName(researcher.canonicalName);
  const aliases = new Set(researcher.aliases.map(alias => normalizeName(alias.aliasName)));

  for (const authorName of authorNames) {
    const normalizedAuthor = normalizeName(authorName);
    if (!normalizedAuthor) continue;

    if (normalizedAuthor === canonical) {
      return { matchType: 'EXACT_NAME_MATCH', confidence: 0.98 };
    }

    if (aliases.has(normalizedAuthor)) {
      return { matchType: 'ALIAS_MATCH', confidence: 0.92 };
    }
  }

  return null;
}

export async function fetchJson<T>(url: string, init?: RequestInit) {
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
