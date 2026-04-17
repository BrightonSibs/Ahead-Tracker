import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

function parseRawSourceRecord(rawData: string | null | undefined) {
  if (!rawData) return null;

  try {
    return JSON.parse(rawData);
  } catch {
    return null;
  }
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !['ADMIN', 'ANALYST'].includes((session.user as any)?.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const matches = await prisma.publicationResearcherMatch.findMany({
    where: {
      manuallyExcluded: false,
      publication: {
        sourcePrimary: 'GOOGLE_SCHOLAR',
        verifiedStatus: 'NEEDS_REVIEW',
      },
    },
    include: {
      researcher: {
        select: {
          id: true,
          canonicalName: true,
          department: true,
          identifiers: {
            where: {
              identifierType: {
                in: ['GOOGLE_SCHOLAR_AUTHOR_ID', 'SCHOLAR_AUTHOR_ID', 'SCHOLAR_PROFILE_ID'],
              },
            },
            select: {
              identifierType: true,
              value: true,
              verified: true,
            },
          },
        },
      },
      publication: {
        select: {
          id: true,
          title: true,
          doi: true,
          publicationYear: true,
          journalName: true,
          citations: {
            orderBy: [
              { capturedAt: 'desc' },
              { id: 'desc' },
            ],
            take: 1,
            select: {
              citationCount: true,
              source: true,
            },
          },
          sourceRecords: {
            where: { source: 'GOOGLE_SCHOLAR' },
            select: {
              source: true,
              externalId: true,
              rawData: true,
            },
          },
        },
      },
    },
    orderBy: [
      { researcher: { canonicalName: 'asc' } },
      { publication: { title: 'asc' } },
    ],
  });

  const verifiedCounts = await prisma.publicationResearcherMatch.groupBy({
    by: ['researcherId'],
    where: {
      manuallyExcluded: false,
      publication: {
        verifiedStatus: 'VERIFIED',
      },
    },
    _count: {
      _all: true,
    },
  });

  const verifiedCountByResearcher = new Map(
    verifiedCounts.map(item => [item.researcherId, item._count._all]),
  );

  const researcherQueue = new Map<string, {
    researcherId: string;
    researcherName: string;
    department: string;
    scholarProfileId: string | null;
    scholarProfileVerified: boolean;
    reviewPublicationCount: number;
    reviewCitationTotal: number;
    reviewPublicationsWithCitationData: number;
    verifiedPublicationCount: number;
    topPublications: Array<{
      id: string;
      title: string;
      doi: string | null;
      publicationYear: number | null;
      journalName: string | null;
      latestCitations: number;
      citationSource: string | null;
      scholarExternalId: string | null;
      scholarSourceLink: string | null;
    }>;
  }>();

  for (const match of matches) {
    const latestCitation = match.publication.citations[0]?.citationCount ?? 0;
    const scholarIdentifier = match.researcher.identifiers.find(identifier => identifier.verified)
      || match.researcher.identifiers[0]
      || null;

    const existing = researcherQueue.get(match.researcherId) || {
      researcherId: match.researcher.id,
      researcherName: match.researcher.canonicalName,
      department: match.researcher.department,
      scholarProfileId: scholarIdentifier?.value ?? null,
      scholarProfileVerified: scholarIdentifier?.verified ?? false,
      reviewPublicationCount: 0,
      reviewCitationTotal: 0,
      reviewPublicationsWithCitationData: 0,
      verifiedPublicationCount: verifiedCountByResearcher.get(match.researcherId) ?? 0,
      topPublications: [],
    };

    existing.reviewPublicationCount += 1;
    existing.reviewCitationTotal += latestCitation;
    if (match.publication.citations.length > 0) {
      existing.reviewPublicationsWithCitationData += 1;
    }
    const scholarRaw = parseRawSourceRecord(match.publication.sourceRecords[0]?.rawData);
    existing.topPublications.push({
      id: match.publication.id,
      title: match.publication.title,
      doi: match.publication.doi,
      publicationYear: match.publication.publicationYear,
      journalName: match.publication.journalName,
      latestCitations: latestCitation,
      citationSource: match.publication.citations[0]?.source ?? null,
      scholarExternalId: match.publication.sourceRecords[0]?.externalId ?? null,
      scholarSourceLink: typeof scholarRaw?.citationLink === 'string' && scholarRaw.citationLink.trim()
        ? scholarRaw.citationLink.trim()
        : Array.isArray(scholarRaw?.resourceLinks)
          ? scholarRaw.resourceLinks.find((resource: any) => typeof resource?.link === 'string' && resource.link.trim())?.link?.trim() || null
          : null,
    });

    researcherQueue.set(match.researcherId, existing);
  }

  const researchers = Array.from(researcherQueue.values())
    .map(item => ({
      ...item,
      topPublications: item.topPublications
        .sort((left, right) =>
          right.latestCitations - left.latestCitations
          || (right.publicationYear ?? 0) - (left.publicationYear ?? 0)
          || left.title.localeCompare(right.title))
        .slice(0, 5),
    }))
    .sort((left, right) =>
      right.reviewCitationTotal - left.reviewCitationTotal
      || right.reviewPublicationCount - left.reviewPublicationCount
      || left.researcherName.localeCompare(right.researcherName));

  const totals = researchers.reduce((acc, researcher) => ({
    researcherCount: acc.researcherCount + 1,
    reviewPublicationCount: acc.reviewPublicationCount + researcher.reviewPublicationCount,
    reviewCitationTotal: acc.reviewCitationTotal + researcher.reviewCitationTotal,
    verifiedPublicationCount: acc.verifiedPublicationCount + researcher.verifiedPublicationCount,
  }), {
    researcherCount: 0,
    reviewPublicationCount: 0,
    reviewCitationTotal: 0,
    verifiedPublicationCount: 0,
  });

  return NextResponse.json({
    totals,
    researchers,
  });
}
