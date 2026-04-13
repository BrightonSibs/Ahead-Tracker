import { prisma } from '@/lib/prisma';
import {
  buildCumulativeCitationCountByYear,
  buildObservedCitationGrowthByYear,
} from '@/lib/citation-metrics';
import { getAllDepartments } from '@/lib/services/departments';
import { departmentHexColor } from '@/lib/utils';
import type { FilterState, PaginatedResult, PublicationSummary } from '@/types';

type PublicationWithRelations = Awaited<ReturnType<typeof fetchPublications>>[number];
type JournalMetricLookup = {
  exact: Map<string, { impactFactor: number | null; quartile: string | null; year: number }>;
  byNormalizedName: Map<string, Array<{ impactFactor: number | null; quartile: string | null; year: number }>>;
};

function decodeHtmlEntities(value: string) {
  let normalized = value;
  const replacements: Array<[RegExp, string]> = [
    [/&amp;/gi, '&'],
    [/&lt;/gi, '<'],
    [/&gt;/gi, '>'],
    [/&quot;/gi, '"'],
    [/&#39;/gi, "'"],
  ];

  for (const [pattern, replacement] of replacements) {
    normalized = normalized.replace(pattern, replacement);
  }

  return normalized;
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

function toRangeStart(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function toRangeEnd(value: string) {
  return new Date(`${value}T23:59:59.999Z`);
}

function getImpactMetricYear(publicationYear: number | null | undefined) {
  return publicationYear ?? new Date().getFullYear();
}

function getImpactMetricKey(journalName: string | null | undefined, publicationYear: number | null | undefined) {
  if (!journalName) return null;
  return `${journalName}::${getImpactMetricYear(publicationYear)}`;
}

async function fetchPublications(where: any, skip?: number, take?: number) {
  return prisma.publication.findMany({
    where,
    include: {
      authors: { orderBy: { authorOrder: 'asc' }, take: 5 },
      citations: { orderBy: { capturedAt: 'desc' }, take: 1 },
      specialties: { include: { specialty: true } },
      matches: {
        where: { manuallyExcluded: false },
        include: { researcher: { select: { id: true, canonicalName: true, department: true } } },
        orderBy: { matchConfidence: 'desc' },
      },
    },
    orderBy: { publicationDate: 'desc' },
    ...(skip !== undefined ? { skip } : {}),
    ...(take !== undefined ? { take } : {}),
  });
}

async function fetchJournalMetricLookup(
  publications: Array<{ journalName: string | null; publicationYear: number | null }>,
) {
  const journalNames = Array.from(
    new Set(
      publications
        .map(publication => publication.journalName)
        .filter((journalName): journalName is string => Boolean(journalName)),
    ),
  );

  if (journalNames.length === 0) {
    return {
      exact: new Map<string, { impactFactor: number | null; quartile: string | null; year: number }>(),
      byNormalizedName: new Map<string, Array<{ impactFactor: number | null; quartile: string | null; year: number }>>(),
    };
  }

  const metrics = await prisma.journalMetric.findMany({
    select: {
      journalName: true,
      year: true,
      impactFactor: true,
      quartile: true,
    },
  });

  const exact = new Map<string, { impactFactor: number | null; quartile: string | null; year: number }>();
  const byNormalizedName = new Map<string, Array<{ impactFactor: number | null; quartile: string | null; year: number }>>();

  for (const metric of metrics) {
    const record = {
      impactFactor: metric.impactFactor,
      quartile: metric.quartile,
      year: metric.year,
    };
    exact.set(getImpactMetricKey(metric.journalName, metric.year) as string, record);

    const normalizedName = normalizeJournalName(metric.journalName);
    if (!normalizedName) continue;

    const existing = byNormalizedName.get(normalizedName) || [];
    existing.push(record);
    byNormalizedName.set(normalizedName, existing);
  }

  for (const entries of byNormalizedName.values()) {
    entries.sort((left, right) => left.year - right.year);
  }

  return { exact, byNormalizedName };
}

function resolvePublicationJournalMetric(
  publication: { journalName: string | null; publicationYear: number | null },
  metricLookup: JournalMetricLookup,
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

function getPublicationImpactFactor(
  publication: { journalName: string | null; publicationYear: number | null },
  metricLookup: JournalMetricLookup,
) {
  return resolvePublicationJournalMetric(publication, metricLookup)?.impactFactor ?? null;
}

function mapPublicationSummary(
  publication: PublicationWithRelations,
  metricLookup: JournalMetricLookup,
): PublicationSummary {
  return {
    id: publication.id,
    title: publication.title,
    doi: publication.doi,
    publicationDate: publication.publicationDate?.toISOString() ?? null,
    publicationYear: publication.publicationYear,
    journalName: publication.journalName,
    latestCitations: publication.citations[0]?.citationCount ?? 0,
    impactFactor: getPublicationImpactFactor(publication, metricLookup),
    verifiedStatus: publication.verifiedStatus,
    sourcePrimary: publication.sourcePrimary,
    authors: publication.authors.map(author => author.authorName),
    matchedResearchers: publication.matches.map(match => ({
      id: match.researcher.id,
      name: match.researcher.canonicalName,
      department: match.researcher.department,
      confidence: match.matchConfidence,
      matchType: match.matchType,
    })),
    specialties: publication.specialties.map(specialty => specialty.specialty.name),
    includedInSluOutput: publication.matches.some(match => match.includedInSluOutput),
  };
}

export async function getPublications(
  filters: FilterState = {},
  page = 1,
  pageSize = 25,
): Promise<PaginatedResult<PublicationSummary>> {
  const where: any = {};

  if (filters.keyword) {
    where.OR = [
      { title: { contains: filters.keyword } },
      { abstract: { contains: filters.keyword } },
      { journalName: { contains: filters.keyword } },
    ];
  }

  if (filters.yearFrom || filters.yearTo) {
    where.publicationYear = {
      ...(filters.yearFrom ? { gte: filters.yearFrom } : {}),
      ...(filters.yearTo ? { lte: filters.yearTo } : {}),
    };
  }

  if (filters.dateFrom || filters.dateTo) {
    where.publicationDate = {
      ...(filters.dateFrom ? { gte: toRangeStart(filters.dateFrom) } : {}),
      ...(filters.dateTo ? { lte: toRangeEnd(filters.dateTo) } : {}),
    };
  }

  if (filters.source) {
    where.sourcePrimary = filters.source;
  }

  if (filters.verifiedStatus) {
    where.verifiedStatus = filters.verifiedStatus;
  }

  if (filters.researcherId) {
    where.matches = {
      some: {
        researcherId: filters.researcherId,
        manuallyExcluded: false,
        ...(filters.sluOnly ? { includedInSluOutput: true } : {}),
      },
    };
  } else if (filters.department) {
    where.matches = {
      some: {
        manuallyExcluded: false,
        researcher: { department: filters.department },
        ...(filters.sluOnly ? { includedInSluOutput: true } : {}),
      },
    };
  } else if (filters.sluOnly) {
    where.matches = {
      some: { manuallyExcluded: false, includedInSluOutput: true },
    };
  }

  if (filters.specialty) {
    where.specialties = {
      some: { specialty: { name: filters.specialty } },
    };
  }

  let total = 0;
  let publications: PublicationWithRelations[] = [];

  if (filters.minImpactFactor !== undefined) {
    const allPublications = await fetchPublications(where);
    const metricLookup = await fetchJournalMetricLookup(allPublications);
    const filtered = allPublications.filter(publication => {
      const impactFactor = getPublicationImpactFactor(publication, metricLookup);
      return impactFactor !== null && impactFactor >= filters.minImpactFactor!;
    });

    total = filtered.length;
    publications = filtered.slice((page - 1) * pageSize, page * pageSize);

    return {
      data: publications.map(publication => mapPublicationSummary(publication, metricLookup)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  const [count, pagedPublications] = await Promise.all([
    prisma.publication.count({ where }),
    fetchPublications(where, (page - 1) * pageSize, pageSize),
  ]);

  total = count;
  publications = pagedPublications;

  const metricLookup = await fetchJournalMetricLookup(publications);

  return {
    data: publications.map(publication => mapPublicationSummary(publication, metricLookup)),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function getPublicationById(id: string) {
  const pub = await prisma.publication.findUnique({
    where: { id },
    include: {
      authors: { orderBy: { authorOrder: 'asc' } },
      citations: { orderBy: { capturedAt: 'asc' } },
      specialties: { include: { specialty: true } },
      sourceRecords: true,
      overrides: { orderBy: { createdAt: 'desc' } },
      matches: {
        include: {
          researcher: {
            select: {
              id: true, canonicalName: true, department: true, orcid: true,
            },
          },
        },
      },
    },
  });

  if (!pub) return null;

  const metricLookup = await fetchJournalMetricLookup([
    {
      journalName: pub.journalName,
      publicationYear: pub.publicationYear,
    },
  ]);
  const journalMetric = resolvePublicationJournalMetric(pub, metricLookup);

  const citationHistory = pub.citations.map(citation => ({
    date: citation.capturedAt.toISOString().split('T')[0],
    count: citation.citationCount,
    source: citation.source,
  }));

  return {
    ...pub,
    publicationDate: pub.publicationDate?.toISOString() ?? null,
    impactFactor: journalMetric?.impactFactor ?? null,
    citationHistory,
    latestCitationCount: pub.citations.length > 0
      ? pub.citations[pub.citations.length - 1].citationCount
      : 0,
  };
}

export async function getAnalyticsData(filters: FilterState = {}) {
  const researcherWhere = filters.department ? { department: filters.department } : {};
  const reportingEndYear = new Date().getFullYear();

  const departments = (await getAllDepartments(false))
    .filter(department => (filters.department ? department.code === filters.department : true));

  const researchers = await prisma.researcher.findMany({
    where: researcherWhere,
    include: {
      matches: {
        where: {
          manuallyExcluded: false,
          ...(filters.sluOnly ? { includedInSluOutput: true } : {}),
        },
        include: {
          publication: {
            include: {
              citations: { orderBy: { capturedAt: 'asc' } },
              specialties: { include: { specialty: true } },
            },
          },
        },
      },
    },
  });

  const publicationEntries = new Map<string, {
    publication: (typeof researchers)[number]['matches'][number]['publication'];
    departments: Set<string>;
  }>();

  for (const researcher of researchers) {
    for (const match of researcher.matches) {
      const existing = publicationEntries.get(match.publication.id);
      if (existing) {
        existing.departments.add(researcher.department);
      } else {
        publicationEntries.set(match.publication.id, {
          publication: match.publication,
          departments: new Set([researcher.department]),
        });
      }
    }
  }

  const uniquePublications = Array.from(publicationEntries.values()).map(entry => entry.publication);
  const metricLookup = await fetchJournalMetricLookup(uniquePublications);

  const publicationsByYear: Record<number, Record<string, number>> = {};
  const citationsByYear: Record<number, Record<string, number>> = {};
  const cumulativeCitationsByYear: Record<number, Record<string, number>> = {};
  const specialtyCounts: Record<string, number> = {};
  const specialtyCitationsByYear: Record<number, Record<string, number>> = {};
  const specialtyCumulativeCitationsByYear: Record<number, Record<string, number>> = {};
  const specialtyCitationTotals: Record<string, number> = {};

  for (const { publication, departments } of publicationEntries.values()) {
    const publicationYear = publication.publicationYear ?? 0;
    if (!publicationsByYear[publicationYear]) publicationsByYear[publicationYear] = {};
    for (const department of departments) {
      publicationsByYear[publicationYear][department] = (publicationsByYear[publicationYear][department] || 0) + 1;
    }

    const citationGrowthByYear = buildObservedCitationGrowthByYear(publication.citations, reportingEndYear);
    const cumulativeCitationByYear = buildCumulativeCitationCountByYear(publication.citations, reportingEndYear);
    for (const [yearString, growth] of Object.entries(citationGrowthByYear)) {
      const year = Number(yearString);
      if (!citationsByYear[year]) citationsByYear[year] = {};
      for (const department of departments) {
        citationsByYear[year][department] = (citationsByYear[year][department] || 0) + growth;
      }
    }

    for (const [yearString, total] of Object.entries(cumulativeCitationByYear)) {
      const year = Number(yearString);
      if (!cumulativeCitationsByYear[year]) cumulativeCitationsByYear[year] = {};
      for (const department of departments) {
        cumulativeCitationsByYear[year][department] = (cumulativeCitationsByYear[year][department] || 0) + total;
      }
    }

    for (const specialty of publication.specialties) {
      specialtyCounts[specialty.specialty.name] = (specialtyCounts[specialty.specialty.name] || 0) + 1;
    }

    for (const [yearString, growth] of Object.entries(citationGrowthByYear)) {
      const year = Number(yearString);
      if (!specialtyCitationsByYear[year]) specialtyCitationsByYear[year] = {};

      for (const specialty of publication.specialties) {
        const specialtyName = specialty.specialty.name;
        specialtyCitationsByYear[year][specialtyName] =
          (specialtyCitationsByYear[year][specialtyName] || 0) + growth;
        specialtyCitationTotals[specialtyName] = (specialtyCitationTotals[specialtyName] || 0) + growth;
      }
    }

    for (const [yearString, total] of Object.entries(cumulativeCitationByYear)) {
      const year = Number(yearString);
      if (!specialtyCumulativeCitationsByYear[year]) specialtyCumulativeCitationsByYear[year] = {};

      for (const specialty of publication.specialties) {
        const specialtyName = specialty.specialty.name;
        specialtyCumulativeCitationsByYear[year][specialtyName] =
          (specialtyCumulativeCitationsByYear[year][specialtyName] || 0) + total;
      }
    }
  }

  const topSpecialtiesByCitations = Object.entries(specialtyCitationTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([specialty]) => specialty);

  const impactFactorDistribution = [
    { bucket: 'IF < 2', count: 0 },
    { bucket: 'IF 2-5', count: 0 },
    { bucket: 'IF 5-10', count: 0 },
    { bucket: 'IF > 10', count: 0 },
  ];

  for (const publication of uniquePublications) {
    const impactFactor = getPublicationImpactFactor(publication, metricLookup);
    if (impactFactor === null) continue;
    if (impactFactor < 2) impactFactorDistribution[0].count += 1;
    else if (impactFactor < 5) impactFactorDistribution[1].count += 1;
    else if (impactFactor <= 10) impactFactorDistribution[2].count += 1;
    else impactFactorDistribution[3].count += 1;
  }

  const { calcHIndex, calcI10Index } = await import('@/lib/utils');
  const researcherStats = researchers.map(researcher => {
    const citations = researcher.matches.map(match =>
      match.publication.citations.length > 0
        ? match.publication.citations[match.publication.citations.length - 1].citationCount
        : 0,
    );
    const impactFactors = researcher.matches
      .map(match => getPublicationImpactFactor(match.publication, metricLookup))
      .filter((value): value is number => value !== null);
    const citationByYear: Record<number, number> = {};
    const cumulativeCitationByYear: Record<number, number> = {};

    for (const match of researcher.matches) {
      const growthByYear = buildObservedCitationGrowthByYear(match.publication.citations, reportingEndYear);
      const cumulativeByYear = buildCumulativeCitationCountByYear(match.publication.citations, reportingEndYear);

      for (const [yearString, growth] of Object.entries(growthByYear)) {
        const year = Number(yearString);
        citationByYear[year] = (citationByYear[year] || 0) + growth;
      }

      for (const [yearString, total] of Object.entries(cumulativeByYear)) {
        const year = Number(yearString);
        cumulativeCitationByYear[year] = (cumulativeCitationByYear[year] || 0) + total;
      }
    }

    return {
      id: researcher.id,
      name: researcher.canonicalName,
      department: researcher.department,
      publications: researcher.matches.length,
      totalCitations: citations.reduce((sum, count) => sum + count, 0),
      hIndex: calcHIndex(citations),
      i10Index: calcI10Index(citations),
      avgImpactFactor: impactFactors.length > 0
        ? Number((impactFactors.reduce((sum, value) => sum + value, 0) / impactFactors.length).toFixed(2))
        : null,
      citationByYear,
      cumulativeCitationByYear,
    };
  }).sort((a, b) => b.hIndex - a.hIndex);

  const years = Array.from(new Set([
    ...Object.keys(publicationsByYear).map(Number),
    ...Object.keys(citationsByYear).map(Number),
    ...Object.keys(cumulativeCitationsByYear).map(Number),
    reportingEndYear,
  ])).sort((a, b) => a - b);

  const departmentKeys = departments.map(department => ({
    key: department.code,
    name: department.shortName || department.name,
    color: department.color || departmentHexColor(department.code),
  }));

  const departmentPublicationTotals = departmentKeys.map(department => ({
    name: department.name,
    code: department.key,
    value: years.reduce((sum, year) => sum + (publicationsByYear[year]?.[department.key] ?? 0), 0),
    color: department.color,
  }));

  return {
    publicationsByYear: years.map(year => ({
      year,
      ...departmentKeys.reduce<Record<string, number>>((acc, department) => {
        acc[department.key] = publicationsByYear[year]?.[department.key] ?? 0;
        return acc;
      }, {}),
    })),
    citationsByYear: years.map(year => ({
      year,
      ...departmentKeys.reduce<Record<string, number>>((acc, department) => {
        acc[department.key] = citationsByYear[year]?.[department.key] ?? 0;
        return acc;
      }, {}),
    })),
    cumulativeCitationsByYear: years.map(year => ({
      year,
      ...departmentKeys.reduce<Record<string, number>>((acc, department) => {
        acc[department.key] = cumulativeCitationsByYear[year]?.[department.key] ?? 0;
        return acc;
      }, {}),
    })),
    departmentKeys,
    departmentPublicationTotals,
    specialtyDistribution: Object.entries(specialtyCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([specialty, count]) => ({ specialty, count })),
    specialtyCitationTrends: years.map(year => ({
      year,
      ...topSpecialtiesByCitations.reduce<Record<string, number>>((acc, specialty) => {
        acc[specialty] = specialtyCitationsByYear[year]?.[specialty] ?? 0;
        return acc;
      }, {}),
    })),
    specialtyCumulativeCitationTrends: years.map(year => ({
      year,
      ...topSpecialtiesByCitations.reduce<Record<string, number>>((acc, specialty) => {
        acc[specialty] = specialtyCumulativeCitationsByYear[year]?.[specialty] ?? 0;
        return acc;
      }, {}),
    })),
    specialtyCitationTrendKeys: topSpecialtiesByCitations.map(specialty => ({
      key: specialty,
      name: specialty,
    })),
    impactFactorDistribution,
    researcherStats,
    researcherTrendYears: years,
  };
}
