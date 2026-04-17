const fs = require('fs');
const path = require('path');
const Module = require('module');

const repoRoot = path.resolve(__dirname, '..');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const equalsIndex = line.indexOf('=');
    if (equalsIndex <= 0) continue;

    const key = line.slice(0, equalsIndex).trim();
    let value = line.slice(equalsIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function resolveSqlitePath(databaseUrl) {
  if (!databaseUrl || !databaseUrl.startsWith('file:')) {
    return null;
  }

  const sqliteRef = databaseUrl.slice('file:'.length);
  if (!sqliteRef) return null;

  if (path.isAbsolute(sqliteRef)) {
    return sqliteRef;
  }

  return path.resolve(repoRoot, 'prisma', sqliteRef);
}

function ensureTsAliasSupport() {
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
}

async function resetPublicationDomain(prisma) {
  await prisma.$transaction([
    prisma.auditLog.deleteMany({
      where: {
        OR: [
          { publicationId: { not: null } },
          { entityType: 'publication' },
        ],
      },
    }),
    prisma.manualOverride.deleteMany(),
    prisma.publicationResearcherMatch.deleteMany(),
    prisma.publicationAuthor.deleteMany(),
    prisma.publicationSpecialty.deleteMany(),
    prisma.citation.deleteMany(),
    prisma.sourceRecord.deleteMany(),
    prisma.publication.deleteMany(),
    prisma.syncJob.deleteMany(),
    prisma.alert.deleteMany(),
  ]);
}

async function main() {
  loadEnvFile(path.join(repoRoot, '.env.local'));
  loadEnvFile(path.join(repoRoot, '.env'));

  const databaseUrl = process.env.DATABASE_URL || 'file:./dev.db';
  const sqlitePath = resolveSqlitePath(databaseUrl);

  if (!sqlitePath) {
    throw new Error(`Only SQLite DATABASE_URL values are supported by this rebuild script. Received: ${databaseUrl}`);
  }

  if (!fs.existsSync(sqlitePath)) {
    throw new Error(`Database file not found at ${sqlitePath}`);
  }

  const backupsDir = path.join(repoRoot, 'prisma', 'backups');
  fs.mkdirSync(backupsDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupsDir, `publications-rebuild-${timestamp}.db`);
  fs.copyFileSync(sqlitePath, backupPath);

  console.log(`Backed up database to ${backupPath}`);

  ensureTsAliasSupport();

  const { PrismaClient } = require('@prisma/client');
  const { runSyncJob } = require(path.join(repoRoot, 'src', 'lib', 'services', 'sync.ts'));

  const prisma = new PrismaClient();
  const orderedSources = ['ORCID', 'OPENALEX', 'PUBMED', 'CROSSREF', 'EUROPE_PMC', 'GOOGLE_SCHOLAR'];
  const activeSources = orderedSources.filter(source => {
    if (source !== 'GOOGLE_SCHOLAR') return true;
    return Boolean(process.env.SERPAPI_KEY);
  });

  try {
    const beforeCounts = {
      publications: await prisma.publication.count(),
      matches: await prisma.publicationResearcherMatch.count(),
      citations: await prisma.citation.count(),
      sourceRecords: await prisma.sourceRecord.count(),
    };

    console.log('Current publication-domain counts:', beforeCounts);
    console.log('Resetting publication-domain tables...');

    await resetPublicationDomain(prisma);

    const afterResetCounts = {
      publications: await prisma.publication.count(),
      matches: await prisma.publicationResearcherMatch.count(),
      citations: await prisma.citation.count(),
      sourceRecords: await prisma.sourceRecord.count(),
    };

    console.log('Counts after reset:', afterResetCounts);

    const results = [];
    for (const source of activeSources) {
      console.log(`Running sync for ${source}...`);
      const job = await runSyncJob(source, 'publication-rebuild');
      results.push({
        source,
        status: job.status,
        found: job.recordsFound ?? 0,
        created: job.recordsCreated ?? 0,
        updated: job.recordsUpdated ?? 0,
        error: job.errorMessage || null,
      });
      console.log(
        `${source}: status=${job.status} found=${job.recordsFound ?? 0} created=${job.recordsCreated ?? 0} updated=${job.recordsUpdated ?? 0}`,
      );
      if (job.errorMessage) {
        console.log(`${source} error: ${job.errorMessage}`);
      }
    }

    const finalCounts = {
      publications: await prisma.publication.count(),
      matches: await prisma.publicationResearcherMatch.count(),
      citations: await prisma.citation.count(),
      sourceRecords: await prisma.sourceRecord.count(),
      scholarPrimary: await prisma.publication.count({ where: { sourcePrimary: 'GOOGLE_SCHOLAR' } }),
      publicationsWithDoi: await prisma.publication.count({ where: { doi: { not: null } } }),
      publicationsWithPubmedId: await prisma.publication.count({ where: { pubmedId: { not: null } } }),
    };

    console.log('Rebuild results:', JSON.stringify(results, null, 2));
    console.log('Final publication-domain counts:', finalCounts);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
