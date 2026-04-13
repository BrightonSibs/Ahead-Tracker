import { prisma } from '@/lib/prisma';
import { fetchCandidatesForSource } from '@/lib/services/sync-adapters';
import { findExistingPublication } from '@/lib/services/sync-deduping';
import { normalizeTitle, resolveAuthorMatch } from '@/lib/services/sync-shared';
import {
  MANUAL_ONLY_SOURCES,
  SYNCABLE_SOURCES,
} from '@/lib/services/sync-types';
import type { PublicationCandidate, ResearcherWithAliases, SyncSource } from '@/lib/services/sync-types';

export { MANUAL_ONLY_SOURCES, SYNCABLE_SOURCES };

async function getResearchersForSync(researcherId?: string) {
  return prisma.researcher.findMany({
    where: {
      activeStatus: true,
      ...(researcherId ? { id: researcherId } : {}),
    },
    include: {
      aliases: true,
      identifiers: true,
    },
    orderBy: { canonicalName: 'asc' },
  });
}

async function persistCandidate(researcher: ResearcherWithAliases, candidate: PublicationCandidate) {
  const authorMatch = resolveAuthorMatch(researcher, candidate.authorNames, candidate.source);
  if (!authorMatch) return { created: 0, updated: 0 };

  const normalizedTitle = normalizeTitle(candidate.title);
  if (!normalizedTitle) return { created: 0, updated: 0 };

  let publication = await findExistingPublication(researcher, candidate, normalizedTitle);

  let created = 0;
  let updated = 0;
  const alerts: Array<{ alertType: string; title: string; message: string; entityId: string; entityType: string }> = [];

  if (!publication) {
    publication = await prisma.publication.create({
      data: {
        title: candidate.title,
        normalizedTitle,
        doi: candidate.doi,
        pubmedId: candidate.pubmedId,
        publicationDate: candidate.publicationDate,
        publicationYear: candidate.publicationYear,
        journalName: candidate.journalName,
        abstract: candidate.abstract,
        sourcePrimary: candidate.source,
        verifiedStatus: 'UNVERIFIED',
      },
    });
    created = 1;
    alerts.push({
      alertType: 'NEW_PUBLICATION',
      title: 'New publication detected',
      message: `${researcher.canonicalName} has a new publication: "${candidate.title}".`,
      entityId: publication.id,
      entityType: 'publication',
    });
  } else {
    const updateData: Record<string, string | number | Date | null> = {};
    if (!publication.doi && candidate.doi) updateData.doi = candidate.doi;
    if (!publication.pubmedId && candidate.pubmedId) updateData.pubmedId = candidate.pubmedId;
    if (!publication.journalName && candidate.journalName) updateData.journalName = candidate.journalName;
    if (!publication.abstract && candidate.abstract) updateData.abstract = candidate.abstract;
    if (!publication.publicationDate && candidate.publicationDate) updateData.publicationDate = candidate.publicationDate;
    if (!publication.publicationYear && candidate.publicationYear) updateData.publicationYear = candidate.publicationYear;
    if (publication.sourcePrimary === 'MANUAL') updateData.sourcePrimary = candidate.source;

    if (Object.keys(updateData).length > 0) {
      publication = await prisma.publication.update({
        where: { id: publication.id },
        data: updateData,
      });
      updated = 1;
    }
  }

  const existingAuthors = await prisma.publicationAuthor.count({
    where: { publicationId: publication.id },
  });
  if (existingAuthors === 0 && candidate.authorNames.length > 0) {
    await prisma.publicationAuthor.createMany({
      data: candidate.authorNames.map((authorName, index) => ({
        publicationId: publication!.id,
        authorName,
        authorOrder: index + 1,
        isCorresponding: index === 0,
      })),
    });
  }

  const existingSourceRecord = await prisma.sourceRecord.findFirst({
    where: {
      publicationId: publication.id,
      source: candidate.source,
      externalId: candidate.externalId,
    },
  });
  if (!existingSourceRecord) {
    await prisma.sourceRecord.create({
      data: {
        publicationId: publication.id,
        source: candidate.source,
        externalId: candidate.externalId,
        rawData: JSON.stringify(candidate),
        normalizedAt: new Date(),
      },
    });
  }

  const includedInSluOutput =
    !researcher.sluStartDate || !candidate.publicationDate || candidate.publicationDate >= researcher.sluStartDate;

  await prisma.publicationResearcherMatch.upsert({
    where: {
      publicationId_researcherId: {
        publicationId: publication.id,
        researcherId: researcher.id,
      },
    },
    update: {
      matchType: authorMatch.matchType,
      matchConfidence: authorMatch.confidence,
      includedInSluOutput,
      manuallyExcluded: false,
      exclusionReason: null,
      sluTenureNote:
        includedInSluOutput || !researcher.sluStartDate || !candidate.publicationDate
          ? null
          : `Published before researcher's SLU start date (${researcher.sluStartDate.toISOString().split('T')[0]})`,
    },
    create: {
      publicationId: publication.id,
      researcherId: researcher.id,
      matchType: authorMatch.matchType,
      matchConfidence: authorMatch.confidence,
      manuallyConfirmed: authorMatch.matchType === 'ORCID_MATCH',
      includedInSluOutput,
      sluTenureNote:
        includedInSluOutput || !researcher.sluStartDate || !candidate.publicationDate
          ? null
          : `Published before researcher's SLU start date (${researcher.sluStartDate.toISOString().split('T')[0]})`,
    },
  });

  if (candidate.citationCount != null) {
    const latestCitation = await prisma.citation.findFirst({
      where: {
        publicationId: publication.id,
        source: candidate.source,
      },
      orderBy: { capturedAt: 'desc' },
    });

    if (!latestCitation || latestCitation.citationCount !== candidate.citationCount) {
      await prisma.citation.create({
        data: {
          publicationId: publication.id,
          source: candidate.source,
          citationCount: candidate.citationCount,
          capturedAt: new Date(),
        },
      });
      if (!created) updated = 1;

      if (latestCitation && candidate.citationCount > latestCitation.citationCount) {
        alerts.push({
          alertType: 'CITATION_INCREASE',
          title: 'Citation count increased',
          message:
            `"${candidate.title}" gained ${candidate.citationCount - latestCitation.citationCount} citation` +
            `${candidate.citationCount - latestCitation.citationCount === 1 ? '' : 's'} for ${researcher.canonicalName}.`,
          entityId: publication.id,
          entityType: 'publication',
        });
      }
    }
  }

  return { created, updated, alerts };
}

