const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const applyChanges = process.argv.includes('--apply');
const AUTO_EXCLUSION_REASON = 'AUTO_EXCLUDED_NO_AUTHOR_HIT';

function normalizeName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizeName(value) {
  const normalized = normalizeName(value);
  if (!normalized) return [];
  return normalized.split(' ').filter(Boolean);
}

function buildNameSignatures(value) {
  const tokens = tokenizeName(value);
  const signatures = new Set();

  if (tokens.length === 0) {
    return signatures;
  }

  signatures.add(`full:${tokens.join(' ')}`);

  if (tokens.length < 2) {
    return signatures;
  }

  const surname = tokens[tokens.length - 1];
  const givenNames = tokens.slice(0, -1);
  const firstName = givenNames[0];
  const initials = givenNames.map(token => token[0]).join('');

  signatures.add(`surname:${surname}|first:${firstName}`);
  signatures.add(`surname:${surname}|first-initial:${firstName[0]}`);
  signatures.add(`surname:${surname}|initials:${initials}`);

  if (givenNames.length > 1) {
    signatures.add(`surname:${surname}|first:${firstName}|second:${givenNames[1]}`);
    signatures.add(`surname:${surname}|first-initials:${givenNames.slice(0, 2).map(token => token[0]).join('')}`);
  }

  return signatures;
}

function hasAuthorHit(researcherNames, publicationAuthors) {
  const allowedSignatures = new Set();
  for (const name of researcherNames) {
    for (const signature of buildNameSignatures(name)) {
      allowedSignatures.add(signature);
    }
  }

  if (allowedSignatures.size === 0) {
    return false;
  }

  for (const author of publicationAuthors) {
    for (const signature of buildNameSignatures(author.authorName)) {
      if (allowedSignatures.has(signature)) {
        return true;
      }
    }
  }

  return false;
}

async function main() {
  const matches = await prisma.publicationResearcherMatch.findMany({
    where: {
      manuallyExcluded: false,
      manuallyConfirmed: false,
      matchType: 'GOOGLE_SCHOLAR_PROFILE_MATCH',
      publication: {
        sourcePrimary: 'GOOGLE_SCHOLAR',
      },
    },
    include: {
      publication: {
        select: {
          id: true,
          title: true,
          publicationYear: true,
          citations: {
            orderBy: [
              { capturedAt: 'desc' },
              { id: 'desc' },
            ],
            take: 1,
            select: { citationCount: true },
          },
          authors: {
            orderBy: { authorOrder: 'asc' },
            select: { authorName: true },
          },
        },
      },
      researcher: {
        select: {
          id: true,
          canonicalName: true,
          aliases: {
            select: { aliasName: true },
          },
        },
      },
    },
    orderBy: [
      { researcherId: 'asc' },
      { publicationId: 'asc' },
    ],
  });

  const questionableMatches = matches.filter(match => {
    const researcherNames = [
      match.researcher.canonicalName,
      ...match.researcher.aliases.map(alias => alias.aliasName),
    ];

    return !hasAuthorHit(researcherNames, match.publication.authors);
  });

  const summaryByResearcher = new Map();
  for (const match of questionableMatches) {
    const existing = summaryByResearcher.get(match.researcher.canonicalName) || {
      matches: 0,
      citations: 0,
    };

    existing.matches += 1;
    existing.citations += match.publication.citations[0]?.citationCount ?? 0;
    summaryByResearcher.set(match.researcher.canonicalName, existing);
  }

  console.log(`Found ${questionableMatches.length} questionable Google Scholar profile matches.`);
  for (const [researcher, summary] of Array.from(summaryByResearcher.entries()).sort((left, right) => (
    right[1].matches - left[1].matches || left[0].localeCompare(right[0])
  ))) {
    console.log(`${researcher}: ${summary.matches} matches, ${summary.citations} citations`);
  }

  for (const match of questionableMatches.slice(0, 25)) {
    console.log({
      researcher: match.researcher.canonicalName,
      title: match.publication.title,
      year: match.publication.publicationYear,
      citations: match.publication.citations[0]?.citationCount ?? null,
      authors: match.publication.authors.map(author => author.authorName),
    });
  }

  if (!applyChanges) {
    return;
  }

  for (const match of questionableMatches) {
    await prisma.publicationResearcherMatch.update({
      where: { id: match.id },
      data: {
        manuallyExcluded: true,
        exclusionReason: AUTO_EXCLUSION_REASON,
      },
    });
  }

  console.log(`Excluded ${questionableMatches.length} questionable Google Scholar profile matches.`);
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
