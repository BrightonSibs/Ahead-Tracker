const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

function loadEnvFile(filename) {
  const fullPath = path.join(process.cwd(), filename);
  if (!fs.existsSync(fullPath)) return;

  const contents = fs.readFileSync(fullPath, 'utf8');
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    if (!key || process.env[key]) continue;

    let value = trimmed.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

loadEnvFile('.env');
loadEnvFile('.env.local');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function parseRawData(value) {
  if (!value) return {};

  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function hasStoredSourceLink(rawData) {
  if (typeof rawData?.citationLink === 'string' && rawData.citationLink.trim()) {
    return true;
  }

  if (Array.isArray(rawData?.resourceLinks)) {
    return rawData.resourceLinks.some(resource => typeof resource?.link === 'string' && resource.link.trim());
  }

  return false;
}

async function fetchScholarCitationDetail(externalId, apiKey) {
  const url = new URL('https://serpapi.com/search.json');
  url.searchParams.set('engine', 'google_scholar_author');
  url.searchParams.set('view_op', 'view_citation');
  url.searchParams.set('citation_id', externalId);
  url.searchParams.set('hl', 'en');
  url.searchParams.set('api_key', apiKey);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`SerpAPI returned ${response.status} for ${externalId}`);
  }

  const payload = await response.json();
  const citation = payload?.citation || {};
  const resources = Array.isArray(citation.resources) ? citation.resources : [];

  return {
    citationLink: typeof citation.link === 'string' ? citation.link.trim() : null,
    resourceLinks: resources
      .map(resource => ({
        title: typeof resource?.title === 'string' ? resource.title : null,
        fileFormat: typeof resource?.file_format === 'string' ? resource.file_format : null,
        link: typeof resource?.link === 'string' ? resource.link.trim() : null,
      }))
      .filter(resource => resource.link),
    journal: typeof citation.journal === 'string' ? citation.journal : null,
    description: typeof citation.description === 'string' ? citation.description : null,
    publicationDate: typeof citation.publication_date === 'string' ? citation.publication_date : null,
    publisher: typeof citation.publisher === 'string' ? citation.publisher : null,
    fetchedAt: new Date().toISOString(),
  };
}

async function main() {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    throw new Error('SERPAPI_KEY is not configured.');
  }

  const publicationIdFilter = process.argv
    .find(argument => argument.startsWith('--publicationId='))
    ?.split('=')
    .slice(1)
    .join('=')
    .trim() || null;

  const sourceRecords = await prisma.sourceRecord.findMany({
    where: {
      source: 'GOOGLE_SCHOLAR',
      publication: {
        sourcePrimary: 'GOOGLE_SCHOLAR',
        verifiedStatus: 'NEEDS_REVIEW',
        ...(publicationIdFilter ? { id: publicationIdFilter } : {}),
      },
    },
    select: {
      id: true,
      externalId: true,
      rawData: true,
      publicationId: true,
      publication: {
        select: {
          title: true,
        },
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const record of sourceRecords) {
    const rawData = parseRawData(record.rawData);
    if (hasStoredSourceLink(rawData)) {
      skipped += 1;
      continue;
    }

    if (!record.externalId || !record.externalId.includes(':')) {
      skipped += 1;
      continue;
    }

    try {
      let detail = null;
      let lastError = null;

      for (const delayMs of [0, 30000, 60000]) {
        if (delayMs > 0) {
          await sleep(delayMs);
        }

        try {
          detail = await fetchScholarCitationDetail(record.externalId, apiKey);
          lastError = null;
          break;
        } catch (error) {
          lastError = error;
          const message = error instanceof Error ? error.message : String(error);
          if (!message.includes('429')) {
            throw error;
          }
        }
      }

      if (!detail) {
        throw lastError || new Error(`Unable to fetch citation details for ${record.externalId}`);
      }

      const nextRawData = {
        ...rawData,
        citationLink: detail.citationLink,
        resourceLinks: detail.resourceLinks,
        citationPublisher: detail.publisher,
        citationJournal: detail.journal,
        citationDescription: detail.description,
        citationPublicationDate: detail.publicationDate,
        citationFetchedAt: detail.fetchedAt,
      };

      await prisma.sourceRecord.update({
        where: { id: record.id },
        data: {
          rawData: JSON.stringify(nextRawData),
          normalizedAt: new Date(),
        },
      });

      updated += 1;
      console.log(`updated ${record.publicationId} :: ${record.publication.title}`);
    } catch (error) {
      failed += 1;
      console.error(`failed ${record.publicationId} :: ${record.publication.title}`);
      console.error(error instanceof Error ? error.message : error);
    }

    await sleep(250);
  }

  console.log(JSON.stringify({
    total: sourceRecords.length,
    updated,
    skipped,
    failed,
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
