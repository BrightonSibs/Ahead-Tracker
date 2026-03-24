import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getResearcherById } from '@/lib/services/researchers';
import { prisma } from '@/lib/prisma';

function normalizeOrcid(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null) return null;

  const normalized = String(value)
    .trim()
    .replace(/^https?:\/\/orcid\.org\//i, '')
    .replace(/^orcid\.org\//i, '')
    .toUpperCase();

  if (!normalized) return null;

  if (!/^\d{4}-\d{4}-\d{4}-[\dX]$/.test(normalized)) {
    throw new Error('ORCID must be in the format 0000-0000-0000-0000');
  }

  return normalized;
}

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
    if (!prev) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const normalizedOrcid = normalizeOrcid(body.orcid);
    const updated = await prisma.$transaction(async tx => {
      const researcher = await tx.researcher.update({
        where: { id },
        data: {
          ...(body.canonicalName !== undefined ? { canonicalName: body.canonicalName } : {}),
          ...(body.department !== undefined ? { department: body.department } : {}),
          ...(normalizedOrcid !== undefined ? { orcid: normalizedOrcid } : {}),
          ...(body.sluStartDate !== undefined ? { sluStartDate: body.sluStartDate ? new Date(body.sluStartDate) : null } : {}),
          ...(body.notes !== undefined ? { notes: body.notes } : {}),
          ...(body.activeStatus !== undefined ? { activeStatus: body.activeStatus } : {}),
        },
      });

      if (normalizedOrcid !== undefined) {
        await tx.researcherIdentifier.deleteMany({
          where: {
            researcherId: id,
            identifierType: 'ORCID',
            ...(normalizedOrcid ? { value: { not: normalizedOrcid } } : {}),
          },
        });

        if (normalizedOrcid) {
          const existingIdentifier = await tx.researcherIdentifier.findUnique({
            where: {
              identifierType_value: {
                identifierType: 'ORCID',
                value: normalizedOrcid,
              },
            },
          });

          if (existingIdentifier && existingIdentifier.researcherId !== id) {
            throw new Error('That ORCID is already assigned to another researcher');
          }

          await tx.researcherIdentifier.upsert({
            where: {
              identifierType_value: {
                identifierType: 'ORCID',
                value: normalizedOrcid,
              },
            },
            update: {
              researcherId: id,
              verified: true,
            },
            create: {
              researcherId: id,
              identifierType: 'ORCID',
              value: normalizedOrcid,
              verified: true,
            },
          });
        } else {
          await tx.researcherIdentifier.deleteMany({
            where: { researcherId: id, identifierType: 'ORCID' },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          entityType: 'researcher',
          entityId: id,
          action: 'UPDATE',
          previousData: JSON.stringify(prev),
          newData: JSON.stringify({
            ...body,
            ...(normalizedOrcid !== undefined ? { orcid: normalizedOrcid } : {}),
          }),
          userId: (session.user as any)?.id,
          researcherId: id,
        },
      });

      return researcher;
    });

    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
