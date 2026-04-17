export type ResearcherAffiliationContext = {
  canonicalName: string;
  sluStartDate?: Date | null;
  aliases?: Array<{ aliasName: string }>;
  identifiers?: Array<{ identifierType: string; value: string }>;
};

export type CandidateAuthorAffiliation = {
  authorName: string;
  affiliations: string[];
};

export type SourceAffiliationEvidence = {
  source: string;
  authorAffiliations: CandidateAuthorAffiliation[];
};

export type SluInclusionDecision = {
  includedInSluOutput: boolean;
  reason: string | null;
  mode: 'AFFILIATION_MATCH' | 'AFFILIATION_MISMATCH' | 'TENURE_FALLBACK';
};

function normalizeAuthorAffiliations(authorAffiliations: unknown): CandidateAuthorAffiliation[] {
  if (!Array.isArray(authorAffiliations)) return [];

  return authorAffiliations
    .map(item => {
      const authorName = normalizeWhitespace(typeof item?.authorName === 'string' ? item.authorName : '');
      const affiliations = Array.isArray(item?.affiliations)
        ? item.affiliations
          .map(affiliation => normalizeWhitespace(typeof affiliation === 'string' ? affiliation : ''))
          .filter(Boolean)
        : [];

      return {
        authorName,
        affiliations: Array.from(new Set(affiliations)),
      };
    })
    .filter(item => item.authorName && item.affiliations.length > 0);
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeName(value: string) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '');
}

function tokenizeName(value: string) {
  return normalizeName(value).split(' ').filter(Boolean);
}

function buildNameSignatures(value: string) {
  const tokens = tokenizeName(value);
  const signatures = new Set<string>();

  if (tokens.length === 0) {
    return signatures;
  }

  signatures.add(`full:${tokens.join(' ')}`);

  if (tokens.length < 2) {
    return signatures;
  }

  const orientations = [
    { given: tokens[0], surname: tokens[tokens.length - 1], middles: tokens.slice(1, -1) },
    { given: tokens[tokens.length - 1], surname: tokens[0], middles: tokens.slice(1, -1) },
  ];

  for (const orientation of orientations) {
    const initials = [orientation.given, ...orientation.middles].map(token => token[0]).join('');
    signatures.add(`given-surname:${orientation.given}|${orientation.surname}`);
    signatures.add(`given-initial-surname:${orientation.given[0]}|${orientation.surname}`);
    signatures.add(`given-surname-initial:${orientation.given}|${orientation.surname[0]}`);
    signatures.add(`initials-surname:${initials}|${orientation.surname}`);
  }

  return signatures;
}

function buildResearcherNameCatalog(researcher: ResearcherAffiliationContext) {
  const canonicalExact = new Set<string>();
  const aliasExact = new Set<string>();
  const canonicalSignatures = new Set<string>();
  const aliasSignatures = new Set<string>();

  const canonical = normalizeName(researcher.canonicalName);
  if (canonical) canonicalExact.add(canonical);
  for (const signature of buildNameSignatures(researcher.canonicalName)) canonicalSignatures.add(signature);

  for (const alias of researcher.aliases || []) {
    const normalized = normalizeName(alias.aliasName);
    if (normalized) aliasExact.add(normalized);
    for (const signature of buildNameSignatures(alias.aliasName)) aliasSignatures.add(signature);
  }

  return {
    canonicalExact,
    aliasExact,
    canonicalSignatures,
    aliasSignatures,
  };
}

function authorNameMatchesResearcher(researcher: ResearcherAffiliationContext, authorName: string) {
  const normalizedAuthor = normalizeName(authorName);
  if (!normalizedAuthor) return false;

  const catalog = buildResearcherNameCatalog(researcher);
  if (catalog.canonicalExact.has(normalizedAuthor)) return true;
  if (catalog.aliasExact.has(normalizedAuthor)) return true;

  const authorSignatures = buildNameSignatures(authorName);
  if (Array.from(authorSignatures).some(signature => catalog.canonicalSignatures.has(signature))) return true;
  if (Array.from(authorSignatures).some(signature => catalog.aliasSignatures.has(signature))) return true;

  return false;
}

