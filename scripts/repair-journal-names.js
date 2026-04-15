const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const applyChanges = process.argv.includes('--apply');

function normalizeWhitespace(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function getJournalSourcePriority(source) {
  const priorities = {
    MANUAL: 100,
    ORCID: 60,
    PUBMED: 55,
    CROSSREF: 50,
    OPENALEX: 45,
    EUROPE_PMC: 40,
    GOOGLE_SCHOLAR: 10,
    RESEARCHGATE: 5,
  };

  return priorities[source || ''] || 0;
}

function looksLikePublisherOrHostSegment(value) {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return false;

  if (/\b[a-z0-9-]+\.[a-z]{2,}\b/i.test(normalized)) return true;

  const knownPublishers = new Set([
    'elsevier',
    'jstor',
    'springer',
    'wiley online library',
    'sage publications',
    'taylor & francis',
    'oxford academic',
  ]);

  return knownPublishers.has(normalized.toLowerCase());
}

function sanitizeJournalName(value, source) {
  if (!value) return null;

  let sanitized = normalizeWhitespace(value)
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\s*\|\s*.*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!sanitized) return null;

  if (source === 'GOOGLE_SCHOLAR' && sanitized.includes(' - ')) {
    const segments = sanitized.split(/\s+-\s+/);
    while (segments.length > 1 && looksLikePublisherOrHostSegment(segments[segments.length - 1] || '')) {
      segments.pop();
    }
    sanitized = segments.join(' - ').trim();
  }

  sanitized = sanitized.replace(/\s+-\s+[a-z0-9-]+\.[a-z]{2,}.*$/i, '').trim();

  let previousValue = '';
  while (sanitized && sanitized !== previousValue) {
    previousValue = sanitized;
    sanitized = sanitized
      .replace(/\s+\d+\s*\([^)]*\)\s*,?\s*[^,]+,\s*$/i, '')
      .replace(/\s+\d+(?:\s*\([^)]*\))+\s*,?\s*$/i, '')
      .replace(/\s*\(\d+\)\s*$/i, '')
      .replace(/,\s*[A-Za-z]?[A-Za-z0-9_.-]*\d[A-Za-z0-9_.-]*\s*,?\s*$/i, '')
      .replace(/\s+\d+\s*,?\s*$/i, '')
      .replace(/[,:;|\-]+$/g, '')
      .trim();
  }

  if (!sanitized) return null;
  if (sanitized.includes('\u2026') || sanitized.includes('...')) return null;
  if (/\b[a-z0-9-]+\.[a-z]{2,}\b/i.test(sanitized)) return null;
  if (!/[A-Za-z]{3}/.test(sanitized)) return null;

  return sanitized;
}

function journalNameQualityScore(value, source) {
  const sanitized = sanitizeJournalName(value, source);
  if (!sanitized) return Number.NEGATIVE_INFINITY;

  let score = getJournalSourcePriority(source) * 100;
  score += Math.min(sanitized.length, 80);

  const trimmed = normalizeWhitespace(value || '');
  if (trimmed === sanitized) score += 15;
  if (/\bjournal\b/i.test(sanitized)) score += 5;

  return score;
}

function selectPreferredJournalName(candidates) {
  let bestValue = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const candidate of candidates) {
    const sanitized = sanitizeJournalName(candidate.journalName, candidate.source);
    const score = journalNameQualityScore(candidate.journalName, candidate.source);
    if (!sanitized) continue;

    if (score > bestScore) {
      bestScore = score;
      bestValue = sanitized;
    }
  }

  return bestValue;
}

function parseSourceRecordCandidate(record) {
  try {
    const raw = JSON.parse(record.rawData);
    return {
      source: raw?.source || record.source,
      journalName: typeof raw?.journalName === 'string' ? raw.journalName : null,
    };
  } catch {
    return {
      source: record.source,
      journalName: null,
    };
  }
}

async function main() {
  const publications = await prisma.publication.findMany({
    select: {
      id: true,
      title: true,
      journalName: true,
      sourcePrimary: true,
      sourceRecords: {
        select: {
          source: true,
          rawData: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  const repairs = [];

  for (const publication of publications) {
    const nextJournalName = selectPreferredJournalName([
      {
        journalName: publication.journalName,
        source: publication.sourcePrimary,
      },
      ...publication.sourceRecords.map(parseSourceRecordCandidate),
    ]);

    if (nextJournalName !== publication.journalName) {
      repairs.push({
        id: publication.id,
        title: publication.title,
        previousJournalName: publication.journalName,
        nextJournalName,
      });
    }
  }

  console.log(`Found ${repairs.length} publication journal names to repair.`);
  for (const repair of repairs.slice(0, 25)) {
    console.log({
      id: repair.id,
      title: repair.title,
      previousJournalName: repair.previousJournalName,
      nextJournalName: repair.nextJournalName,
    });
  }

  if (!applyChanges) return;

  for (const repair of repairs) {
    await prisma.publication.update({
      where: { id: repair.id },
      data: { journalName: repair.nextJournalName },
    });
  }

  console.log(`Applied ${repairs.length} journal-name repairs.`);
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
