import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getPublications } from '@/lib/services/publications';
import type { FilterState } from '@/types';

function normalizeTitle(value: string) {
  return value.replace(/\s+/g, ' ').trim().toLowerCase().replace(/[^a-z0-9\s]/g, '');
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sp = req.nextUrl.searchParams;

  const filters: FilterState = {
    keyword:         sp.get('keyword') || undefined,
    researcherId:    sp.get('researcherId') || undefined,
    department:      sp.get('department') || undefined,
    yearFrom:        sp.get('yearFrom') ? Number(sp.get('yearFrom')) : undefined,
    yearTo:          sp.get('yearTo') ? Number(sp.get('yearTo')) : undefined,
    dateFrom:        sp.get('dateFrom') || undefined,
    dateTo:          sp.get('dateTo') || undefined,
    sluOnly:         sp.get('sluOnly') === 'true',
    minImpactFactor: sp.get('minIF') ? Number(sp.get('minIF')) : undefined,
    specialty:       sp.get('specialty') || undefined,
    source:          sp.get('source') || undefined,
    verifiedStatus:  sp.get('verifiedStatus') || undefined,
  };

  const page = Number(sp.get('page') || '1');
  const pageSize = Number(sp.get('pageSize') || '25');

  try {
    const result = await getPublications(filters, page, pageSize);
    return NextResponse.json(result);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role === 'VIEWER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const { prisma } = await import('@/lib/prisma');

  try {
    let parsedCitationCount: number | null = null;
    if (body.citationCount !== undefined && body.citationCount !== null && body.citationCount !== '') {
      parsedCitationCount = Number(body.citationCount);
      if (Number.isNaN(parsedCitationCount) || parsedCitationCount < 0) {
        return NextResponse.json({ error: 'Citation count must be a non-negative number' }, { status: 400 });
      }
    }

    const pub = await prisma.publication.create({
      data: {
        title: body.title,
        normalizedTitle: normalizeTitle(body.title),
        doi: body.doi || null,
        publicationDate: body.publicationDate ? new Date(body.publicationDate) : null,
        publicationYear: body.publicationYear ? Number(body.publicationYear) : null,
        journalName: body.journalName || null,
        abstract: body.abstract || null,
        sourcePrimary: body.sourcePrimary || 'MANUAL',
        verifiedStatus: 'UNVERIFIED',
      },
    });

    const actorId = (session.user as any)?.id;

    // Add authors
    if (body.authors?.length) {
      await prisma.publicationAuthor.createMany({
        data: body.authors.map((name: string, i: number) => ({
          publicationId: pub.id,
          authorName: name,
          authorOrder: i + 1,
          isCorresponding: i === 0,
        })),
      });
    }

    // Add researcher matches
    if (body.researcherIds?.length) {
      const researchers = await prisma.researcher.findMany({
        where: { id: { in: body.researcherIds } },
        select: {
          id: true,
          sluStartDate: true,
        },
      });

      await prisma.publicationResearcherMatch.createMany({
        data: researchers.map(researcher => {
          const includedInSluOutput =
            !researcher.sluStartDate || !pub.publicationDate || pub.publicationDate >= researcher.sluStartDate;

          return {
            publicationId: pub.id,
            researcherId: researcher.id,
            matchType: 'MANUAL_ASSIGNMENT',
            matchConfidence: 1.0,
            manuallyConfirmed: true,
            includedInSluOutput,
            sluTenureNote:
              includedInSluOutput || !researcher.sluStartDate || !pub.publicationDate
                ? null
                : `Published before researcher's SLU start date (${researcher.sluStartDate.toISOString().split('T')[0]})`,
          };
        }),
      });
    }

    if (parsedCitationCount !== null) {
      await prisma.citation.create({
        data: {
          publicationId: pub.id,
          source: body.sourcePrimary || 'MANUAL',
          citationCount: parsedCitationCount,
          capturedAt: new Date(),
        },
      });
    }

    await prisma.auditLog.create({
      data: {
        entityType: 'publication',
        entityId: pub.id,
        action: 'CREATE',
        newData: JSON.stringify({
          ...body,
          publicationId: pub.id,
        }),
        userId: actorId,
        publicationId: pub.id,
      },
    });

    return NextResponse.json(pub, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
