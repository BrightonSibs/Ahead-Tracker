const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const applyChanges = process.argv.includes('--apply');

function normalizeWhitespace(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeTitle(value) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '');
}

function normalizeJournalName(value) {
  if (!value) return null;
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '');
}

function normalizeAuthorName(value) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '');
}

function publicationScore(publication) {
  return [
    publication.doi ? 20 : 0,
    publication.pubmedId ? 20 : 0,
    publication.publicationDate ? 8 : 0,
    publication.publicationYear ? 4 : 0,
    publication.journalName ? 4 : 0,
    publication.abstract ? 4 : 0,
    publication.sourcePrimary && publication.sourcePrimary !== 'MANUAL' ? 3 : 0,
    publication.authors.length,
    publication.matches.length * 2,
    publication.sourceRecords.length * 2,
    publication.citations.length,
  ].reduce((sum, value) => sum + value, 0);
}

function pickPreferredString(publications, fieldName) {
  return publications
    .map(publication => publication[fieldName])
    .filter(value => typeof value === 'string' && value.trim().length > 0)
    .sort((a, b) => b.length - a.length)[0] || null;
}

function pickPreferredStatus(publications) {
  const priorities = ['VERIFIED', 'NEEDS_REVIEW', 'UNVERIFIED', 'EXCLUDED'];
  for (const status of priorities) {
    if (publications.some(publication => publication.verifiedStatus === status)) {
      return status;
    }
  }
  return 'UNVERIFIED';
}

function uniqueBy(items, getKey) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const key = getKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function haveSharedResearcher(left, right) {
  const researcherIds = new Set(left.matches.map(match => match.researcherId));
  return right.matches.some(match => researcherIds.has(match.researcherId));
}

function haveSharedExternalId(left, right) {
  const leftIds = new Set(
    left.sourceRecords
      .filter(record => record.externalId)
      .map(record => `${record.source}::${record.externalId}`)
  );
  return right.sourceRecords.some(record => record.externalId && leftIds.has(`${record.source}::${record.externalId}`));
}

function countAuthorOverlap(left, right) {
  const leftAuthors = new Set(left.authors.map(author => normalizeAuthorName(author.authorName)).filter(Boolean));
  const rightAuthors = new Set(right.authors.map(author => normalizeAuthorName(author.authorName)).filter(Boolean));

  if (leftAuthors.size === 0 || rightAuthors.size === 0) return 0;

  let overlap = 0;
  for (const author of leftAuthors) {
    if (rightAuthors.has(author)) overlap += 1;
  }
  return overlap;
}

function shouldMerge(left, right) {
  if (haveSharedResearcher(left, right)) return true;
  if (left.doi && right.doi && left.doi === right.doi) return true;
  if (left.pubmedId && right.pubmedId && left.pubmedId === right.pubmedId) return true;
  if (haveSharedExternalId(left, right)) return true;

  if (left.publicationYear && right.publicationYear && left.publicationYear === right.publicationYear) {
    const leftJournal = normalizeJournalName(left.journalName);
    const rightJournal = normalizeJournalName(right.journalName);
    if ((!leftJournal || !rightJournal || leftJournal === rightJournal) && countAuthorOverlap(left, right) > 0) {
      return true;
    }
  }

  return false;
}

function buildComponents(publications) {
  const visited = new Set();
  const components = [];

  for (const publication of publications) {
    if (visited.has(publication.id)) continue;

    const stack = [publication];
    const component = [];
    visited.add(publication.id);

    while (stack.length > 0) {
      const current = stack.pop();
      component.push(current);

      for (const candidate of publications) {
        if (visited.has(candidate.id)) continue;
        if (!shouldMerge(current, candidate)) continue;
        visited.add(candidate.id);
        stack.push(candidate);
      }
    }

    components.push(component);
  }

  return components;
}

function chooseKeeper(publications) {
  return [...publications].sort((left, right) => {
    const scoreDiff = publicationScore(right) - publicationScore(left);
    if (scoreDiff !== 0) return scoreDiff;
    return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
  })[0];
}

