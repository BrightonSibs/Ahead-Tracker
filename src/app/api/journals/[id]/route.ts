import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

function normalizeJournalName(value: unknown) {
  const normalized = String(value || '').trim().replace(/\s+/g, ' ');
  if (!normalized) {
    throw new Error('Journal name is required');
  }
  return normalized;
}

function normalizeOptionalString(value: unknown) {
  if (value === undefined) return undefined;
  const normalized = String(value || '').trim();
  return normalized || null;
}

function normalizeYear(value: unknown) {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1900 || parsed > 2100) {
    throw new Error('Year must be a whole number between 1900 and 2100');
  }
  return parsed;
}

function normalizeImpactFactor(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed < 0) {
    throw new Error('Impact factor must be a non-negative number');
  }
  return Number(parsed.toFixed(2));
}

function normalizeQuartile(value: unknown) {
  if (value === undefined) return undefined;
  const normalized = String(value || '').trim().toUpperCase();
  if (!['Q1', 'Q2', 'Q3', 'Q4'].includes(normalized)) {
    throw new Error('Quartile must be one of Q1, Q2, Q3, or Q4');
  }
  return normalized;
}

function normalizeSource(value: unknown) {
  if (value === undefined) return undefined;
  const normalized = String(value || '').trim();
  return normalized || 'manual';
}

async function requireEditorSession() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role === 'VIEWER') {
    return null;
  }
  return session;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireEditorSession();
  if (!session) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();

  try {
    const existing = await prisma.journalMetric.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const year = normalizeYear(body.year);
    const impactFactor = normalizeImpactFactor(body.impactFactor);
    const quartile = normalizeQuartile(body.quartile);
    const source = normalizeSource(body.source);

    const updated = await prisma.journalMetric.update({
      where: { id },
      data: {
        ...(body.journalName !== undefined ? { journalName: normalizeJournalName(body.journalName) } : {}),
        ...(body.issn !== undefined ? { issn: normalizeOptionalString(body.issn) } : {}),
        ...(year !== undefined ? { year } : {}),
        ...(impactFactor !== undefined ? { impactFactor } : {}),
        ...(quartile !== undefined ? { quartile } : {}),
        ...(source !== undefined ? { source } : {}),
      },
    });

    await prisma.auditLog.create({
      data: {
        entityType: 'journalMetric',
        entityId: id,
        action: 'UPDATE',
        previousData: JSON.stringify(existing),
        newData: JSON.stringify(updated),
        userId: (session.user as any)?.id,
      },
    });

    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unable to update journal metric' }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireEditorSession();
  if (!session) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const existing = await prisma.journalMetric.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await prisma.$transaction([
      prisma.auditLog.create({
        data: {
          entityType: 'journalMetric',
          entityId: id,
          action: 'DELETE',
          previousData: JSON.stringify(existing),
          newData: null,
          userId: (session.user as any)?.id,
        },
      }),
      prisma.journalMetric.delete({ where: { id } }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unable to delete journal metric' }, { status: 400 });
  }
}
