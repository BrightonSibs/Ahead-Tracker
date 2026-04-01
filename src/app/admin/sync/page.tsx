'use client';

import { useEffect, useState } from 'react';
import { PageLayout, PageContent, TopBar } from '@/components/layout';
import { Card, CardHeader, CardTitle, Button, Alert, Spinner } from '@/components/ui';
import { fetchJsonCached, invalidateJsonCache } from '@/lib/client-cache';
import { sourceLabel, formatDate } from '@/lib/utils';

const SOURCES = ['CROSSREF', 'PUBMED', 'EUROPE_PMC', 'ORCID', 'OPENALEX', 'GOOGLE_SCHOLAR'];

type MessageTone = 'success' | 'warning' | 'error';
type SourceConfig = Record<string, { configured: boolean; reason?: string }>;

function summarizeSourceError(source: string, message: string) {
  const trimmed = message.trim();
  const researcherMatch = trimmed.match(/^([^:|]+):\s*(.+)$/);
  const researcher = researcherMatch?.[1]?.trim();
  const detail = (researcherMatch?.[2] || trimmed).trim();
  const labelPrefix = researcher ? `${researcher}: ` : '';

  if (detail.includes('NCBI PubMed rate limit reached') || detail.includes('Request failed (429)')) {
    return `${labelPrefix}PubMed rate limit reached. Wait a minute and retry${
      detail.includes('NCBI_API_KEY') ? ', or add NCBI_API_KEY to .env.local' : ''
    }.`;
  }

  if (detail.includes('Request failed (500)')) {
    if (source === 'PUBMED') {
      return `${labelPrefix}PubMed returned a server error while fetching publications. Retry in a few minutes.`;
    }

    if (source === 'EUROPE_PMC') {
      return `${labelPrefix}Europe PMC returned a server error while fetching publications. Retry in a few minutes.`;
    }

    if (source === 'CROSSREF') {
      return `${labelPrefix}CrossRef returned a server error while fetching publications. Retry in a few minutes.`;
    }

    if (source === 'ORCID') {
      return `${labelPrefix}ORCID returned a server error while fetching works. Retry in a few minutes.`;
    }

    if (source === 'OPENALEX') {
      return `${labelPrefix}OpenAlex returned a server error while fetching works. Retry in a few minutes.`;
    }

    if (source === 'GOOGLE_SCHOLAR') {
      return `${labelPrefix}Google Scholar sync returned a server error through SerpAPI. Retry in a few minutes.`;
    }
  }

  if (detail.includes('SERPAPI_KEY is not configured')) {
    return 'Google Scholar sync is not configured. Add SERPAPI_KEY to .env.local first.';
  }

  if (detail.includes('No active researchers available for sync')) {
    return 'No active researchers are available to sync.';
  }

  if (detail.includes('does not have automatic ingestion wired into the platform')) {
    return `${sourceLabel(source)} does not support automatic sync in this app yet.`;
  }

  if (detail.includes('Request failed (403)')) {
    return `${labelPrefix}${sourceLabel(source)} rejected the request. Check API configuration and permissions.`;
  }

  if (detail.includes('Request failed (404)')) {
    return `${labelPrefix}${sourceLabel(source)} could not find the requested researcher or record.`;
  }

  return `${labelPrefix}${detail.replace(/\s+for\s+https?:\/\/\S+$/i, '')}`;
}

function summarizeJobError(source: string, errorMessage?: string | null) {
  if (!errorMessage) return null;

  const parts = errorMessage
    .split(' | ')
    .map(part => part.trim())
    .filter(Boolean);

  if (parts.length === 0) return null;

  const summarized = parts.map(part => summarizeSourceError(source, part));
  if (summarized.length === 1) return summarized[0];

  return `${summarized[0]} (${summarized.length - 1} more issue${summarized.length > 2 ? 's' : ''} in this run.)`;
}

