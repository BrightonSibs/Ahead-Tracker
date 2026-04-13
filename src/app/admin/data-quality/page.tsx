'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PageLayout, PageContent, TopBar, TopBarActions } from '@/components/layout';
import { Alert, Button, Card, CardHeader, CardTitle, Spinner } from '@/components/ui';
import { fetchJsonCached } from '@/lib/client-cache';

export default function AdminDataQualityPage() {
  const [quality, setQuality] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadQuality() {
    setLoading(true);
    setError('');

    try {
      const data = await fetchJsonCached<any>('/api/admin/data-quality', { force: true });
      setQuality(data);
    } catch (e: any) {
      setError(e.message || 'Unable to load data quality summary.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadQuality();
  }, []);

  return (
    <PageLayout>
      <TopBar
        title="Data Quality"
        subtitle="Review the most common metadata gaps without changing existing sync or analytics behavior"
        actions={
          <TopBarActions>
            <Button variant="outline" size="sm" onClick={loadQuality}>Refresh</Button>
            <Link href="/admin">
              <Button variant="ghost" size="sm">Back</Button>
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { label: 'Missing ORCID', value: quality?.counts?.missingOrcidCount ?? '-', href: '/admin/researchers' },
                { label: 'Missing SLU Start', value: quality?.counts?.missingSluStartCount ?? '-', href: '/admin/researchers' },
                { label: 'Missing Journal Name', value: quality?.counts?.missingJournalNameCount ?? '-', href: '/publications' },
                { label: 'Missing Abstract', value: quality?.counts?.missingAbstractCount ?? '-', href: '/publications' },
                { label: 'Needs Review', value: quality?.counts?.needsReviewCount ?? '-', href: '/publications?verifiedStatus=NEEDS_REVIEW' },
                { label: 'Unresolved Impact Factor', value: quality?.counts?.unresolvedImpactFactorCount ?? '-', href: '/admin/journals' },
              ].map(item => (
                <Link key={item.label} href={item.href}>
                  <Card className="cursor-pointer transition-colors hover:border-brand-200 hover:bg-brand-50/40">
                    <div className="font-display text-2xl font-bold text-brand-700">{item.value}</div>
                    <p className="mt-1 text-xs uppercase tracking-wide text-gray-500">{item.label}</p>
                  </Card>
                </Link>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle>Researchers Missing Metadata</CardTitle>
                </CardHeader>
                <div className="space-y-2">
                  {quality?.samples?.researchersMissingMetadata?.length ? quality.samples.researchersMissingMetadata.map((researcher: any) => (
                    <Link key={researcher.id} href={`/researchers/${researcher.id}`} className="block rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 hover:border-brand-200 hover:bg-brand-50">
                      <p className="text-sm font-medium text-gray-800">{researcher.canonicalName}</p>
                      <p className="mt-1 text-xs text-gray-500">
                        {researcher.department}
                        {researcher.orcid ? '' : ' | Missing ORCID'}
                        {researcher.sluStartDate ? '' : ' | Missing SLU start'}
                      </p>
                    </Link>
                  )) : (
                    <p className="text-sm text-gray-400">No sampled researcher gaps right now.</p>
                  )}
                </div>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Publications Missing Metadata</CardTitle>
                </CardHeader>
                <div className="space-y-2">
                  {quality?.samples?.publicationsMissingMetadata?.length ? quality.samples.publicationsMissingMetadata.map((publication: any) => (
                    <Link key={publication.id} href={`/publications/${publication.id}`} className="block rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 hover:border-brand-200 hover:bg-brand-50">
                      <p className="line-clamp-2 text-sm font-medium text-gray-800">{publication.title}</p>
                      <p className="mt-1 text-xs text-gray-500">
                        {publication.publicationYear ?? 'Unknown year'}
                        {publication.journalName ? '' : ' | Missing journal'}
                        {publication.verifiedStatus === 'NEEDS_REVIEW' ? ' | Needs review' : ''}
                      </p>
                    </Link>
                  )) : (
                    <p className="text-sm text-gray-400">No sampled publication gaps right now.</p>
                  )}
                </div>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Unresolved Impact Factors</CardTitle>
                </CardHeader>
                <div className="space-y-2">
                  {quality?.samples?.unresolvedImpactFactors?.length ? quality.samples.unresolvedImpactFactors.map((publication: any) => (
                    <Link key={publication.id} href="/admin/journals" className="block rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 hover:border-brand-200 hover:bg-brand-50">
                      <p className="line-clamp-2 text-sm font-medium text-gray-800">{publication.title}</p>
                      <p className="mt-1 text-xs text-gray-500">
                        {publication.journalName || 'Missing journal'} | {publication.publicationYear ?? 'Unknown year'}
                      </p>
                    </Link>
                  )) : (
                    <p className="text-sm text-gray-400">No sampled impact-factor gaps right now.</p>
                  )}
                </div>
              </Card>
            </div>
          </div>
        )}
      </PageContent>
    </PageLayout>
  );
}
