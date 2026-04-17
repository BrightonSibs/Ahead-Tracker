const path = require('path');
const Module = require('module');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const applyChanges = process.argv.includes('--apply');
const repoRoot = path.resolve(__dirname, '..');

require('ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'CommonJS',
    moduleResolution: 'node',
  },
});

const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function patchedResolve(request, parent, isMain, options) {
  if (request.startsWith('@/')) {
    const mapped = path.join(repoRoot, 'src', request.slice(2));
    return originalResolveFilename.call(this, mapped, parent, isMain, options);
  }

  return originalResolveFilename.call(this, request, parent, isMain, options);
};

const {
  determineSluInclusion,
  extractSourceAffiliationEvidence,
} = require(path.join(repoRoot, 'src', 'lib', 'affiliations.ts'));

async function main() {
  const matches = await prisma.publicationResearcherMatch.findMany({
    where: {
      manuallyExcluded: false,
    },
    include: {
      publication: {
        select: {
          id: true,
          title: true,
          publicationDate: true,
          publicationYear: true,
          sourceRecords: {
            select: {
              source: true,
              rawData: true,
            },
          },
        },
      },
      researcher: {
        select: {
          id: true,
          canonicalName: true,
          sluStartDate: true,
          aliases: { select: { aliasName: true } },
          identifiers: { select: { identifierType: true, value: true } },
        },
      },
    },
    orderBy: [
      { researcherId: 'asc' },
      { publicationId: 'asc' },
    ],
  });

  let affiliationMatch = 0;
  let affiliationMismatch = 0;
  let tenureFallback = 0;
  let changed = 0;

  const samples = [];

  for (const match of matches) {
    const decision = determineSluInclusion({
      researcher: match.researcher,
      publicationDate: match.publication.publicationDate,
      publicationYear: match.publication.publicationYear,
      evidenceSources: extractSourceAffiliationEvidence(match.publication.sourceRecords),
    });

    if (decision.mode === 'AFFILIATION_MATCH') affiliationMatch += 1;
    else if (decision.mode === 'AFFILIATION_MISMATCH') affiliationMismatch += 1;
    else tenureFallback += 1;

    const reasonChanged = (match.sluTenureNote || null) !== (decision.reason || null);
    const includedChanged = match.includedInSluOutput !== decision.includedInSluOutput;

    if (reasonChanged || includedChanged) {
      changed += 1;
      if (samples.length < 25) {
        samples.push({
          researcher: match.researcher.canonicalName,
          title: match.publication.title,
          previousIncluded: match.includedInSluOutput,
          nextIncluded: decision.includedInSluOutput,
          previousReason: match.sluTenureNote,
          nextReason: decision.reason,
          mode: decision.mode,
        });
      }

      if (applyChanges) {
        await prisma.publicationResearcherMatch.update({
          where: { id: match.id },
          data: {
            includedInSluOutput: decision.includedInSluOutput,
            sluTenureNote: decision.reason,
          },
        });
      }
    }
  }

  console.log(JSON.stringify({
    checked: matches.length,
    changed,
    modeCounts: {
      AFFILIATION_MATCH: affiliationMatch,
      AFFILIATION_MISMATCH: affiliationMismatch,
      TENURE_FALLBACK: tenureFallback,
    },
    applied: applyChanges,
    sampleChanges: samples,
  }, null, 2));
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
