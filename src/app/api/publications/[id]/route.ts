import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getPublicationById } from '@/lib/services/publications';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const pub = await getPublicationById(id);
    if (!pub) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(pub);
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
    const prev = await prisma.publication.findUnique({ where: { id } });

    const updated = await prisma.publication.update({
      where: { id },
      data: {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.doi !== undefined ? { doi: body.doi } : {}),
        ...(body.journalName !== undefined ? { journalName: body.journalName } : {}),
        ...(body.publicationDate !== undefined ? { publicationDate: new Date(body.publicationDate) } : {}),
        ...(body.publicationYear !== undefined ? { publicationYear: Number(body.publicationYear) } : {}),
        ...(body.verifiedStatus !== undefined ? { verifiedStatus: body.verifiedStatus } : {}),
        ...(body.abstract !== undefined ? { abstract: body.abstract } : {}),
      },
    });

    // Handle researcher match exclusion
    if (body.excludeResearcherId) {
      await prisma.publicationResearcherMatch.updateMany({
        where: { publicationId: id, researcherId: body.excludeResearcherId },
        data: { manuallyExcluded: true, exclusionReason: body.exclusionReason || 'Manual exclusion' },
      });
      await prisma.manualOverride.create({
        data: {
          publicationId: id,
          overrideType: 'RESEARCHER_ASSIGNMENT',
          newValue: body.excludeResearcherId,
          reason: body.exclusionReason || 'Manual exclusion',
          userId: (session.user as any)?.id,
        },
      });
    }

    await prisma.auditLog.create({
      data: {
        entityType: 'publication',
        entityId: id,
        action: 'UPDATE',
        previousData: prev ? JSON.stringify(prev) : null,
        newData: JSON.stringify(body),
        userId: (session.user as any)?.id,
        publicationId: id,
      },
    });

    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
