import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const resolved = body?.resolved !== false;

  const existingAlert = await prisma.alert.findUnique({
    where: { id },
  });

  if (!existingAlert) {
    return NextResponse.json({ error: 'Alert not found' }, { status: 404 });
  }

  const updatedAlert = await prisma.alert.update({
    where: { id },
    data: {
      resolved,
      resolvedAt: resolved ? new Date() : null,
    },
  });

  await prisma.auditLog.create({
    data: {
      entityType: 'alert',
      entityId: updatedAlert.id,
      action: resolved ? 'RESOLVE_ALERT' : 'REOPEN_ALERT',
      previousData: JSON.stringify({
        resolved: existingAlert.resolved,
        resolvedAt: existingAlert.resolvedAt?.toISOString() ?? null,
      }),
      newData: JSON.stringify({
        resolved: updatedAlert.resolved,
        resolvedAt: updatedAlert.resolvedAt?.toISOString() ?? null,
      }),
      userId: (session.user as any)?.id || null,
    },
  });

  return NextResponse.json({
    ...updatedAlert,
    resolvedAt: updatedAlert.resolvedAt?.toISOString() ?? null,
    createdAt: updatedAlert.createdAt.toISOString(),
  });
}
