import { prisma } from '@/lib/prisma';
import type { FilterState, PaginatedResult, PublicationSummary } from '@/types';

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

  const [total, pubs] = await Promise.all([
    prisma.publication.count({ where }),
    prisma.publication.findMany({
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
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  // Filter by impact factor post-query (needs journal metrics join)
  const journalMetrics = filters.minImpactFactor
    ? await prisma.journalMetric.findMany({
        where: { impactFactor: { gte: filters.minImpactFactor } },
        select: { journalName: true },
      })
    : null;
  const eligibleJournals = journalMetrics ? new Set(journalMetrics.map(j => j.journalName)) : null;

  const data: PublicationSummary[] = pubs
    .filter(p => !eligibleJournals || (p.journalName && eligibleJournals.has(p.journalName)))
    .map(p => ({
      id: p.id,
      title: p.title,
      doi: p.doi,
      publicationDate: p.publicationDate?.toISOString() ?? null,
      publicationYear: p.publicationYear,
      journalName: p.journalName,
      latestCitations: p.citations[0]?.citationCount ?? 0,
      impactFactor: null, // enriched separately
      verifiedStatus: p.verifiedStatus,
      sourcePrimary: p.sourcePrimary,
      authors: p.authors.map(a => a.authorName),
      matchedResearchers: p.matches.map(m => ({
        id: m.researcher.id,
        name: m.researcher.canonicalName,
        department: m.researcher.department,
        confidence: m.matchConfidence,
        matchType: m.matchType,
      })),
      specialties: p.specialties.map(s => s.specialty.name),
      includedInSluOutput: p.matches.some(m => m.includedInSluOutput),
    }));

  return {
    data,
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

  // Get journal IF for publication year
  const journalMetric = pub.journalName
    ? await prisma.journalMetric.findFirst({
        where: {
          journalName: pub.journalName,
          year: pub.publicationYear ?? new Date().getFullYear(),
        },
      })
    : null;

  // Build citation history for chart
  const citHistory = pub.citations.map(c => ({
    date: c.capturedAt.toISOString().split('T')[0],
    count: c.citationCount,
    source: c.source,
  }));

  return {
    ...pub,
    publicationDate: pub.publicationDate?.toISOString() ?? null,
    impactFactor: journalMetric?.impactFactor ?? null,
    citationHistory: citHistory,
    latestCitationCount: pub.citations.length > 0
      ? pub.citations[pub.citations.length - 1].citationCount
      : 0,
  };
}

export async function getAnalyticsData(filters: FilterState = {}) {
  const researcherWhere = filters.department ? { department: filters.department } : {};

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

  // Annual publications by dept
  const pubsByYear: Record<number, Record<string, number>> = {};
  const citsByYear: Record<number, Record<string, number>> = {};

  for (const r of researchers) {
    for (const match of r.matches) {
      const yr = match.publication.publicationYear ?? 0;
      if (!pubsByYear[yr]) pubsByYear[yr] = {};
      pubsByYear[yr][r.department] = (pubsByYear[yr][r.department] || 0) + 1;

      // Annual citations from history
      for (const cit of match.publication.citations) {
        const citYr = cit.capturedAt.getFullYear();
        if (!citsByYear[citYr]) citsByYear[citYr] = {};
        citsByYear[citYr][r.department] = (citsByYear[citYr][r.department] || 0) + cit.citationCount;
      }
    }
  }

  // Specialty distribution
  const specCounts: Record<string, number> = {};
  for (const r of researchers) {
    for (const match of r.matches) {
      for (const sp of match.publication.specialties) {
        specCounts[sp.specialty.name] = (specCounts[sp.specialty.name] || 0) + 1;
      }
    }
  }

  // Researcher h-index table
  const { calcHIndex, calcI10Index } = await import('@/lib/utils');
  const researcherStats = researchers.map(r => {
    const cits = r.matches.map(m =>
      m.publication.citations.length > 0
        ? m.publication.citations[m.publication.citations.length - 1].citationCount
        : 0
    );
    return {
      id: r.id,
      name: r.canonicalName,
      department: r.department,
      publications: r.matches.length,
      totalCitations: cits.reduce((a, b) => a + b, 0),
      hIndex: calcHIndex(cits),
      i10Index: calcI10Index(cits),
    };
  }).sort((a, b) => b.hIndex - a.hIndex);

  const years = Array.from(new Set([
    ...Object.keys(pubsByYear).map(Number),
    ...Object.keys(citsByYear).map(Number),
  ])).sort((a, b) => a - b);

  return {
    publicationsByYear: years.map(yr => ({
      year: yr,
      AHEAD: pubsByYear[yr]?.AHEAD ?? 0,
      HCOR: pubsByYear[yr]?.HCOR ?? 0,
    })),
    citationsByYear: years.map(yr => ({
      year: yr,
      AHEAD: citsByYear[yr]?.AHEAD ?? 0,
      HCOR: citsByYear[yr]?.HCOR ?? 0,
    })),
    specialtyDistribution: Object.entries(specCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([specialty, count]) => ({ specialty, count })),
    researcherStats,
  };
}
