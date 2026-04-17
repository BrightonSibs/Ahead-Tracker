'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { PageLayout, PageContent, TopBar, TopBarActions } from '@/components/layout';
import { Card, CardHeader, CardTitle, Button, Spinner, Alert, StatRow } from '@/components/ui';
import { CitationTrendChart } from '@/components/charts/lazy';
import { fetchJsonCached, invalidateJsonCache } from '@/lib/client-cache';
import { buildDoiUrl } from '@/lib/doi';
import {
  sourceBadgeColor,
  sourceLabel,
  departmentColor,
  formatCitationCount,
  formatDate,
  matchTypeBadgeColor,
  matchTypeLabel,
} from '@/lib/utils';

type ResearcherOption = {
  id: string;
  canonicalName: string;
  department: string;
};

type ExternalPublicationLink = {
  href: string;
  label: string;
  source: string;
};

function buildPubMedUrl(value: string | null | undefined) {
  if (!value) return null;
  const normalized = String(value).trim().match(/\d+/)?.[0];
  return normalized ? `https://pubmed.ncbi.nlm.nih.gov/${normalized}/` : null;
}

function buildGoogleScholarCitationUrl(value: string | null | undefined) {
  if (!value) return null;

  const normalized = String(value).trim();
  const separatorIndex = normalized.indexOf(':');
  if (separatorIndex <= 0) return null;

  const userId = normalized.slice(0, separatorIndex).trim();
  const citationId = normalized.slice(separatorIndex + 1).trim();
  if (!userId || !citationId) return null;

  return `https://scholar.google.com/citations?view_op=view_citation&user=${encodeURIComponent(userId)}&citation_for_view=${encodeURIComponent(normalized)}`;
}

function buildGoogleScholarSearchUrl(value: string | null | undefined) {
  const normalized = String(value || '').trim();
  return normalized ? `https://scholar.google.com/scholar?q=${encodeURIComponent(normalized)}` : null;
}

