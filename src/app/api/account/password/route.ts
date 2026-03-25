import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import bcrypt from 'bcryptjs';
import { authOptions } from '@/lib/auth';
import { validatePasswordRules } from '@/lib/password-policy';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;

  if (!session || !userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const currentPassword = typeof body?.currentPassword === 'string' ? body.currentPassword : '';
  const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : '';

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: 'Current password and new password are required.' }, { status: 400 });
  }

  if (currentPassword === newPassword) {
    return NextResponse.json(
      { error: 'Choose a new password that is different from your current password.' },
      { status: 400 },
    );
  }

  const passwordRuleError = validatePasswordRules(newPassword);
  if (passwordRuleError) {
    return NextResponse.json({ error: passwordRuleError }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, passwordHash: true },
  });

  if (!user?.passwordHash) {
    return NextResponse.json({ error: 'Password changes are not available for this account.' }, { status: 400 });
  }

  const matchesCurrentPassword = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!matchesCurrentPassword) {
    return NextResponse.json({ error: 'Your current password is incorrect.' }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  const changedAt = new Date().toISOString();

  await prisma.$transaction(async tx => {
    await tx.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    await tx.auditLog.create({
      data: {
        entityType: 'user',
        entityId: userId,
        action: 'CHANGE_PASSWORD',
        newData: JSON.stringify({ changedAt }),
        userId,
      },
    });
  });

  return NextResponse.json({ ok: true, message: 'Password updated successfully.' });
}
