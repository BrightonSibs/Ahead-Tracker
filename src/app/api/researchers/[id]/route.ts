import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getResearcherById } from '@/lib/services/researchers';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sluOnly = req.nextUrl.searchParams.get('sluOnly') === 'true';

  try {
    const researcher = await getResearcherById(id, sluOnly);
    if (!researcher) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(researcher);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role === 'VIEWER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();

  try {
    const prev = await prisma.researcher.findUnique({ where: { id } });

    const updated = await prisma.researcher.update({
      where: { id },
      data: {
        ...(body.canonicalName !== undefined ? { canonicalName: body.canonicalName } : {}),
        ...(body.department !== undefined ? { department: body.department } : {}),
        ...(body.orcid !== undefined ? { orcid: body.orcid } : {}),
        ...(body.sluStartDate !== undefined ? { sluStartDate: body.sluStartDate ? new Date(body.sluStartDate) : null } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
        ...(body.activeStatus !== undefined ? { activeStatus: body.activeStatus } : {}),
      },
    });

    await prisma.auditLog.create({
      data: {
        entityType: 'researcher',
        entityId: id,
        action: 'UPDATE',
        previousData: prev ? JSON.stringify(prev) : null,
        newData: JSON.stringify(body),
        userId: (session.user as any)?.id,
        researcherId: id,
      },
    });

    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
