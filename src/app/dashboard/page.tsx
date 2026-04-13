'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PageLayout, PageContent, TopBar, TopBarActions } from '@/components/layout';
import { Card, CardHeader, CardTitle, KpiCard, Button, Alert, Skeleton, Toggle } from '@/components/ui';
import { CitationTrendChart, DeptPieChart } from '@/components/charts/lazy';
import { fetchJsonCached } from '@/lib/client-cache';
import { departmentDotColor, departmentColor, formatDate, sourceLabel } from '@/lib/utils';

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [growthChartData, setGrowthChartData] = useState<any[]>([]);
  const [cumulativeChartData, setCumulativeChartData] = useState<any[]>([]);
  const [departmentKeys, setDepartmentKeys] = useState<any[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(true);
  const [sluOnly, setSluOnly] = useState(false);
  const [citationView, setCitationView] = useState<'growth' | 'cumulative'>('growth');

  useEffect(() => {
    let cancelled = false;
    setSummaryLoading(true);
    setDetailLoading(true);

    fetchJsonCached<any>(`/api/analytics?type=dashboard&sluOnly=${sluOnly}`)
      .then(dashboardData => {
        if (cancelled) return;
        setStats(dashboardData);
      })
      .catch(() => {
        if (!cancelled) setStats(null);
      })
      .finally(() => {
        if (!cancelled) setSummaryLoading(false);
      });

    fetchJsonCached<any>(`/api/analytics?type=full&sluOnly=${sluOnly}`)
      .then(fullData => {
        if (cancelled) return;
        setGrowthChartData(fullData?.citationsByYear || []);
        setCumulativeChartData(fullData?.cumulativeCitationsByYear || []);
        setDepartmentKeys(fullData?.departmentKeys || []);
      })
      .catch(() => {
        if (cancelled) return;
        setGrowthChartData([]);
        setCumulativeChartData([]);
        setDepartmentKeys([]);
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [sluOnly]);

  const activeChartData = citationView === 'cumulative' ? cumulativeChartData : growthChartData;

  return (
    <PageLayout>
      <TopBar
        title="Dashboard"
        subtitle="Research output overview across tracked departments"
        actions={
          <TopBarActions>
            <Toggle checked={sluOnly} onChange={setSluOnly} label="SLU tenure only" />
            <Link href="/reports">
              <Button variant="outline" size="sm">Export Report</Button>
            </Link>
          </TopBarActions>
        }
      />

      <PageContent>
        <>
          {stats?.alerts?.length > 0 && (
            <div className="space-y-2">
              {stats.alerts.slice(0, 2).map((alert: any) => (
                <Alert key={alert.id} type={alert.alertType === 'SYNC_FAILED' ? 'error' : 'warning'} title={alert.title}>
                  <span className="text-sm">{alert.message}</span>
                  <Link href="/admin" className="ml-2 text-xs font-medium underline">Review</Link>
                </Alert>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {summaryLoading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="border border-gray-300 bg-white p-5">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <Skeleton className="h-3 w-28" />
                      <Skeleton className="mt-3 h-8 w-24" />
                      <Skeleton className="mt-2 h-3 w-36" />
                    </div>
                    <Skeleton className="ml-3 h-10 w-10" />
                  </div>
                </div>
              ))
            ) : (
              <>
                <KpiCard
                  label="Total Publications"
                  value={stats?.totalPublications ?? 0}
                  sub={sluOnly ? 'SLU tenure-filtered output' : 'All matched publications'}
                  color="blue"
                  icon="P"
                />
                <KpiCard
                  label="Total Citations"
                  value={(stats?.totalCitations ?? 0).toLocaleString()}
                  sub="Current total across all publications"
                  color="teal"
                  icon="C"
                  delta={`${(stats?.citationsThisYear ?? 0).toLocaleString()} observed growth in ${new Date().getFullYear()} so far`}
                />
                <KpiCard
                  label="Avg Citations / Article"
                  value={stats?.avgCitationsPerArticle ?? 0}
                  sub="Based on displayed publication set"
                  color="green"
                  icon="A"
                />
                <KpiCard
                  label="Active Researchers"
                  value={stats?.totalResearchers ?? 0}
                  sub="Across all departments"
                  color="amber"
                  icon="R"
                />
              </>
            )}
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <div>
                  <CardTitle>
                    {citationView === 'cumulative' ? 'Department Cumulative Citations' : 'Department Citation Trends'}
                  </CardTitle>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {citationView === 'cumulative'
                      ? `Latest observed citation totals carried forward by year ${sluOnly ? '(SLU tenure only)' : '(all time)'}`
                      : `Observed citation growth from stored snapshots ${sluOnly ? '(SLU tenure only)' : '(all time)'}`}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant={citationView === 'growth' ? 'primary' : 'ghost'}
                    size="xs"
                    onClick={() => setCitationView('growth')}
                  >
                    Growth
                  </Button>
                  <Button
                    variant={citationView === 'cumulative' ? 'primary' : 'ghost'}
                    size="xs"
                    onClick={() => setCitationView('cumulative')}
                  >
                    Cumulative
                  </Button>
                </div>
              </CardHeader>
              {detailLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-64 w-full" />
                </div>
              ) : (
                <CitationTrendChart data={activeChartData} keys={departmentKeys} cumulative={citationView === 'cumulative'} />
              )}
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Publications by Department</CardTitle>
              </CardHeader>
              {summaryLoading || detailLoading ? (
                <div className="space-y-3">
                  <Skeleton className="mx-auto h-52 w-52 rounded-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              ) : (
                <>
                <DeptPieChart
                  data={stats?.byDepartment?.map((item: any) => ({
                    name: item.name || item.dept,
                    value: item.publications,
                    color: item.color,
                  })) ?? []}
                />
                <div className="mt-3 space-y-2">
                  {stats?.byDepartment?.map((department: any) => (
                    <div key={department.dept} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span
                          className={department.color ? 'h-2.5 w-2.5 rounded-full' : `h-2.5 w-2.5 rounded-full ${departmentDotColor(department.dept)}`}
                          style={department.color ? { backgroundColor: department.color } : undefined}
                        />
                        <span className="font-medium text-gray-700">{department.name || department.dept}</span>
                      </span>
                      <span className="text-xs text-gray-500">{department.publications} publications</span>
                    </div>
                  ))}
                </div>
                </>
              )}
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <div>
                  <CardTitle>Researcher Leaderboard</CardTitle>
                  <p className="mt-0.5 text-xs text-gray-500">Ranked by h-index for the displayed publication set</p>
                </div>
                <Link href="/researchers">
                  <Button variant="ghost" size="xs">View all</Button>
                </Link>
              </CardHeader>
              {summaryLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <div key={index} className="flex items-center gap-3 rounded-lg p-2.5">
                      <Skeleton className="h-4 w-6" />
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                      <div className="space-y-2 text-right">
                        <Skeleton className="h-4 w-12" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {stats?.topResearchers?.map((researcher: any, index: number) => (
                    <Link key={researcher.id} href={`/researchers/${researcher.id}`}>
                      <div className="group flex cursor-pointer items-center gap-3 border-b border-gray-200 py-2.5 transition-colors hover:bg-gray-50">
                        <span className="w-6 text-center text-sm font-bold text-gray-300">{index + 1}</span>
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center border border-gray-300 bg-gray-50">
                          <span className="text-xs font-bold text-brand-700">
                            {researcher.name.split(' ').map((part: string) => part[0]).slice(0, 2).join('')}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-gray-900 group-hover:text-brand-700">{researcher.name}</p>
                          <span className={`mt-0.5 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${departmentColor(researcher.department)}`}>
                            {researcher.department}
                          </span>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <div className="text-sm font-bold text-gray-900">h={researcher.hIndex}</div>
                          <div className="text-xs text-gray-400">{researcher.totalCitations.toLocaleString()} cit.</div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Sync Activity</CardTitle>
                <Link href="/admin/sync"><Button variant="ghost" size="xs">Manage</Button></Link>
              </CardHeader>
              {summaryLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <Skeleton className="mt-1.5 h-2 w-2 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-3 w-32" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                      <Skeleton className="h-5 w-16 rounded" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {stats?.recentJobs?.map((job: any) => (
                    <div key={job.id} className="flex items-start gap-3">
                      <span className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${
                        job.status === 'COMPLETED' ? 'bg-brand-700' :
                        job.status === 'FAILED' ? 'bg-red-700' :
                        job.status === 'RUNNING' ? 'bg-gray-500 animate-pulse' : 'bg-gray-300'
                      }`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-gray-700">{sourceLabel(job.source)}</p>
                        <p className="text-xs text-gray-400">
                          {job.recordsCreated} new / {job.recordsUpdated} updated
                        </p>
                        <p className="mt-0.5 text-[10px] text-gray-400">{formatDate(job.completedAt || job.createdAt)}</p>
                      </div>
                      <span className={`border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                        job.status === 'COMPLETED' ? 'border-brand-200 bg-brand-50 text-brand-700' :
                        job.status === 'FAILED' ? 'border-red-200 bg-white text-red-700' :
                        'border-gray-300 bg-white text-gray-700'
                      }`}>
                        {job.status.toLowerCase()}
                      </span>
                    </div>
                  ))}
                  {!stats?.recentJobs?.length && (
                    <p className="py-4 text-center text-sm text-gray-400">No recent sync jobs</p>
                  )}
                </div>
              )}

              {stats?.alerts?.length > 0 && (
                <div className="mt-4 border-t border-gray-100 pt-4">
                  <Link href="/admin">
                    <div className="cursor-pointer border border-gray-300 bg-white p-2.5 transition-colors hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-800">
                          {stats.alerts.length} unresolved alert{stats.alerts.length > 1 ? 's' : ''}
                        </span>
                        <span className="text-xs text-brand-700">Review</span>
                      </div>
                    </div>
                  </Link>
                </div>
              )}
            </Card>
          </div>
        </>
      </PageContent>
    </PageLayout>
  );
}
