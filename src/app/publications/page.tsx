'use client';
import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { PageLayout, PageContent, TopBar } from '@/components/layout';
import { Card, Button, Spinner, EmptyState } from '@/components/ui';
import { departmentColor, sourceBadgeColor, sourceLabel } from '@/lib/utils';
import type { PublicationSummary, PaginatedResult } from '@/types';

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
  const searchParamsString = searchParams.toString();

  const page = Number(searchParams.get('page') || '1');

  const setParam = useCallback((updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([k, v]) => {
      if (!v) params.delete(k); else params.set(k, v);
    });
    params.delete('page');
    router.push(`${pathname}?${params.toString()}`);
  }, [router, pathname, searchParams]);

  const get = (key: string) => searchParams.get(key) || '';

  useEffect(() => {
    fetch('/api/researchers')
      .then(r => r.json())
      .then(res => {
        setResearchers(res);
      });
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams(searchParamsString);
    fetch(`/api/publications?${params}`)
      .then(r => r.json())
      .then(d => { setResult(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [searchParamsString]);

  const verifiedIcon: Record<string, string> = {
    VERIFIED: '✅', UNVERIFIED: '○', NEEDS_REVIEW: '⚠️', EXCLUDED: '✗'
  };

  return (
    <PageLayout>
      <TopBar
        title="Publications"
        subtitle={result ? `${result.total.toLocaleString()} total publications` : 'Loading…'}
        actions={
          <div className="flex items-center gap-2">
            <a href={`/api/export?type=publications&${searchParamsString}`}>
              <Button variant="outline" size="sm">⬇ Export CSV</Button>
            </a>
            <Link href="/admin">
              <Button variant="primary" size="sm">+ Add Publication</Button>
            </Link>
          </div>
        }
      />
      <PageContent>
        {/* Filter bar */}
        <Card className="!p-4">
          <div className="flex flex-wrap gap-3 items-end">
            {/* Search */}
            <div className="relative flex-1 min-w-[220px] max-w-xs">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
              <input value={get('keyword')} onChange={e => setParam({ keyword: e.target.value || null })}
                placeholder="Search title, abstract, journal…"
                className="w-full pl-8 pr-3 py-2 text-sm rounded-md border border-gray-300 bg-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none" />
            </div>

            {/* Researcher */}
            <select value={get('researcherId')} onChange={e => setParam({ researcherId: e.target.value || null })}
              className="px-3 py-2 text-sm rounded-md border border-gray-300 bg-white focus:border-brand-500 outline-none min-w-[160px]">
              <option value="">All Researchers</option>
              {researchers.map(r => <option key={r.id} value={r.id}>{r.canonicalName}</option>)}
            </select>

            {/* Department */}
            <select value={get('department')} onChange={e => setParam({ department: e.target.value || null })}
              className="px-3 py-2 text-sm rounded-md border border-gray-300 bg-white focus:border-brand-500 outline-none">
              <option value="">All Depts</option>
              <option value="AHEAD">AHEAD</option>
              <option value="HCOR">HCOR</option>
            </select>

            {/* Year range */}
            <div className="flex items-center gap-1.5">
              <input type="number" value={get('yearFrom')} onChange={e => setParam({ yearFrom: e.target.value || null })}
                placeholder="From year" min={2000} max={2030}
                className="w-24 px-3 py-2 text-sm rounded-md border border-gray-300 bg-white focus:border-brand-500 outline-none" />
              <span className="text-gray-400 text-sm">–</span>
              <input type="number" value={get('yearTo')} onChange={e => setParam({ yearTo: e.target.value || null })}
                placeholder="To year" min={2000} max={2030}
                className="w-24 px-3 py-2 text-sm rounded-md border border-gray-300 bg-white focus:border-brand-500 outline-none" />
            </div>

            {/* Min IF */}
            <input type="number" value={get('minIF')} onChange={e => setParam({ minIF: e.target.value || null })}
              placeholder="Min IF" step="0.1" min="0"
              className="w-24 px-3 py-2 text-sm rounded-md border border-gray-300 bg-white focus:border-brand-500 outline-none" />

            {/* Source */}
            <select value={get('source')} onChange={e => setParam({ source: e.target.value || null })}
              className="px-3 py-2 text-sm rounded-md border border-gray-300 bg-white focus:border-brand-500 outline-none">
              <option value="">Any Source</option>
              {SOURCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>

            {/* Status */}
            <select value={get('verifiedStatus')} onChange={e => setParam({ verifiedStatus: e.target.value || null })}
              className="px-3 py-2 text-sm rounded-md border border-gray-300 bg-white focus:border-brand-500 outline-none">
              <option value="">Any Status</option>
              {VERIFIED_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>

            {/* SLU only toggle */}
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none whitespace-nowrap">
              <input type="checkbox" checked={get('sluOnly') === 'true'}
                onChange={e => setParam({ sluOnly: e.target.checked ? 'true' : null })}
                className="rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
              SLU tenure only
            </label>

            {/* Clear */}
            {Array.from(searchParams.keys()).some(k => k !== 'page') && (
              <button onClick={() => router.push(pathname)}
                className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 px-2 py-2 rounded hover:bg-gray-100">
                ✕ Clear
              </button>
            )}
          </div>

          {/* Active filter pills */}
          {get('sluOnly') === 'true' && (
            <div className="mt-3 flex gap-2">
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-brand-50 text-brand-700 border border-brand-200">
                📅 SLU tenure filter active — pre-tenure publications hidden
                <button onClick={() => setParam({ sluOnly: null })} className="ml-1 hover:text-brand-900">✕</button>
              </span>
            </div>
          )}
        </Card>

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : !result?.data.length ? (
          <EmptyState icon="📄" title="No publications found"
            description="Try adjusting your filters or add publications through the admin panel." />
        ) : (
          <Card padding={false}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    {['Title', 'Authors / Researchers', 'Journal', 'Year', 'IF', 'Citations', 'Source', 'Status', 'SLU', ''].map((h, i) => (
                      <th key={i} className={`px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide ${i >= 3 ? 'text-right' : 'text-left'} whitespace-nowrap`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {result.data.map(pub => (
                    <tr key={pub.id} className="hover:bg-gray-50/60 transition-colors group">
                      {/* Title */}
                      <td className="px-4 py-3 max-w-xs">
                        <p className="text-sm font-medium text-gray-900 line-clamp-2 leading-snug">{pub.title}</p>
                        {pub.doi && (
                          <p className="text-[10px] text-gray-400 font-mono mt-0.5 truncate">{pub.doi}</p>
                        )}
                        {pub.specialties.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {pub.specialties.slice(0, 2).map(s => (
                              <span key={s} className="px-1.5 py-0.5 rounded text-[10px] bg-gray-100 text-gray-500">{s}</span>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Authors / Researchers */}
                      <td className="px-4 py-3 max-w-[180px]">
                        <p className="text-xs text-gray-600 truncate">{pub.authors.slice(0, 3).join(', ')}{pub.authors.length > 3 ? ' et al.' : ''}</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {pub.matchedResearchers.slice(0, 2).map(r => (
                            <Link key={r.id} href={`/researchers/${r.id}`}>
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium cursor-pointer hover:opacity-80 ${departmentColor(r.department)}`}>
                                {r.name.split(' ').slice(-1)[0]}
                              </span>
                            </Link>
                          ))}
                        </div>
                      </td>

                      {/* Journal */}
                      <td className="px-4 py-3 max-w-[160px]">
                        <p className="text-xs text-gray-600 truncate">{pub.journalName || '—'}</p>
                      </td>

                      {/* Year */}
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm text-gray-700 font-mono">{pub.publicationYear ?? '—'}</span>
                      </td>

                      {/* IF */}
                      <td className="px-4 py-3 text-right">
                        {pub.impactFactor != null ? (
                          <span className={`text-xs font-medium ${pub.impactFactor >= 10 ? 'text-amber-600' : pub.impactFactor >= 5 ? 'text-green-600' : 'text-gray-500'}`}>
                            {pub.impactFactor.toFixed(1)}
                          </span>
                        ) : <span className="text-xs text-gray-300">—</span>}
                      </td>

                      {/* Citations */}
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-bold text-brand-700">{pub.latestCitations.toLocaleString()}</span>
                      </td>

                      {/* Source badge */}
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${sourceBadgeColor(pub.sourcePrimary)}`}>
                          {sourceLabel(pub.sourcePrimary)}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 text-right">
                        <span title={pub.verifiedStatus} className="text-sm">
                          {verifiedIcon[pub.verifiedStatus] || '○'}
                        </span>
                      </td>

                      {/* SLU */}
                      <td className="px-4 py-3 text-right">
                        <span className={`text-xs font-medium ${pub.includedInSluOutput ? 'text-green-600' : 'text-gray-400'}`}>
                          {pub.includedInSluOutput ? '✓' : '○'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <Link href={`/publications/${pub.id}`}>
                          <Button variant="outline" size="xs" className="opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                            View →
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/40">
              <p className="text-xs text-gray-500">
                Showing {((page - 1) * 25) + 1}–{Math.min(page * 25, result.total)} of {result.total.toLocaleString()} results
              </p>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="xs" disabled={page <= 1}
                  onClick={() => setParam({ page: String(page - 1) })}>← Prev</Button>
                {Array.from({ length: Math.min(result.totalPages, 7) }, (_, i) => {
                  const p = i + 1;
                  return (
                    <button key={p} onClick={() => setParam({ page: String(p) })}
                      className={`w-7 h-7 text-xs rounded flex items-center justify-center font-medium transition-colors ${
                        p === page ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                      }`}>{p}</button>
                  );
                })}
                {result.totalPages > 7 && <span className="text-gray-400 text-xs px-1">…</span>}
                <Button variant="outline" size="xs" disabled={page >= result.totalPages}
                  onClick={() => setParam({ page: String(page + 1) })}>Next →</Button>
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
