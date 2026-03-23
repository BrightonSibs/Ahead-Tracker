'use client';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { PageLayout, PageContent, TopBar } from '@/components/layout';
import { Card, Badge, Button, Spinner, EmptyState, ProgressBar, KpiCard } from '@/components/ui';
import { FilterBar } from '@/components/filters';
import { departmentColor, confidenceBadgeColor } from '@/lib/utils';
import type { ResearcherSummary } from '@/types';

export default function ResearchersPage() {
  return (
    <Suspense fallback={<ResearchersPageFallback />}>
      <ResearchersPageContent />
    </Suspense>
  );
}

function ResearchersPageContent() {
  const searchParams = useSearchParams();
  const [researchers, setResearchers] = useState<ResearcherSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const department = searchParams.get('department') || '';
  const search = searchParams.get('search') || '';

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (department) params.set('department', department);
    if (search) params.set('search', search);
    fetch(`/api/researchers?${params}`)
      .then(r => r.json())
      .then(d => { setResearchers(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [department, search]);

  const totalCitations = researchers.reduce((a, r) => a + r.totalCitations, 0);
  const maxH = Math.max(...researchers.map(r => r.hIndex), 0);

  return (
    <PageLayout>
      <TopBar
        title="Researchers"
        subtitle={`${researchers.length} faculty members — AHEAD & HCOR`}
        actions={
          <a href="/api/export?type=researchers">
            <Button variant="outline" size="sm">⬇ Export CSV</Button>
          </a>
        }
      />
      <PageContent>
        {/* Summary KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Total Faculty" value={researchers.length} color="blue" icon="👥" />
          <KpiCard label="AHEAD" value={researchers.filter(r => r.department === 'AHEAD').length} color="blue" icon="🔬" />
          <KpiCard label="HCOR" value={researchers.filter(r => r.department === 'HCOR').length} color="teal" icon="🏥" />
          <KpiCard label="Total Citations" value={totalCitations.toLocaleString()} color="green" icon="📊" />
        </div>

        {/* Filters */}
        <FilterBar filters={[
          { type: 'search', key: 'search', placeholder: 'Search by name, alias, department…', className: 'w-72' },
          { type: 'select', key: 'department', label: 'All Departments',
            options: [{ value: 'AHEAD', label: 'AHEAD' }, { value: 'HCOR', label: 'HCOR' }] },
        ]} />

        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : researchers.length === 0 ? (
          <EmptyState icon="👥" title="No researchers found"
            description="Try adjusting your search or filter." />
        ) : (
          <Card padding={false}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Researcher</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Department</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">ORCID</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">SLU Start</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Publications</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Citations</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">h-index</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Aliases</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Completeness</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {researchers.map(r => (
                    <tr key={r.id} className="hover:bg-gray-50/70 transition-colors group">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
                            <span className="text-brand-700 text-xs font-bold">
                              {r.canonicalName.split(' ').map(p => p[0]).slice(0, 2).join('')}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{r.canonicalName}</p>
                            {r.notes && (
                              <p className="text-xs text-amber-600 flex items-center gap-1 mt-0.5">
                                ⚠ Pending verification
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${departmentColor(r.department)}`}>
                          {r.department}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {r.orcid ? (
                          <a href={`https://orcid.org/${r.orcid}`} target="_blank" rel="noopener"
                            className="text-xs text-teal-600 hover:text-teal-700 font-mono flex items-center gap-1">
                            <span className="w-3 h-3 bg-teal-500 rounded-full inline-block" />
                            {r.orcid.slice(0, 9)}…
                          </a>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 font-mono whitespace-nowrap">
                        {r.sluStartDate ? r.sluStartDate.split('T')[0] : <span className="text-amber-500">Not set</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-medium text-gray-900">{r.publicationCount}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-semibold text-brand-700">{r.totalCitations.toLocaleString()}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`inline-block min-w-[28px] text-center px-2 py-0.5 rounded text-sm font-bold font-display ${
                          r.hIndex >= 10 ? 'bg-green-50 text-green-700' :
                          r.hIndex >= 5 ? 'bg-brand-50 text-brand-700' :
                          'bg-gray-50 text-gray-600'
                        }`}>{r.hIndex}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-500">{r.aliasCount} alias{r.aliasCount !== 1 ? 'es' : ''}</span>
                      </td>
                      <td className="px-4 py-3 w-28">
                        <ProgressBar value={r.profileCompleteness}
                          color={r.profileCompleteness >= 80 ? 'green' : r.profileCompleteness >= 50 ? 'blue' : 'amber'} />
                        <span className="text-[10px] text-gray-400 mt-0.5">{r.profileCompleteness}%</span>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/researchers/${r.id}`}>
                          <Button variant="outline" size="xs" className="opacity-0 group-hover:opacity-100 transition-opacity">
                            View →
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </PageContent>
    </PageLayout>
  );
}

function ResearchersPageFallback() {
  return (
    <PageLayout>
      <TopBar title="Researchers" subtitle="Loading researchers..." />
      <PageContent>
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      </PageContent>
    </PageLayout>
  );
}
