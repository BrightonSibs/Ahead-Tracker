import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { calcHIndex, calcI10Index } from '@/lib/utils';

type ExportFilters = {
  department?: string;
  researcherId?: string;
  sluOnly: boolean;
  yearFrom?: number;
  yearTo?: number;
  dateFrom?: Date;
  dateTo?: Date;
};

function toRangeStart(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function toRangeEnd(value: string) {
  return new Date(`${value}T23:59:59.999Z`);
}

function parseFilters(searchParams: URLSearchParams): ExportFilters {
  const dateFrom = searchParams.get('dateFrom');
  const dateTo = searchParams.get('dateTo');

  return {
    department: searchParams.get('department') || undefined,
    researcherId: searchParams.get('researcherId') || undefined,
    sluOnly: searchParams.get('sluOnly') === 'true',
    yearFrom: searchParams.get('yearFrom') ? Number(searchParams.get('yearFrom')) : undefined,
    yearTo: searchParams.get('yearTo') ? Number(searchParams.get('yearTo')) : undefined,
    dateFrom: dateFrom ? toRangeStart(dateFrom) : undefined,
    dateTo: dateTo ? toRangeEnd(dateTo) : undefined,
  };
}

function buildPublicationWhere(filters: ExportFilters) {
  return {
    verifiedStatus: { not: 'EXCLUDED' },
    ...(filters.yearFrom || filters.yearTo
      ? {
          publicationYear: {
            ...(filters.yearFrom ? { gte: filters.yearFrom } : {}),
            ...(filters.yearTo ? { lte: filters.yearTo } : {}),
          },
        }
      : {}),
    ...(filters.dateFrom || filters.dateTo
      ? {
          publicationDate: {
            ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
            ...(filters.dateTo ? { lte: filters.dateTo } : {}),
          },
        }
      : {}),
    matches: {
      some: {
        manuallyExcluded: false,
        ...(filters.researcherId ? { researcherId: filters.researcherId } : {}),
        ...(filters.department ? { researcher: { department: filters.department } } : {}),
        ...(filters.sluOnly ? { includedInSluOutput: true } : {}),
      },
    },
  };
}

function buildResearcherWhere(filters: ExportFilters) {
  return {
    ...(filters.researcherId ? { id: filters.researcherId } : {}),
    ...(filters.department ? { department: filters.department } : {}),
  };
}

async function getPublicationExportData(filters: ExportFilters) {
  return prisma.publication.findMany({
    where: buildPublicationWhere(filters),
    include: {
      authors: { orderBy: { authorOrder: 'asc' } },
      citations: { orderBy: { capturedAt: 'desc' }, take: 1 },
      matches: {
        where: {
          manuallyExcluded: false,
          ...(filters.sluOnly ? { includedInSluOutput: true } : {}),
        },
        include: { researcher: { select: { canonicalName: true, department: true } } },
      },
      specialties: { include: { specialty: true } },
    },
    orderBy: { publicationDate: 'desc' },
  });
}

async function getResearcherExportData(filters: ExportFilters) {
  return prisma.researcher.findMany({
    where: buildResearcherWhere(filters),
    include: {
      aliases: true,
      specialties: { include: { specialty: true } },
      matches: {
        where: {
          manuallyExcluded: false,
          ...(filters.sluOnly ? { includedInSluOutput: true } : {}),
          publication: {
            verifiedStatus: { not: 'EXCLUDED' },
            ...(filters.yearFrom || filters.yearTo
              ? {
                  publicationYear: {
                    ...(filters.yearFrom ? { gte: filters.yearFrom } : {}),
                    ...(filters.yearTo ? { lte: filters.yearTo } : {}),
                  },
                }
              : {}),
            ...(filters.dateFrom || filters.dateTo
              ? {
                  publicationDate: {
                    ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
                    ...(filters.dateTo ? { lte: filters.dateTo } : {}),
                  },
                }
              : {}),
          },
        },
        include: {
          publication: {
            include: {
              citations: { orderBy: { capturedAt: 'desc' }, take: 1 },
            },
          },
        },
      },
    },
    orderBy: { canonicalName: 'asc' },
  });
}

function csvEscape(value: string | number | null | undefined) {
  const stringValue = value == null ? '' : String(value);
  return `"${stringValue.replace(/"/g, '""')}"`;
}

function getLatestCitationValue(citations: Array<{ citationCount: number }> | undefined) {
  return citations?.[0]?.citationCount ?? null;
}

async function buildPdfReport(filters: ExportFilters) {
  const [{ jsPDF }, _autoTable, publications, researchers] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
    getPublicationExportData(filters),
    getResearcherExportData(filters),
  ]);

  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const filterSummary = [
    filters.researcherId ? `Researcher filter applied` : 'All researchers',
    filters.department ? `Department: ${filters.department}` : 'All departments',
    filters.sluOnly ? 'SLU tenure only' : 'All publication matches',
    filters.yearFrom || filters.yearTo ? `Years: ${filters.yearFrom || '...'}-${filters.yearTo || '...'}` : null,
    filters.dateFrom || filters.dateTo
      ? `Dates: ${filters.dateFrom?.toISOString().split('T')[0] || '...'} to ${filters.dateTo?.toISOString().split('T')[0] || '...'}`
      : null,
  ].filter(Boolean).join(' | ');

  doc.setFontSize(18);
  doc.text('Research Output Tracker Report', 40, 40);
  doc.setFontSize(10);
  doc.text(filterSummary, 40, 58);
  doc.text(`Generated ${new Date().toLocaleString('en-US')}`, 40, 72);

  (doc as any).autoTable({
    startY: 90,
    head: [['Publication', 'Journal', 'Year', 'Researchers', 'Citations', 'Specialties']],
    body: publications.map(publication => [
      publication.title,
      publication.journalName || '-',
      publication.publicationYear || '-',
      publication.matches.map(match => match.researcher.canonicalName).join('; '),
      getLatestCitationValue(publication.citations) ?? '',
      publication.specialties.map(specialty => specialty.specialty.name).join('; '),
    ]),
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [26, 111, 181] },
  });

  doc.addPage('landscape');
  doc.setFontSize(16);
  doc.text('Researcher Summary', 40, 40);

  (doc as any).autoTable({
    startY: 56,
    head: [['Researcher', 'Dept', 'Publications', 'Citations', 'h-index', 'i10-index', 'ORCID']],
    body: researchers.map(researcher => {
      const citations = researcher.matches.map(match => match.publication.citations[0]?.citationCount ?? 0);
      return [
        researcher.canonicalName,
        researcher.department,
        researcher.matches.length,
        citations.reduce((sum, count) => sum + count, 0),
        calcHIndex(citations),
        calcI10Index(citations),
        researcher.orcid || '-',
      ];
    }),
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [20, 184, 166] },
  });

  return doc.output('arraybuffer');
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const type = sp.get('type') || 'publications';
  const filters = parseFilters(sp);

  try {
    if (type === 'publications') {
      const publications = await getPublicationExportData(filters);
      const rows = [
        ['Title', 'DOI', 'Journal', 'Year', 'Authors', 'Researchers', 'Department', 'Citations', 'Specialties', 'Verified Status'].join(','),
        ...publications.map(publication => [
          csvEscape(publication.title),
          publication.doi || '',
          csvEscape(publication.journalName || ''),
          publication.publicationYear || '',
          csvEscape(publication.authors.map(author => author.authorName).join('; ')),
          csvEscape(publication.matches.map(match => match.researcher.canonicalName).join('; ')),
          csvEscape(Array.from(new Set(publication.matches.map(match => match.researcher.department))).join('; ')),
          getLatestCitationValue(publication.citations) ?? '',
          csvEscape(publication.specialties.map(specialty => specialty.specialty.name).join('; ')),
          publication.verifiedStatus,
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
      const researchers = await getResearcherExportData(filters);
      const rows = [
        ['Faculty ID', 'Canonical Name', 'Department', 'ORCID', 'SLU Start Date', 'Publications', 'Total Citations', 'h-index', 'i10-index', 'Aliases', 'Specialties'].join(','),
        ...researchers.map(researcher => {
          const citations = researcher.matches.map(match => match.publication.citations[0]?.citationCount ?? 0);
          return [
            researcher.facultyId,
            csvEscape(researcher.canonicalName),
            researcher.department,
            researcher.orcid || '',
            researcher.sluStartDate ? researcher.sluStartDate.toISOString().split('T')[0] : '',
            researcher.matches.length,
            citations.reduce((sum, count) => sum + count, 0),
            calcHIndex(citations),
            calcI10Index(citations),
            csvEscape(researcher.aliases.map(alias => alias.aliasName).join('; ')),
            csvEscape(researcher.specialties.map(specialty => specialty.specialty.name).join('; ')),
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

    if (type === 'pdf') {
      const pdf = await buildPdfReport(filters);
      return new NextResponse(pdf, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="ahead-report-${Date.now()}.pdf"`,
        },
      });
    }

    return NextResponse.json({ error: 'Unknown export type' }, { status: 400 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
