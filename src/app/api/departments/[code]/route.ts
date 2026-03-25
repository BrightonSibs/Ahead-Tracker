import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { normalizeDepartmentCode } from '@/lib/services/departments';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role === 'VIEWER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { code: rawCode } = await params;
  const currentCode = normalizeDepartmentCode(rawCode);
  const body = await req.json();

  try {
    const existing = await prisma.department.findUnique({ where: { code: currentCode } });
    if (!existing) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 });
    }

    const nextCode = body.code ? normalizeDepartmentCode(String(body.code)) : currentCode;
    const nextName = body.name !== undefined ? String(body.name).trim() : existing.name;

    if (!nextCode) {
      return NextResponse.json({ error: 'Department code is required' }, { status: 400 });
    }

    if (!nextName) {
      return NextResponse.json({ error: 'Department name is required' }, { status: 400 });
    }

    const updated = await prisma.$transaction(async tx => {
      if (nextCode !== currentCode) {
        const duplicate = await tx.department.findUnique({ where: { code: nextCode } });
        if (duplicate) {
          throw new Error('A department with that code already exists');
        }

        await tx.researcher.updateMany({
          where: { department: currentCode },
          data: { department: nextCode },
        });
      }

      return tx.department.update({
        where: { code: currentCode },
        data: {
          code: nextCode,
          name: nextName,
          shortName: body.shortName !== undefined ? (body.shortName?.trim() || null) : undefined,
          color: body.color !== undefined ? (body.color?.trim() || null) : undefined,
          activeStatus: body.activeStatus !== undefined ? Boolean(body.activeStatus) : undefined,
          displayOrder: body.displayOrder !== undefined ? Number(body.displayOrder) : undefined,
        },
      });
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Unable to update department' }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { code: rawCode } = await params;
  const code = normalizeDepartmentCode(rawCode);

  try {
    const inUse = await prisma.researcher.count({ where: { department: code } });
    if (inUse > 0) {
      return NextResponse.json(
        { error: 'This department is still assigned to researchers. Reassign them first or mark the department inactive.' },
        { status: 400 },
      );
    }

    await prisma.department.delete({ where: { code } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Unable to delete department' }, { status: 400 });
  }
}
