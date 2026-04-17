import { prisma } from '@/lib/prisma';
import {
  buildCumulativeCitationCountByYear,
  buildObservedCitationGrowthByYear,
  getLatestCitationCount,
  getLatestCitationCountOrNull,
} from '@/lib/citation-metrics';
import { calcHIndex, calcI10Index } from '@/lib/utils';
import type { ResearcherSummary } from '@/types';

function buildResearcherWhere(filters?: {
  department?: string;
  search?: string;
  active?: boolean;
}) {
  return {
    ...(filters?.department ? { department: filters.department } : {}),
    ...(filters?.active !== undefined ? { activeStatus: filters.active } : {}),
    ...(filters?.search ? {
      OR: [
        { canonicalName: { contains: filters.search } },
        { department: { contains: filters.search } },
        { aliases: { some: { aliasName: { contains: filters.search } } } },
      ],
    } : {}),
  };
}

async function getLatestCitationCountMap(publicationIds: string[]) {
  if (publicationIds.length === 0) {
    return new Map<string, number>();
  }

  const citations = await prisma.citation.findMany({
    where: { publicationId: { in: publicationIds } },
    orderBy: [
      { publicationId: 'asc' },
      { capturedAt: 'desc' },
      { id: 'desc' },
    ],
    select: { publicationId: true, citationCount: true },
  });

  const latestByPublication = new Map<string, number>();
  for (const citation of citations) {
    if (!latestByPublication.has(citation.publicationId)) {
      latestByPublication.set(citation.publicationId, citation.citationCount);
    }
  }

  return latestByPublication;
}

export async function getAllResearchers(filters?: {
  department?: string;
  search?: string;
  active?: boolean;
}): Promise<ResearcherSummary[]> {
  const researchers = await prisma.researcher.findMany({
    where: buildResearcherWhere(filters),
    include: {
      aliases: true,
      specialties: { include: { specialty: true } },
    },
    orderBy: { canonicalName: 'asc' },
  });

  const researcherIds = researchers.map(researcher => researcher.id);
  const matches = researcherIds.length > 0
    ? await prisma.publicationResearcherMatch.findMany({
        where: {
          researcherId: { in: researcherIds },
          manuallyExcluded: false,
          publication: { verifiedStatus: { not: 'EXCLUDED' } },
        },
        select: {
          researcherId: true,
          publicationId: true,
        },
      })
    : [];

  const latestCitations = await getLatestCitationCountMap(matches.map(match => match.publicationId));
  const matchesByResearcher = new Map<string, string[]>();

  for (const match of matches) {
    const existing = matchesByResearcher.get(match.researcherId);
    if (existing) {
      existing.push(match.publicationId);
    } else {
      matchesByResearcher.set(match.researcherId, [match.publicationId]);
    }
  }

  return researchers.map(r => {
    const publicationIds = matchesByResearcher.get(r.id) || [];
    const citations = publicationIds.map(publicationId => latestCitations.get(publicationId) ?? 0);
    const totalCitations = citations.reduce((a, b) => a + b, 0);
    const hIndex = calcHIndex(citations);
    const i10Index = calcI10Index(citations);

    // Profile completeness score
    let completeness = 0;
    if (r.canonicalName) completeness += 20;
    if (r.orcid) completeness += 25;
    if (r.sluStartDate) completeness += 25;
    if (r.aliases.length > 0) completeness += 15;
    if (r.specialties.length > 0) completeness += 15;

    return {
      id: r.id,
      facultyId: r.facultyId,
      canonicalName: r.canonicalName,
      department: r.department,
      orcid: r.orcid,
      sluStartDate: r.sluStartDate?.toISOString() ?? null,
      activeStatus: r.activeStatus,
      notes: r.notes,
      aliasCount: r.aliases.length,
      publicationCount: publicationIds.length,
      totalCitations,
      hIndex,
      i10Index,
      profileCompleteness: completeness,
      specialties: r.specialties.map(s => s.specialty.name),
    };
  });
}

