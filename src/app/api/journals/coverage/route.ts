import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type MetricRecord = {
  journalName: string;
  year: number;
  impactFactor: number | null;
  quartile: string | null;
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

function csvEscape(value: string | number | null | undefined) {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const format = req.nextUrl.searchParams.get('format');

  const [publications, metrics] = await Promise.all([
    prisma.publication.findMany({
      select: {
        id: true,
        title: true,
        journalName: true,
        publicationYear: true,
      },
      orderBy: [{ publicationYear: 'desc' }, { title: 'asc' }],
    }),
    prisma.journalMetric.findMany({
      select: {
        journalName: true,
        year: true,
        impactFactor: true,
        quartile: true,
      },
    }),
  ]);

  const metricLookup = buildMetricLookup(metrics);

  const unresolvedByPair = new Map<string, {
    journalName: string | null;
    publicationYear: number | null;
    publicationCount: number;
    sampleTitles: string[];
  }>();

  let missingJournalNameCount = 0;
  let resolvedByFallbackCount = 0;

  for (const publication of publications) {
    const resolvedMetric = resolveMetric(publication, metricLookup);
    if (resolvedMetric?.impactFactor != null) {
      const exactKey = getImpactMetricKey(publication.journalName, publication.publicationYear);
      if (!exactKey || !metricLookup.exact.has(exactKey)) {
        resolvedByFallbackCount += 1;
      }
      continue;
    }

    if (!publication.journalName) {
      missingJournalNameCount += 1;
    }

    const pairKey = `${publication.journalName || '[missing]'}::${publication.publicationYear ?? 'unknown'}`;
    const existing = unresolvedByPair.get(pairKey) || {
      journalName: publication.journalName,
      publicationYear: publication.publicationYear,
      publicationCount: 0,
      sampleTitles: [],
    };

    existing.publicationCount += 1;
    if (existing.sampleTitles.length < 3) {
      existing.sampleTitles.push(publication.title);
    }

    unresolvedByPair.set(pairKey, existing);
  }

  const unresolved = [...unresolvedByPair.values()].sort((left, right) => {
    if (right.publicationCount !== left.publicationCount) {
      return right.publicationCount - left.publicationCount;
    }

    const leftYear = left.publicationYear ?? -1;
    const rightYear = right.publicationYear ?? -1;
    if (rightYear !== leftYear) return rightYear - leftYear;

    return (left.journalName || '').localeCompare(right.journalName || '');
  });

  if (format === 'csv') {
    const rows = [
      ['journal_name', 'publication_year', 'publication_count', 'sample_titles'].join(','),
      ...unresolved.map(item => [
        csvEscape(item.journalName || ''),
        csvEscape(item.publicationYear ?? ''),
        csvEscape(item.publicationCount),
        csvEscape(item.sampleTitles.join(' | ')),
      ].join(',')),
    ];

    return new NextResponse(rows.join('\n'), {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="missing-journal-metrics-${Date.now()}.csv"`,
      },
    });
  }

  return NextResponse.json({
    totalPublications: publications.length,
    totalJournalMetrics: metrics.length,
    resolvedByFallbackCount,
    missingJournalNameCount,
    unresolvedPublicationCount: unresolved.reduce((sum, item) => sum + item.publicationCount, 0),
    unresolvedJournalPairCount: unresolved.length,
    unresolved: unresolved.slice(0, 25),
  });
}
