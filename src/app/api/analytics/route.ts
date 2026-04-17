import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { buildObservedCitationGrowthByYear } from '@/lib/citation-metrics';
import { getAllDepartments } from '@/lib/services/departments';
import { getAnalyticsData } from '@/lib/services/publications';
import { prisma } from '@/lib/prisma';
import { departmentHexColor } from '@/lib/utils';
import { calcHIndex } from '@/lib/utils';

function buildCitationSummaries(
  citations: Array<{ publicationId: string; citationCount: number; capturedAt: Date }>,
  currentYear: number,
) {
  const citationsByPublication = new Map<string, Array<{ citationCount: number; capturedAt: Date }>>();
  for (const citation of citations) {
    const existing = citationsByPublication.get(citation.publicationId);
    if (existing) {
      existing.push({ citationCount: citation.citationCount, capturedAt: citation.capturedAt });
    } else {
      citationsByPublication.set(citation.publicationId, [
        { citationCount: citation.citationCount, capturedAt: citation.capturedAt },
      ]);
    }
  }

  let totalCitations = 0;
  let citationsThisYear = 0;
  let publicationsWithCitationData = 0;

  for (const publicationCitations of citationsByPublication.values()) {
    const latestCount = publicationCitations[publicationCitations.length - 1]?.citationCount ?? 0;
    totalCitations += latestCount;
    publicationsWithCitationData += 1;

    const growthByYear = buildObservedCitationGrowthByYear(publicationCitations);
    citationsThisYear += growthByYear[currentYear] ?? 0;
  }

  return { totalCitations, citationsThisYear, publicationsWithCitationData };
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const department = sp.get('department') || undefined;
  const sluOnly = sp.get('sluOnly') === 'true';
  const type = sp.get('type') || 'full';

  try {
    if (type === 'dashboard') {
      const matchWhere = {
        manuallyExcluded: false,
        publication: { verifiedStatus: { not: 'EXCLUDED' } },
        ...(sluOnly ? { includedInSluOutput: true } : {}),
        ...(department ? { researcher: { department } } : {}),
      };

      const [resCount, alerts, recentJobs, researchers, publicationMatches] = await Promise.all([
        prisma.researcher.count({
          where: {
            activeStatus: true,
            ...(department ? { department } : {}),
          },
        }),
        prisma.alert.findMany({ where: { resolved: false }, orderBy: { createdAt: 'desc' }, take: 5 }),
        prisma.syncJob.findMany({ orderBy: { createdAt: 'desc' }, take: 3 }),
        prisma.researcher.findMany({
          where: {
            activeStatus: true,
            ...(department ? { department } : {}),
          },
          select: {
            id: true,
            canonicalName: true,
            department: true,
          },
          orderBy: { canonicalName: 'asc' },
        }),
        prisma.publicationResearcherMatch.findMany({
          where: matchWhere,
          select: { publicationId: true, researcherId: true },
        }),
      ]);

      const uniquePublicationIds = Array.from(new Set(publicationMatches.map(match => match.publicationId)));
      const pubCount = uniquePublicationIds.length;
      const thisYear = new Date().getFullYear();
      const publicationStatusCounts = uniquePublicationIds.length > 0
        ? await prisma.publication.groupBy({
            by: ['verifiedStatus'],
            where: { id: { in: uniquePublicationIds } },
            _count: { _all: true },
          })
        : [];
      const verifiedPublications = publicationStatusCounts.find(item => item.verifiedStatus === 'VERIFIED')?._count._all ?? 0;
      const reviewPublications = publicationStatusCounts.find(item => item.verifiedStatus === 'NEEDS_REVIEW')?._count._all ?? 0;

      const citationHistory = uniquePublicationIds.length > 0
        ? await prisma.citation.findMany({
            where: { publicationId: { in: uniquePublicationIds } },
            orderBy: [
              { publicationId: 'asc' },
              { capturedAt: 'asc' },
              { id: 'asc' },
            ],
            select: { publicationId: true, citationCount: true, capturedAt: true },
          })
        : [];
      const { totalCitations, citationsThisYear, publicationsWithCitationData } = buildCitationSummaries(citationHistory, thisYear);
      const publicationsWithoutCitationData = Math.max(0, pubCount - publicationsWithCitationData);
      const avgCit = publicationsWithCitationData > 0 ? (totalCitations / publicationsWithCitationData).toFixed(1) : '0';

      const latestByPublication = new Map<string, number>();
      for (const citation of citationHistory) {
        latestByPublication.set(citation.publicationId, citation.citationCount);
      }

      const publicationIdsByResearcher = new Map<string, string[]>();
      const publicationIdsByDepartment = new Map<string, Set<string>>();
      for (const match of publicationMatches) {
        const researcherPublications = publicationIdsByResearcher.get(match.researcherId);
        if (researcherPublications) {
          researcherPublications.push(match.publicationId);
        } else {
          publicationIdsByResearcher.set(match.researcherId, [match.publicationId]);
        }
      }

      const topResearchers = researchers
        .map(researcher => {
          const publicationIds = publicationIdsByResearcher.get(researcher.id) || [];
          const citations = publicationIds.map(publicationId => latestByPublication.get(publicationId) ?? 0);
          return {
            id: researcher.id,
            name: researcher.canonicalName,
            department: researcher.department,
            hIndex: calcHIndex(citations),
            totalCitations: citations.reduce((a, b) => a + b, 0),
          };
        })
        .sort((a, b) => b.hIndex - a.hIndex)
        .slice(0, 8);

      const departments = (await getAllDepartments(false))
        .filter(item => (department ? item.code === department : true));

      const researcherDepartmentById = new Map(researchers.map(researcher => [researcher.id, researcher.department]));
      for (const match of publicationMatches) {
        const dept = researcherDepartmentById.get(match.researcherId);
        if (!dept) continue;
        if (!publicationIdsByDepartment.has(dept)) {
          publicationIdsByDepartment.set(dept, new Set());
        }
        publicationIdsByDepartment.get(dept)!.add(match.publicationId);
      }

      const byDept = departments.map(item => ({
        dept: item.code,
        name: item.shortName || item.name || item.code,
        color: item.color || departmentHexColor(item.code),
        publications: publicationIdsByDepartment.get(item.code)?.size ?? 0,
        citations: Array.from(publicationIdsByDepartment.get(item.code) || []).reduce(
          (sum, publicationId) => sum + (latestByPublication.get(publicationId) ?? 0),
          0,
        ),
      }));

      return NextResponse.json({
        totalPublications: pubCount,
        totalResearchers: resCount,
        totalCitations,
        avgCitationsPerArticle: Number(avgCit),
        citationsThisYear,
        verifiedPublications,
        reviewPublications,
        publicationsWithCitationData,
        publicationsWithoutCitationData,
        alerts: alerts.map(alert => ({ ...alert, createdAt: alert.createdAt.toISOString() })),
        recentJobs: recentJobs.map(job => ({
          ...job,
          startedAt: job.startedAt?.toISOString(),
          completedAt: job.completedAt?.toISOString(),
          createdAt: job.createdAt.toISOString(),
        })),
        topResearchers,
        byDepartment: byDept,
      });
    }

    const data = await getAnalyticsData({ department, sluOnly });
    return NextResponse.json(data);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