export async function getResearchersSummary(filters?: {
  department?: string;
  search?: string;
  active?: boolean;
  sluOnly?: boolean;
}) {
  const researcherWhere = buildResearcherWhere(filters);

  const [researcherCount, publicationMatches] = await Promise.all([
    prisma.researcher.count({ where: researcherWhere }),
    prisma.publicationResearcherMatch.findMany({
      where: {
        manuallyExcluded: false,
        publication: { verifiedStatus: { not: 'EXCLUDED' } },
        ...(filters?.sluOnly ? { includedInSluOutput: true } : {}),
        researcher: researcherWhere,
      },
      select: { publicationId: true },
      distinct: ['publicationId'],
    }),
  ]);

  const publicationIds = publicationMatches.map(match => match.publicationId);
  if (publicationIds.length === 0) {
    return {
      totalResearchers: researcherCount,
      totalPublications: 0,
      totalCitations: 0,
    };
  }

  const citations = await prisma.citation.findMany({
    where: { publicationId: { in: publicationIds } },
    orderBy: { capturedAt: 'desc' },
    select: { publicationId: true, citationCount: true },
  });

  const latestByPublication: Record<string, number> = {};
  for (const citation of citations) {
    if (!(citation.publicationId in latestByPublication)) {
      latestByPublication[citation.publicationId] = citation.citationCount;
    }
  }

  return {
    totalResearchers: researcherCount,
    totalPublications: publicationIds.length,
    totalCitations: Object.values(latestByPublication).reduce((sum, count) => sum + count, 0),
  };
}

