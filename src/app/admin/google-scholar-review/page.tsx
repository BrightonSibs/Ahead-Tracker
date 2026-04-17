'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PageLayout, PageContent, TopBar, TopBarActions } from '@/components/layout';
import { Alert, Button, Card, CardHeader, CardTitle, Spinner } from '@/components/ui';
import { fetchJsonCached } from '@/lib/client-cache';
import { departmentColor, formatCitationCount } from '@/lib/utils';

type ReviewResearcher = {
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
};

type ReviewPayload = {
  totals: {
    researcherCount: number;
    reviewPublicationCount: number;
    reviewCitationTotal: number;
    verifiedPublicationCount: number;
  };
  researchers: ReviewResearcher[];
};

function buildDoiUrl(value: string | null | undefined) {
  const normalized = String(value || '')
    .trim()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')
    .replace(/^doi:\s*/i, '')
    .replace(/\s+/g, '')
    .toLowerCase();

  return normalized ? `https://doi.org/${normalized}` : null;
}

function buildGoogleScholarCitationUrl(value: string | null | undefined) {
  const normalized = String(value || '').trim();
  const separatorIndex = normalized.indexOf(':');
  if (separatorIndex <= 0) return null;

  const userId = normalized.slice(0, separatorIndex).trim();
  const citationId = normalized.slice(separatorIndex + 1).trim();
  if (!userId || !citationId) return null;

  return `https://scholar.google.com/citations?view_op=view_citation&user=${encodeURIComponent(userId)}&citation_for_view=${encodeURIComponent(normalized)}`;
}

