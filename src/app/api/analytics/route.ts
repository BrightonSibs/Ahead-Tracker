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

  for (const publicationCitations of citationsByPublication.values()) {
    const latestCount = publicationCitations[publicationCitations.length - 1]?.citationCount ?? 0;
    totalCitations += latestCount;

    const growthByYear = buildObservedCitationGrowthByYear(publicationCitations);
    citationsThisYear += growthByYear[currentYear] ?? 0;
  }

  return { totalCitations, citationsThisYear };
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
          include: {
            matches: {
              where: matchWhere,
              include: {
                publication: {
                  include: { citations: { orderBy: { capturedAt: 'desc' }, take: 1 } },
                },
              },
            },
          },
          orderBy: { canonicalName: 'asc' },
        }),
        prisma.publicationResearcherMatch.findMany({
          where: matchWhere,
          select: { publicationId: true },
          distinct: ['publicationId'],
        }),
      ]);

      const publicationIds = publicationMatches.map(match => match.publicationId);
      const pubCount = publicationIds.length;
      const thisYear = new Date().getFullYear();

      const citationHistory = publicationIds.length > 0
        ? await prisma.citation.findMany({
            where: { publicationId: { in: publicationIds } },
            orderBy: [
              { publicationId: 'asc' },
              { capturedAt: 'asc' },
              { id: 'asc' },
            ],
            select: { publicationId: true, citationCount: true, capturedAt: true },
          })
        : [];
      const { totalCitations, citationsThisYear } = buildCitationSummaries(citationHistory, thisYear);
      const avgCit = pubCount > 0 ? (totalCitations / pubCount).toFixed(1) : '0';

      const topResearchers = researchers
        .map(researcher => {
          const citations = researcher.matches.map(match => match.publication.citations[0]?.citationCount ?? 0);
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

      const depts = departments.map(item => item.code);
      const byDept = await Promise.all(
        depts.map(async dept => {
          const pubs = await prisma.publicationResearcherMatch.findMany({
            where: {
              manuallyExcluded: false,
              ...(sluOnly ? { includedInSluOutput: true } : {}),
              researcher: { department: dept },
            },
            select: { publicationId: true },
            distinct: ['publicationId'],
          });

          const meta = departments.find(item => item.code === dept);
          return {
            dept,
            name: meta?.shortName || meta?.name || dept,
            color: meta?.color || departmentHexColor(dept),
            publications: pubs.length,
            citations: 0,
          };
        }),
      );

      return NextResponse.json({
        totalPublications: pubCount,
        totalResearchers: resCount,
        totalCitations,
        avgCitationsPerArticle: Number(avgCit),
        citationsThisYear,
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