export async function getResearcherById(id: string, sluOnly = false) {
  const reportingEndYear = new Date().getFullYear();
  const researcher = await prisma.researcher.findUnique({
    where: { id },
    include: {
      aliases: { orderBy: { aliasType: 'asc' } },
      identifiers: true,
      specialties: { include: { specialty: true } },
      matches: {
        where: {
          manuallyExcluded: false,
          publication: { verifiedStatus: { not: 'EXCLUDED' } },
          ...(sluOnly ? { includedInSluOutput: true } : {}),
        },
        include: {
          publication: {
            include: {
              citations: { orderBy: { capturedAt: 'asc' } },
              specialties: { include: { specialty: true } },
              authors: { orderBy: { authorOrder: 'asc' } },
            },
          },
        },
        orderBy: { publication: { publicationDate: 'desc' } },
      },
    },
  });

  if (!researcher) return null;

  const citationValues = researcher.matches.map(match => getLatestCitationCountOrNull(match.publication.citations));
  const citations = citationValues.map(value => value ?? 0);
  const publicationsWithCitationData = citationValues.filter((value): value is number => value !== null).length;

  const totalCitations = citations.reduce((a, b) => a + b, 0);
  const hIndex = calcHIndex(citations);
  const i10Index = calcI10Index(citations);

  // Build a conservative year-over-year growth series from stored snapshots.
  const citByYear: Record<number, number> = {};
  const cumulativeCitByYear: Record<number, number> = {};
  for (const match of researcher.matches) {
    const growthByYear = buildObservedCitationGrowthByYear(match.publication.citations, reportingEndYear);
    const cumulativeByYear = buildCumulativeCitationCountByYear(match.publication.citations, reportingEndYear);
    for (const [year, growth] of Object.entries(growthByYear)) {
      const numericYear = Number(year);
      citByYear[numericYear] = (citByYear[numericYear] || 0) + growth;
    }

    for (const [year, citations] of Object.entries(cumulativeByYear)) {
      const numericYear = Number(year);
      cumulativeCitByYear[numericYear] = (cumulativeCitByYear[numericYear] || 0) + citations;
    }
  }

  // Top journals
  const journalCounts: Record<string, number> = {};
  for (const match of researcher.matches) {
    const j = match.publication.journalName;
    if (j) journalCounts[j] = (journalCounts[j] || 0) + 1;
  }
  const topJournals = Object.entries(journalCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  const publicationIds = researcher.matches.map(match => match.publicationId);
  const collaboratorMatches = publicationIds.length > 0
    ? await prisma.publicationResearcherMatch.findMany({
        where: {
          publicationId: { in: publicationIds },
          manuallyExcluded: false,
          publication: { verifiedStatus: { not: 'EXCLUDED' } },
          researcherId: { not: id },
        },
        include: {
          researcher: {
            select: {
              id: true,
              canonicalName: true,
              department: true,
            },
          },
        },
      })
    : [];

  const publicationDetailsById = new Map(
    researcher.matches.map(match => [
      match.publicationId,
      {
        title: match.publication.title,
        publicationYear: match.publication.publicationYear,
        latestCitations: getLatestCitationCountOrNull(match.publication.citations),
      },
    ]),
  );

  const collaboratorCounts = new Map<string, {
    id: string;
    name: string;
    department: string;
    sharedPublications: number;
    sharedCitations: number;
    latestSharedYear: number | null;
    samplePublicationTitles: string[];
  }>();
  for (const match of collaboratorMatches) {
    const publicationDetails = publicationDetailsById.get(match.publicationId);
    const existing = collaboratorCounts.get(match.researcherId);
    if (existing) {
      existing.sharedPublications += 1;
      existing.sharedCitations += publicationDetails?.latestCitations ?? 0;
      existing.latestSharedYear = Math.max(existing.latestSharedYear ?? 0, publicationDetails?.publicationYear ?? 0) || null;
      if (
        publicationDetails?.title
        && existing.samplePublicationTitles.length < 3
        && !existing.samplePublicationTitles.includes(publicationDetails.title)
      ) {
        existing.samplePublicationTitles.push(publicationDetails.title);
      }
    } else {
      collaboratorCounts.set(match.researcherId, {
        id: match.researcher.id,
        name: match.researcher.canonicalName,
        department: match.researcher.department,
        sharedPublications: 1,
        sharedCitations: publicationDetails?.latestCitations ?? 0,
        latestSharedYear: publicationDetails?.publicationYear ?? null,
        samplePublicationTitles: publicationDetails?.title ? [publicationDetails.title] : [],
      });
    }
  }

  const topCollaborators = Array.from(collaboratorCounts.values())
    .sort((a, b) =>
      b.sharedPublications - a.sharedPublications
      || b.sharedCitations - a.sharedCitations
      || a.name.localeCompare(b.name))
    .slice(0, 8);

  const citationYears = Array.from(new Set([
    ...Object.keys(citByYear).map(Number),
    ...Object.keys(cumulativeCitByYear).map(Number),
  ])).sort((a, b) => a - b);

  return {
    ...researcher,
    sluStartDate: researcher.sluStartDate?.toISOString() ?? null,
    totalCitations,
    publicationsWithCitationData,
    publicationsWithoutCitationData: researcher.matches.length - publicationsWithCitationData,
    hIndex,
    i10Index,
    publicationCount: researcher.matches.length,
    citationByYear: citationYears
      .map(year => ({ year, citations: citByYear[year] ?? 0 })),
    cumulativeCitationByYear: citationYears
      .map(year => ({ year, citations: cumulativeCitByYear[year] ?? 0 })),
    topJournals,
    topCollaborators,
    specialties: researcher.specialties.map(s => s.specialty),
  };
}

export async function getCollaborationNetwork(department?: string) {
  const researchers = await prisma.researcher.findMany({
    where: department ? { department } : {},
    select: {
      id: true,
      canonicalName: true,
      department: true,
    },
  });

  const researcherIds = researchers.map(researcher => researcher.id);
  const matches = researcherIds.length > 0
    ? await prisma.publicationResearcherMatch.findMany({
        where: {
          researcherId: { in: researcherIds },
          manuallyExcluded: false,
          publication: { verifiedStatus: { not: 'EXCLUDED' } },
        },
        select: {
          researcherId: true,
          publicationId: true,
        },
      })
    : [];

  const latestCitations = await getLatestCitationCountMap(matches.map(match => match.publicationId));
  const matchesByResearcher = new Map<string, string[]>();

  // Build co-authorship edges
  const pubToResearchers: Record<string, string[]> = {};
  for (const match of matches) {
    if (!pubToResearchers[match.publicationId]) pubToResearchers[match.publicationId] = [];
    pubToResearchers[match.publicationId].push(match.researcherId);

    const existing = matchesByResearcher.get(match.researcherId);
    if (existing) {
      existing.push(match.publicationId);
    } else {
      matchesByResearcher.set(match.researcherId, [match.publicationId]);
    }
  }

  const edgeMap: Record<string, number> = {};
  for (const [, ids] of Object.entries(pubToResearchers)) {
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const key = [ids[i], ids[j]].sort().join('|');
        edgeMap[key] = (edgeMap[key] || 0) + 1;
      }
    }
  }

  const nodes = researchers.map(r => ({
    id: r.id,
    name: r.canonicalName,
    canonicalName: r.canonicalName,
    department: r.department,
    publicationCount: (matchesByResearcher.get(r.id) || []).length,
    publicationsWithCitationData: (matchesByResearcher.get(r.id) || []).filter(publicationId => latestCitations.has(publicationId)).length,
    totalCitations: (matchesByResearcher.get(r.id) || []).reduce((sum, publicationId) => sum + (latestCitations.get(publicationId) ?? 0), 0),
    hIndex: calcHIndex((matchesByResearcher.get(r.id) || []).map(publicationId => latestCitations.get(publicationId) ?? 0)),
  }));

  const edges = Object.entries(edgeMap).map(([key, weight]) => {
    const [source, target] = key.split('|');
    return { source, target, weight };
  });

  return { nodes, edges };
}
