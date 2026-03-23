import { prisma } from '@/lib/prisma';
import { calcHIndex, calcI10Index } from '@/lib/utils';
import type { ResearcherSummary } from '@/types';

export async function getAllResearchers(filters?: {
  department?: string;
  search?: string;
  active?: boolean;
}): Promise<ResearcherSummary[]> {
  const researchers = await prisma.researcher.findMany({
    where: {
      ...(filters?.department ? { department: filters.department } : {}),
      ...(filters?.active !== undefined ? { activeStatus: filters.active } : {}),
      ...(filters?.search ? {
        OR: [
          { canonicalName: { contains: filters.search } },
          { department: { contains: filters.search } },
          { aliases: { some: { aliasName: { contains: filters.search } } } },
        ],
      } : {}),
    },
    include: {
      aliases: true,
      specialties: { include: { specialty: true } },
      matches: {
        where: { manuallyExcluded: false },
        include: {
          publication: {
            include: {
              citations: { orderBy: { capturedAt: 'desc' }, take: 1 },
            },
          },
        },
      },
    },
    orderBy: { canonicalName: 'asc' },
  });

  return researchers.map(r => {
    const validMatches = r.matches.filter(m => !m.manuallyExcluded);
    const citations = validMatches.map(m => m.publication.citations[0]?.citationCount ?? 0);
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
      publicationCount: validMatches.length,
      totalCitations,
      hIndex,
      i10Index,
      profileCompleteness: completeness,
      specialties: r.specialties.map(s => s.specialty.name),
    };
  });
}

export async function getResearcherById(id: string, sluOnly = false) {
  const researcher = await prisma.researcher.findUnique({
    where: { id },
    include: {
      aliases: { orderBy: { aliasType: 'asc' } },
      identifiers: true,
      specialties: { include: { specialty: true } },
      matches: {
        where: {
          manuallyExcluded: false,
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

  const citations = researcher.matches.map(m =>
    m.publication.citations.length > 0
      ? m.publication.citations[m.publication.citations.length - 1].citationCount
      : 0
  );

  const totalCitations = citations.reduce((a, b) => a + b, 0);
  const hIndex = calcHIndex(citations);
  const i10Index = calcI10Index(citations);

  // Build citation trend by year
  const citByYear: Record<number, number> = {};
  for (const match of researcher.matches) {
    for (const cit of match.publication.citations) {
      const yr = cit.capturedAt.getFullYear();
      citByYear[yr] = (citByYear[yr] || 0) + cit.citationCount;
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

  // Co-authors (internal)
  const coauthorIds = new Set<string>();
  for (const match of researcher.matches) {
    const pub = match.publication as any;
    // We'd need to fetch co-authors separately in a real query
  }

  return {
    ...researcher,
    sluStartDate: researcher.sluStartDate?.toISOString() ?? null,
    totalCitations,
    hIndex,
    i10Index,
    publicationCount: researcher.matches.length,
    citationByYear: Object.entries(citByYear)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([year, citations]) => ({ year: Number(year), citations })),
    topJournals,
    specialties: researcher.specialties.map(s => s.specialty),
  };
}

export async function getCollaborationNetwork(department?: string) {
  const researchers = await prisma.researcher.findMany({
    where: department ? { department } : {},
    include: {
      matches: {
        where: { manuallyExcluded: false },
        select: { publicationId: true, researcherId: true },
      },
    },
  });

  // Build co-authorship edges
  const pubToResearchers: Record<string, string[]> = {};
  for (const r of researchers) {
    for (const m of r.matches) {
      if (!pubToResearchers[m.publicationId]) pubToResearchers[m.publicationId] = [];
      pubToResearchers[m.publicationId].push(r.id);
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
    department: r.department,
    publicationCount: r.matches.length,
  }));

  const edges = Object.entries(edgeMap).map(([key, weight]) => {
    const [source, target] = key.split('|');
    return { source, target, weight };
  });

  return { nodes, edges };
}
