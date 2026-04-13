import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type MetricRecord = {
  journalName: string;
  year: number;
  impactFactor: number | null;
};

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function normalizeJournalName(value: string | null | undefined) {
  if (!value) return null;

  const normalized = decodeHtmlEntities(value)
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .replace(/[.,;:]+$/g, '')
    .trim()
    .toLowerCase();

  return normalized || null;
}

function getImpactMetricYear(publicationYear: number | null | undefined) {
  return publicationYear ?? new Date().getFullYear();
}

function getImpactMetricKey(journalName: string | null | undefined, publicationYear: number | null | undefined) {
  if (!journalName) return null;
  return `${journalName}::${getImpactMetricYear(publicationYear)}`;
}

function buildMetricLookup(metrics: MetricRecord[]) {
  const exact = new Map<string, MetricRecord>();
  const byNormalizedName = new Map<string, MetricRecord[]>();

  for (const metric of metrics) {
    exact.set(getImpactMetricKey(metric.journalName, metric.year) as string, metric);

    const normalizedName = normalizeJournalName(metric.journalName);
    if (!normalizedName) continue;

    const existing = byNormalizedName.get(normalizedName) || [];
    existing.push(metric);
    byNormalizedName.set(normalizedName, existing);
  }

  for (const entries of byNormalizedName.values()) {
    entries.sort((left, right) => left.year - right.year);
  }

  return { exact, byNormalizedName };
}

function resolveMetric(
  publication: { journalName: string | null; publicationYear: number | null },
  metricLookup: ReturnType<typeof buildMetricLookup>,
) {
  const key = getImpactMetricKey(publication.journalName, publication.publicationYear);
  if (key) {
    const exactMetric = metricLookup.exact.get(key);
    if (exactMetric) return exactMetric;
  }

  const normalizedJournalName = normalizeJournalName(publication.journalName);
  if (!normalizedJournalName) return null;

  const candidates = metricLookup.byNormalizedName.get(normalizedJournalName) || [];
  if (candidates.length === 0) return null;

  const targetYear = getImpactMetricYear(publication.publicationYear);
  const sameYearMetric = candidates.find(candidate => candidate.year === targetYear);
  if (sameYearMetric) return sameYearMetric;

  return [...candidates].sort((left, right) => {
    const leftDistance = Math.abs(left.year - targetYear);
    const rightDistance = Math.abs(right.year - targetYear);
    if (leftDistance !== rightDistance) return leftDistance - rightDistance;
    return right.year - left.year;
  })[0] || null;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !['ADMIN', 'ANALYST'].includes((session.user as any)?.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const [
    missingOrcidCount,
    missingSluStartCount,
    missingJournalNameCount,
    missingAbstractCount,
    needsReviewCount,
    researchersMissingMetadata,
    publicationsMissingMetadata,
    impactPublications,
    metrics,
  ] = await Promise.all([
    prisma.researcher.count({ where: { activeStatus: true, orcid: null } }),
    prisma.researcher.count({ where: { activeStatus: true, sluStartDate: null } }),
    prisma.publication.count({ where: { journalName: null } }),
    prisma.publication.count({ where: { abstract: null } }),
    prisma.publication.count({ where: { verifiedStatus: 'NEEDS_REVIEW' } }),
    prisma.researcher.findMany({
      where: {
        activeStatus: true,
        OR: [
          { orcid: null },
          { sluStartDate: null },
        ],
      },
      select: {
        id: true,
        canonicalName: true,
        department: true,
        orcid: true,
        sluStartDate: true,
      },
      orderBy: { canonicalName: 'asc' },
      take: 5,
    }),
    prisma.publication.findMany({
      where: {
        OR: [
          { journalName: null },
          { abstract: null },
          { verifiedStatus: 'NEEDS_REVIEW' },
        ],
      },
      select: {
        id: true,
        title: true,
        journalName: true,
        publicationYear: true,
        verifiedStatus: true,
      },
      orderBy: [{ publicationYear: 'desc' }, { title: 'asc' }],
      take: 5,
    }),
    prisma.publication.findMany({
      select: {
        id: true,
        title: true,
        journalName: true,
        publicationYear: true,
      },
    }),
    prisma.journalMetric.findMany({
      select: {
        journalName: true,
        year: true,
        impactFactor: true,
      },
    }),
  ]);

  const metricLookup = buildMetricLookup(metrics);
  const unresolvedImpactFactorPublications = impactPublications.filter(
    publication => resolveMetric(publication, metricLookup)?.impactFactor == null,
  );

  return NextResponse.json({
    counts: {
      missingOrcidCount,
      missingSluStartCount,
      missingJournalNameCount,
      missingAbstractCount,
      needsReviewCount,
      unresolvedImpactFactorCount: unresolvedImpactFactorPublications.length,
    },
    samples: {
      researchersMissingMetadata: researchersMissingMetadata.map(researcher => ({
        ...researcher,
        sluStartDate: researcher.sluStartDate?.toISOString() ?? null,
      })),
      publicationsMissingMetadata,
      unresolvedImpactFactors: unresolvedImpactFactorPublications.slice(0, 5),
    },
  });
}
