import { prisma } from '@/lib/prisma';
import {
  normalizeJournalName,
  normalizeName,
  normalizeTitle,
} from '@/lib/services/sync-shared';
import type { PublicationCandidate, ResearcherWithAliases } from '@/lib/services/sync-types';

function mergeStringValue(current: string | null, incoming: string | null) {
  if (!current) return incoming;
  if (!incoming) return current;
  return incoming.length > current.length ? incoming : current;
}

function mergePublicationCandidates(current: PublicationCandidate, incoming: PublicationCandidate): PublicationCandidate {
  const mergedAuthors = Array.from(new Set([...current.authorNames, ...incoming.authorNames].filter(Boolean)));
  const mergedExternalIds = Array.from(
    new Set(
      [
        ...(current.alternateExternalIds || []),
        ...(incoming.alternateExternalIds || []),
        current.externalId,
        incoming.externalId,
      ].filter(Boolean) as string[],
    ),
  );
  const primaryExternalId = current.externalId || incoming.externalId || null;

  return {
    ...current,
    externalId: primaryExternalId,
    alternateExternalIds: mergedExternalIds.filter(id => id !== primaryExternalId),
    doi: current.doi || incoming.doi,
    pubmedId: current.pubmedId || incoming.pubmedId,
    title: mergeStringValue(current.title, incoming.title) || current.title,
    journalName: mergeStringValue(current.journalName, incoming.journalName),
    abstract: mergeStringValue(current.abstract, incoming.abstract),
    publicationDate: current.publicationDate || incoming.publicationDate,
    publicationYear: current.publicationYear || incoming.publicationYear,
    authorNames: mergedAuthors,
    citationCount:
      current.citationCount == null
        ? incoming.citationCount
        : incoming.citationCount == null
          ? current.citationCount
          : Math.max(current.citationCount, incoming.citationCount),
  };
}

function buildCandidateKeys(candidate: PublicationCandidate) {
  const normalizedTitle = normalizeTitle(candidate.title);
  const normalizedJournal = normalizeJournalName(candidate.journalName);
  const keys = new Set<string>();

  if (candidate.doi) keys.add(`doi:${candidate.doi}`);
  if (candidate.pubmedId) keys.add(`pmid:${candidate.pubmedId}`);
  if (candidate.externalId) keys.add(`source:${candidate.source}:${candidate.externalId}`);
  for (const externalId of candidate.alternateExternalIds || []) {
    if (externalId) keys.add(`source:${candidate.source}:${externalId}`);
  }
  if (normalizedTitle) {
    if (candidate.publicationYear) keys.add(`title-year:${normalizedTitle}:${candidate.publicationYear}`);
    if (normalizedJournal) keys.add(`title-journal:${normalizedTitle}:${normalizedJournal}`);
  }

  return Array.from(keys);
}

export function dedupeCandidates(candidates: PublicationCandidate[]) {
  const deduped = new Map<string, PublicationCandidate>();
  const canonicalByKey = new Map<string, string>();

  for (const candidate of candidates) {
    const keys = buildCandidateKeys(candidate);
    const matchedKey = keys.find(key => canonicalByKey.has(key));

    if (matchedKey) {
      const canonicalKey = canonicalByKey.get(matchedKey)!;
      const merged = mergePublicationCandidates(deduped.get(canonicalKey)!, candidate);
      deduped.set(canonicalKey, merged);
      for (const key of buildCandidateKeys(merged)) canonicalByKey.set(key, canonicalKey);
      continue;
    }

    const canonicalKey = keys[0] || `row:${deduped.size + 1}`;
    deduped.set(canonicalKey, candidate);
    for (const key of keys) canonicalByKey.set(key, canonicalKey);
  }

  return Array.from(deduped.values());
}

