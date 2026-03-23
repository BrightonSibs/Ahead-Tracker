'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PageLayout, PageContent, TopBar } from '@/components/layout';
import { Card, CardHeader, CardTitle, Button, Alert, Spinner, Badge } from '@/components/ui';
import { useSession } from 'next-auth/react';
import { sourceLabel, formatDate } from '@/lib/utils';

export default function AdminPage() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);

  const role = (session?.user as any)?.role;
  const isAdmin = role === 'ADMIN';

  useEffect(() => {
    Promise.all([
      fetch('/api/analytics?type=dashboard').then(r => r.json()),
      fetch('/api/admin/sync').then(r => r.json()),
    ]).then(([dashData, syncData]) => {
      setStats(dashData);
      setAlerts(dashData?.alerts || []);
      setJobs(syncData || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  async function triggerSync(source: string) {
    setSyncing(true);
    await fetch('/api/admin/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source }),
    });
    const data = await fetch('/api/admin/sync').then(r => r.json());
    setJobs(data);
    setSyncing(false);
  }

  const adminSections = [
    { href: '/admin/researchers', label: 'Manage Roster', icon: '👥', desc: 'Add, edit, deactivate researchers and manage aliases' },
    { href: '/admin/sources', label: 'Data Sources', icon: '🔌', desc: 'Configure API credentials for CrossRef, PubMed, ORCID' },
    { href: '/admin/sync', label: 'Sync Jobs', icon: '🔄', desc: 'Schedule, trigger, and monitor data sync jobs' },
    { href: '/admin/journals', label: 'Journal Impact Factors', icon: '📰', desc: 'Manage journal IF records, upload CSV' },
  ];

  const alertTypeIcon: Record<string, string> = {
    LOW_CONFIDENCE_MATCH: '⚠️',
    DATA_QUALITY: '🔍',
    MISSING_IMPACT_FACTOR: '📰',
    SYNC_FAILED: '🔴',
    NEW_PUBLICATION: '📄',
    DUPLICATE_DETECTED: '🔁',
  };

  return (
    <PageLayout>
      <TopBar title="Administration" subtitle="System management, data quality, and sync controls" />
      <PageContent>
        {!isAdmin && <Alert type="warning">You have read-only access to admin views. Contact an administrator to make changes.</Alert>}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {adminSections.map(s => (
            <Link key={s.href} href={s.href}>
              <div className="bg-white rounded-xl border border-gray-200 p-5 hover:border-brand-300 hover:shadow-card-md transition-all cursor-pointer group">
                <div className="text-2xl mb-2">{s.icon}</div>
                <h3 className="text-sm font-semibold text-gray-900 group-hover:text-brand-700 mb-1">{s.label}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{s.desc}</p>
              </div>
            </Link>
          ))}
        </div>

        {loading ? <div className="flex justify-center py-12"><Spinner size="lg" /></div> : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Alerts */}
            <Card>
              <CardHeader>
                <CardTitle>Data Quality Alerts</CardTitle>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${alerts.filter(a => !a.resolved).length > 0 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                  {alerts.filter(a => !a.resolved).length} unresolved
                </span>
              </CardHeader>
              {alerts.length === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center">✅ No active alerts</p>
              ) : (
                <div className="space-y-3">
                  {alerts.map((alert: any) => (
                    <div key={alert.id} className={`flex items-start gap-3 p-3 rounded-lg border ${alert.resolved ? 'bg-gray-50 border-gray-100 opacity-60' : 'bg-amber-50 border-amber-200'}`}>
                      <span className="text-base">{alertTypeIcon[alert.alertType] || '⚠️'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-800">{alert.title}</p>
                        <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{alert.message}</p>
                        <p className="text-[10px] text-gray-400 mt-1">{formatDate(alert.createdAt)}</p>
                      </div>
                      {!alert.resolved && isAdmin && (
                        <button className="text-xs text-gray-400 hover:text-green-600 flex-shrink-0 mt-0.5">✓</button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Sync controls */}
            <Card>
              <CardHeader>
                <CardTitle>Sync Controls</CardTitle>
                <Link href="/admin/sync"><Button variant="ghost" size="xs">All jobs →</Button></Link>
              </CardHeader>
              <div className="space-y-2 mb-4">
                {['CROSSREF', 'PUBMED', 'ORCID', 'GOOGLE_SCHOLAR'].map(src => (
                  <div key={src} className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${src === 'GOOGLE_SCHOLAR' ? 'bg-blue-400' : 'bg-green-400'}`} />
                      <span className="text-sm text-gray-700">{sourceLabel(src)}</span>
                      {src === 'GOOGLE_SCHOLAR' && <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">SerpAPI</span>}
                    </div>
                    <Button variant="outline" size="xs" loading={syncing} disabled={!isAdmin}
                      onClick={() => triggerSync(src)}>
                      🔄 Sync
                    </Button>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Recent Jobs</p>
                <div className="space-y-2">
                  {jobs.slice(0, 4).map((job: any) => (
                    <div key={job.id} className="flex items-center gap-2 text-xs">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        job.status === 'COMPLETED' ? 'bg-green-500' :
                        job.status === 'FAILED' ? 'bg-red-500' :
                        job.status === 'RUNNING' ? 'bg-blue-500 animate-pulse' : 'bg-gray-300'
                      }`} />
                      <span className="text-gray-600 flex-1">{sourceLabel(job.source)}</span>
                      <span className="text-gray-400 font-mono">{formatDate(job.completedAt || job.createdAt)}</span>
                      <span className={`px-1.5 py-0.5 rounded capitalize ${
                        job.status === 'COMPLETED' ? 'bg-green-50 text-green-700' :
                        job.status === 'FAILED' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
                      }`}>{job.status.toLowerCase()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            {/* System info */}
            <Card>
              <CardHeader><CardTitle>System Overview</CardTitle></CardHeader>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Total Researchers', value: stats?.totalResearchers ?? '—', color: 'text-brand-700' },
                  { label: 'Publications', value: stats?.totalPublications ?? '—', color: 'text-teal-700' },
                  { label: 'Total Citations', value: (stats?.totalCitations ?? 0).toLocaleString(), color: 'text-green-700' },
                  { label: 'Avg Cit / Article', value: stats?.avgCitationsPerArticle ?? '—', color: 'text-gray-700' },
                ].map(s => (
                  <div key={s.label} className="bg-gray-50 rounded-lg p-3">
                    <div className={`text-xl font-bold font-display ${s.color}`}>{s.value}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Quick links */}
            <Card>
              <CardHeader><CardTitle>Quick Actions</CardTitle></CardHeader>
              <div className="space-y-2">
                {[
                  { href: '/api/export?type=researchers', label: '⬇ Export full researcher roster CSV', external: true },
                  { href: '/api/export?type=publications', label: '⬇ Export all publications CSV', external: true },
                  { href: '/admin/researchers', label: '+ Add new researcher', external: false },
                  { href: '/publications?verifiedStatus=NEEDS_REVIEW', label: '⚠ Review flagged publications', external: false },
                  { href: '/researchers?department=AHEAD', label: '🔍 Review AHEAD researchers', external: false },
                ].map(l => (
                  l.external ? (
                    <a key={l.href} href={l.href} className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-gray-50 hover:bg-brand-50 border border-gray-200 hover:border-brand-200 text-sm text-gray-700 hover:text-brand-700 transition-colors">
                      {l.label}
                    </a>
                  ) : (
                    <Link key={l.href} href={l.href} className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-gray-50 hover:bg-brand-50 border border-gray-200 hover:border-brand-200 text-sm text-gray-700 hover:text-brand-700 transition-colors">
                      {l.label}
                    </Link>
                  )
                ))}
              </div>
            </Card>
          </div>
        )}
      </PageContent>
    </PageLayout>
  );
}
