'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { PageLayout, PageContent, TopBar, TopBarActions } from '@/components/layout';
import { Card, Button, Spinner, EmptyState, ProgressBar, KpiCard } from '@/components/ui';
import { FilterBar } from '@/components/filters';
import { fetchJsonCached } from '@/lib/client-cache';
import { departmentColor } from '@/lib/utils';
import type { DepartmentSummary, ResearcherSummary } from '@/types';

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
  const [departments, setDepartments] = useState<DepartmentSummary[]>([]);
  const [summary, setSummary] = useState<{ totalCitations: number } | null>(null);
  const [loading, setLoading] = useState(true);

  const department = searchParams.get('department') || '';
  const search = searchParams.get('search') || '';

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams();
    if (department) params.set('department', department);
    if (search) params.set('search', search);

    Promise.allSettled([
      fetchJsonCached<ResearcherSummary[]>(`/api/researchers?${params}`),
      fetchJsonCached<{ totalCitations: number }>(`/api/researchers?summary=true&${params}`),
      fetchJsonCached<DepartmentSummary[]>('/api/departments'),
    ])
      .then(([researcherResult, summaryResult, departmentResult]) => {
        if (cancelled) return;

        const researcherData = researcherResult.status === 'fulfilled' && Array.isArray(researcherResult.value)
          ? researcherResult.value
          : [];
        const summaryData = summaryResult.status === 'fulfilled' ? summaryResult.value : { totalCitations: 0 };
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
        setSummary(summaryData);
        setDepartments(departmentData.filter(item => item.activeStatus));
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [department, search]);

  const representedDepartments = Array.from(new Set(researchers.map(researcher => researcher.department)));
  const leadingDepartment = departments
    .map(departmentItem => ({
      ...departmentItem,
      count: researchers.filter(researcher => researcher.department === departmentItem.code).length,
    }))
    .sort((a, b) => b.count - a.count)[0];

  return (
    <PageLayout>
      <TopBar
        title="Researchers"
        subtitle={`${researchers.length} faculty members across ${representedDepartments.length || 0} departments`}
        actions={
          <TopBarActions>
            <a href="/api/export?type=researchers">
              <Button variant="outline" size="sm">Export CSV</Button>
            </a>
          </TopBarActions>
        }
      />
      <PageContent>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Total Faculty" value={researchers.length} color="blue" icon="R" />
          <KpiCard label="Departments" value={representedDepartments.length} color="teal" icon="D" />
          <KpiCard
            label="Largest Department"
            value={leadingDepartment?.shortName || leadingDepartment?.name || '-'}
            sub={leadingDepartment ? `${leadingDepartment.count} researchers` : 'No department data'}
            color="amber"
            icon="L"
          />
          <KpiCard label="Captured Citations" value={(summary?.totalCitations ?? 0).toLocaleString()} color="green" icon="C" />
        </div>

        <FilterBar filters={[
          { type: 'search', key: 'search', placeholder: 'Search by name, alias, department...', className: 'w-72' },
          {
            type: 'select',
            key: 'department',
            label: 'All Departments',
            options: departments.map(departmentItem => ({
              value: departmentItem.code,
              label: departmentItem.shortName || departmentItem.name,
            })),
          },
        ]} />

        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : researchers.length === 0 ? (
          <EmptyState icon="R" title="No researchers found" description="Try adjusting your search or filter." />
        ) : (
          <Card padding={false}>
            <div className="border-b border-gray-100 bg-gray-50/40 px-4 py-3 text-xs text-gray-600">
              Profile completeness reflects how complete each researcher record is.
              It is based on name, ORCID, SLU start date, aliases, and specialties.
              Citation totals on this page use the latest stored citation snapshot per publication.
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Researcher</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Department</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">ORCID</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">SLU Start</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Publications</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Captured Citations</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">h-index</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Aliases</th>
                    <th
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500"
                      title="Based on profile fields present: name, ORCID, SLU start date, aliases, and specialties."
                    >
                      Profile Completeness
                    </th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {researchers.map(researcher => (
                    <tr key={researcher.id} className="group hover:bg-gray-50/70 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-100">
                            <span className="text-xs font-bold text-brand-700">
                              {researcher.canonicalName.split(' ').map(part => part[0]).slice(0, 2).join('')}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{researcher.canonicalName}</p>
                            {researcher.notes && (
                              <p className="mt-0.5 text-xs text-amber-600">Pending verification</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded px-2 py-0.5 text-xs font-medium ${departmentColor(researcher.department)}`}>
                          {researcher.department}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {researcher.orcid ? (
                          <a
                            href={`https://orcid.org/${researcher.orcid}`}
                            target="_blank"
                            rel="noopener"
                            className="flex items-center gap-1 text-xs font-mono text-teal-600 hover:text-teal-700"
                          >
                            <span className="inline-block h-3 w-3 rounded-full bg-teal-500" />
                            {researcher.orcid.slice(0, 9)}...
                          </a>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-gray-500">
                        {researcher.sluStartDate ? researcher.sluStartDate.split('T')[0] : <span className="text-amber-500">Not set</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">{researcher.publicationCount}</td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-brand-700">{researcher.totalCitations.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`inline-block min-w-[28px] rounded px-2 py-0.5 text-sm font-bold ${
                          researcher.hIndex >= 10 ? 'bg-green-50 text-green-700' :
                          researcher.hIndex >= 5 ? 'bg-brand-50 text-brand-700' :
                          'bg-gray-50 text-gray-600'
                        }`}>
                          {researcher.hIndex}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{researcher.aliasCount} alias{researcher.aliasCount !== 1 ? 'es' : ''}</td>
                      <td className="w-28 px-4 py-3">
                        <ProgressBar
                          value={researcher.profileCompleteness}
                          color={researcher.profileCompleteness >= 80 ? 'green' : researcher.profileCompleteness >= 50 ? 'blue' : 'amber'}
                        />
                        <span className="mt-0.5 text-[10px] text-gray-400">{researcher.profileCompleteness}%</span>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/researchers/${researcher.id}`}>
                          <Button variant="outline" size="xs" className="opacity-0 transition-opacity group-hover:opacity-100">
                            View
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
