import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type JournalMetricInput = {
  journalName?: unknown;
  issn?: unknown;
  year?: unknown;
  impactFactor?: unknown;
  quartile?: unknown;
  source?: unknown;
};

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
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1900 || parsed > 2100) {
    throw new Error('Year must be a whole number between 1900 and 2100');
  }
  return parsed;
}

function normalizeImpactFactor(value: unknown) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed < 0) {
    throw new Error('Impact factor must be a non-negative number');
  }
  return Number(parsed.toFixed(2));
}

function normalizeQuartile(value: unknown) {
  const normalized = String(value || 'Q1').trim().toUpperCase();
  if (!['Q1', 'Q2', 'Q3', 'Q4'].includes(normalized)) {
    throw new Error('Quartile must be one of Q1, Q2, Q3, or Q4');
  }
  return normalized;
}

function normalizeSource(value: unknown) {
  const normalized = String(value || 'manual').trim();
  return normalized || 'manual';
}

function normalizeJournalMetric(input: JournalMetricInput) {
  return {
    journalName: normalizeJournalName(input.journalName),
    issn: normalizeOptionalString(input.issn),
    year: normalizeYear(input.year),
    impactFactor: normalizeImpactFactor(input.impactFactor),
    quartile: normalizeQuartile(input.quartile),
    source: normalizeSource(input.source),
  };
}

async function requireEditorSession() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role === 'VIEWER') {
    return null;
  }
  return session;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const search = req.nextUrl.searchParams.get('search')?.trim();
  const year = req.nextUrl.searchParams.get('year');
  const parsedYear = year ? normalizeYear(year) : undefined;

  const where = {
    ...(search
      ? {
          journalName: {
            contains: search,
          },
        }
      : {}),
    ...(parsedYear ? { year: parsedYear } : {}),
  };

  try {
    const journals = await prisma.journalMetric.findMany({
      where,
      orderBy: [{ year: 'desc' }, { journalName: 'asc' }],
    });

    return NextResponse.json(journals);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await requireEditorSession();
  if (!session) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const inputs: JournalMetricInput[] = Array.isArray(body?.records)
    ? body.records
    : [body];

  try {
    const normalizedRecords = inputs.map(normalizeJournalMetric);
    const actorId = (session.user as any)?.id;
    let created = 0;
    let updated = 0;

    const journals = await prisma.$transaction(async tx => {
      const results = [];

      for (const record of normalizedRecords) {
        const existing = await tx.journalMetric.findUnique({
          where: {
            journalName_year: {
              journalName: record.journalName,
              year: record.year,
            },
          },
        });

        const saved = await tx.journalMetric.upsert({
          where: {
            journalName_year: {
              journalName: record.journalName,
              year: record.year,
            },
          },
          update: {
            issn: record.issn,
            impactFactor: record.impactFactor,
            quartile: record.quartile,
            source: record.source,
          },
          create: record,
        });

        if (existing) updated += 1;
        else created += 1;

        await tx.auditLog.create({
          data: {
            entityType: 'journalMetric',
            entityId: saved.id,
            action: existing ? 'UPDATE' : 'CREATE',
            previousData: existing ? JSON.stringify(existing) : null,
            newData: JSON.stringify(record),
            userId: actorId,
          },
        });

        results.push(saved);
      }

      return results;
    });

    return NextResponse.json(
      {
        journals,
        created,
        updated,
      },
      { status: 201 },
    );
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unable to save journal metrics' }, { status: 400 });
  }
}
