'use client';

import { useEffect, useState } from 'react';
import { PageLayout, PageContent, TopBar, TopBarActions, TopBarSelect } from '@/components/layout';
import { Card, CardHeader, CardTitle, Button, Spinner, Tabs, Toggle, KpiCard } from '@/components/ui';
import {
  CitationTrendChart,
  PublicationBarChart,
  HIndexChart,
  SpecialtyBarChart,
  ImpactFactorChart,
  DeptPieChart,
} from '@/components/charts/lazy';
import { fetchJsonCached } from '@/lib/client-cache';
import { departmentColor } from '@/lib/utils';
import type { DepartmentSummary } from '@/types';

export default function AnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [dashboard, setDashboard] = useState<any>(null);
  const [departments, setDepartments] = useState<DepartmentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [dept, setDept] = useState('');
  const [sluOnly, setSluOnly] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const params = new URLSearchParams();
    if (dept) params.set('department', dept);
    if (sluOnly) params.set('sluOnly', 'true');

    Promise.allSettled([
      fetchJsonCached<any>(`/api/analytics?type=full&${params}`),
      fetchJsonCached<any>(`/api/analytics?type=dashboard&${params}`),
      fetchJsonCached<DepartmentSummary[]>('/api/departments'),
    ])
      .then(([fullResult, dashboardResult, departmentResult]) => {
        if (cancelled) return;

        const fullData = fullResult.status === 'fulfilled' ? fullResult.value : null;
        const dashboardData = dashboardResult.status === 'fulfilled' ? dashboardResult.value : null;
        const departmentData = departmentResult.status === 'fulfilled' && Array.isArray(departmentResult.value)
          ? departmentResult.value
          : (fullData?.departmentKeys || []).map((item: any, index: number) => ({
              id: `fallback-${item.key}`,
              code: item.key,
              name: item.name,
              shortName: item.name,
              color: item.color || null,
              activeStatus: true,
              displayOrder: index,
              researcherCount: 0,
            }));

        setData(fullData);
        setDashboard(dashboardData);
        setDepartments(departmentData.filter((item: DepartmentSummary) => item.activeStatus));
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [dept, sluOnly]);

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'citations', label: 'Citations' },
    { id: 'hindex', label: 'h-index' },
    { id: 'specialties', label: 'Specialties' },
    { id: 'impact', label: 'Impact Factors' },
  ];

  return (
    <PageLayout>
      <TopBar
        title="Analytics"
        subtitle="Research output and citation analysis across departments"
        actions={
          <TopBarActions>
            <Toggle checked={sluOnly} onChange={setSluOnly} label="SLU tenure only" />
            <TopBarSelect
              value={dept}
              onChange={e => setDept(e.target.value)}
            >
              <option value="">All Departments</option>
              {departments.map(department => (
                <option key={department.code} value={department.code}>
                  {department.shortName || department.name}
                </option>
              ))}
            </TopBarSelect>
            <a href={`/api/export?type=researchers${dept ? `&department=${dept}` : ''}`}>
              <Button variant="outline" size="sm">Export</Button>
            </a>
          </TopBarActions>
        }
      />

      <PageContent>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Total Publications" value={dashboard?.totalPublications ?? '-'} color="blue" icon="P" />
          <KpiCard label="Total Citations" value={(dashboard?.totalCitations ?? 0).toLocaleString()} color="teal" icon="C" />
          <KpiCard
            label="Observed Citation Growth"
            value={(dashboard?.citationsThisYear ?? 0).toLocaleString()}
            sub={`${new Date().getFullYear()} from stored snapshots`}
            color="green"
            icon="G"
          />
          <KpiCard label="Avg Citations / Article" value={dashboard?.avgCitationsPerArticle ?? '-'} color="amber" icon="A" />
        </div>

        <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

        {loading ? (
          <div className="flex justify-center py-20">
            <Spinner size="lg" />
          </div>
        ) : (
          <>
            {activeTab === 'overview' && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <div>
                        <CardTitle>Annual Publications</CardTitle>
                        <p className="mt-0.5 text-xs text-gray-500">By department per year</p>
                      </div>
                    </CardHeader>
                    <PublicationBarChart data={data?.publicationsByYear || []} keys={data?.departmentKeys || []} />
                  </Card>

                  <Card>
                    <CardHeader>
                      <div>
                        <CardTitle>Department Share</CardTitle>
                        <p className="mt-0.5 text-xs text-gray-500">Total publications by department</p>
                      </div>
                    </CardHeader>
                    <DeptPieChart data={data?.departmentPublicationTotals || []} />
                  </Card>
                </div>

                <Card padding={false}>
                  <div className="border-b border-gray-100 px-5 pb-3 pt-4">
                    <CardTitle>Researcher Summary Table</CardTitle>
                    <p className="mt-0.5 text-xs text-gray-500">All researchers ranked by h-index</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50">
                          {['#', 'Researcher', 'Dept', 'Publications', 'Total Citations', 'Avg Citations', 'h-index', 'i10-index'].map((header, index) => (
                            <th
                              key={index}
                              className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 ${index >= 3 ? 'text-right' : 'text-left'}`}
                            >
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {data?.researcherStats?.map((researcher: any, index: number) => (
                          <tr key={researcher.id} className="transition-colors hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-semibold text-gray-400">{index + 1}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center border border-gray-300 bg-gray-50">
                                  <span className="text-[10px] font-bold text-brand-700">
                                    {researcher.name.split(' ').map((part: string) => part[0]).slice(0, 2).join('')}
                                  </span>
                                </div>
                                <a href={`/researchers/${researcher.id}`} className="text-sm font-medium text-gray-900 hover:text-brand-700">
                                  {researcher.name}
                                </a>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`rounded px-2 py-0.5 text-xs font-medium ${departmentColor(researcher.department)}`}>
                                {researcher.department}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right text-sm text-gray-700">{researcher.publications}</td>
                            <td className="px-4 py-3 text-right text-sm font-semibold text-brand-700">
                              {researcher.totalCitations.toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-right text-sm text-gray-600">
                              {researcher.publications > 0 ? (researcher.totalCitations / researcher.publications).toFixed(1) : '0'}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span
                                className={`inline-block min-w-[28px] border px-2 py-0.5 text-center text-sm font-semibold ${
                                  researcher.hIndex >= 10
                                    ? 'border-brand-200 bg-brand-50 text-brand-700'
                                    : researcher.hIndex >= 5
                                      ? 'border-gray-300 bg-gray-50 text-gray-700'
                                      : 'border-gray-300 bg-white text-gray-600'
                                }`}
                              >
                                {researcher.hIndex}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right text-sm text-gray-600">{researcher.i10Index}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            )}

            {activeTab === 'citations' && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <div>
                        <CardTitle>Observed Citation Growth by Department</CardTitle>
                        <p className="mt-0.5 text-xs text-gray-500">Year-over-year growth inferred from stored citation snapshots</p>
                      </div>
                    </CardHeader>
                    <CitationTrendChart data={data?.citationsByYear || []} keys={data?.departmentKeys || []} />
                  </Card>

                  <Card>
                    <CardHeader>
                      <div>
                        <CardTitle>Cumulative Citations by Department</CardTitle>
                        <p className="mt-0.5 text-xs text-gray-500">Latest observed citation totals carried forward across years</p>
                      </div>
                    </CardHeader>
                    <CitationTrendChart
                      data={data?.cumulativeCitationsByYear || []}
                      keys={data?.departmentKeys || []}
                      cumulative
                    />
                  </Card>
                </div>

                <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <div>
                        <CardTitle>Per-Researcher Citation Growth</CardTitle>
                        <p className="mt-0.5 text-xs text-gray-500">Top 6 researchers by total citations, using observed growth only</p>
                      </div>
                    </CardHeader>
                    <ResearcherCitationChart researcherStats={data?.researcherStats?.slice(0, 6) || []} mode="growth" />
                  </Card>

                  <Card>
                    <CardHeader>
                      <div>
                        <CardTitle>Per-Researcher Cumulative Citations</CardTitle>
                        <p className="mt-0.5 text-xs text-gray-500">Latest observed citation totals carried forward across years</p>
                      </div>
                    </CardHeader>
                    <ResearcherCitationChart researcherStats={data?.researcherStats?.slice(0, 6) || []} mode="cumulative" />
                  </Card>
                </div>
              </div>
            )}

            {activeTab === 'hindex' && (
              <div className="space-y-5">
                <Card>
                  <CardHeader>
                    <CardTitle>h-index Comparison</CardTitle>
                    <p className="text-xs text-gray-500">Bars are colored by department.</p>
                  </CardHeader>
                  <HIndexChart
                    data={
                      data?.researcherStats?.map((researcher: any) => ({
                        name: researcher.name.split(' ').slice(-1)[0],
                        hIndex: researcher.hIndex,
                        dept: researcher.department,
                      })) || []
                    }
                  />
                </Card>

                <Card padding={false}>
                  <div className="border-b border-gray-100 px-5 pb-3 pt-4">
                    <CardTitle>h-index and i10-index Details</CardTitle>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50">
                          {['Researcher', 'Dept', 'h-index', 'i10-index', 'Total Citations', 'Publications', 'Avg Cit/Article'].map((header, index) => (
                            <th
                              key={index}
                              className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 ${index >= 2 ? 'text-right' : 'text-left'}`}
                            >
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {data?.researcherStats?.map((researcher: any) => (
                          <tr key={researcher.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">{researcher.name}</td>
                            <td className="px-4 py-3">
                              <span className={`rounded px-2 py-0.5 text-xs font-medium ${departmentColor(researcher.department)}`}>
                                {researcher.department}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span
                                className={`text-lg font-semibold ${
                                  researcher.hIndex >= 10
                                    ? 'text-brand-700'
                                    : researcher.hIndex >= 5
                                      ? 'text-gray-800'
                                      : 'text-gray-600'
                                }`}
                              >
                                {researcher.hIndex}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-gray-700">{researcher.i10Index}</td>
                            <td className="px-4 py-3 text-right text-sm font-semibold text-brand-700">
                              {researcher.totalCitations.toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-right text-sm text-gray-600">{researcher.publications}</td>
                            <td className="px-4 py-3 text-right text-sm text-gray-600">
                              {researcher.publications > 0 ? (researcher.totalCitations / researcher.publications).toFixed(1) : '0'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            )}

            {activeTab === 'specialties' && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>Publications by Specialty</CardTitle>
                    </CardHeader>
                    <SpecialtyBarChart data={data?.specialtyDistribution || []} />
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Specialty Breakdown</CardTitle>
                    </CardHeader>
                    <div className="space-y-2.5">
                      {data?.specialtyDistribution?.map((specialty: any, index: number) => (
                        <div key={index} className="flex items-center gap-3">
                          <div className="w-28 truncate text-right text-xs text-gray-600">{specialty.specialty}</div>
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                            <div
                              className="h-full bg-gray-600 transition-all"
                              style={{ width: `${(specialty.count / (data.specialtyDistribution[0]?.count || 1)) * 100}%` }}
                            />
                          </div>
                          <span className="w-6 text-right text-xs font-semibold text-gray-700">{specialty.count}</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>

                <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>Specialty Citation Trends</CardTitle>
                      <p className="text-xs text-gray-500">Observed yearly citation growth for the most-cited specialties</p>
                    </CardHeader>
                    <CitationTrendChart
                      data={data?.specialtyCitationTrends || []}
                      keys={(data?.specialtyCitationTrendKeys || []).map((item: any, index: number) => ({
                        key: item.key,
                        name: item.name,
                        color: ['#003DA5', '#4B5563', '#9CA3AF', '#1F2937', '#6B7280'][index % 5],
                      }))}
                    />
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Specialty Cumulative Citations</CardTitle>
                      <p className="text-xs text-gray-500">Latest observed citation totals carried forward across years</p>
                    </CardHeader>
                    <CitationTrendChart
                      data={data?.specialtyCumulativeCitationTrends || []}
                      keys={(data?.specialtyCitationTrendKeys || []).map((item: any, index: number) => ({
                        key: item.key,
                        name: item.name,
                        color: ['#003DA5', '#4B5563', '#9CA3AF', '#1F2937', '#6B7280'][index % 5],
                      }))}
                      cumulative
                    />
                  </Card>
                </div>
              </div>
            )}

            {activeTab === 'impact' && (
              <div className="space-y-5">
                <Card>
                  <CardHeader>
                    <CardTitle>Average IF per Researcher</CardTitle>
                    <p className="text-xs text-gray-500">Weighted average journal impact factor</p>
                  </CardHeader>
                  <div className="space-y-3 py-2">
                    {data?.researcherStats?.map((researcher: any) => (
                      <div key={researcher.id} className="flex items-center gap-3">
                        <span className="w-36 truncate text-right text-xs text-gray-700">
                          {researcher.name.split(' ').slice(-1)[0]}
                        </span>
                        <div className="h-3 flex-1 overflow-hidden rounded-full bg-gray-100">
                          <div
                            className="h-full bg-brand-700 transition-all"
                            style={{ width: `${Math.min(100, ((researcher.avgImpactFactor || 0) / 10) * 100)}%` }}
                          />
                        </div>
                        <span className="w-12 text-right text-xs font-medium text-gray-700">
                          {researcher.avgImpactFactor != null ? researcher.avgImpactFactor.toFixed(1) : '-'}
                        </span>
                        <span className={`w-8 text-right text-xs font-medium ${departmentColor(researcher.department).split(' ')[1]}`}>
                          {researcher.department}
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Impact Factor Distribution</CardTitle>
                    <p className="text-xs text-gray-500">Publications binned by journal impact factor tier</p>
                  </CardHeader>
                  <ImpactFactorChart data={data?.impactFactorDistribution || []} />
                </Card>
              </div>
            )}
          </>
        )}
      </PageContent>
    </PageLayout>
  );
}

function ResearcherCitationChart({
  researcherStats,
  mode,
}: {
  researcherStats: any[];
  mode: 'growth' | 'cumulative';
}) {
  const colors = ['#003DA5', '#4B5563', '#6B7280', '#9CA3AF', '#1F2937', '#D1D5DB'];
  const chartData = Object.entries(
    researcherStats.slice(0, 6).reduce<Record<number, Record<string, number>>>((yearMap, researcher, index) => {
      const series = mode === 'cumulative' ? researcher?.cumulativeCitationByYear : researcher?.citationByYear;
      if (!series) return yearMap;

      for (const [yearString, citations] of Object.entries(series as Record<number, number>)) {
        const year = Number(yearString);
        if (!yearMap[year]) yearMap[year] = {};
        yearMap[year][`r${index}`] = Number(citations) || 0;
      }

      return yearMap;
    }, {}),
  )
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([year, values]) => ({ year: Number(year), ...values }));

  const keys = researcherStats.slice(0, 6).map((researcher, index) => ({
    key: `r${index}`,
    name: researcher.name.split(' ').slice(-1)[0],
    color: colors[index],
  }));

  return <CitationTrendChart data={chartData} keys={keys} cumulative={mode === 'cumulative'} />;
}
