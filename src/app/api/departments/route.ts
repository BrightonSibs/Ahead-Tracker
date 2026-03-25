import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getAllDepartments, normalizeDepartmentCode } from '@/lib/services/departments';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const includeInactive = req.nextUrl.searchParams.get('includeInactive') !== 'false';

  try {
    const departments = await getAllDepartments(includeInactive);
    return NextResponse.json(departments);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role === 'VIEWER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();

  try {
    const code = normalizeDepartmentCode(String(body.code || ''));
    const name = String(body.name || '').trim();

    if (!code) {
      return NextResponse.json({ error: 'Department code is required' }, { status: 400 });
    }

    if (!name) {
      return NextResponse.json({ error: 'Department name is required' }, { status: 400 });
    }

    const department = await prisma.department.create({
      data: {
        code,
        name,
        shortName: body.shortName?.trim() || null,
        color: body.color?.trim() || null,
        activeStatus: body.activeStatus ?? true,
        displayOrder: Number.isFinite(body.displayOrder) ? Number(body.displayOrder) : 0,
      },
    });

    return NextResponse.json(department, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Unable to create department' }, { status: 400 });
  }
}
