'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { PageLayout, PageContent, TopBar, TopBarActions } from '@/components/layout';
import { Card, CardHeader, CardTitle, Button, Spinner, StatRow, Tabs, Toggle, Alert } from '@/components/ui';
import { CitationTrendChart } from '@/components/charts/lazy';
import { fetchJsonCached, invalidateJsonCache } from '@/lib/client-cache';
import { departmentColor, matchTypeBadgeColor, matchTypeLabel } from '@/lib/utils';

export default function ResearcherProfilePage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [researcher, setResearcher] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sluOnly, setSluOnly] = useState(false);
  const [activeTab, setActiveTab] = useState('publications');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [editForm, setEditForm] = useState({
    sluStartDate: '',
    notes: '',
    orcid: '',
  });

  function syncForm(data: any) {
    setEditForm({
      sluStartDate: data?.sluStartDate?.split('T')[0] || '',
      notes: data?.notes || '',
      orcid: data?.orcid || '',
    });
  }

  async function refreshResearcher(force = false) {
    if (force) invalidateJsonCache(`/api/researchers/${id}`);
    const data = await fetchJsonCached<any>(`/api/researchers/${id}?sluOnly=${sluOnly}`, { force });
    setResearcher(data);
    syncForm(data);
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetchJsonCached<any>(`/api/researchers/${id}?sluOnly=${sluOnly}`)
      .then(data => {
        if (!cancelled) {
          setResearcher(data);
          syncForm(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id, sluOnly]);

  async function saveEdit() {
    try {
      setSaving(true);
      setError('');
      setMsg('');

      const response = await fetch(`/api/researchers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || 'Unable to save researcher changes');
      }

      setEditing(false);
      invalidateJsonCache('/api/researchers');
      invalidateJsonCache(`/api/researchers/${id}`);
      await refreshResearcher(true);
      setMsg('Researcher profile updated.');
    } catch (e: any) {
      setError(e.message || 'Unable to save researcher changes.');
    } finally {
      setSaving(false);
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

  if (!researcher) {
    return (
      <PageLayout>
        <PageContent>
          <Alert type="error">Researcher not found.</Alert>
        </PageContent>
      </PageLayout>
    );
  }

  const aliasTypeLabel: Record<string, string> = {
    NAME_VARIANT: 'Variant',
    MAIDEN_NAME: 'Maiden name',
    ABBREVIATED: 'Abbreviated',
    INITIALS_ONLY: 'Initials',
    LEGACY: 'Legacy',
  };

  return (
    <PageLayout>
      <TopBar
        title={researcher.canonicalName}
        subtitle={`Faculty ID ${researcher.facultyId} | ${researcher.department}`}
        actions={
          <TopBarActions>
            <Toggle checked={sluOnly} onChange={setSluOnly} label="SLU tenure only" />
            <a href={`/api/export?type=publications&researcherId=${id}&sluOnly=${sluOnly}`}>
              <Button variant="outline" size="sm">Export</Button>
            </a>
            <Link href="/researchers">
              <Button variant="ghost" size="sm">Back</Button>
            </Link>
          </TopBarActions>
        }
      />
      <PageContent>
        {msg && <Alert type="success">{msg}</Alert>}
        {error && <Alert type="error">{error}</Alert>}

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-4">
          <Card className="lg:col-span-1">
            <div className="mb-5 text-center">
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-100">
                <span className="text-xl font-bold font-display text-brand-700">
                  {researcher.canonicalName.split(' ').map((part: string) => part[0]).slice(0, 2).join('')}
                </span>
              </div>
              <h2 className="text-base font-bold font-display text-gray-900">{researcher.canonicalName}</h2>
              <span className={`mt-1 inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${departmentColor(researcher.department)}`}>
                {researcher.department}
              </span>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Faculty ID</span>
                <span className="font-mono text-gray-700">{researcher.facultyId}</span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-500">SLU Start</span>
                {editing ? (
                  <input
                    type="date"
                    value={editForm.sluStartDate}
                    onChange={e => setEditForm(prev => ({ ...prev, sluStartDate: e.target.value }))}
                    className="w-32 rounded border border-gray-300 px-2 py-1 text-xs"
                  />
                ) : (
                  <span className={`text-xs font-mono ${researcher.sluStartDate ? 'text-gray-700' : 'font-medium text-amber-500'}`}>
                    {researcher.sluStartDate ? researcher.sluStartDate.split('T')[0] : 'Not set'}
                  </span>
                )}
              </div>

              <div className="space-y-1">
                <span className="block text-gray-500">ORCID</span>
                {editing ? (
                  <input
                    type="text"
                    value={editForm.orcid}
                    onChange={e => setEditForm(prev => ({ ...prev, orcid: e.target.value }))}
                    placeholder="0000-0000-0000-0000"
                    className="w-full rounded border border-gray-300 px-2 py-1 text-xs font-mono"
                  />
                ) : researcher.orcid ? (
                  <a
                    href={`https://orcid.org/${researcher.orcid}`}
                    target="_blank"
                    rel="noopener"
                    className="text-xs font-mono text-teal-600 hover:text-teal-700"
                  >
                    {researcher.orcid}
                  </a>
                ) : (
                  <span className="text-xs text-gray-400">Not set</span>
                )}
                {editing && (
                  <p className="text-[10px] text-gray-400">Paste the ORCID iD or ORCID URL.</p>
                )}
              </div>

              <div>
                <span className="mb-1.5 block text-gray-500">Specialties</span>
                <div className="flex flex-wrap gap-1">
                  {researcher.specialties?.map((specialty: any) => (
                    <span
                      key={specialty.id}
                      className="rounded-full border border-brand-100 bg-brand-50 px-2 py-0.5 text-[10px] font-medium text-brand-700"
                    >
                      {specialty.name}
                    </span>
                  ))}
                  {!researcher.specialties?.length && <span className="text-xs text-gray-400">None tagged</span>}
                </div>
              </div>
            </div>

            {researcher.notes && !editing && (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-2.5">
                <p className="text-xs text-amber-700">{researcher.notes}</p>
              </div>
            )}

            <div className="mt-4 border-t border-gray-100 pt-4">
              {editing ? (
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500">Notes</label>
                    <textarea
                      value={editForm.notes}
                      onChange={e => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                      rows={4}
                      className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button size="xs" loading={saving} onClick={saveEdit} className="flex-1">Save</Button>
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => {
                        syncForm(researcher);
                        setEditing(false);
                        setError('');
                      }}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => {
                    syncForm(researcher);
                    setEditing(true);
                    setError('');
                    setMsg('');
                  }}
                  className="w-full"
                >
                  Edit Profile
                </Button>
              )}
            </div>
          </Card>

          <div className="space-y-5 lg:col-span-3">
            <StatRow stats={[
              { label: 'Publications', value: researcher.publicationCount, color: 'text-gray-900' },
              { label: 'Total Citations', value: (researcher.totalCitations ?? 0).toLocaleString(), color: 'text-brand-700' },
              { label: 'h-index', value: researcher.hIndex ?? 0, color: 'text-green-700' },
              { label: 'i10-index', value: researcher.i10Index ?? 0, color: 'text-teal-700' },
            ]} />

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Citation Growth Trend</CardTitle>
                  <span className="text-xs text-gray-500">
                    {sluOnly ? 'SLU tenure only' : 'All time'} from stored snapshots
                  </span>
                </CardHeader>
                <CitationTrendChart
                  data={researcher.citationByYear || []}
                  keys={[{ key: 'citations', name: 'Observed growth', color: '#1a6fb5' }]}
                />
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Cumulative Citations</CardTitle>
                  <span className="text-xs text-gray-500">
                    Latest observed totals carried forward by year
                  </span>
                </CardHeader>
                <CitationTrendChart
                  data={researcher.cumulativeCitationByYear || []}
                  keys={[{ key: 'citations', name: 'Cumulative citations', color: '#0f766e' }]}
                  cumulative
                />
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Approved Name Variants</CardTitle>
                <span className="text-xs text-gray-500">{researcher.aliases?.length || 0} recorded</span>
              </CardHeader>
              <p className="mb-3 text-xs text-gray-500">
                Automatic publication matching is limited to this approved name roster.
              </p>
              {researcher.aliases?.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {researcher.aliases.map((alias: any) => (
                    <div key={alias.id} className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5">
                      <span className="text-sm text-gray-800">{alias.aliasName}</span>
                      <span className="text-[10px] text-gray-400">{aliasTypeLabel[alias.aliasType] || alias.aliasType}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">No aliases recorded. Add common name variants for better publication matching.</p>
              )}
            </Card>
          </div>
        </div>

        <Tabs
          tabs={[
            { id: 'publications', label: 'Publications', count: researcher.publicationCount },
            { id: 'journals', label: 'Top Journals' },
            { id: 'collaborators', label: 'Top Collaborators', count: researcher.topCollaborators?.length || 0 },
          ]}
          active={activeTab}
          onChange={setActiveTab}
        />

        {activeTab === 'publications' && (
          <Card padding={false}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Title</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Journal</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Year</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Citations</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Match</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">SLU</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {researcher.matches?.map((match: any) => (
                    <tr key={match.id} className="hover:bg-gray-50/50">
                      <td className="max-w-xs px-4 py-3">
                        <p className="line-clamp-2 text-sm font-medium leading-snug text-gray-900">{match.publication.title}</p>
                        {match.publication.doi && (
                          <p className="mt-0.5 text-[10px] font-mono text-gray-400">{match.publication.doi}</p>
                        )}
                      </td>
                      <td className="max-w-[160px] px-4 py-3">
                        <p className="truncate text-xs text-gray-600">{match.publication.journalName || '-'}</p>
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-600">{match.publication.publicationYear || '-'}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-semibold text-brand-700">
                          {match.publication.citations?.[0]?.citationCount ?? 0}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${matchTypeBadgeColor(match.matchType)}`}>
                          {matchTypeLabel(match.matchType)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium ${match.includedInSluOutput ? 'text-green-600' : 'text-gray-400'}`}>
                          {match.includedInSluOutput ? 'Included' : 'Pre-tenure'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/publications/${match.publication.id}`}>
                          <Button variant="ghost" size="xs">View</Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {activeTab === 'journals' && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {researcher.topJournals?.map((journal: any, index: number) => (
              <Card key={index}>
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1 pr-2">
                    <p className="text-sm font-medium leading-snug text-gray-900">{journal.name}</p>
                  </div>
                  <span className="flex-shrink-0 text-lg font-bold font-display text-brand-700">{journal.count}</span>
                </div>
                <p className="mt-1 text-xs text-gray-400">
                  {journal.count} publication{journal.count > 1 ? 's' : ''}
                </p>
              </Card>
            ))}
          </div>
        )}

        {activeTab === 'collaborators' && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {researcher.topCollaborators?.length ? researcher.topCollaborators.map((collaborator: any) => (
              <Card key={collaborator.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">{collaborator.name}</p>
                    <span className={`mt-1 inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium ${departmentColor(collaborator.department)}`}>
                      {collaborator.department}
                    </span>
                  </div>
                  <span className="text-lg font-bold font-display text-brand-700">{collaborator.sharedPublications}</span>
                </div>
                <p className="mt-1 text-xs text-gray-400">
                  {collaborator.sharedPublications} shared publication{collaborator.sharedPublications === 1 ? '' : 's'}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded border border-gray-200 bg-gray-50 px-2.5 py-2">
                    <p className="uppercase tracking-wide text-gray-400">Shared Citations</p>
                    <p className="mt-1 font-semibold text-gray-800">{(collaborator.sharedCitations ?? 0).toLocaleString()}</p>
                  </div>
                  <div className="rounded border border-gray-200 bg-gray-50 px-2.5 py-2">
                    <p className="uppercase tracking-wide text-gray-400">Latest Shared Year</p>
                    <p className="mt-1 font-semibold text-gray-800">{collaborator.latestSharedYear ?? '-'}</p>
                  </div>
                </div>
                {collaborator.samplePublicationTitles?.length > 0 && (
                  <div className="mt-3">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">Sample Shared Work</p>
                    <div className="mt-1 space-y-1">
                      {collaborator.samplePublicationTitles.map((title: string) => (
                        <p key={title} className="line-clamp-2 text-xs text-gray-600">{title}</p>
                      ))}
                    </div>
                  </div>
                )}
                <Link href={`/researchers/${collaborator.id}`} className="mt-3 inline-block">
                  <Button variant="ghost" size="xs">View Profile</Button>
                </Link>
              </Card>
            )) : (
              <Card className="sm:col-span-2 lg:col-span-3">
                <p className="text-sm text-gray-400">No internal collaborators found yet for this researcher.</p>
              </Card>
            )}
          </div>
        )}
      </PageContent>
    </PageLayout>
  );
}