export default function AdminSyncPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [sourceConfig, setSourceConfig] = useState<SourceConfig>({});
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: MessageTone; text: string } | null>(null);

  useEffect(() => {
    loadPageData();
  }, []);

  async function loadPageData() {
    const [jobsData, configData] = await Promise.all([
      fetchJsonCached<any[]>('/api/admin/sync', { force: true }).catch(() => []),
      fetchJsonCached<{ sources: SourceConfig }>('/api/admin/sync/config', { force: true }).catch(() => ({ sources: {} })),
    ]);

    setJobs(jobsData || []);
    setSourceConfig(configData?.sources || {});
    setLoading(false);
  }

  async function triggerSync(source: string) {
    setMessage(null);
    setSyncing(source);

    try {
      const response = await fetch('/api/admin/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source }),
      });
      const result = await response.json();

      if (!response.ok) {
        setMessage({
          type: 'error',
          text: summarizeJobError(source, result.error) || `${sourceLabel(source)} sync failed.`,
        });
      } else if (result.status === 'FAILED') {
        setMessage({
          type: 'error',
          text: summarizeJobError(source, result.errorMessage) || `${sourceLabel(source)} sync failed.`,
        });
      } else if (result.status === 'PARTIAL') {
        setMessage({
          type: 'warning',
          text:
            `${sourceLabel(source)} sync completed with some skipped records: ` +
            `${result.recordsFound ?? 0} found, ${result.recordsCreated ?? 0} new, ${result.recordsUpdated ?? 0} updated.` +
            `${result.errorMessage ? ` ${summarizeJobError(source, result.errorMessage)}` : ''}`,
        });
      } else {
        setMessage({
          type: 'success',
          text:
            `${sourceLabel(source)} sync ${String(result.status || 'completed').toLowerCase()}: ` +
            `${result.recordsFound ?? 0} found, ${result.recordsCreated ?? 0} new, ${result.recordsUpdated ?? 0} updated.`,
        });
      }
    } catch {
      setMessage({
        type: 'error',
        text: `${sourceLabel(source)} sync failed before the server returned a result.`,
      });
    }

    invalidateJsonCache('/api/admin/sync');
    invalidateJsonCache('/api/analytics');
    invalidateJsonCache('/api/researchers');
    invalidateJsonCache('/api/publications');
    await loadPageData();
    setSyncing(null);
  }

  const statusColor: Record<string, string> = {
    COMPLETED: 'bg-green-50 text-green-700 border-green-200',
    FAILED: 'bg-red-50 text-red-700 border-red-200',
    RUNNING: 'bg-blue-50 text-blue-700 border-blue-200',
    PENDING: 'bg-gray-50 text-gray-600 border-gray-200',
    PARTIAL: 'bg-amber-50 text-amber-700 border-amber-200',
  };

  return (
    <PageLayout>
      <TopBar title="Sync Jobs" subtitle="Run and review publication ingestion from external sources" />
      <PageContent>
        {message && <Alert type={message.type}>{message.text}</Alert>}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SOURCES.map(src => {
            const recentJob = jobs.find(job => job.source === src);
            const configured = sourceConfig[src]?.configured ?? true;
            const configReason = sourceConfig[src]?.reason;

            return (
              <Card key={src} className="relative overflow-hidden">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{sourceLabel(src)}</p>
                    {src === 'GOOGLE_SCHOLAR' && (
                      <p className={`text-[10px] mt-0.5 ${configured ? 'text-green-600' : 'text-blue-600'}`}>
                        {configured ? 'SERPAPI_KEY detected on server' : 'Requires SERPAPI_KEY in .env.local'}
                      </p>
                    )}
                    {src === 'OPENALEX' && (
                      <p className="mt-0.5 text-[10px] text-indigo-600">
                        Best with ORCID or OPENALEX_AUTHOR_ID on the researcher profile
                      </p>
                    )}
                  </div>
                  <span
                    className={`w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0 ${
                      recentJob?.status === 'COMPLETED'
                        ? 'bg-green-500'
                        : recentJob?.status === 'FAILED'
                          ? 'bg-red-500'
                          : recentJob?.status === 'PARTIAL'
                            ? 'bg-amber-500'
                            : 'bg-gray-300'
                    }`}
                  />
                </div>

                {recentJob && (
                  <div className="text-xs text-gray-500 mb-3 space-y-0.5">
                    <p>Last run: {formatDate(recentJob.completedAt || recentJob.createdAt)}</p>
                    {recentJob.recordsCreated != null && (
                      <p>{recentJob.recordsCreated} new / {recentJob.recordsUpdated} updated</p>
                    )}
                  </div>
                )}

                {!configured && configReason && (
                  <p className="text-[11px] leading-relaxed text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 mb-3">
                    {configReason}
                  </p>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  disabled={syncing === src || !configured}
                  loading={syncing === src}
                  onClick={() => triggerSync(src)}
                >
                  {configured ? 'Run Sync' : 'Configure First'}
                </Button>
              </Card>
            );
          })}
        </div>

        <Card padding={false}>
          <div className="px-5 pt-4 pb-3 border-b border-gray-100 flex items-center justify-between">
            <div>
              <CardTitle>Job History</CardTitle>
              <p className="text-xs text-gray-500 mt-0.5">Last 50 sync jobs</p>
            </div>
            <Button variant="outline" size="sm" onClick={loadPageData}>
              Refresh
            </Button>
          </div>
          {loading ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50/60">
                    {['Source', 'Status', 'Started', 'Completed', 'Found', 'Created', 'Updated', 'Triggered By', 'Error'].map(header => (
                      <th
                        key={header}
                        className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {jobs.map(job => (
                    <tr key={job.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{sourceLabel(job.source)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded border text-xs font-medium capitalize ${statusColor[job.status] || statusColor.PENDING}`}>
                          {job.status === 'RUNNING' && <span className="inline-block w-2 h-2 bg-blue-500 rounded-full animate-pulse mr-1" />}
                          {String(job.status).toLowerCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 font-mono whitespace-nowrap">{job.startedAt ? formatDate(job.startedAt) : '--'}</td>
                      <td className="px-4 py-3 text-xs text-gray-500 font-mono whitespace-nowrap">{job.completedAt ? formatDate(job.completedAt) : '--'}</td>
                      <td className="px-4 py-3 text-xs text-gray-600">{job.recordsFound ?? '--'}</td>
                      <td className="px-4 py-3 text-xs text-green-700 font-medium">{job.recordsCreated ?? '--'}</td>
                      <td className="px-4 py-3 text-xs text-brand-700 font-medium">{job.recordsUpdated ?? '--'}</td>
                      <td className="px-4 py-3 text-xs text-gray-400">{job.triggeredBy || 'system'}</td>
                      <td className="px-4 py-3 max-w-xs">
                        {job.errorMessage && (
                          <p title={summarizeJobError(job.source, job.errorMessage) || job.errorMessage} className="text-xs text-red-600">
                            {summarizeJobError(job.source, job.errorMessage)}
                          </p>
                        )}
                      </td>
                    </tr>
                  ))}
                  {jobs.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-gray-400 text-sm">
                        No sync jobs yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Data Source Strategy</CardTitle>
          </CardHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
            <div className="space-y-2">
              <p>
                <strong className="text-gray-800">CrossRef</strong> - Automatic sync is supported and ingests DOI-based metadata plus CrossRef citation counts when available.
              </p>
              <p>
                <strong className="text-gray-800">PubMed</strong> - Automatic sync is supported and ingests PubMed-indexed publications through author-based searches.
              </p>
              <p>
                <strong className="text-gray-800">Europe PMC</strong> - Automatic sync is supported for biomedical literature and adds PMID/PMCID-aware matching on top of strict author checks.
              </p>
            </div>
            <div className="space-y-2">
              <p>
                <strong className="text-gray-800">ORCID</strong> - Automatic sync is supported for researchers who have ORCID iDs and provides the highest-confidence identity match.
              </p>
              <p>
                <strong className="text-gray-800">OpenAlex</strong> - Automatic sync is supported for researchers who have ORCID iDs or verified OpenAlex author IDs, with stronger duplicate reuse across sources.
              </p>
              <p>
                <strong className="text-gray-800">Google Scholar</strong> - Automatic sync is supported through SerpAPI when{' '}
                <code className="font-mono bg-gray-100 px-1 rounded">SERPAPI_KEY</code> is configured.
              </p>
            </div>
          </div>
        </Card>
      </PageContent>
    </PageLayout>
  );
}
