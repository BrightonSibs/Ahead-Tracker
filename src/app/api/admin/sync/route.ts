import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { runSyncJob } from '@/lib/services/sync';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !['ADMIN', 'ANALYST'].includes((session.user as any)?.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const jobs = await prisma.syncJob.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return NextResponse.json(jobs.map(j => ({
    ...j,
    startedAt: j.startedAt?.toISOString(),
    completedAt: j.completedAt?.toISOString(),
    createdAt: j.createdAt.toISOString(),
  })));
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !['ADMIN', 'ANALYST'].includes((session.user as any)?.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const { source, researcherId } = body;
  if (source === 'GOOGLE_SCHOLAR' && !process.env.SERPAPI_KEY) {
    return NextResponse.json(
      {
        error: 'Google Scholar sync needs SERPAPI_KEY in .env.local. Add it and restart the dev server.',
      },
      { status: 400 },
    );
  }

  const job = await runSyncJob(source || 'CROSSREF', (session.user as any)?.id, researcherId || undefined);

  return NextResponse.json({
    ...job,
    startedAt: job.startedAt?.toISOString(),
    completedAt: job.completedAt?.toISOString(),
    createdAt: job.createdAt.toISOString(),
  });
}
