'use client';
import { useEffect, useState } from 'react';
import { PageLayout, PageContent, TopBar } from '@/components/layout';
import { Card, CardHeader, CardTitle, Button, Spinner, Tabs, Toggle, KpiCard } from '@/components/ui';
import {
  CitationTrendChart, PublicationBarChart, HIndexChart,
  SpecialtyBarChart, ImpactFactorChart, DeptPieChart,
} from '@/components/charts';
import { departmentColor } from '@/lib/utils';

export default function AnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [dashboard, setDashboard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dept, setDept] = useState('');
  const [sluOnly, setSluOnly] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (dept) params.set('department', dept);
    if (sluOnly) params.set('sluOnly', 'true');

    Promise.all([
      fetch(`/api/analytics?type=full&${params}`).then(r => r.json()),
      fetch(`/api/analytics?type=dashboard`).then(r => r.json()),
    ]).then(([fullData, dashData]) => {
      setData(fullData);
      setDashboard(dashData);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [dept, sluOnly]);

  // Build IF distribution buckets from researcher stats
  const ifBuckets = [
    { bucket: 'IF < 2', count: 0 },
    { bucket: 'IF 2–5', count: 0 },
    { bucket: 'IF 5–10', count: 0 },
    { bucket: 'IF > 10', count: 0 },
  ];

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
          <div className="flex items-center gap-3">
            <Toggle checked={sluOnly} onChange={setSluOnly} label="SLU tenure only" />
            <select value={dept} onChange={e => setDept(e.target.value)}
              className="px-3 py-1.5 text-sm rounded-md border border-gray-300 bg-white focus:border-brand-500 outline-none">
              <option value="">All Departments</option>
              <option value="AHEAD">AHEAD only</option>
              <option value="HCOR">HCOR only</option>
            </select>
            <a href={`/api/export?type=researchers${dept ? `&department=${dept}` : ''}`}>
              <Button variant="outline" size="sm">⬇ Export</Button>
            </a>
          </div>
        }
      />
      <PageContent>
        {/* Global KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Total Publications" value={dashboard?.totalPublications ?? '—'} color="blue" icon="📄" />
          <KpiCard label="Total Citations" value={(dashboard?.totalCitations ?? 0).toLocaleString()} color="teal" icon="📊" />
          <KpiCard label="Citations This Year" value={(dashboard?.citationsThisYear ?? 0).toLocaleString()} color="green" icon="📈" />
          <KpiCard label="Avg Citations / Article" value={dashboard?.avgCitationsPerArticle ?? '—'} color="amber" icon="⭐" />
        </div>

        <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

        {loading ? (
          <div className="flex justify-center py-20"><Spinner size="lg" /></div>
        ) : (
          <>
            {/* OVERVIEW TAB */}
            {activeTab === 'overview' && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <Card>
                    <CardHeader>
                      <div>
                        <CardTitle>Annual Publications</CardTitle>
                        <p className="text-xs text-gray-500 mt-0.5">By department per year</p>
                      </div>
                    </CardHeader>
                    <PublicationBarChart data={data?.publicationsByYear || []} />
                  </Card>
                  <Card>
                    <CardHeader>
                      <div>
                        <CardTitle>Department Share</CardTitle>
                        <p className="text-xs text-gray-500 mt-0.5">Total publications by dept</p>
                      </div>
                    </CardHeader>
                    <DeptPieChart data={[
                      { name: 'AHEAD', value: data?.publicationsByYear?.reduce((s: number, r: any) => s + (r.AHEAD || 0), 0) || 0 },
                      { name: 'HCOR',  value: data?.publicationsByYear?.reduce((s: number, r: any) => s + (r.HCOR || 0), 0) || 0 },
                    ]} />
                  </Card>
                </div>

                {/* Researcher summary table */}
                <Card padding={false}>
                  <div className="px-5 pt-4 pb-3 border-b border-gray-100">
                    <CardTitle>Researcher Summary Table</CardTitle>
                    <p className="text-xs text-gray-500 mt-0.5">All researchers ranked by h-index</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50/60">
                          {['#', 'Researcher', 'Dept', 'Publications', 'Total Citations', 'Avg Citations', 'h-index', 'i10-index'].map((h, i) => (
                            <th key={i} className={`px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide ${i >= 3 ? 'text-right' : 'text-left'}`}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {data?.researcherStats?.map((r: any, i: number) => (
                          <tr key={r.id} className="hover:bg-gray-50/60 transition-colors">
                            <td className="px-4 py-3 text-sm font-bold text-gray-300 font-display">{i + 1}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
                                  <span className="text-brand-700 text-[10px] font-bold">
                                    {r.name.split(' ').map((p: string) => p[0]).slice(0, 2).join('')}
                                  </span>
                                </div>
                                <a href={`/researchers/${r.id}`} className="text-sm font-medium text-gray-900 hover:text-brand-700">{r.name}</a>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${departmentColor(r.department)}`}>{r.department}</span>
                            </td>
                            <td className="px-4 py-3 text-right text-sm text-gray-700">{r.publications}</td>
                            <td className="px-4 py-3 text-right text-sm font-semibold text-brand-700">{r.totalCitations.toLocaleString()}</td>
                            <td className="px-4 py-3 text-right text-sm text-gray-600">
                              {r.publications > 0 ? (r.totalCitations / r.publications).toFixed(1) : '0'}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className={`inline-block min-w-[28px] text-center px-2 py-0.5 rounded text-sm font-bold font-display ${
                                r.hIndex >= 10 ? 'bg-green-50 text-green-700' :
                                r.hIndex >= 5  ? 'bg-brand-50 text-brand-700' :
                                'bg-gray-50 text-gray-600'
                              }`}>{r.hIndex}</span>
                            </td>
                            <td className="px-4 py-3 text-right text-sm text-gray-600">{r.i10Index}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            )}

            {/* CITATIONS TAB */}
            {activeTab === 'citations' && (
              <div className="space-y-5">
                <Card>
                  <CardHeader>
                    <div>
                      <CardTitle>Annual Citations by Department</CardTitle>
                      <p className="text-xs text-gray-500 mt-0.5">Total citation counts captured per year</p>
                    </div>
                  </CardHeader>
                  <CitationTrendChart
                    data={data?.citationsByYear || []}
                    keys={[
                      { key: 'AHEAD', name: 'AHEAD', color: '#1a6fb5' },
                      { key: 'HCOR',  name: 'HCOR',  color: '#14b8a6' },
                    ]}
                  />
                </Card>

                <Card>
                  <CardHeader>
                    <div>
                      <CardTitle>Per-Researcher Citation Trends</CardTitle>
                      <p className="text-xs text-gray-500 mt-0.5">Top 6 researchers by total citations</p>
                    </div>
                  </CardHeader>
                  <ResearcherCitationChart researcherStats={data?.researcherStats?.slice(0, 6) || []} />
                </Card>
              </div>
            )}

            {/* H-INDEX TAB */}
            {activeTab === 'hindex' && (
              <div className="space-y-5">
                <Card>
                  <CardHeader>
                    <CardTitle>h-index Comparison</CardTitle>
                    <p className="text-xs text-gray-500">Color: <span className="text-brand-600 font-medium">AHEAD</span> · <span className="text-teal-600 font-medium">HCOR</span></p>
                  </CardHeader>
                  <HIndexChart data={data?.researcherStats?.map((r: any) => ({
                    name: r.name.split(' ').slice(-1)[0],
                    hIndex: r.hIndex,
                    dept: r.department,
                  })) || []} />
                </Card>

                <Card padding={false}>
                  <div className="px-5 pt-4 pb-3 border-b border-gray-100">
                    <CardTitle>h-index & i10-index Details</CardTitle>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50/60">
                          {['Researcher', 'Dept', 'h-index', 'i10-index', 'Total Citations', 'Publications', 'Avg Cit/Article'].map((h, i) => (
                            <th key={i} className={`px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide ${i >= 2 ? 'text-right' : 'text-left'}`}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {data?.researcherStats?.map((r: any) => (
                          <tr key={r.id} className="hover:bg-gray-50/60">
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">{r.name}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${departmentColor(r.department)}`}>{r.department}</span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className={`font-bold font-display text-lg ${r.hIndex >= 10 ? 'text-green-700' : r.hIndex >= 5 ? 'text-brand-700' : 'text-gray-600'}`}>
                                {r.hIndex}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-teal-700">{r.i10Index}</td>
                            <td className="px-4 py-3 text-right text-sm font-semibold text-brand-700">{r.totalCitations.toLocaleString()}</td>
                            <td className="px-4 py-3 text-right text-sm text-gray-600">{r.publications}</td>
                            <td className="px-4 py-3 text-right text-sm text-gray-600">
                              {r.publications > 0 ? (r.totalCitations / r.publications).toFixed(1) : '0'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            )}

            {/* SPECIALTIES TAB */}
            {activeTab === 'specialties' && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
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
                      {data?.specialtyDistribution?.map((s: any, i: number) => (
                        <div key={i} className="flex items-center gap-3">
                          <div className="w-28 text-xs text-gray-600 truncate text-right">{s.specialty}</div>
                          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-teal-500 transition-all"
                              style={{ width: `${(s.count / (data.specialtyDistribution[0]?.count || 1)) * 100}%` }} />
                          </div>
                          <span className="text-xs font-semibold text-gray-700 w-6 text-right">{s.count}</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              </div>
            )}

            {/* IMPACT FACTORS TAB */}
            {activeTab === 'impact' && (
              <div className="space-y-5">
                <Card>
                  <CardHeader>
                    <CardTitle>Average IF per Researcher</CardTitle>
                    <p className="text-xs text-gray-500">Weighted average journal impact factor</p>
                  </CardHeader>
                  <div className="space-y-3 py-2">
                    {data?.researcherStats?.map((r: any) => (
                      <div key={r.id} className="flex items-center gap-3">
                        <span className="w-36 text-xs text-gray-700 text-right truncate">{r.name.split(' ').slice(-1)[0]}</span>
                        <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-brand-400 transition-all"
                            style={{ width: `${Math.min(100, (r.publications / 10) * 100)}%` }} />
                        </div>
                        <span className={`text-xs font-medium w-8 text-right ${departmentColor(r.department).split(' ')[1]}`}>
                          {r.department}
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Impact Factor Distribution</CardTitle>
                    <p className="text-xs text-gray-500">Publications binned by journal IF tier</p>
                  </CardHeader>
                  <ImpactFactorChart data={ifBuckets} />
                  <p className="text-xs text-gray-400 mt-2 text-center">
                    Note: Exact IF tier counts require journal_metrics data to be populated.
                  </p>
                </Card>
              </div>
            )}
          </>
        )}
      </PageContent>
    </PageLayout>
  );
}

// Inner component for per-researcher citation trends
function ResearcherCitationChart({ researcherStats }: { researcherStats: any[] }) {
  const [chartData, setChartData] = useState<any[]>([]);
  const COLORS = ['#1a6fb5', '#14b8a6', '#16a34a', '#d97706', '#dc2626', '#8b5cf6'];

  useEffect(() => {
    if (!researcherStats.length) return;
    // Fetch citation data per top researcher
    Promise.all(
      researcherStats.slice(0, 6).map(r =>
        fetch(`/api/researchers/${r.id}`).then(res => res.json()).catch(() => null)
      )
    ).then(details => {
      // Merge by year
      const yearMap: Record<number, Record<string, number>> = {};
      details.forEach((d, i) => {
        if (!d?.citationByYear) return;
        for (const { year, citations } of d.citationByYear) {
          if (!yearMap[year]) yearMap[year] = {};
          yearMap[year][`r${i}`] = citations;
        }
      });
      setChartData(
        Object.entries(yearMap)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([year, vals]) => ({ year: Number(year), ...vals }))
      );
    });
  }, [researcherStats]);

  const keys = researcherStats.slice(0, 6).map((r, i) => ({
    key: `r${i}`,
    name: r.name.split(' ').slice(-1)[0],
    color: COLORS[i],
  }));

  return <CitationTrendChart data={chartData} keys={keys} />;
}