function buildMergedPublicationData(publications, keeper) {
  const sorted = [...publications].sort((left, right) => publicationScore(right) - publicationScore(left));
  const title = pickPreferredString(sorted, 'title') || keeper.title;
  const normalizedTitle = normalizeTitle(title);

  return {
    title,
    normalizedTitle,
    doi: sorted.find(publication => publication.doi)?.doi || null,
    pubmedId: sorted.find(publication => publication.pubmedId)?.pubmedId || null,
    publicationDate: sorted.find(publication => publication.publicationDate)?.publicationDate || null,
    publicationYear:
      sorted.find(publication => publication.publicationYear != null)?.publicationYear ??
      (sorted.find(publication => publication.publicationDate)?.publicationDate?.getUTCFullYear() ?? null),
    journalName: pickPreferredString(sorted, 'journalName'),
    abstract: pickPreferredString(sorted, 'abstract'),
    sourcePrimary: sorted.find(publication => publication.sourcePrimary && publication.sourcePrimary !== 'MANUAL')?.sourcePrimary || keeper.sourcePrimary,
    verifiedStatus: pickPreferredStatus(sorted),
    volume: pickPreferredString(sorted, 'volume'),
    issue: pickPreferredString(sorted, 'issue'),
    pages: pickPreferredString(sorted, 'pages'),
  };
}

function buildTenureFields(researcher, publicationDate) {
  const includedInSluOutput =
    !researcher?.sluStartDate || !publicationDate || publicationDate >= researcher.sluStartDate;

  return {
    includedInSluOutput,
    sluTenureNote:
      includedInSluOutput || !researcher?.sluStartDate || !publicationDate
        ? null
        : `Published before researcher's SLU start date (${researcher.sluStartDate.toISOString().split('T')[0]})`,
  };
}

async function mergeComponent(publications) {
  const keeper = chooseKeeper(publications);
  const duplicates = publications.filter(publication => publication.id !== keeper.id);
  if (duplicates.length === 0) {
    return { merged: 0, keeperId: keeper.id };
  }

  const mergedData = buildMergedPublicationData(publications, keeper);

  await prisma.$transaction(async tx => {
    await tx.publication.update({
      where: { id: keeper.id },
      data: mergedData,
    });

    const keeperAuthors = await tx.publicationAuthor.findMany({
      where: { publicationId: keeper.id },
    });
    const keeperAuthorKeys = new Map(
      keeperAuthors.map(author => [`${author.authorOrder}::${author.authorName.toLowerCase()}`, author])
    );

    const keeperMatches = await tx.publicationResearcherMatch.findMany({
      where: { publicationId: keeper.id },
      include: { researcher: { select: { id: true, sluStartDate: true } } },
    });
    const keeperMatchMap = new Map(keeperMatches.map(match => [match.researcherId, match]));

    const keeperCitationKeys = new Set(
      (await tx.citation.findMany({ where: { publicationId: keeper.id } }))
        .map(citation => `${citation.source}::${citation.citationCount}::${citation.capturedAt.toISOString()}`)
    );

    const keeperSourceKeys = new Set(
      (await tx.sourceRecord.findMany({ where: { publicationId: keeper.id } }))
        .map(record => `${record.source}::${record.externalId || ''}::${record.rawData}`)
    );

    const keeperSpecialtyIds = new Set(
      (await tx.publicationSpecialty.findMany({ where: { publicationId: keeper.id } }))
        .map(specialty => specialty.specialtyId)
    );

    for (const duplicate of duplicates) {
      for (const author of duplicate.authors) {
        const key = `${author.authorOrder}::${author.authorName.toLowerCase()}`;
        const existing = keeperAuthorKeys.get(key);
        if (!existing) {
          const created = await tx.publicationAuthor.create({
            data: {
              publicationId: keeper.id,
              authorName: author.authorName,
              authorOrder: author.authorOrder,
              isCorresponding: author.isCorresponding,
            },
          });
          keeperAuthorKeys.set(key, created);
        } else if (author.isCorresponding && !existing.isCorresponding) {
          await tx.publicationAuthor.update({
            where: { id: existing.id },
            data: { isCorresponding: true },
          });
        }
      }

      for (const match of duplicate.matches) {
        const tenure = buildTenureFields(match.researcher, mergedData.publicationDate);
        const existing = keeperMatchMap.get(match.researcherId);

        if (!existing) {
          const updatedMatch = await tx.publicationResearcherMatch.update({
            where: { id: match.id },
            data: {
              publicationId: keeper.id,
              includedInSluOutput: tenure.includedInSluOutput,
              sluTenureNote: tenure.sluTenureNote,
            },
            include: { researcher: { select: { id: true, sluStartDate: true } } },
          });
          keeperMatchMap.set(match.researcherId, updatedMatch);
          continue;
        }

        const mergedMatch = {
          matchConfidence: Math.max(existing.matchConfidence, match.matchConfidence),
          manuallyConfirmed: existing.manuallyConfirmed || match.manuallyConfirmed,
          manuallyExcluded: existing.manuallyExcluded && match.manuallyExcluded,
          exclusionReason:
            existing.manuallyExcluded && match.manuallyExcluded
              ? existing.exclusionReason || match.exclusionReason
              : null,
          includedInSluOutput: tenure.includedInSluOutput,
          sluTenureNote: tenure.sluTenureNote,
          matchType: existing.matchConfidence >= match.matchConfidence ? existing.matchType : match.matchType,
        };

        await tx.publicationResearcherMatch.update({
          where: { id: existing.id },
          data: mergedMatch,
        });
        await tx.publicationResearcherMatch.delete({ where: { id: match.id } });
      }

      for (const citation of duplicate.citations) {
        const key = `${citation.source}::${citation.citationCount}::${citation.capturedAt.toISOString()}`;
        if (keeperCitationKeys.has(key)) {
          await tx.citation.delete({ where: { id: citation.id } });
        } else {
          await tx.citation.update({
            where: { id: citation.id },
            data: { publicationId: keeper.id },
          });
          keeperCitationKeys.add(key);
        }
      }

      for (const record of duplicate.sourceRecords) {
        const key = `${record.source}::${record.externalId || ''}::${record.rawData}`;
        if (keeperSourceKeys.has(key)) {
          await tx.sourceRecord.delete({ where: { id: record.id } });
        } else {
          await tx.sourceRecord.update({
            where: { id: record.id },
            data: { publicationId: keeper.id },
          });
          keeperSourceKeys.add(key);
        }
      }

      for (const specialty of duplicate.specialties) {
        if (keeperSpecialtyIds.has(specialty.specialtyId)) {
          await tx.publicationSpecialty.delete({ where: { id: specialty.id } });
        } else {
          await tx.publicationSpecialty.update({
            where: { id: specialty.id },
            data: { publicationId: keeper.id },
          });
          keeperSpecialtyIds.add(specialty.specialtyId);
        }
      }

      if (duplicate.overrides.length > 0) {
        await tx.manualOverride.updateMany({
          where: { publicationId: duplicate.id },
          data: { publicationId: keeper.id },
        });
      }

      await tx.auditLog.updateMany({
        where: { publicationId: duplicate.id },
        data: { publicationId: keeper.id },
      });

      await tx.publication.delete({ where: { id: duplicate.id } });
    }
  });

  return {
    merged: duplicates.length,
    keeperId: keeper.id,
    duplicateIds: duplicates.map(publication => publication.id),
    normalizedTitle: keeper.normalizedTitle,
  };
}