export async function runSyncJob(source: SyncSource, triggeredBy?: string, researcherId?: string) {
  const job = await prisma.syncJob.create({
    data: {
      source,
      status: 'RUNNING',
      researcherId: researcherId || null,
      startedAt: new Date(),
      triggeredBy: triggeredBy || 'system',
      logs: JSON.stringify([]),
    },
  });

  try {
    if (!SYNCABLE_SOURCES.includes(source as (typeof SYNCABLE_SOURCES)[number])) {
      throw new Error(`${source} does not have automatic ingestion wired into the platform.`);
    }

    const researchers = await getResearchersForSync(researcherId);
    if (researchers.length === 0) {
      throw new Error('No active researchers available for sync.');
    }

    let recordsFound = 0;
    let recordsCreated = 0;
    let recordsUpdated = 0;
    const errors: string[] = [];
    const alertsToCreate: Array<{ alertType: string; title: string; message: string; entityId: string; entityType: string }> = [];

    for (const researcher of researchers) {
      try {
        const candidates = await fetchCandidatesForSource(source, researcher);
        recordsFound += candidates.length;

        for (const candidate of candidates) {
          const result = await persistCandidate(researcher, candidate);
          recordsCreated += result.created;
          recordsUpdated += result.updated;
          alertsToCreate.push(...(result.alerts || []));
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown sync error';
        errors.push(`${researcher.canonicalName}: ${message}`);
      }
    }

    const status =
      errors.length === 0 ? 'COMPLETED' : recordsFound > 0 || recordsCreated > 0 || recordsUpdated > 0 ? 'PARTIAL' : 'FAILED';

    if (alertsToCreate.length > 0) {
      await prisma.alert.createMany({
        data: alertsToCreate.slice(0, 25).map(alert => ({
          ...alert,
          resolved: false,
        })),
      });
    }

    return prisma.syncJob.update({
      where: { id: job.id },
      data: {
        status,
        completedAt: new Date(),
        recordsFound,
        recordsCreated,
        recordsUpdated,
        errorMessage: errors.length > 0 ? errors.join(' | ').slice(0, 1000) : null,
        logs: JSON.stringify(errors),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown sync failure';
    return prisma.syncJob.update({
      where: { id: job.id },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        errorMessage: message,
        logs: JSON.stringify([message]),
      },
    });
  }
}
