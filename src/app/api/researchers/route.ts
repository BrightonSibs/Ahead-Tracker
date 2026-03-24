import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getAllResearchers, getResearchersSummary } from '@/lib/services/researchers';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const department = searchParams.get('department') || undefined;
  const search = searchParams.get('search') || undefined;
  const summary = searchParams.get('summary') === 'true';

  try {
    if (summary) {
      const researcherSummary = await getResearchersSummary({ department, search });
      return NextResponse.json(researcherSummary);
    }

    const researchers = await getAllResearchers({ department, search });
    return NextResponse.json(researchers);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role === 'VIEWER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const { prisma } = await import('@/lib/prisma');

  try {
    const researcher = await prisma.researcher.create({
      data: {
        facultyId: body.facultyId,
        canonicalName: body.canonicalName,
        department: body.department,
        orcid: body.orcid || null,
        sluStartDate: body.sluStartDate ? new Date(body.sluStartDate) : null,
        notes: body.notes || null,
      },
    });

    // Create aliases
    if (body.aliases?.length) {
      await prisma.researcherAlias.createMany({
        data: body.aliases.map((a: any) => ({
          researcherId: researcher.id,
          aliasName: a.aliasName,
          aliasType: a.aliasType || 'NAME_VARIANT',
          confidence: 1.0,
          source: 'manual',
        })),
      });
    }

    await prisma.auditLog.create({
      data: {
        entityType: 'researcher',
        entityId: researcher.id,
        action: 'CREATE',
        newData: JSON.stringify(body),
        userId: (session.user as any)?.id,
      },
    });

    return NextResponse.json(researcher, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
