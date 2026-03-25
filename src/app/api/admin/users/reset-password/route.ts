import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import bcrypt from 'bcryptjs';
import { authOptions } from '@/lib/auth';
import { validatePasswordRules } from '@/lib/password-policy';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const actorId = (session?.user as any)?.id;
  const actorRole = (session?.user as any)?.role;

  if (!session || !actorId || actorRole !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : '';

  if (!email || !newPassword) {
    return NextResponse.json({ error: 'Email and new password are required.' }, { status: 400 });
  }

  const passwordRuleError = validatePasswordRules(newPassword);
  if (passwordRuleError) {
    return NextResponse.json({ error: passwordRuleError }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, role: true },
  });

  if (!user) {
    return NextResponse.json({ error: 'No user found with that email address.' }, { status: 404 });
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);

  await prisma.$transaction(async tx => {
    await tx.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    await tx.auditLog.create({
      data: {
        entityType: 'user',
        entityId: user.id,
        action: 'ADMIN_RESET_PASSWORD',
        newData: JSON.stringify({ email: user.email, role: user.role, resetAt: new Date().toISOString() }),
        userId: actorId,
      },
    });
  });

  return NextResponse.json({ ok: true, message: `Password reset for ${email}.` });
}