export default function AdminGoogleScholarReviewPage() {
  const [data, setData] = useState<ReviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadData() {
    setLoading(true);
    setError('');

    try {
      const payload = await fetchJsonCached<ReviewPayload>('/api/admin/google-scholar-review', { force: true });
      setData(payload);
    } catch (e: any) {
      setError(e.message || 'Unable to load Google Scholar review queue.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  return (
    <PageLayout>
      <TopBar
        title="Scholar Review Queue"
        subtitle="Review Google Scholar imports from verified profile IDs before treating them as trusted publication records"
        actions={
          <TopBarActions>
            <Button variant="outline" size="sm" onClick={loadData}>Refresh</Button>
            <Link href="/admin/data-quality">
              <Button variant="ghost" size="sm">Data Quality</Button>
            </Link>
          </TopBarActions>
        }
      />
      <PageContent>
        {error && <Alert type="error">{error}</Alert>}

        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <div className="font-display text-2xl font-bold text-brand-700">{data?.totals.researcherCount ?? 0}</div>
                <p className="mt-1 text-xs uppercase tracking-wide text-gray-500">Researchers With Review Queue</p>
              </Card>
              <Card>
                <div className="font-display text-2xl font-bold text-brand-700">{data?.totals.reviewPublicationCount ?? 0}</div>
                <p className="mt-1 text-xs uppercase tracking-wide text-gray-500">Scholar Review Publications</p>
              </Card>
              <Card>
                <div className="font-display text-2xl font-bold text-brand-700">{formatCitationCount(data?.totals.reviewCitationTotal ?? 0)}</div>
                <p className="mt-1 text-xs uppercase tracking-wide text-gray-500">Review-Stage Captured Citations</p>
              </Card>
              <Card>
                <div className="font-display text-2xl font-bold text-brand-700">{data?.totals.verifiedPublicationCount ?? 0}</div>
                <p className="mt-1 text-xs uppercase tracking-wide text-gray-500">Verified Publications For Same Researchers</p>
              </Card>
            </div>

            <div className="text-sm text-gray-600">
              This queue is sorted by citation impact first so we can clean the most meaningful records first. Each researcher card links directly to a filtered publications view for review and approval/exclusion.
            </div>

            <div className="space-y-4">
              {data?.researchers.length ? data.researchers.map(researcher => (
                <Card key={researcher.researcherId}>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/researchers/${researcher.researcherId}`}>
                          <h2 className="text-lg font-semibold text-gray-900 hover:text-brand-700">{researcher.researcherName}</h2>
                        </Link>
                        <span className={`rounded px-2 py-0.5 text-[10px] font-medium ${departmentColor(researcher.department)}`}>
                          {researcher.department}
                        </span>
                        {researcher.scholarProfileId && (
                          <span className={`rounded border px-2 py-0.5 text-[10px] font-medium ${researcher.scholarProfileVerified ? 'border-green-200 bg-green-50 text-green-700' : 'border-gray-300 bg-white text-gray-600'}`}>
                            Scholar ID {researcher.scholarProfileVerified ? 'verified' : 'present'}
                          </span>
                        )}
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <div className="rounded-lg bg-gray-50 p-3">
                          <div className="text-lg font-bold text-gray-900">{researcher.reviewPublicationCount}</div>
                          <div className="text-[10px] uppercase tracking-wide text-gray-500">Review Publications</div>
                        </div>
                        <div className="rounded-lg bg-gray-50 p-3">
                          <div className="text-lg font-bold text-gray-900">{formatCitationCount(researcher.reviewCitationTotal)}</div>
                          <div className="text-[10px] uppercase tracking-wide text-gray-500">Review Citations</div>
                        </div>
                        <div className="rounded-lg bg-gray-50 p-3">
                          <div className="text-lg font-bold text-gray-900">{researcher.reviewPublicationsWithCitationData}</div>
                          <div className="text-[10px] uppercase tracking-wide text-gray-500">With Citation Data</div>
                        </div>
                        <div className="rounded-lg bg-gray-50 p-3">
                          <div className="text-lg font-bold text-gray-900">{researcher.verifiedPublicationCount}</div>
                          <div className="text-[10px] uppercase tracking-wide text-gray-500">Verified Publications</div>
                        </div>
                      </div>

                      <div className="mt-4 space-y-2">
                        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Top Review Publications</p>
                        {researcher.topPublications.map(publication => (
                          <div key={publication.id} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <Link href={`/publications/${publication.id}`}>
                                  <p className="line-clamp-2 text-sm font-medium text-gray-900 hover:text-brand-700">{publication.title}</p>
                                </Link>
                                <p className="mt-1 text-xs text-gray-500">
                                  {publication.journalName || 'Unknown venue'} | {publication.publicationYear ?? 'Unknown year'}
                                </p>
                                {buildDoiUrl(publication.doi) ? (
                                  <a
                                    href={buildDoiUrl(publication.doi) as string}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-1 inline-flex text-xs font-medium text-brand-700 underline"
                                  >
                                    Open original source
                                  </a>
                                ) : publication.scholarSourceLink ? (
                                  <a
                                    href={publication.scholarSourceLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-1 inline-flex text-xs font-medium text-brand-700 underline"
                                  >
                                    Open original source
                                  </a>
                                ) : buildGoogleScholarCitationUrl(publication.scholarExternalId) ? (
                                  <a
                                    href={buildGoogleScholarCitationUrl(publication.scholarExternalId) as string}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-1 inline-flex text-xs font-medium text-brand-700 underline"
                                  >
                                    Open Scholar record
                                  </a>
                                ) : null}
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-bold text-brand-700">{formatCitationCount(publication.latestCitations)}</div>
                                <div className="text-[10px] text-gray-400">{publication.citationSource || 'No snapshot'}</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex w-full flex-col gap-2 lg:w-64">
                      <Link href={`/publications?source=GOOGLE_SCHOLAR&verifiedStatus=NEEDS_REVIEW&researcherId=${researcher.researcherId}`}>
                        <Button variant="outline" size="sm" className="w-full">Review Publications</Button>
                      </Link>
                      <Link href={`/researchers/${researcher.researcherId}`}>
                        <Button variant="ghost" size="sm" className="w-full">Open Researcher</Button>
                      </Link>
                    </div>
                  </div>
                </Card>
              )) : (
                <Card>
                  <CardHeader>
                    <CardTitle>No Google Scholar review queue</CardTitle>
                  </CardHeader>
                  <p className="text-sm text-gray-500">No review-stage Scholar publications are waiting right now.</p>
                </Card>
              )}
            </div>
          </div>
        )}
      </PageContent>
    </PageLayout>
  );
}
