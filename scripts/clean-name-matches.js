const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const applyChanges = process.argv.includes('--apply');

function normalizeName(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '');
}

function buildAllowedNameMap(researchers) {
  return new Map(
    researchers.map(researcher => [
      researcher.id,
      new Set(
        [researcher.canonicalName, ...researcher.aliases.map(alias => alias.aliasName)]
          .map(normalizeName)
          .filter(Boolean)
      ),
    ])
  );
}

function matchAllowedAuthors(publicationAuthors, allowedNames) {
  return publicationAuthors.some(author => allowedNames.has(normalizeName(author.authorName)));
}

function classifyMatch(publicationAuthors, researcher) {
  const canonicalName = normalizeName(researcher.canonicalName);
  const aliasNames = new Set(researcher.aliases.map(alias => normalizeName(alias.aliasName)));

  for (const author of publicationAuthors) {
    const normalizedAuthor = normalizeName(author.authorName);
    if (!normalizedAuthor) continue;

    if (normalizedAuthor === canonicalName) {
      return { matchType: 'EXACT_NAME_MATCH', matchConfidence: 0.98 };
    }

    if (aliasNames.has(normalizedAuthor)) {
      return { matchType: 'ALIAS_MATCH', matchConfidence: 0.92 };
    }
  }

  return null;
}

async function main() {
  const [researchers, matches] = await Promise.all([
    prisma.researcher.findMany({
      select: {
        id: true,
        canonicalName: true,
        aliases: { select: { aliasName: true } },
      },
    }),
    prisma.publicationResearcherMatch.findMany({
      where: { manuallyExcluded: false },
      include: {
        publication: {
          select: {
            id: true,
            title: true,
            sourcePrimary: true,
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
            aliases: { select: { aliasName: true } },
          },
        },
      },
    }),
  ]);

  const allowedNameMap = buildAllowedNameMap(researchers);
  const matchesToRemove = matches.filter(match => {
    if (match.matchType === 'MANUAL_ASSIGNMENT') {
      return false;
    }

    const allowedNames = allowedNameMap.get(match.researcherId);
    if (!allowedNames || match.publication.authors.length === 0) {
      return true;
    }

    return !matchAllowedAuthors(match.publication.authors, allowedNames);
  });

  const affectedPublicationIds = Array.from(new Set(matchesToRemove.map(match => match.publicationId)));

  console.log(`Found ${matchesToRemove.length} mismatched researcher-publication links.`);

  for (const match of matchesToRemove.slice(0, 25)) {
    console.log({
      researcher: match.researcher.canonicalName,
      matchType: match.matchType,
      publication: match.publication.title,
      source: match.publication.sourcePrimary,
      authors: match.publication.authors.map(author => author.authorName),
    });
  }

  if (!applyChanges) {
    return;
  }

  if (matchesToRemove.length > 0) {
    await prisma.publicationResearcherMatch.deleteMany({
      where: { id: { in: matchesToRemove.map(match => match.id) } },
    });
  }

  const matchesToNormalize = matches
    .filter(match => !matchesToRemove.some(candidate => candidate.id === match.id))
    .filter(match => !['MANUAL_ASSIGNMENT', 'ORCID_MATCH'].includes(match.matchType))
    .map(match => ({
      id: match.id,
      next: classifyMatch(match.publication.authors, match.researcher),
    }))
    .filter(entry =>
      entry.next &&
      (entry.next.matchType !== matches.find(match => match.id === entry.id)?.matchType ||
        entry.next.matchConfidence !== matches.find(match => match.id === entry.id)?.matchConfidence)
    );

  for (const entry of matchesToNormalize) {
    await prisma.publicationResearcherMatch.update({
      where: { id: entry.id },
      data: entry.next,
    });
  }

  const orphanCandidates = affectedPublicationIds.length > 0
    ? await prisma.publication.findMany({
        where: {
          id: { in: affectedPublicationIds },
          sourcePrimary: { not: 'MANUAL' },
        },
        include: {
          matches: {
            where: { manuallyExcluded: false },
            select: { id: true },
          },
        },
      })
    : [];

  const orphanIds = orphanCandidates
    .filter(publication => publication.matches.length === 0)
    .map(publication => publication.id);

  if (orphanIds.length > 0) {
    await prisma.publication.deleteMany({
      where: { id: { in: orphanIds } },
    });
  }

  console.log(`Removed ${matchesToRemove.length} mismatched links.`);
  console.log(`Normalized ${matchesToNormalize.length} surviving match labels.`);
  console.log(`Deleted ${orphanIds.length} orphaned auto-imported publications.`);
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