function buildOpenAlexUrl(value: string | null | undefined) {
  const normalized = String(value || '').trim();
  if (!normalized) return null;
  if (/^https?:\/\//i.test(normalized)) return normalized;
  return `https://openalex.org/${encodeURIComponent(normalized)}`;
}

function parseRawSourceRecord(rawData: string | null | undefined) {
  if (!rawData) return null;

  try {
    return JSON.parse(rawData);
  } catch {
    return null;
  }
}

function buildSourceRecordLink(record: any, publication: any): ExternalPublicationLink | null {
  const raw = parseRawSourceRecord(record?.rawData);
  const effectiveDoi = publication?.doi || raw?.doi || null;
  const effectivePubmedId = publication?.pubmedId || raw?.pubmedId || null;
  const effectiveTitle = publication?.title || raw?.title || null;
  const directScholarLink = typeof raw?.citationLink === 'string' ? raw.citationLink.trim() : '';
  const scholarResourceLink = Array.isArray(raw?.resourceLinks)
    ? raw.resourceLinks.find((resource: any) => typeof resource?.link === 'string' && resource.link.trim())?.link?.trim() || ''
    : '';

  if (record?.source === 'CROSSREF') {
    const doiUrl = buildDoiUrl(effectiveDoi || record?.externalId);
    return doiUrl ? { href: doiUrl, label: 'Publisher page', source: record.source } : null;
  }

  if (record?.source === 'PUBMED') {
    const pubmedUrl = buildPubMedUrl(effectivePubmedId || record?.externalId);
    return pubmedUrl ? { href: pubmedUrl, label: 'PubMed record', source: record.source } : null;
  }

  if (record?.source === 'EUROPE_PMC') {
    if (effectivePubmedId) {
      return {
        href: `https://europepmc.org/article/MED/${encodeURIComponent(String(effectivePubmedId))}`,
        label: 'Europe PMC record',
        source: record.source,
      };
    }

    const doiUrl = buildDoiUrl(effectiveDoi);
    if (doiUrl) return { href: doiUrl, label: 'Publisher page', source: record.source };
  }

  if (record?.source === 'OPENALEX') {
    const openAlexUrl = buildOpenAlexUrl(record?.externalId);
    return openAlexUrl ? { href: openAlexUrl, label: 'OpenAlex record', source: record.source } : null;
  }

  if (record?.source === 'GOOGLE_SCHOLAR') {
    if (directScholarLink) {
      return { href: directScholarLink, label: 'Original article', source: record.source };
    }

    if (scholarResourceLink) {
      return { href: scholarResourceLink, label: 'PDF / full text', source: record.source };
    }

    const citationUrl = buildGoogleScholarCitationUrl(record?.externalId || raw?.externalId);
    if (citationUrl) {
      return { href: citationUrl, label: 'Google Scholar record', source: record.source };
    }

    const scholarSearchUrl = buildGoogleScholarSearchUrl(effectiveTitle);
    if (scholarSearchUrl) {
      return { href: scholarSearchUrl, label: 'Search on Google Scholar', source: record.source };
    }
  }

  if (record?.source === 'ORCID') {
    const doiUrl = buildDoiUrl(effectiveDoi);
    return doiUrl ? { href: doiUrl, label: 'Publisher page', source: record.source } : null;
  }

  return null;
}

function buildPublicationExternalLinks(publication: any) {
  const links: ExternalPublicationLink[] = [];
  const seen = new Set<string>();

  const addLink = (link: ExternalPublicationLink | null) => {
    if (!link || !link.href || seen.has(link.href)) return;
    seen.add(link.href);
    links.push(link);
  };

  addLink(buildDoiUrl(publication?.doi) ? {
    href: buildDoiUrl(publication?.doi) as string,
    label: 'Publisher page',
    source: 'DOI',
  } : null);

  addLink(buildPubMedUrl(publication?.pubmedId) ? {
    href: buildPubMedUrl(publication?.pubmedId) as string,
    label: 'PubMed record',
    source: 'PUBMED',
  } : null);

  for (const record of publication?.sourceRecords || []) {
    addLink(buildSourceRecordLink(record, publication));
  }

  return links;
}

export default function PublicationDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const id = params.id;

  const [pub, setPub] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [researchers, setResearchers] = useState<ResearcherOption[]>([]);
  const [selectedResearcherId, setSelectedResearcherId] = useState('');
  const [editForm, setEditForm] = useState({
    title: '',
    doi: '',
    journalName: '',
    publicationDate: '',
    publicationYear: '',
    abstract: '',
  });

  const role = (session?.user as any)?.role;
  const canEdit = ['ADMIN', 'ANALYST'].includes(role);
  const canDelete = role === 'ADMIN';

  function syncEditForm(data: any) {
    setEditForm({
      title: data?.title || '',
      doi: data?.doi || '',
      journalName: data?.journalName || '',
      publicationDate: data?.publicationDate?.split('T')[0] || '',
      publicationYear: data?.publicationYear ? String(data.publicationYear) : '',
      abstract: data?.abstract || '',
    });
  }

  async function refreshPublication() {
    invalidateJsonCache(`/api/publications/${id}`);
    const data = await fetchJsonCached<any>(`/api/publications/${id}`, { force: true });
    setPub(data);
    syncEditForm(data);
  }

  async function sendPublicationRequest(method: 'PATCH' | 'DELETE', body?: Record<string, unknown>) {
    const response = await fetch(`/api/publications/${id}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.error || 'Unable to update publication');
    }

    return payload;
  }

  useEffect(() => {
    let cancelled = false;

    fetchJsonCached<any>(`/api/publications/${id}`)
      .then(data => {
        if (!cancelled) {
          setPub(data);
          syncEditForm(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!canEdit) return;

    let cancelled = false;

    fetchJsonCached<ResearcherOption[]>('/api/researchers')
      .then(data => {
        if (!cancelled) setResearchers(data);
      })
      .catch(() => {
        if (!cancelled) setResearchers([]);
      });

    return () => {
      cancelled = true;
    };
  }, [canEdit]);

  async function runUpdate(
    operation: () => Promise<void>,
    successMessage: string,
    fallbackError: string,
  ) {
    try {
      setSaving(true);
      setError('');
      setMsg('');
      await operation();
      await refreshPublication();
      setMsg(successMessage);
    } catch (e: any) {
      setError(e.message || fallbackError);
    } finally {
      setSaving(false);
    }
  }

  async function updateVerified(status: string) {
    await runUpdate(
      () => sendPublicationRequest('PATCH', { verifiedStatus: status }).then(() => undefined),
      'Status updated.',
      'Unable to update status.',
    );
  }

  async function savePublicationChanges() {
    await runUpdate(
      () => sendPublicationRequest('PATCH', editForm).then(() => undefined),
      'Publication details saved.',
      'Unable to save publication changes.',
    );
  }

  async function excludeResearcher(researcherId: string, reason: string) {
    await runUpdate(
      () => sendPublicationRequest('PATCH', {
        excludeResearcherId: researcherId,
        exclusionReason: reason,
      }).then(() => undefined),
      'Researcher match excluded.',
      'Unable to exclude researcher.',
    );
  }

  async function restoreResearcher(researcherId: string) {
    await runUpdate(
      () => sendPublicationRequest('PATCH', { restoreResearcherId: researcherId }).then(() => undefined),
      'Researcher match restored.',
      'Unable to restore researcher.',
    );
  }

  async function addResearcher() {
    if (!selectedResearcherId) return;

    await runUpdate(
      async () => {
        await sendPublicationRequest('PATCH', { addResearcherId: selectedResearcherId });
        setSelectedResearcherId('');
      },
      'Researcher added to this publication.',
      'Unable to add researcher.',
    );
  }

  async function deletePublication() {
    const confirmed = window.confirm(
      'Delete this publication and all of its researcher matches, citations, and source records?',
    );
    if (!confirmed) return;

    try {
      setSaving(true);
      setError('');
      setMsg('');
      await sendPublicationRequest('DELETE');
      invalidateJsonCache('/api/publications');
      invalidateJsonCache('/api/researchers');
      router.push('/publications');
    } catch (e: any) {
      setSaving(false);
      setError(e.message || 'Unable to delete publication.');
    }
  }

  if (loading) {
    return (
      <PageLayout>
        <div className="flex h-screen items-center justify-center px-4">
          <Spinner size="lg" />
        </div>
      </PageLayout>
    );
  }

  if (!pub) {
    return (
      <PageLayout>
        <PageContent>
          <Alert type="error">Publication not found.</Alert>
        </PageContent>
      </PageLayout>
    );
  }

  const latestCit = pub.latestCitationCount ?? null;
  const doiUrl = buildDoiUrl(pub.doi);
  const pubmedUrl = buildPubMedUrl(pub.pubmedId);
  const externalLinks = buildPublicationExternalLinks(pub);
  const primaryExternalLink = externalLinks[0] || null;

  const matchedResearcherIds = new Set((pub.matches || []).map((match: any) => match.researcher.id));
  const assignableResearchers = researchers.filter(researcher => !matchedResearcherIds.has(researcher.id));

  const chartData = (pub.citationHistory || [])
    .map((citation: any) => ({
      year: new Date(citation.date).getFullYear(),
      citations: citation.count,
    }))
    .reduce((acc: any[], current: any) => {
      const existing = acc.find(entry => entry.year === current.year);
      if (existing) existing.citations = Math.max(existing.citations, current.citations);
      else acc.push(current);
      return acc;
    }, [])
    .sort((a: any, b: any) => a.year - b.year);

  const statusColor: Record<string, string> = {
    VERIFIED: 'bg-green-50 text-green-700 border-green-200',
    UNVERIFIED: 'bg-gray-50 text-gray-600 border-gray-200',
    NEEDS_REVIEW: 'bg-amber-50 text-amber-700 border-amber-200',
    EXCLUDED: 'bg-red-50 text-red-600 border-red-200',
  };

  return (
    <PageLayout>
      <TopBar
        title={pub.title?.length > 60 ? `${pub.title.slice(0, 60)}...` : pub.title}
        subtitle={`${pub.journalName || 'Unknown journal'} | ${pub.publicationYear || '-'}`}
        actions={
          <TopBarActions>
            {primaryExternalLink && (
              <a href={primaryExternalLink.href} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm">{primaryExternalLink.label}</Button>
              </a>
            )}
            <a href="/api/export?type=publications">
              <Button variant="outline" size="sm">Export</Button>
            </a>
            <Link href="/publications">
              <Button variant="ghost" size="sm">Back</Button>
            </Link>
          </TopBarActions>
        }
      />
      <PageContent>
        {msg && <Alert type="success">{msg}</Alert>}
        {error && <Alert type="error">{error}</Alert>}

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            <Card>
              <div className="mb-4 flex items-start justify-between">
                <div className="flex-1 pr-4">
                  <h2 className="text-base font-bold font-display text-gray-900 leading-snug">{pub.title}</h2>
                  <p className="mt-1 text-sm text-gray-500">{pub.journalName || 'Unknown journal'}</p>
                </div>
                <span className={`flex-shrink-0 rounded-lg border px-2 py-1 text-xs font-semibold ${statusColor[pub.verifiedStatus] || statusColor.UNVERIFIED}`}>
                  {pub.verifiedStatus?.replace('_', ' ')}
                </span>
              </div>

              <div className="mb-5 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                {[
                  { label: 'Publication Date', value: formatDate(pub.publicationDate) },
                  { label: 'Year', value: pub.publicationYear ?? '-' },
                  { label: 'Volume / Issue', value: [pub.volume, pub.issue].filter(Boolean).join(' / ') || '-' },
                  { label: 'Pages', value: pub.pages || '-' },
                  { label: 'Impact Factor', value: pub.impactFactor != null ? pub.impactFactor.toFixed(1) : '-' },
                  { label: 'Primary Source', value: sourceLabel(pub.sourcePrimary) },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <span className="text-xs uppercase tracking-wide text-gray-400">{label}</span>
                    <p className="mt-0.5 font-medium text-gray-800">{String(value)}</p>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                {doiUrl && pub.doi && (
                  <a
                    href={doiUrl}
                    target="_blank"
                    rel="noopener"
                    className="inline-flex items-center rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 transition-colors hover:bg-brand-100"
                  >
                    DOI: {pub.doi}
                  </a>
                )}
                {pubmedUrl && pub.pubmedId && (
                  <a
                    href={pubmedUrl}
                    target="_blank"
                    rel="noopener"
                    className="inline-flex items-center rounded-lg border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-medium text-purple-700 transition-colors hover:bg-purple-100"
                  >
                    PubMed: {pub.pubmedId}
                  </a>
                )}
                {externalLinks
                  .filter(link => link.href !== doiUrl && link.href !== pubmedUrl)
                  .map(link => (
                    <a
                      key={link.href}
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
                    >
                      {link.label}
                    </a>
                  ))}
                {!doiUrl && !pubmedUrl && externalLinks.length === 0 && (
                  <span className="text-xs text-gray-400">
                    No DOI, PubMed ID, or source landing page captured yet.
                  </span>
                )}
              </div>

              {pub.abstract && (
                <div className="mt-5 border-t border-gray-100 pt-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Abstract</p>
                  <p className="text-sm leading-relaxed text-gray-700">{pub.abstract}</p>
                </div>
              )}
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Authors ({pub.authors?.length || 0})</CardTitle>
              </CardHeader>
              <div className="flex flex-wrap gap-2">
                {pub.authors?.map((author: any) => (
                  <div
                    key={author.id}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm ${
                      author.isCorresponding
                        ? 'border border-brand-200 bg-brand-50 text-brand-800'
                        : 'border border-gray-200 bg-gray-50 text-gray-700'
                    }`}
                  >
                    <span className="font-mono text-xs text-gray-400">{author.authorOrder}.</span>
                    {author.authorName}
                    {author.isCorresponding && <span className="text-[10px] font-medium text-brand-500">Corresponding</span>}
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Citation History</CardTitle>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500">{pub.citations?.length || 0} snapshots</span>
                  <span className={`text-xl font-bold font-display ${latestCit == null ? 'text-gray-400' : 'text-brand-700'}`}>
                    {formatCitationCount(latestCit)}
                  </span>
                </div>
              </CardHeader>
              {chartData.length > 1 ? (
                <CitationTrendChart
                  data={chartData}
                  keys={[{ key: 'citations', name: 'Citations', color: '#1a6fb5' }]}
                />
              ) : (
                <p className="py-8 text-center text-sm text-gray-400">
                  {pub.citations?.length ? 'Insufficient citation history for trend chart.' : 'No citation snapshots captured yet.'}
                </p>
              )}

              {pub.citationHistory?.length > 0 && (
                <div className="mt-4 border-t border-gray-100 pt-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Snapshots</p>
                  <div className="max-h-40 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-400">
                          <th className="pb-1 text-left">Date</th>
                          <th className="pb-1 text-right">Count</th>
                          <th className="pb-1 text-right">Source</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...pub.citationHistory].reverse().slice(0, 20).map((citation: any, index: number) => (
                          <tr key={index} className="border-t border-gray-50">
                            <td className="py-1 font-mono text-gray-500">{citation.date}</td>
                            <td className="py-1 text-right font-bold text-brand-700">{citation.count}</td>
                            <td className="py-1 text-right text-gray-400">{sourceLabel(citation.source)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </Card>

            {pub.overrides?.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Override / Audit Trail</CardTitle>
                </CardHeader>
                <div className="space-y-2">
                  {pub.overrides.map((override: any) => (
                    <div key={override.id} className="flex items-start gap-3 rounded-lg border border-gray-100 bg-gray-50 p-2.5">
                      <span className="text-sm">Note</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-gray-700">{override.overrideType.replace(/_/g, ' ')}</p>
                        {override.reason && <p className="mt-0.5 text-xs text-gray-500">{override.reason}</p>}
                        <p className="mt-1 font-mono text-[10px] text-gray-400">{formatDate(override.createdAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>

          <div className="space-y-5">
            <Card>
              <StatRow stats={[
                { label: 'Citations', value: formatCitationCount(latestCit), color: latestCit == null ? 'text-gray-500' : 'text-brand-700' },
                { label: 'IF', value: pub.impactFactor?.toFixed(1) ?? '-', color: 'text-green-700' },
              ]} />
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Matched Researchers</CardTitle>
                <span className="text-xs text-gray-400">{pub.matches?.length || 0}</span>
              </CardHeader>
              <p className="mb-3 text-xs text-gray-500">
                Automatic matches are restricted to canonical names and approved aliases.
              </p>
              <div className="space-y-3">
                {pub.matches?.map((match: any) => (
                  <div key={match.id} className="flex items-start gap-2.5">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-100">
                      <span className="text-xs font-bold text-brand-700">
                        {match.researcher.canonicalName.split(' ').map((part: string) => part[0]).slice(0, 2).join('')}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link href={`/researchers/${match.researcher.id}`}>
                        <p className="truncate text-sm font-medium text-gray-900 hover:text-brand-700">
                          {match.researcher.canonicalName}
                        </p>
                      </Link>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${departmentColor(match.researcher.department)}`}>
                          {match.researcher.department}
                        </span>
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${matchTypeBadgeColor(match.matchType)}`}>
                          {matchTypeLabel(match.matchType)}
                        </span>
                        {match.manuallyConfirmed && <span className="text-[10px] text-green-600">Confirmed</span>}
                        {match.manuallyExcluded && <span className="text-[10px] text-red-500">Excluded</span>}
                      </div>
                    </div>
                    {canEdit && (
                      match.manuallyExcluded ? (
                        <button
                          onClick={() => restoreResearcher(match.researcher.id)}
                          title="Restore this match"
                          className="mt-1 text-xs text-gray-300 transition-colors hover:text-green-600"
                        >
                          Restore
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            const reason = prompt('Reason for exclusion:');
                            if (reason) void excludeResearcher(match.researcher.id, reason);
                          }}
                          title="Exclude this match"
                          className="mt-1 text-xs text-gray-300 transition-colors hover:text-red-500"
                        >
                          Remove
                        </button>
                      )
                    )}
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Specialties</CardTitle>
              </CardHeader>
              <div className="flex flex-wrap gap-1.5">
                {pub.specialties?.map((specialty: any) => (
                  <span
                    key={specialty.specialtyId}
                    className="rounded-full border border-teal-200 bg-teal-50 px-2 py-1 text-xs font-medium text-teal-700"
                  >
                    {specialty.specialty?.name}
                  </span>
                ))}
                {!pub.specialties?.length && <p className="text-xs text-gray-400">No specialties tagged.</p>}
              </div>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Data Sources</CardTitle>
              </CardHeader>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Primary source</span>
                  <div className="flex items-center gap-2">
                    {primaryExternalLink && (
                      <a
                        href={primaryExternalLink.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] font-medium text-brand-700 underline"
                      >
                        Open source
                      </a>
                    )}
                    <span className={`rounded border px-2 py-0.5 text-[10px] font-medium ${sourceBadgeColor(pub.sourcePrimary)}`}>
                      {sourceLabel(pub.sourcePrimary)}
                    </span>
                  </div>
                </div>
                {pub.sourceRecords?.map((record: any) => {
                  const recordLink = buildSourceRecordLink(record, pub);

                  return (
                    <div key={record.id} className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <span className="block truncate font-mono text-[10px] text-gray-400">
                          {record.externalId?.slice(0, 36) || 'Imported record'}
                        </span>
                        {recordLink && (
                          <a
                            href={recordLink.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] font-medium text-brand-700 underline"
                          >
                            {recordLink.label}
                          </a>
                        )}
                      </div>
                      <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${sourceBadgeColor(record.source)}`}>
                        {sourceLabel(record.source)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Card>

            {canEdit && (
              <Card>
                <CardHeader>
                  <CardTitle>Correction Tools</CardTitle>
                </CardHeader>
                <div className="space-y-4">
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Title</label>
                      <input
                        value={editForm.title}
                        onChange={e => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">DOI</label>
                      <input
                        value={editForm.doi}
                        onChange={e => setEditForm(prev => ({ ...prev, doi: e.target.value }))}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Journal</label>
                      <input
                        value={editForm.journalName}
                        onChange={e => setEditForm(prev => ({ ...prev, journalName: e.target.value }))}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Publication Date</label>
                        <input
                          type="date"
                          value={editForm.publicationDate}
                          onChange={e => setEditForm(prev => ({ ...prev, publicationDate: e.target.value }))}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Year</label>
                        <input
                          type="number"
                          value={editForm.publicationYear}
                          onChange={e => setEditForm(prev => ({ ...prev, publicationYear: e.target.value }))}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Abstract</label>
                      <textarea
                        value={editForm.abstract}
                        onChange={e => setEditForm(prev => ({ ...prev, abstract: e.target.value }))}
                        rows={5}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" loading={saving} onClick={savePublicationChanges} className="flex-1">
                        Save Changes
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => syncEditForm(pub)} className="flex-1">
                        Reset
                      </Button>
                    </div>
                  </div>

                  <div className="border-t border-gray-100 pt-4">
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">Assign Researcher</p>
                    {assignableResearchers.length > 0 ? (
                      <div className="space-y-2">
                        <select
                          value={selectedResearcherId}
                          onChange={e => setSelectedResearcherId(e.target.value)}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                        >
                          <option value="">Select researcher</option>
                          {assignableResearchers.map(researcher => (
                            <option key={researcher.id} value={researcher.id}>
                              {researcher.canonicalName} ({researcher.department})
                            </option>
                          ))}
                        </select>
                        <Button
                          variant="outline"
                          size="sm"
                          loading={saving}
                          disabled={!selectedResearcherId}
                          onClick={addResearcher}
                          className="w-full"
                        >
                          Add Researcher Match
                        </Button>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400">All researchers are already linked or previously reviewed for this publication.</p>
                    )}
                  </div>
                </div>
              </Card>
            )}

            {canEdit && (
              <Card>
                <CardHeader>
                  <CardTitle>Status Controls</CardTitle>
                </CardHeader>
                <div className="space-y-2">
                  <p className="mb-3 text-xs text-gray-500">Override verification status:</p>
                  <div className="flex flex-col gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      loading={saving}
                      onClick={() => updateVerified('VERIFIED')}
                      className="justify-start border-green-200 text-green-700 hover:bg-green-50"
                    >
                      Mark as Verified
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      loading={saving}
                      onClick={() => updateVerified('NEEDS_REVIEW')}
                      className="justify-start border-amber-200 text-amber-700 hover:bg-amber-50"
                    >
                      Flag for Review
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      loading={saving}
                      onClick={() => updateVerified('EXCLUDED')}
                      className="justify-start border-red-200 text-red-600 hover:bg-red-50"
                    >
                      Exclude Publication
                    </Button>
                  </div>
                </div>
              </Card>
            )}

            {canDelete && (
              <Card>
                <CardHeader>
                  <CardTitle>Danger Zone</CardTitle>
                </CardHeader>
                <div className="space-y-3">
                  <p className="text-xs text-gray-500">
                    Delete this publication if it was fetched incorrectly and should be removed entirely from the system.
                  </p>
                  <Button variant="danger" size="sm" loading={saving} onClick={deletePublication} className="w-full">
                    Delete Publication
                  </Button>
                </div>
              </Card>
            )}
          </div>
        </div>
      </PageContent>
    </PageLayout>
  );
}
