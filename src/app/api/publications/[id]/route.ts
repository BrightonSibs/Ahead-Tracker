import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getPublicationById } from '@/lib/services/publications';
import { prisma } from '@/lib/prisma';

function normalizeTitle(value: string) {
  return value.replace(/\s+/g, ' ').trim().toLowerCase().replace(/[^a-z0-9\s]/g, '');
}

function parseOptionalDate(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Invalid publication date');
  }
  return parsed;
}

function parseOptionalNumber(value: unknown, fieldName: string) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid ${fieldName}`);
  }
  return parsed;
}

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
    if (!prev) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const publicationDate = parseOptionalDate(body.publicationDate);
    const publicationYear = parseOptionalNumber(body.publicationYear, 'publication year');

    let updated = await prisma.publication.update({
      where: { id },
      data: {
        ...(body.title !== undefined ? { title: body.title, normalizedTitle: normalizeTitle(body.title) } : {}),
        ...(body.doi !== undefined ? { doi: body.doi } : {}),
        ...(body.journalName !== undefined ? { journalName: body.journalName } : {}),
        ...(publicationDate !== undefined ? { publicationDate } : {}),
        ...(publicationYear !== undefined ? { publicationYear } : {}),
        ...(body.verifiedStatus !== undefined ? { verifiedStatus: body.verifiedStatus } : {}),
        ...(body.abstract !== undefined ? { abstract: body.abstract } : {}),
      },
    });

    const actorId = (session.user as any)?.id;
    const removeResearcherId = body.excludeResearcherId || body.removeResearcherId;

    if (removeResearcherId) {
      await prisma.publicationResearcherMatch.updateMany({
        where: { publicationId: id, researcherId: removeResearcherId },
        data: { manuallyExcluded: true, exclusionReason: body.exclusionReason || 'Manual exclusion' },
      });
      await prisma.manualOverride.create({
        data: {
          publicationId: id,
          overrideType: 'RESEARCHER_ASSIGNMENT',
          newValue: removeResearcherId,
          reason: body.exclusionReason || 'Manual exclusion',
          userId: actorId,
        },
      });
    }

    if (body.restoreResearcherId) {
      await prisma.publicationResearcherMatch.updateMany({
        where: { publicationId: id, researcherId: body.restoreResearcherId },
        data: { manuallyExcluded: false, exclusionReason: null, manuallyConfirmed: true },
      });
      await prisma.manualOverride.create({
        data: {
          publicationId: id,
          overrideType: 'RESTORE_RESEARCHER_ASSIGNMENT',
          newValue: body.restoreResearcherId,
          reason: body.restoreReason || 'Manual restoration',
          userId: actorId,
        },
      });
    }

    if (body.addResearcherId) {
      const researcher = await prisma.researcher.findUnique({
        where: { id: body.addResearcherId },
        select: { id: true, sluStartDate: true },
      });

      if (!researcher) {
        return NextResponse.json({ error: 'Researcher not found' }, { status: 404 });
      }

      const includedInSluOutput = !researcher.sluStartDate
        || !updated.publicationDate
        || updated.publicationDate >= researcher.sluStartDate;

      await prisma.publicationResearcherMatch.upsert({
        where: {
          publicationId_researcherId: {
            publicationId: id,
            researcherId: researcher.id,
          },
        },
        update: {
          manuallyExcluded: false,
          exclusionReason: null,
          matchType: 'MANUAL_ASSIGNMENT',
          matchConfidence: 1.0,
          manuallyConfirmed: true,
          includedInSluOutput,
        },
        create: {
          publicationId: id,
          researcherId: researcher.id,
          matchType: 'MANUAL_ASSIGNMENT',
          matchConfidence: 1.0,
          manuallyConfirmed: true,
          manuallyExcluded: false,
          includedInSluOutput,
        },
      });

      await prisma.manualOverride.create({
        data: {
          publicationId: id,
          overrideType: 'ADD_RESEARCHER_ASSIGNMENT',
          newValue: researcher.id,
          reason: body.addReason || 'Manual assignment',
          userId: actorId,
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
        userId: actorId,
        publicationId: id,
      },
    });

    updated = await prisma.publication.findUniqueOrThrow({ where: { id } });
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const existing = await prisma.publication.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await prisma.auditLog.create({
      data: {
        entityType: 'publication',
        entityId: id,
        action: 'DELETE',
        previousData: JSON.stringify(existing),
        newData: null,
        userId: (session.user as any)?.id,
        publicationId: id,
      },
    });

    await prisma.publication.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
