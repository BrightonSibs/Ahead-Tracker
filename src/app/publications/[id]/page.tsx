'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { PageLayout, PageContent, TopBar } from '@/components/layout';
import { Card, CardHeader, CardTitle, Badge, Button, Spinner, Alert, StatRow } from '@/components/ui';
import { CitationTrendChart } from '@/components/charts';
import { confidenceBadgeColor, confidenceLabel, sourceBadgeColor, sourceLabel, departmentColor, formatDate } from '@/lib/utils';
import { useSession } from 'next-auth/react';

export default function PublicationDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { data: session } = useSession();
  const [pub, setPub] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const isAdmin = ['ADMIN', 'ANALYST'].includes((session?.user as any)?.role);

  useEffect(() => {
    fetch(`/api/publications/${id}`)
      .then(r => r.json())
      .then(d => { setPub(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  async function updateVerified(status: string) {
    setSaving(true);
    await fetch(`/api/publications/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verifiedStatus: status }),
    });
    setPub((prev: any) => ({ ...prev, verifiedStatus: status }));
    setSaving(false);
    setMsg('Status updated.');
  }

  async function excludeResearcher(researcherId: string, reason: string) {
    setSaving(true);
    await fetch(`/api/publications/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ excludeResearcherId: researcherId, exclusionReason: reason }),
    });
    setMsg('Researcher match excluded.');
    setSaving(false);
    // Refresh
    fetch(`/api/publications/${id}`).then(r => r.json()).then(setPub);
  }

  if (loading) return (
    <PageLayout>
      <div className="pl-56 flex items-center justify-center h-screen"><Spinner size="lg" /></div>
    </PageLayout>
  );

  if (!pub) return (
    <PageLayout><PageContent><Alert type="error">Publication not found.</Alert></PageContent></PageLayout>
  );

  const latestCit = pub.citations?.length > 0
    ? pub.citations[pub.citations.length - 1].citationCount
    : 0;

  // Build cumulative citation chart data from history
  const chartData = pub.citationHistory?.map((c: any) => ({
    year: new Date(c.date).getFullYear(),
    citations: c.count,
  })).reduce((acc: any[], cur: any) => {
    const existing = acc.find(a => a.year === cur.year);
    if (existing) existing.citations = Math.max(existing.citations, cur.count);
    else acc.push({ ...cur });
    return acc;
  }, []).sort((a: any, b: any) => a.year - b.year) || [];

  const statusColor: Record<string, string> = {
    VERIFIED: 'bg-green-50 text-green-700 border-green-200',
    UNVERIFIED: 'bg-gray-50 text-gray-600 border-gray-200',
    NEEDS_REVIEW: 'bg-amber-50 text-amber-700 border-amber-200',
    EXCLUDED: 'bg-red-50 text-red-600 border-red-200',
  };

  return (
    <PageLayout>
      <TopBar
        title={pub.title?.length > 60 ? pub.title.slice(0, 60) + '…' : pub.title}
        subtitle={`${pub.journalName || 'Unknown journal'} · ${pub.publicationYear || '—'}`}
        actions={
          <div className="flex items-center gap-2">
            <a href={`/api/export?type=publications`}>
              <Button variant="outline" size="sm">⬇ Export</Button>
            </a>
            <Link href="/publications">
              <Button variant="ghost" size="sm">← Back</Button>
            </Link>
          </div>
        }
      />
      <PageContent>
        {msg && <Alert type="success">{msg}</Alert>}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-5">
            {/* Metadata card */}
            <Card>
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1 pr-4">
                  <h2 className="text-base font-bold font-display text-gray-900 leading-snug">{pub.title}</h2>
                  <p className="text-sm text-gray-500 mt-1">{pub.journalName}</p>
                </div>
                <span className={`px-2 py-1 rounded-lg text-xs font-semibold border flex-shrink-0 ${statusColor[pub.verifiedStatus] || statusColor.UNVERIFIED}`}>
                  {pub.verifiedStatus?.replace('_', ' ')}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm mb-5">
                {[
                  { label: 'Publication Date', value: formatDate(pub.publicationDate) },
                  { label: 'Year', value: pub.publicationYear ?? '—' },
                  { label: 'Volume / Issue', value: [pub.volume, pub.issue].filter(Boolean).join(' / ') || '—' },
                  { label: 'Pages', value: pub.pages || '—' },
                  { label: 'Impact Factor', value: pub.impactFactor ? pub.impactFactor.toFixed(1) : '—' },
                  { label: 'Primary Source', value: sourceLabel(pub.sourcePrimary) },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
                    <p className="text-gray-800 font-medium mt-0.5">{String(value)}</p>
                  </div>
                ))}
              </div>

              {/* DOI & Links */}
              <div className="flex flex-wrap gap-2">
                {pub.doi && (
                  <a href={`https://doi.org/${pub.doi}`} target="_blank" rel="noopener"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-brand-50 text-brand-700 border border-brand-200 hover:bg-brand-100 transition-colors">
                    🔗 DOI: {pub.doi}
                  </a>
                )}
                {pub.pubmedId && (
                  <a href={`https://pubmed.ncbi.nlm.nih.gov/${pub.pubmedId}`} target="_blank" rel="noopener"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 transition-colors">
                    📋 PubMed: {pub.pubmedId}
                  </a>
                )}
              </div>

              {/* Abstract */}
              {pub.abstract && (
                <div className="mt-5 pt-4 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Abstract</p>
                  <p className="text-sm text-gray-700 leading-relaxed">{pub.abstract}</p>
                </div>
              )}
            </Card>

            {/* Authors */}
            <Card>
              <CardHeader><CardTitle>Authors ({pub.authors?.length || 0})</CardTitle></CardHeader>
              <div className="flex flex-wrap gap-2">
                {pub.authors?.map((a: any, i: number) => (
                  <div key={a.id} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm ${a.isCorresponding ? 'bg-brand-50 border border-brand-200 text-brand-800' : 'bg-gray-50 border border-gray-200 text-gray-700'}`}>
                    <span className="text-xs text-gray-400 font-mono">{a.authorOrder}.</span>
                    {a.authorName}
                    {a.isCorresponding && <span className="text-[10px] text-brand-500 font-medium">✉</span>}
                  </div>
                ))}
              </div>
            </Card>

            {/* Citation history chart */}
            <Card>
              <CardHeader>
                <CardTitle>Citation History</CardTitle>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500">{pub.citations?.length || 0} snapshots</span>
                  <span className="text-xl font-bold font-display text-brand-700">{latestCit.toLocaleString()}</span>
                </div>
              </CardHeader>
              {chartData.length > 1 ? (
                <CitationTrendChart
                  data={chartData}
                  keys={[{ key: 'citations', name: 'Citations', color: '#1a6fb5' }]}
                />
              ) : (
                <p className="text-sm text-gray-400 py-8 text-center">Insufficient citation history for trend chart.</p>
              )}

              {/* Raw snapshots table */}
              {pub.citationHistory?.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-2">Snapshots</p>
                  <div className="max-h-40 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-400">
                          <th className="text-left pb-1">Date</th>
                          <th className="text-right pb-1">Count</th>
                          <th className="text-right pb-1">Source</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...pub.citationHistory].reverse().slice(0, 20).map((c: any, i: number) => (
                          <tr key={i} className="border-t border-gray-50">
                            <td className="py-1 text-gray-500 font-mono">{c.date}</td>
                            <td className="py-1 text-right font-bold text-brand-700">{c.count}</td>
                            <td className="py-1 text-right text-gray-400">{sourceLabel(c.source)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </Card>

            {/* Audit trail */}
            {pub.overrides?.length > 0 && (
              <Card>
                <CardHeader><CardTitle>Override / Audit Trail</CardTitle></CardHeader>
                <div className="space-y-2">
                  {pub.overrides.map((o: any) => (
                    <div key={o.id} className="flex items-start gap-3 p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                      <span className="text-sm">📝</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-700">{o.overrideType.replace(/_/g, ' ')}</p>
                        {o.reason && <p className="text-xs text-gray-500 mt-0.5">{o.reason}</p>}
                        <p className="text-[10px] text-gray-400 mt-1 font-mono">{formatDate(o.createdAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-5">
            {/* Summary stats */}
            <Card>
              <StatRow stats={[
                { label: 'Citations', value: latestCit.toLocaleString(), color: 'text-brand-700' },
                { label: 'IF', value: pub.impactFactor?.toFixed(1) ?? '—', color: 'text-green-700' },
              ]} />
            </Card>

            {/* Matched researchers */}
            <Card>
              <CardHeader>
                <CardTitle>Matched Researchers</CardTitle>
                <span className="text-xs text-gray-400">{pub.matches?.length || 0}</span>
              </CardHeader>
              <div className="space-y-3">
                {pub.matches?.map((m: any) => (
                  <div key={m.id} className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-brand-700 text-xs font-bold">
                        {m.researcher.canonicalName.split(' ').map((p: string) => p[0]).slice(0, 2).join('')}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <Link href={`/researchers/${m.researcher.id}`}>
                        <p className="text-sm font-medium text-gray-900 hover:text-brand-700 truncate">{m.researcher.canonicalName}</p>
                      </Link>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${departmentColor(m.researcher.department)}`}>
                          {m.researcher.department}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${confidenceBadgeColor(m.matchConfidence)}`}>
                          {confidenceLabel(m.matchConfidence)}
                        </span>
                        {m.manuallyConfirmed && <span className="text-[10px] text-green-600">✓ Confirmed</span>}
                        {m.manuallyExcluded && <span className="text-[10px] text-red-500">✗ Excluded</span>}
                      </div>
                      <p className="text-[10px] text-gray-400 mt-0.5">{m.matchType?.replace(/_/g, ' ')}</p>
                    </div>
                    {isAdmin && !m.manuallyExcluded && (
                      <button
                        onClick={() => {
                          const reason = prompt('Reason for exclusion:');
                          if (reason) excludeResearcher(m.researcher.id, reason);
                        }}
                        title="Exclude this match"
                        className="text-gray-300 hover:text-red-500 text-xs mt-1 transition-colors"
                      >✕</button>
                    )}
                  </div>
                ))}
              </div>
            </Card>

            {/* Specialties */}
            <Card>
              <CardHeader><CardTitle>Specialties</CardTitle></CardHeader>
              <div className="flex flex-wrap gap-1.5">
                {pub.specialties?.map((s: any) => (
                  <span key={s.specialtyId} className="px-2 py-1 rounded-full text-xs font-medium bg-teal-50 text-teal-700 border border-teal-200">
                    {s.specialty?.name}
                  </span>
                ))}
                {!pub.specialties?.length && <p className="text-xs text-gray-400">No specialties tagged.</p>}
              </div>
            </Card>

            {/* Source provenance */}
            <Card>
              <CardHeader><CardTitle>Data Sources</CardTitle></CardHeader>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Primary source</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${sourceBadgeColor(pub.sourcePrimary)}`}>
                    {sourceLabel(pub.sourcePrimary)}
                  </span>
                </div>
                {pub.sourceRecords?.map((sr: any) => (
                  <div key={sr.id} className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-400 font-mono">{sr.externalId?.slice(0, 24)}…</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${sourceBadgeColor(sr.source)}`}>
                      {sourceLabel(sr.source)}
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Admin controls */}
            {isAdmin && (
              <Card>
                <CardHeader><CardTitle>Admin Controls</CardTitle></CardHeader>
                <div className="space-y-2">
                  <p className="text-xs text-gray-500 mb-3">Override verification status:</p>
                  <div className="flex flex-col gap-2">
                    <Button variant="outline" size="sm" loading={saving}
                      onClick={() => updateVerified('VERIFIED')}
                      className="justify-start text-green-700 border-green-200 hover:bg-green-50">
                      ✅ Mark as Verified
                    </Button>
                    <Button variant="outline" size="sm" loading={saving}
                      onClick={() => updateVerified('NEEDS_REVIEW')}
                      className="justify-start text-amber-700 border-amber-200 hover:bg-amber-50">
                      ⚠️ Flag for Review
                    </Button>
                    <Button variant="outline" size="sm" loading={saving}
                      onClick={() => updateVerified('EXCLUDED')}
                      className="justify-start text-red-600 border-red-200 hover:bg-red-50">
                      ✗ Exclude Publication
                    </Button>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      </PageContent>
    </PageLayout>
  );
}
