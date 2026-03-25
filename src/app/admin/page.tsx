'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { PageLayout, PageContent, TopBar } from '@/components/layout';
import { Card, CardHeader, CardTitle, Button, Alert, Input, Spinner } from '@/components/ui';
import { fetchJsonCached, invalidateJsonCache } from '@/lib/client-cache';
import { PASSWORD_REQUIREMENTS_MESSAGE } from '@/lib/password-policy';
import { sourceLabel, formatDate } from '@/lib/utils';

export default function AdminPage() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [resetEmail, setResetEmail] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);
  const [resetMessage, setResetMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const role = (session?.user as any)?.role;
  const isAdmin = role === 'ADMIN';

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      fetchJsonCached<any>('/api/analytics?type=dashboard'),
      fetchJsonCached<any[]>('/api/admin/sync'),
    ])
      .then(([dashboardData, syncData]) => {
        if (cancelled) return;
        setStats(dashboardData);
        setAlerts(dashboardData?.alerts || []);
        setJobs(syncData || []);
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
  }, []);

  async function triggerSync(source: string) {
    setSyncing(true);

    await fetch('/api/admin/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source }),
    });

    invalidateJsonCache('/api/admin/sync');
    invalidateJsonCache('/api/analytics');
    invalidateJsonCache('/api/researchers');
    invalidateJsonCache('/api/publications');

    const data = await fetchJsonCached<any[]>('/api/admin/sync', { force: true });
    setJobs(data);
    setSyncing(false);
  }

  async function resetUserPassword() {
    setResetMessage(null);

    if (!resetEmail || !resetPassword || !resetConfirmPassword) {
      setResetMessage({ type: 'error', text: 'Enter the user email, new password, and confirmation.' });
      return;
    }

    if (resetPassword !== resetConfirmPassword) {
      setResetMessage({ type: 'error', text: 'New password and confirmation do not match.' });
      return;
    }

    try {
      setResettingPassword(true);

      const response = await fetch('/api/admin/users/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail, newPassword: resetPassword }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        setResetMessage({ type: 'error', text: result?.error || 'Unable to reset password right now.' });
        return;
      }

      setResetPassword('');
      setResetConfirmPassword('');
      setResetMessage({ type: 'success', text: result?.message || `Password reset for ${resetEmail}.` });
    } finally {
      setResettingPassword(false);
    }
  }

  const adminSections = [
    { href: '/admin/researchers', label: 'Manage Roster', icon: 'R', desc: 'Add, edit, deactivate researchers, and manage aliases.' },
    { href: '/admin/departments', label: 'Departments', icon: 'D', desc: 'Add, edit, and retire departments without code changes.' },
    { href: '/admin/sources', label: 'Data Sources', icon: 'S', desc: 'Configure API credentials for CrossRef, PubMed, ORCID, and Scholar sync.' },
    { href: '/admin/sync', label: 'Sync Jobs', icon: 'J', desc: 'Trigger and monitor sync jobs across connected data sources.' },
    { href: '/admin/journals', label: 'Journal Impact Factors', icon: 'I', desc: 'Manage journal impact factor records and import CSV files.' },
  ];

  const alertTypeIcon: Record<string, string> = {
    LOW_CONFIDENCE_MATCH: '!',
    DATA_QUALITY: '?',
    MISSING_IMPACT_FACTOR: 'I',
    SYNC_FAILED: 'X',
    NEW_PUBLICATION: 'N',
    DUPLICATE_DETECTED: 'D',
  };

  return (
    <PageLayout>
      <TopBar title="Administration" subtitle="System management, data quality, and sync controls" />
      <PageContent>
        {!isAdmin && (
          <Alert type="warning">
            You have read-only access to admin views. Contact an administrator to make changes.
          </Alert>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {adminSections.map(section => (
            <Link key={section.href} href={section.href}>
              <div className="group cursor-pointer rounded-xl border border-gray-200 bg-white p-5 transition-all hover:border-brand-300 hover:shadow-card-md">
                <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700">
                  {section.icon}
                </div>
                <h3 className="mb-1 text-sm font-semibold text-gray-900 group-hover:text-brand-700">{section.label}</h3>
                <p className="text-xs leading-relaxed text-gray-500">{section.desc}</p>
              </div>
            </Link>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Data Quality Alerts</CardTitle>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    alerts.filter(alert => !alert.resolved).length > 0
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-green-100 text-green-700'
                  }`}
                >
                  {alerts.filter(alert => !alert.resolved).length} unresolved
                </span>
              </CardHeader>
              {alerts.length === 0 ? (
                <p className="py-4 text-center text-sm text-gray-400">No active alerts</p>
              ) : (
                <div className="space-y-3">
                  {alerts.map(alert => (
                    <div
                      key={alert.id}
                      className={`flex items-start gap-3 rounded-lg border p-3 ${
                        alert.resolved ? 'border-gray-100 bg-gray-50 opacity-60' : 'border-amber-200 bg-amber-50'
                      }`}
                    >
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs font-semibold text-gray-600">
                        {alertTypeIcon[alert.alertType] || '!'}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-gray-800">{alert.title}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-gray-600">{alert.message}</p>
                        <p className="mt-1 text-[10px] text-gray-400">{formatDate(alert.createdAt)}</p>
                      </div>
                      {!alert.resolved && isAdmin && (
                        <button className="mt-0.5 flex-shrink-0 text-xs text-gray-400 hover:text-green-600">Mark done</button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Sync Controls</CardTitle>
                <Link href="/admin/sync">
                  <Button variant="ghost" size="xs">All jobs</Button>
                </Link>
              </CardHeader>

              <div className="mb-4 space-y-2">
                {['CROSSREF', 'PUBMED', 'ORCID', 'GOOGLE_SCHOLAR'].map(source => (
                  <div
                    key={source}
                    className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 p-2.5"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${source === 'GOOGLE_SCHOLAR' ? 'bg-blue-400' : 'bg-green-400'}`} />
                      <span className="text-sm text-gray-700">{sourceLabel(source)}</span>
                      {source === 'GOOGLE_SCHOLAR' && (
                        <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-600">SerpAPI</span>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="xs"
                      loading={syncing}
                      disabled={!isAdmin}
                      onClick={() => triggerSync(source)}
                    >
                      Sync
                    </Button>
                  </div>
                ))}
              </div>

              <div className="border-t border-gray-100 pt-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Recent Jobs</p>
                <div className="space-y-2">
                  {jobs.slice(0, 4).map(job => (
                    <div key={job.id} className="flex items-center gap-2 text-xs">
                      <span
                        className={`h-2 w-2 flex-shrink-0 rounded-full ${
                          job.status === 'COMPLETED'
                            ? 'bg-green-500'
                            : job.status === 'FAILED'
                              ? 'bg-red-500'
                              : job.status === 'RUNNING'
                                ? 'animate-pulse bg-blue-500'
                                : 'bg-gray-300'
                        }`}
                      />
                      <span className="flex-1 text-gray-600">{sourceLabel(job.source)}</span>
                      <span className="font-mono text-gray-400">{formatDate(job.completedAt || job.createdAt)}</span>
                      <span
                        className={`rounded px-1.5 py-0.5 capitalize ${
                          job.status === 'COMPLETED'
                            ? 'bg-green-50 text-green-700'
                            : job.status === 'FAILED'
                              ? 'bg-red-50 text-red-600'
                              : 'bg-blue-50 text-blue-600'
                        }`}
                      >
                        {job.status.toLowerCase()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>System Overview</CardTitle>
              </CardHeader>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Total Researchers', value: stats?.totalResearchers ?? '-', color: 'text-brand-700' },
                  { label: 'Publications', value: stats?.totalPublications ?? '-', color: 'text-teal-700' },
                  { label: 'Total Citations', value: (stats?.totalCitations ?? 0).toLocaleString(), color: 'text-green-700' },
                  { label: 'Avg Cit / Article', value: stats?.avgCitationsPerArticle ?? '-', color: 'text-gray-700' },
                ].map(item => (
                  <div key={item.label} className="rounded-lg bg-gray-50 p-3">
                    <div className={`font-display text-xl font-bold ${item.color}`}>{item.value}</div>
                    <div className="mt-0.5 text-xs text-gray-500">{item.label}</div>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <div className="space-y-2">
                {[
                  { href: '/api/export?type=researchers', label: 'Export full researcher roster CSV', external: true },
                  { href: '/api/export?type=publications', label: 'Export all publications CSV', external: true },
                  { href: '/admin/researchers', label: 'Add new researcher', external: false },
                  { href: '/admin/departments', label: 'Manage departments', external: false },
                  { href: '/publications?verifiedStatus=NEEDS_REVIEW', label: 'Review flagged publications', external: false },
                ].map(action =>
                  action.external ? (
                    <a
                      key={action.href}
                      href={action.href}
                      className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-700 transition-colors hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
                    >
                      {action.label}
                    </a>
                  ) : (
                    <Link
                      key={action.href}
                      href={action.href}
                      className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-700 transition-colors hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
                    >
                      {action.label}
                    </Link>
                  ),
                )}
              </div>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Access Management</CardTitle>
              </CardHeader>

              {!isAdmin ? (
                <p className="text-sm text-gray-500">Only administrators can reset user passwords.</p>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">
                    Reset a user password without changing their role or account record.
                  </p>

                  {resetMessage && (
                    <Alert type={resetMessage.type} title={resetMessage.type === 'success' ? 'Password reset' : 'Unable to reset password'}>
                      {resetMessage.text}
                    </Alert>
                  )}

                  <div className="grid grid-cols-1 gap-3">
                    <Input
                      id="reset-email"
                      label="User email"
                      type="email"
                      autoComplete="email"
                      value={resetEmail}
                      onChange={event => setResetEmail(event.target.value)}
                      placeholder="user@slu.edu"
                    />
                    <Input
                      id="reset-password"
                      label="New password"
                      type="password"
                      autoComplete="new-password"
                      value={resetPassword}
                      onChange={event => setResetPassword(event.target.value)}
                      helperText={PASSWORD_REQUIREMENTS_MESSAGE}
                    />
                    <Input
                      id="reset-confirm-password"
                      label="Confirm new password"
                      type="password"
                      autoComplete="new-password"
                      value={resetConfirmPassword}
                      onChange={event => setResetConfirmPassword(event.target.value)}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Button onClick={resetUserPassword} loading={resettingPassword}>
                      Reset password
                    </Button>
                    <span className="text-xs text-gray-400">This action is recorded in the audit log.</span>
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}
      </PageContent>
    </PageLayout>
  );
}