async function main() {
  const publications = await prisma.publication.findMany({
    include: {
      authors: true,
      matches: {
        include: {
          researcher: {
            select: {
              id: true,
              sluStartDate: true,
            },
          },
        },
      },
      citations: true,
      specialties: true,
      sourceRecords: true,
      overrides: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  for (const publication of publications) {
    const nextNormalizedTitle = normalizeTitle(publication.title);
    if (publication.normalizedTitle !== nextNormalizedTitle && applyChanges) {
      await prisma.publication.update({
        where: { id: publication.id },
        data: { normalizedTitle: nextNormalizedTitle },
      });
      publication.normalizedTitle = nextNormalizedTitle;
    } else {
      publication.normalizedTitle = nextNormalizedTitle;
    }
  }

  const groups = new Map();
  for (const publication of publications) {
    if (!publication.normalizedTitle) continue;
    if (!groups.has(publication.normalizedTitle)) groups.set(publication.normalizedTitle, []);
    groups.get(publication.normalizedTitle).push(publication);
  }

  const mergePlans = [];
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    for (const component of buildComponents(group)) {
      if (component.length > 1) {
        mergePlans.push(component);
      }
    }
  }

  console.log(`Found ${mergePlans.length} duplicate publication groups to merge.`);

  if (!applyChanges) {
    for (const component of mergePlans.slice(0, 20)) {
      console.log({
        normalizedTitle: component[0].normalizedTitle,
        publicationIds: component.map(publication => publication.id),
        titles: uniqueBy(component.map(publication => publication.title), value => value),
        years: uniqueBy(component.map(publication => publication.publicationYear), value => String(value)),
      });
    }
    return;
  }

  let mergedPublications = 0;
  for (const component of mergePlans) {
    const result = await mergeComponent(component);
    mergedPublications += result.merged;
    console.log(`Merged ${result.merged} duplicate records into ${result.keeperId} (${result.normalizedTitle}).`);
  }

  console.log(`Finished. Removed ${mergedPublications} duplicate publication records.`);
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