export function normalizeInstitutionKeyword(value: string) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getExpectedInstitutionKeywords(researcher: Pick<ResearcherAffiliationContext, 'identifiers'>) {
  const configuredKeywords = (researcher.identifiers || [])
    .filter(identifier => ['SCHOLAR_AFFILIATION_KEYWORD', 'AFFILIATION_KEYWORD'].includes(identifier.identifierType.toUpperCase()))
    .map(identifier => normalizeInstitutionKeyword(identifier.value))
    .filter(Boolean);

  return Array.from(new Set([
    ...configuredKeywords,
    'saint louis university',
    'saint louis univ',
    'st louis university',
    'st louis univ',
    'st. louis university',
    'health slu edu',
    'slu edu',
  ]));
}

export function institutionTextMatchesExpectedKeywords(text: string, keywords: string[]) {
  const normalized = normalizeInstitutionKeyword(text);
  if (!normalized) return false;
  return keywords.some(keyword => normalized.includes(normalizeInstitutionKeyword(keyword)));
}

function buildFallbackPublicationDate(publicationYear?: number | null) {
  if (!publicationYear) return null;
  return new Date(Date.UTC(publicationYear, 0, 1));
}

export function determineSluInclusion(args: {
  researcher: ResearcherAffiliationContext;
  publicationDate?: Date | null;
  publicationYear?: number | null;
  evidenceSources?: SourceAffiliationEvidence[];
}) {
  const { researcher, publicationDate = null, publicationYear = null, evidenceSources = [] } = args;
  const expectedKeywords = getExpectedInstitutionKeywords(researcher);

  const matchedAuthorAffiliations: Array<{ source: string; affiliation: string }> = [];
  const nonMatchingAuthorAffiliations: Array<{ source: string; affiliation: string }> = [];

  for (const evidence of evidenceSources) {
    for (const item of evidence.authorAffiliations || []) {
      if (!authorNameMatchesResearcher(researcher, item.authorName)) continue;

      for (const affiliation of item.affiliations || []) {
        const normalizedAffiliation = normalizeWhitespace(affiliation);
        if (!normalizedAffiliation) continue;

        if (institutionTextMatchesExpectedKeywords(normalizedAffiliation, expectedKeywords)) {
          matchedAuthorAffiliations.push({ source: evidence.source, affiliation: normalizedAffiliation });
        } else {
          nonMatchingAuthorAffiliations.push({ source: evidence.source, affiliation: normalizedAffiliation });
        }
      }
    }
  }

  if (matchedAuthorAffiliations.length > 0) {
    const best = matchedAuthorAffiliations[0];
    return {
      includedInSluOutput: true,
      reason: `Matched Saint Louis University affiliation from ${best.source}: ${best.affiliation}`,
      mode: 'AFFILIATION_MATCH' as const,
    };
  }

  if (nonMatchingAuthorAffiliations.length > 0) {
    const best = nonMatchingAuthorAffiliations[0];
    return {
      includedInSluOutput: false,
      reason: `Matched author affiliation from ${best.source} did not indicate Saint Louis University: ${best.affiliation}`,
      mode: 'AFFILIATION_MISMATCH' as const,
    };
  }

  const effectivePublicationDate = publicationDate || buildFallbackPublicationDate(publicationYear);
  if (!researcher.sluStartDate) {
    return {
      includedInSluOutput: true,
      reason: 'No SLU start date set and no affiliation evidence available',
      mode: 'TENURE_FALLBACK' as const,
    };
  }

  if (!effectivePublicationDate) {
    return {
      includedInSluOutput: true,
      reason: 'No publication date and no affiliation evidence available',
      mode: 'TENURE_FALLBACK' as const,
    };
  }

  if (effectivePublicationDate >= researcher.sluStartDate) {
    return {
      includedInSluOutput: true,
      reason: 'No affiliation evidence available; included by SLU tenure date',
      mode: 'TENURE_FALLBACK' as const,
    };
  }

  return {
    includedInSluOutput: false,
    reason: `No affiliation evidence available; published before SLU start date (${researcher.sluStartDate.toISOString().split('T')[0]})`,
    mode: 'TENURE_FALLBACK' as const,
  };
}

export function extractSourceAffiliationEvidence(
  sourceRecords: Array<{ source: string; rawData: string | null | undefined }>,
) {
  const evidence: SourceAffiliationEvidence[] = [];

  for (const record of sourceRecords) {
    if (!record.rawData) continue;

    try {
      const parsed = JSON.parse(record.rawData);
      const authorAffiliations = normalizeAuthorAffiliations(parsed?.authorAffiliations);
      if (authorAffiliations.length === 0) continue;

      evidence.push({
        source: record.source,
        authorAffiliations,
      });
    } catch {
      continue;
    }
  }

  return evidence;
}
