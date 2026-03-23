import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { calcHIndex, calcI10Index } from '@/lib/utils';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const type = sp.get('type') || 'publications';
  const department = sp.get('department') || undefined;
  const researcherId = sp.get('researcherId') || undefined;
  const sluOnly = sp.get('sluOnly') === 'true';

  try {
    if (type === 'publications') {
      const pubs = await prisma.publication.findMany({
        where: {
          matches: {
            some: {
              manuallyExcluded: false,
              ...(researcherId ? { researcherId } : {}),
              ...(department ? { researcher: { department } } : {}),
              ...(sluOnly ? { includedInSluOutput: true } : {}),
            },
          },
        },
        include: {
          authors: { orderBy: { authorOrder: 'asc' } },
          citations: { orderBy: { capturedAt: 'desc' }, take: 1 },
          matches: {
            where: { manuallyExcluded: false },
            include: { researcher: { select: { canonicalName: true, department: true } } },
          },
          specialties: { include: { specialty: true } },
        },
        orderBy: { publicationDate: 'desc' },
      });

      const rows = [
        ['Title', 'DOI', 'Journal', 'Year', 'Authors', 'Researchers', 'Department', 'Citations', 'Specialties', 'Verified Status'].join(','),
        ...pubs.map(p => [
          `"${p.title.replace(/"/g, '""')}"`,
          p.doi || '',
          `"${p.journalName || ''}"`,
          p.publicationYear || '',
          `"${p.authors.map(a => a.authorName).join('; ')}"`,
          `"${p.matches.map(m => m.researcher.canonicalName).join('; ')}"`,
          `"${Array.from(new Set(p.matches.map(m => m.researcher.department))).join('; ')}"`,
          p.citations[0]?.citationCount ?? 0,
          `"${p.specialties.map(s => s.specialty.name).join('; ')}"`,
          p.verifiedStatus,
        ].join(',')),
      ].join('\n');

      return new NextResponse(rows, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="publications-${Date.now()}.csv"`,
        },
      });
    }

    if (type === 'researchers') {
      const researchers = await prisma.researcher.findMany({
        where: department ? { department } : {},
        include: {
          aliases: true,
          specialties: { include: { specialty: true } },
          matches: {
            where: { manuallyExcluded: false },
            include: { publication: { include: { citations: { orderBy: { capturedAt: 'desc' }, take: 1 } } } },
          },
        },
        orderBy: { canonicalName: 'asc' },
      });

      const rows = [
        ['Faculty ID', 'Canonical Name', 'Department', 'ORCID', 'SLU Start Date', 'Publications', 'Total Citations', 'h-index', 'i10-index', 'Aliases', 'Specialties'].join(','),
        ...researchers.map(r => {
          const cits = r.matches.map(m => m.publication.citations[0]?.citationCount ?? 0);
          return [
            r.facultyId,
            `"${r.canonicalName}"`,
            r.department,
            r.orcid || '',
            r.sluStartDate ? r.sluStartDate.toISOString().split('T')[0] : '',
            r.matches.length,
            cits.reduce((a, b) => a + b, 0),
            calcHIndex(cits),
            calcI10Index(cits),
            `"${r.aliases.map(a => a.aliasName).join('; ')}"`,
            `"${r.specialties.map(s => s.specialty.name).join('; ')}"`,
          ].join(',');
        }),
      ].join('\n');

      return new NextResponse(rows, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="researchers-${Date.now()}.csv"`,
        },
      });
    }

    return NextResponse.json({ error: 'Unknown export type' }, { status: 400 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
