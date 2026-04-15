const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function inferStatus(publication) {
  if (publication.verifiedStatus && publication.verifiedStatus !== 'UNVERIFIED') {
    return publication.verifiedStatus;
  }

  const activeMatches = publication.matches.filter(match => !match.manuallyExcluded);
  if (activeMatches.length === 0) {
    return 'UNVERIFIED';
  }

  const hasManualOrOrcid = activeMatches.some(
    match => match.manuallyConfirmed || match.matchType === 'ORCID_MATCH' || match.matchType === 'MANUAL_ASSIGNMENT',
  );
  if (hasManualOrOrcid) {
    return 'VERIFIED';
  }

  const hasStrongAuthorMatch = activeMatches.some(match =>
    ['EXACT_NAME_MATCH', 'ALIAS_MATCH', 'INITIALS_MATCH', 'TRUSTED_SOURCE_ENRICHMENT'].includes(match.matchType),
  );

  if (!hasStrongAuthorMatch) {
    return 'UNVERIFIED';
  }

  const supportingSources = new Set([
    publication.sourcePrimary,
    ...publication.sourceRecords.map(record => record.source),
  ].filter(Boolean));

  const hasStructuredIdentifier = Boolean(publication.doi || publication.pubmedId);
  const hasNonScholarSupport = Array.from(supportingSources).some(source => source !== 'GOOGLE_SCHOLAR');

  if (hasStructuredIdentifier || hasNonScholarSupport) {
    return 'VERIFIED';
  }

  return 'NEEDS_REVIEW';
}

async function main() {
  const apply = process.argv.includes('--apply');

  const publications = await prisma.publication.findMany({
    select: {
      id: true,
      title: true,
      verifiedStatus: true,
      sourcePrimary: true,
      doi: true,
      pubmedId: true,
      sourceRecords: {
        select: { source: true },
      },
      matches: {
        select: {
          matchType: true,
          manuallyConfirmed: true,
          manuallyExcluded: true,
        },
      },
    },
    orderBy: { title: 'asc' },
  });

  const updates = publications
    .map(publication => ({
      id: publication.id,
      title: publication.title,
      current: publication.verifiedStatus,
      next: inferStatus(publication),
    }))
    .filter(row => row.current !== row.next);

  console.log(`Found ${updates.length} publication status updates.`);

  if (!apply || updates.length === 0) {
    for (const row of updates.slice(0, 20)) {
      console.log(`${row.current} -> ${row.next} | ${row.title}`);
    }
    return;
  }

  for (const row of updates) {
    await prisma.publication.update({
      where: { id: row.id },
      data: { verifiedStatus: row.next },
    });
  }

  const summary = updates.reduce((acc, row) => {
    const key = `${row.current}->${row.next}`;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  console.log('Applied publication status updates.');
  for (const [transition, count] of Object.entries(summary)) {
    console.log(`${transition}: ${count}`);
  }
}

main()
  .catch(error => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
