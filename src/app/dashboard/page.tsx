'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PageLayout, PageContent, TopBar } from '@/components/layout';
import { Card, CardHeader, CardTitle, KpiCard, Button, Alert, Spinner } from '@/components/ui';
import { CitationTrendChart, DeptPieChart } from '@/components/charts';
import { departmentColor, formatDate, sourceLabel } from '@/lib/utils';

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sluOnly, setSluOnly] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/analytics?type=dashboard&sluOnly=${sluOnly}`)
      .then(r => r.json())
      .then(d => { setStats(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [sluOnly]);

  return (
    <PageLayout>
      <TopBar
        title="Dashboard"
        subtitle="Research output overview - AHEAD & HCOR departments"
        actions={
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={sluOnly}
                onChange={e => setSluOnly(e.target.checked)}
                className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
              />
              SLU tenure only
            </label>
            <Link href="/reports">
              <Button variant="outline" size="sm">Export Report</Button>
            </Link>
          </div>
        }
      />

      <PageContent>
        {loading ? (
          <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>
        ) : (
          <>
            {stats?.alerts?.length > 0 && (
              <div className="space-y-2">
                {stats.alerts.slice(0, 2).map((alert: any) => (
                  <Alert key={alert.id} type={alert.alertType === 'SYNC_FAILED' ? 'error' : 'warning'} title={alert.title}>
                    <span className="text-sm">{alert.message}</span>
                    <Link href="/admin" className="ml-2 underline text-xs font-medium">Review</Link>
                  </Alert>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
                sub="Latest snapshot per publication"
                color="teal"
                icon="C"
                delta={stats?.citationsThisYear ? `${stats.citationsThisYear.toLocaleString()} this year` : undefined}
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
                sub="AHEAD + HCOR"
                color="amber"
                icon="R"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <div>
                    <CardTitle>Department Citation Trends</CardTitle>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Annual citations - AHEAD vs HCOR {sluOnly ? '(SLU tenure only)' : '(all time)'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <span className="flex items-center gap-1.5 text-xs text-gray-500">
                      <span className="w-3 h-1.5 rounded-full bg-brand-600 inline-block" /> AHEAD
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-gray-500">
                      <span className="w-3 h-1.5 rounded-full bg-teal-500 inline-block" /> HCOR
                    </span>
                  </div>
                </CardHeader>
                <DeptCitationChart sluOnly={sluOnly} />
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Publications by Dept</CardTitle>
                </CardHeader>
                <DeptPieChart
                  data={stats?.byDepartment?.map((d: any) => ({ name: d.dept, value: d.publications })) ?? []}
                />
                <div className="mt-3 space-y-2">
                  {stats?.byDepartment?.map((d: any) => (
                    <div key={d.dept} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${d.dept === 'AHEAD' ? 'bg-brand-500' : 'bg-teal-500'}`} />
                        <span className="font-medium text-gray-700">{d.dept}</span>
                      </span>
                      <span className="text-gray-500 text-xs">{d.publications} publications</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <div>
                    <CardTitle>Researcher Leaderboard</CardTitle>
                    <p className="text-xs text-gray-500 mt-0.5">Ranked by h-index for the displayed publication set</p>
                  </div>
                  <Link href="/researchers">
                    <Button variant="ghost" size="xs">View all</Button>
                  </Link>
                </CardHeader>
                <div className="space-y-2.5">
                  {stats?.topResearchers?.map((researcher: any, index: number) => (
                    <Link key={researcher.id} href={`/researchers/${researcher.id}`}>
                      <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer group">
                        <span className="w-6 text-center text-sm font-bold text-gray-300 font-display">
                          {index + 1}
                        </span>
                        <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-brand-700 text-xs font-bold">
                            {researcher.name.split(' ').map((part: string) => part[0]).slice(0, 2).join('')}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 group-hover:text-brand-700 truncate">{researcher.name}</p>
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium mt-0.5 ${departmentColor(researcher.department)}`}>
                            {researcher.department}
                          </span>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-sm font-bold font-display text-gray-900">h={researcher.hIndex}</div>
                          <div className="text-xs text-gray-400">{researcher.totalCitations.toLocaleString()} cit.</div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Sync Activity</CardTitle>
                  <Link href="/admin/sync"><Button variant="ghost" size="xs">Manage</Button></Link>
                </CardHeader>
                <div className="space-y-3">
                  {stats?.recentJobs?.map((job: any) => (
                    <div key={job.id} className="flex items-start gap-3">
                      <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                        job.status === 'COMPLETED' ? 'bg-green-500' :
                        job.status === 'FAILED' ? 'bg-red-500' :
                        job.status === 'RUNNING' ? 'bg-blue-500 animate-pulse' : 'bg-gray-300'
                      }`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-gray-700">{sourceLabel(job.source)}</p>
                        <p className="text-xs text-gray-400">
                          {job.recordsCreated} new / {job.recordsUpdated} updated
                        </p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{formatDate(job.completedAt || job.createdAt)}</p>
                      </div>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium capitalize ${
                        job.status === 'COMPLETED' ? 'bg-green-50 text-green-700' :
                        job.status === 'FAILED' ? 'bg-red-50 text-red-700' :
                        'bg-blue-50 text-blue-700'
                      }`}>{job.status.toLowerCase()}</span>
                    </div>
                  ))}
                  {!stats?.recentJobs?.length && (
                    <p className="text-sm text-gray-400 text-center py-4">No recent sync jobs</p>
                  )}
                </div>

                {stats?.alerts?.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <Link href="/admin">
                      <div className="flex items-center justify-between p-2.5 rounded-lg bg-amber-50 hover:bg-amber-100 transition-colors cursor-pointer border border-amber-200">
                        <span className="text-xs font-medium text-amber-800">
                          {stats.alerts.length} unresolved alert{stats.alerts.length > 1 ? 's' : ''}
                        </span>
                        <span className="text-xs text-amber-600">Review</span>
                      </div>
                    </Link>
                  </div>
                )}
              </Card>
            </div>
          </>
        )}
      </PageContent>
    </PageLayout>
  );
}

function DeptCitationChart({ sluOnly }: { sluOnly: boolean }) {
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    fetch(`/api/analytics?type=full&sluOnly=${sluOnly}`)
      .then(r => r.json())
      .then(d => setData(d.citationsByYear || []));
  }, [sluOnly]);

  return (
    <CitationTrendChart
      data={data}
      keys={[
        { key: 'AHEAD', name: 'AHEAD', color: '#1a6fb5' },
        { key: 'HCOR', name: 'HCOR', color: '#14b8a6' },
      ]}
    />
  );
}
