import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getAnalyticsData } from '@/lib/services/publications';
import { prisma } from '@/lib/prisma';
import { calcHIndex, calcI10Index } from '@/lib/utils';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const department = sp.get('department') || undefined;
  const sluOnly = sp.get('sluOnly') === 'true';
  const type = sp.get('type') || 'full';

  try {
    if (type === 'dashboard') {
      // Lightweight stats for dashboard
      const [pubCount, resCount, alerts, recentJobs] = await Promise.all([
        prisma.publication.count(),
        prisma.researcher.count({ where: { activeStatus: true } }),
        prisma.alert.findMany({ where: { resolved: false }, orderBy: { createdAt: 'desc' }, take: 5 }),
        prisma.syncJob.findMany({ orderBy: { createdAt: 'desc' }, take: 3 }),
      ]);

      // Total citations from latest snapshots
      const allCitations = await prisma.citation.findMany({
        orderBy: { capturedAt: 'desc' },
        select: { publicationId: true, citationCount: true, capturedAt: true },
      });
      // Deduplicate to latest per publication
      const latestByPub: Record<string, number> = {};
      for (const c of allCitations) {
        if (!latestByPub[c.publicationId]) latestByPub[c.publicationId] = c.citationCount;
      }
      const totalCitations = Object.values(latestByPub).reduce((a, b) => a + b, 0);
      const avgCit = pubCount > 0 ? (totalCitations / pubCount).toFixed(1) : '0';

      // Citations this year
      const thisYear = new Date().getFullYear();
      const citThisYear = await prisma.citation.aggregate({
        where: { capturedAt: { gte: new Date(`${thisYear}-01-01`) } },
        _sum: { citationCount: true },
      });

      // Top researchers by h-index
      const researchers = await prisma.researcher.findMany({
        where: { activeStatus: true },
        include: {
          matches: {
            where: { manuallyExcluded: false },
            include: { publication: { include: { citations: { orderBy: { capturedAt: 'desc' }, take: 1 } } } },
          },
        },
        orderBy: { canonicalName: 'asc' },
      });

      const topResearchers = researchers
        .map(r => {
          const cits = r.matches.map(m => m.publication.citations[0]?.citationCount ?? 0);
          return {
            id: r.id,
            name: r.canonicalName,
            department: r.department,
            hIndex: calcHIndex(cits),
            totalCitations: cits.reduce((a, b) => a + b, 0),
          };
        })
        .sort((a, b) => b.hIndex - a.hIndex)
        .slice(0, 8);

      // Dept breakdown
      const depts = ['AHEAD', 'HCOR'];
      const byDept = await Promise.all(depts.map(async dept => {
        const rIds = researchers.filter(r => r.department === dept).map(r => r.id);
        const pubs = await prisma.publicationResearcherMatch.findMany({
          where: { researcherId: { in: rIds }, manuallyExcluded: false },
          select: { publicationId: true },
          distinct: ['publicationId'],
        });
        return { dept, publications: pubs.length, citations: 0 };
      }));

      return NextResponse.json({
        totalPublications: pubCount,
        totalResearchers: resCount,
        totalCitations,
        avgCitationsPerArticle: Number(avgCit),
        citationsThisYear: citThisYear._sum.citationCount ?? 0,
        alerts: alerts.map(a => ({ ...a, createdAt: a.createdAt.toISOString() })),
        recentJobs: recentJobs.map(j => ({
          ...j,
          startedAt: j.startedAt?.toISOString(),
          completedAt: j.completedAt?.toISOString(),
          createdAt: j.createdAt.toISOString(),
        })),
        topResearchers,
        byDepartment: byDept,
      });
    }

    // Full analytics
    const data = await getAnalyticsData({ department, sluOnly });
    return NextResponse.json(data);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
