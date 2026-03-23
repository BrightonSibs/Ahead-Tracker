'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { PageLayout, PageContent, TopBar } from '@/components/layout';
import { Card, CardHeader, CardTitle, Badge, Button, Spinner, StatRow, Tabs, Toggle, Alert } from '@/components/ui';
import { CitationTrendChart } from '@/components/charts';
import { fetchJsonCached, invalidateJsonCache } from '@/lib/client-cache';
import { departmentColor, confidenceBadgeColor, confidenceLabel, sourceBadgeColor, sourceLabel, formatDate, truncate } from '@/lib/utils';

export default function ResearcherProfilePage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [researcher, setResearcher] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sluOnly, setSluOnly] = useState(false);
  const [activeTab, setActiveTab] = useState('publications');
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchJsonCached<any>(`/api/researchers/${id}?sluOnly=${sluOnly}`)
      .then(d => {
        if (!cancelled) {
          setResearcher(d);
          setEditForm({ sluStartDate: d.sluStartDate?.split('T')[0] || '', notes: d.notes || '' });
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
    await fetch(`/api/researchers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    });
    setEditing(false);
    invalidateJsonCache(`/api/researchers/${id}`);
    fetchJsonCached<any>(`/api/researchers/${id}?sluOnly=${sluOnly}`, { force: true }).then(setResearcher);
  }

  if (loading) return <PageLayout><div className="flex h-screen items-center justify-center px-4"><Spinner size="lg" /></div></PageLayout>;
  if (!researcher) return <PageLayout><PageContent><Alert type="error">Researcher not found.</Alert></PageContent></PageLayout>;

  const aliasTypeLabel: Record<string, string> = {
    NAME_VARIANT: 'Variant', MAIDEN_NAME: 'Maiden name',
    ABBREVIATED: 'Abbreviated', INITIALS_ONLY: 'Initials', LEGACY: 'Legacy',
  };

  return (
    <PageLayout>
      <TopBar
        title={researcher.canonicalName}
        subtitle={`Faculty ID ${researcher.facultyId} · ${researcher.department}`}
        actions={
          <div className="flex items-center gap-2">
            <Toggle checked={sluOnly} onChange={setSluOnly} label="SLU tenure only" />
            <a href={`/api/export?type=publications&researcherId=${id}&sluOnly=${sluOnly}`}>
              <Button variant="outline" size="sm">⬇ Export</Button>
            </a>
            <Link href="/researchers">
              <Button variant="ghost" size="sm">← Back</Button>
            </Link>
          </div>
        }
      />
      <PageContent>
        {/* Profile header */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
          <Card className="lg:col-span-1">
            {/* Avatar + identity */}
            <div className="text-center mb-5">
              <div className="w-16 h-16 rounded-2xl bg-brand-100 flex items-center justify-center mx-auto mb-3">
                <span className="text-brand-700 text-xl font-bold font-display">
                  {researcher.canonicalName.split(' ').map((p: string) => p[0]).slice(0, 2).join('')}
                </span>
              </div>
              <h2 className="text-base font-bold text-gray-900 font-display">{researcher.canonicalName}</h2>
              <span className={`mt-1 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${departmentColor(researcher.department)}`}>
                {researcher.department}
              </span>
            </div>

            {/* Details */}
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Faculty ID</span>
                <span className="font-mono text-gray-700">{researcher.facultyId}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">SLU Start</span>
                {editing ? (
                  <input type="date" value={editForm.sluStartDate}
                    onChange={e => setEditForm({ ...editForm, sluStartDate: e.target.value })}
                    className="text-xs border border-gray-300 rounded px-2 py-1 w-32" />
                ) : (
                  <span className={`text-xs font-mono ${researcher.sluStartDate ? 'text-gray-700' : 'text-amber-500 font-medium'}`}>
                    {researcher.sluStartDate ? researcher.sluStartDate.split('T')[0] : '⚠ Not set'}
                  </span>
                )}
              </div>
              <div className="flex justify-between items-start">
                <span className="text-gray-500">ORCID</span>
                {researcher.orcid ? (
                  <a href={`https://orcid.org/${researcher.orcid}`} target="_blank" rel="noopener"
                    className="text-xs text-teal-600 hover:text-teal-700 font-mono">
                    {researcher.orcid}
                  </a>
                ) : <span className="text-xs text-gray-400">Not set</span>}
              </div>
              <div>
                <span className="text-gray-500 block mb-1.5">Specialties</span>
                <div className="flex flex-wrap gap-1">
                  {researcher.specialties?.map((s: any) => (
                    <span key={s.id} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-brand-50 text-brand-700 border border-brand-100">
                      {s.name}
                    </span>
                  ))}
                  {!researcher.specialties?.length && <span className="text-xs text-gray-400">None tagged</span>}
                </div>
              </div>
            </div>

            {/* Notes */}
            {researcher.notes && (
              <div className="mt-4 p-2.5 rounded-lg bg-amber-50 border border-amber-200">
                <p className="text-xs text-amber-700">⚠ {researcher.notes}</p>
              </div>
            )}

            {/* Edit controls */}
            <div className="mt-4 pt-4 border-t border-gray-100 flex gap-2">
              {editing ? (
                <>
                  <Button size="xs" onClick={saveEdit} className="flex-1">Save</Button>
                  <Button size="xs" variant="outline" onClick={() => setEditing(false)} className="flex-1">Cancel</Button>
                </>
              ) : (
                <Button size="xs" variant="outline" onClick={() => setEditing(true)} className="w-full">✏ Edit Profile</Button>
              )}
            </div>
          </Card>

          {/* Stats */}
          <div className="lg:col-span-3 space-y-5">
            <StatRow stats={[
              { label: 'Publications', value: researcher.publicationCount, color: 'text-gray-900' },
              { label: 'Total Citations', value: (researcher.totalCitations ?? 0).toLocaleString(), color: 'text-brand-700' },
              { label: 'h-index', value: researcher.hIndex ?? 0, color: 'text-green-700' },
              { label: 'i10-index', value: researcher.i10Index ?? 0, color: 'text-teal-700' },
            ]} />

            {/* Citation trend */}
            <Card>
              <CardHeader>
                <CardTitle>Citation Trend</CardTitle>
                <span className="text-xs text-gray-500">{sluOnly ? 'SLU tenure only' : 'All time'}</span>
              </CardHeader>
              <CitationTrendChart
                data={researcher.citationByYear || []}
                keys={[{ key: 'citations', name: 'Citations', color: '#1a6fb5' }]}
              />
            </Card>

            {/* Aliases */}
            <Card>
              <CardHeader>
                <CardTitle>Name Variants & Aliases</CardTitle>
                <span className="text-xs text-gray-500">{researcher.aliases?.length || 0} recorded</span>
              </CardHeader>
              {researcher.aliases?.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {researcher.aliases.map((a: any) => (
                    <div key={a.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200">
                      <span className="text-sm text-gray-800">{a.aliasName}</span>
                      <span className="text-[10px] text-gray-400">{aliasTypeLabel[a.aliasType] || a.aliasType}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">No aliases recorded. Add common name variants for better publication matching.</p>
              )}
            </Card>
          </div>
        </div>

        {/* Publications tab */}
        <Tabs
          tabs={[
            { id: 'publications', label: 'Publications', count: researcher.publicationCount },
            { id: 'journals', label: 'Top Journals' },
          ]}
          active={activeTab} onChange={setActiveTab}
        />

        {activeTab === 'publications' && (
          <Card padding={false}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Title</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Journal</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Year</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Citations</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Match</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">SLU</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {researcher.matches?.map((m: any) => (
                    <tr key={m.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 max-w-xs">
                        <p className="text-sm text-gray-900 font-medium line-clamp-2 leading-snug">{m.publication.title}</p>
                        {m.publication.doi && (
                          <p className="text-[10px] text-gray-400 font-mono mt-0.5">{m.publication.doi}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 max-w-[160px]">
                        <p className="text-xs text-gray-600 truncate">{m.publication.journalName || '—'}</p>
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-600">{m.publication.publicationYear || '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-semibold text-brand-700">
                          {m.publication.citations?.[0]?.citationCount ?? 0}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${confidenceBadgeColor(m.matchConfidence)}`}>
                          {confidenceLabel(m.matchConfidence)} ({Math.round(m.matchConfidence * 100)}%)
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium ${m.includedInSluOutput ? 'text-green-600' : 'text-gray-400'}`}>
                          {m.includedInSluOutput ? '✓ Included' : '○ Pre-tenure'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/publications/${m.publication.id}`}>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {researcher.topJournals?.map((j: any, i: number) => (
              <Card key={i}>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0 pr-2">
                    <p className="text-sm font-medium text-gray-900 leading-snug">{j.name}</p>
                  </div>
                  <span className="text-lg font-bold font-display text-brand-700 flex-shrink-0">{j.count}</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">{j.count} publication{j.count > 1 ? 's' : ''}</p>
              </Card>
            ))}
          </div>
        )}
      </PageContent>
    </PageLayout>
  );
}
