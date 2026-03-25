'use client';

import { Suspense, startTransition, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { PageLayout, PageContent, TopBar, TopBarActions } from '@/components/layout';
import { Card, Button, Spinner, EmptyState } from '@/components/ui';
import { fetchJsonCached } from '@/lib/client-cache';
import { departmentColor, sourceBadgeColor, sourceLabel } from '@/lib/utils';
import type { DepartmentSummary, PublicationSummary, PaginatedResult } from '@/types';

const SOURCE_OPTIONS = [
  { value: 'CROSSREF', label: 'CrossRef' },
  { value: 'PUBMED', label: 'PubMed' },
  { value: 'ORCID', label: 'ORCID' },
  { value: 'GOOGLE_SCHOLAR', label: 'Google Scholar' },
  { value: 'MANUAL', label: 'Manual' },
];

const VERIFIED_OPTIONS = [
  { value: 'VERIFIED', label: 'Verified' },
  { value: 'UNVERIFIED', label: 'Unverified' },
  { value: 'NEEDS_REVIEW', label: 'Needs Review' },
];

export default function PublicationsPage() {
  return (
    <Suspense fallback={<PublicationsPageFallback />}>
      <PublicationsPageContent />
    </Suspense>
  );
}

function PublicationsPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [result, setResult] = useState<PaginatedResult<PublicationSummary> | null>(null);
  const [loading, setLoading] = useState(true);
  const [researchers, setResearchers] = useState<{ id: string; canonicalName: string; department: string }[]>([]);
  const [departments, setDepartments] = useState<DepartmentSummary[]>([]);
  const searchParamsString = searchParams.toString();
  const page = Number(searchParams.get('page') || '1');

  const setParam = useCallback((updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    const isPageOnlyUpdate = Object.keys(updates).length === 1 && Object.prototype.hasOwnProperty.call(updates, 'page');

    Object.entries(updates).forEach(([k, v]) => {
      if (!v) params.delete(k);
      else params.set(k, v);
    });

    if (!isPageOnlyUpdate) {
      params.delete('page');
    }

    const nextUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    startTransition(() => {
      router.replace(nextUrl, { scroll: false });
    });
  }, [router, pathname, searchParams]);

  const get = (key: string) => searchParams.get(key) || '';

  useEffect(() => {
    let cancelled = false;

    Promise.allSettled([
      fetchJsonCached<{ id: string; canonicalName: string; department: string }[]>('/api/researchers'),
      fetchJsonCached<DepartmentSummary[]>('/api/departments'),
    ])
      .then(([researcherResult, departmentResult]) => {
        if (cancelled) return;

        const researcherData = researcherResult.status === 'fulfilled' && Array.isArray(researcherResult.value)
          ? researcherResult.value
          : [];
        const departmentData = departmentResult.status === 'fulfilled' && Array.isArray(departmentResult.value)
          ? departmentResult.value
          : Array.from(new Set(researcherData.map(item => item.department))).map((code, index) => ({
              id: `fallback-${code}`,
              code,
              name: code,
              shortName: code,
              color: null,
              activeStatus: true,
              displayOrder: index,
              researcherCount: researcherData.filter(item => item.department === code).length,
            }));

        setResearchers(researcherData);
        setDepartments(departmentData.filter((item: DepartmentSummary) => item.activeStatus));
      })
      .catch(() => {
        if (!cancelled) {
          setResearchers([]);
          setDepartments([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams(searchParamsString);

    fetchJsonCached<PaginatedResult<PublicationSummary>>(`/api/publications?${params}`)
      .then(data => {
        if (!cancelled) {
          setResult(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [searchParamsString]);

  const verifiedLabel: Record<string, string> = {
    VERIFIED: 'Verified',
    UNVERIFIED: 'Open',
    NEEDS_REVIEW: 'Review',
    EXCLUDED: 'Excluded',
  };

  return (
    <PageLayout>
      <TopBar
        title="Publications"
        subtitle={result ? `${result.total.toLocaleString()} total publications` : 'Loading...'}
        actions={
          <TopBarActions>
            <a href={`/api/export?type=publications&${searchParamsString}`}>
              <Button variant="outline" size="sm">Export CSV</Button>
            </a>
            <Link href="/admin">
              <Button variant="primary" size="sm">+ Add Publication</Button>
            </Link>
          </TopBarActions>
        }
      />
      <PageContent>
        <Card className="!p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="relative w-full sm:min-w-[220px] sm:max-w-xs sm:flex-1">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-gray-400">/</span>
              <input
                value={get('keyword')}
                onChange={e => setParam({ keyword: e.target.value || null })}
                placeholder="Search title, abstract, journal..."
                className="w-full rounded-md border border-gray-300 bg-white py-2 pl-8 pr-3 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              />
            </div>

            <select
              value={get('researcherId')}
              onChange={e => setParam({ researcherId: e.target.value || null })}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 sm:min-w-[160px] sm:w-auto"
            >
              <option value="">All Researchers</option>
              {researchers.map(researcher => <option key={researcher.id} value={researcher.id}>{researcher.canonicalName}</option>)}
            </select>

            <select
              value={get('department')}
              onChange={e => setParam({ department: e.target.value || null })}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 sm:w-auto"
            >
              <option value="">All Depts</option>
              {departments.map(department => (
                <option key={department.code} value={department.code}>
                  {department.shortName || department.name}
                </option>
              ))}
            </select>

            <div className="flex w-full items-center gap-1.5 sm:w-auto">
              <input
                type="number"
                value={get('yearFrom')}
                onChange={e => setParam({ yearFrom: e.target.value || null })}
                placeholder="From year"
                min={2000}
                max={2030}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 sm:w-24"
              />
              <span className="text-sm text-gray-400">-</span>
              <input
                type="number"
                value={get('yearTo')}
                onChange={e => setParam({ yearTo: e.target.value || null })}
                placeholder="To year"
                min={2000}
                max={2030}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 sm:w-24"
              />
            </div>

            <div className="flex w-full items-center gap-1.5 sm:w-auto">
              <input
                type="date"
                value={get('dateFrom')}
                onChange={e => setParam({ dateFrom: e.target.value || null })}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 sm:w-36"
              />
              <span className="text-sm text-gray-400">-</span>
              <input
                type="date"
                value={get('dateTo')}
                onChange={e => setParam({ dateTo: e.target.value || null })}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 sm:w-36"
              />
            </div>

            <input
              type="number"
              value={get('minIF')}
              onChange={e => setParam({ minIF: e.target.value || null })}
              placeholder="Min IF"
              step="0.1"
              min="0"
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 sm:w-24"
            />

            <select
              value={get('source')}
              onChange={e => setParam({ source: e.target.value || null })}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 sm:w-auto"
            >
              <option value="">Any Source</option>
              {SOURCE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>

            <select
              value={get('verifiedStatus')}
              onChange={e => setParam({ verifiedStatus: e.target.value || null })}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 sm:w-auto"
            >
              <option value="">Any Status</option>
              {VERIFIED_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>

            <label className="flex cursor-pointer select-none items-center gap-2 whitespace-nowrap text-sm text-gray-600">
              <input
                type="checkbox"
                checked={get('sluOnly') === 'true'}
                onChange={e => setParam({ sluOnly: e.target.checked ? 'true' : null })}
                className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
              />
              SLU tenure only
            </label>

            {Array.from(searchParams.keys()).some(key => key !== 'page') && (
              <button
                onClick={() => router.replace(pathname, { scroll: false })}
                className="flex items-center gap-1 rounded px-2 py-2 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              >
                x Clear
              </button>
            )}
          </div>

          {get('sluOnly') === 'true' && (
            <div className="mt-3 flex gap-2">
              <span className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-2 py-1 text-xs text-brand-700">
                SLU tenure filter active - pre-tenure publications hidden
                <button onClick={() => setParam({ sluOnly: null })} className="ml-1 hover:text-brand-900">x</button>
              </span>
            </div>
          )}
        </Card>

        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : !result?.data.length ? (
          <EmptyState
            icon="P"
            title="No publications found"
            description="Try adjusting your filters or add publications through the admin panel."
          />
        ) : (
          <Card padding={false}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    {['Title', 'Authors / Researchers', 'Journal', 'Year', 'IF', 'Citations', 'Source', 'Status', 'SLU', ''].map((header, index) => (
                      <th
                        key={header}
                        className={`whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 ${index >= 3 ? 'text-right' : 'text-left'}`}
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {result.data.map(publication => (
                    <tr key={publication.id} className="group transition-colors hover:bg-gray-50/60">
                      <td className="max-w-xs px-4 py-3">
                        <p className="line-clamp-2 text-sm font-medium leading-snug text-gray-900">{publication.title}</p>
                        {publication.doi && (
                          <p className="mt-0.5 truncate font-mono text-[10px] text-gray-400">{publication.doi}</p>
                        )}
                        {publication.specialties.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {publication.specialties.slice(0, 2).map(specialty => (
                              <span key={specialty} className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">{specialty}</span>
                            ))}
                          </div>
                        )}
                      </td>

                      <td className="max-w-[180px] px-4 py-3">
                        <p className="truncate text-xs text-gray-600">
                          {publication.authors.slice(0, 3).join(', ')}
                          {publication.authors.length > 3 ? ' et al.' : ''}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {publication.matchedResearchers.slice(0, 2).map(researcher => (
                            <Link key={researcher.id} href={`/researchers/${researcher.id}`}>
                              <span className={`cursor-pointer rounded px-1.5 py-0.5 text-[10px] font-medium hover:opacity-80 ${departmentColor(researcher.department)}`}>
                                {researcher.name.split(' ').slice(-1)[0]}
                              </span>
                            </Link>
                          ))}
                        </div>
                      </td>

                      <td className="max-w-[160px] px-4 py-3">
                        <p className="truncate text-xs text-gray-600">{publication.journalName || '-'}</p>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <span className="font-mono text-sm text-gray-700">{publication.publicationYear ?? '-'}</span>
                      </td>

                      <td className="px-4 py-3 text-right">
                        {publication.impactFactor != null ? (
                          <span className={`text-xs font-medium ${publication.impactFactor >= 10 ? 'text-amber-600' : publication.impactFactor >= 5 ? 'text-green-600' : 'text-gray-500'}`}>
                            {publication.impactFactor.toFixed(1)}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">-</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-bold text-brand-700">{publication.latestCitations.toLocaleString()}</span>
                      </td>

                      <td className="px-4 py-3">
                        <span className={`rounded border px-2 py-0.5 text-[10px] font-medium ${sourceBadgeColor(publication.sourcePrimary)}`}>
                          {sourceLabel(publication.sourcePrimary)}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <span title={publication.verifiedStatus} className="text-xs font-medium text-gray-700">
                          {verifiedLabel[publication.verifiedStatus] || 'Open'}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <span className={`text-xs font-medium ${publication.includedInSluOutput ? 'text-green-600' : 'text-gray-400'}`}>
                          {publication.includedInSluOutput ? 'Included' : 'Excluded'}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <Link href={`/publications/${publication.id}`}>
                          <Button variant="outline" size="xs" className="whitespace-nowrap opacity-0 transition-opacity group-hover:opacity-100">
                            View
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50/40 px-4 py-3">
              <p className="text-xs text-gray-500">
                Showing {((page - 1) * 25) + 1}-{Math.min(page * 25, result.total)} of {result.total.toLocaleString()} results
              </p>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="xs" disabled={page <= 1} onClick={() => setParam({ page: String(page - 1) })}>
                  Prev
                </Button>
                {Array.from({ length: Math.min(result.totalPages, 7) }, (_, index) => {
                  const nextPage = index + 1;
                  return (
                    <button
                      key={nextPage}
                      onClick={() => setParam({ page: String(nextPage) })}
                      className={`flex h-7 w-7 items-center justify-center rounded text-xs font-medium transition-colors ${
                        nextPage === page ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {nextPage}
                    </button>
                  );
                })}
                {result.totalPages > 7 && <span className="px-1 text-xs text-gray-400">...</span>}
                <Button variant="outline" size="xs" disabled={page >= result.totalPages} onClick={() => setParam({ page: String(page + 1) })}>
                  Next
                </Button>
              </div>
            </div>
          </Card>
        )}
      </PageContent>
    </PageLayout>
  );
}

function PublicationsPageFallback() {
  return (
    <PageLayout>
      <TopBar title="Publications" subtitle="Loading publications..." />
      <PageContent>
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      </PageContent>
    </PageLayout>
  );
}