function countAuthorOverlap(candidateAuthors: string[], publicationAuthors: Array<{ authorName: string }>) {
  const candidateSet = new Set(candidateAuthors.map(author => normalizeName(author)).filter(Boolean));
  const publicationSet = new Set(publicationAuthors.map(author => normalizeName(author.authorName)).filter(Boolean));

  if (candidateSet.size === 0 || publicationSet.size === 0) {
    return { overlap: 0, ratio: 0 };
  }

  let overlap = 0;
  for (const author of candidateSet) {
    if (publicationSet.has(author)) overlap += 1;
  }

  return {
    overlap,
    ratio: overlap / Math.max(1, Math.min(candidateSet.size, publicationSet.size)),
  };
}

export async function findExistingPublication(
  researcher: ResearcherWithAliases,
  candidate: PublicationCandidate,
  normalizedTitle: string,
) {
  if (candidate.doi) {
    const byDoi = await prisma.publication.findUnique({ where: { doi: candidate.doi } });
    if (byDoi) return byDoi;
  }

  if (candidate.pubmedId) {
    const byPubmedId = await prisma.publication.findUnique({ where: { pubmedId: candidate.pubmedId } });
    if (byPubmedId) return byPubmedId;
  }

  const externalIds = Array.from(
    new Set([candidate.externalId, ...(candidate.alternateExternalIds || [])].filter(Boolean) as string[]),
  );

  if (externalIds.length > 0) {
    const sourceRecord = await prisma.sourceRecord.findFirst({
      where: {
        source: candidate.source,
        externalId: { in: externalIds },
        publicationId: { not: null },
      },
      include: {
        publication: true,
      },
    });

    if (sourceRecord?.publication) return sourceRecord.publication;
  }

  const matchedPublication = await prisma.publicationResearcherMatch.findFirst({
    where: {
      researcherId: researcher.id,
      publication: { normalizedTitle },
    },
    include: {
      publication: true,
    },
    orderBy: {
      publication: { updatedAt: 'desc' },
    },
  });

  if (matchedPublication?.publication) return matchedPublication.publication;

  const sameTitlePublications = await prisma.publication.findMany({
    where: { normalizedTitle },
    include: {
      authors: { select: { authorName: true } },
      sourceRecords: { select: { source: true, externalId: true } },
    },
    orderBy: [
      { updatedAt: 'desc' },
      { createdAt: 'desc' },
    ],
    take: 10,
  });

  const normalizedJournal = normalizeJournalName(candidate.journalName);
  let bestMatch: (typeof sameTitlePublications)[number] | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  let secondBestScore = Number.NEGATIVE_INFINITY;

  for (const publication of sameTitlePublications) {
    let score = 6;

    if (candidate.publicationYear != null && publication.publicationYear != null) {
      const diff = Math.abs(publication.publicationYear - candidate.publicationYear);
      if (diff === 0) score += 12;
      else if (diff === 1) score += 8;
      else if (diff === 2) score += 4;
      else score -= 12;
    }

    if (normalizedJournal && publication.journalName) {
      if (normalizeJournalName(publication.journalName) === normalizedJournal) score += 8;
      else score -= 2;
    }

    const { overlap, ratio } = countAuthorOverlap(candidate.authorNames, publication.authors);
    if (overlap >= 2 || ratio >= 0.6) score += 12;
    else if (overlap === 1) score += 5;
    else if (candidate.authorNames.length > 0 && publication.authors.length > 0) score -= 8;

    if (candidate.source === publication.sourcePrimary) score += 1;

    const sourceRecordHit = publication.sourceRecords.some(
      record => record.source === candidate.source && record.externalId && externalIds.includes(record.externalId),
    );
    if (sourceRecordHit) score += 80;

    if (score > bestScore) {
      secondBestScore = bestScore;
      bestScore = score;
      bestMatch = publication;
    } else if (score > secondBestScore) {
      secondBestScore = score;
    }
  }

  if (bestMatch && (bestScore >= 18 || (bestScore >= 12 && bestScore - secondBestScore >= 3))) {
    return bestMatch;
  }

  return null;
}
