'use client';

import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { PageLayout, PageContent, TopBar } from '@/components/layout';
import { Card, CardHeader, CardTitle, Button, Input, Alert, Spinner } from '@/components/ui';

type JournalMetricRecord = {
  id: string;
  journalName: string;
  issn: string | null;
  year: number;
  impactFactor: number | null;
  quartile: string | null;
  source: string;
};

type JournalFormState = {
  journalName: string;
  issn: string;
  year: number;
  impactFactor: string;
  quartile: string;
  source: string;
};

type MissingCoverageSummary = {
  totalPublications: number;
  totalJournalMetrics: number;
  resolvedByFallbackCount: number;
  missingJournalNameCount: number;
  unresolvedPublicationCount: number;
  unresolvedJournalPairCount: number;
  unresolved: Array<{
    journalName: string | null;
    publicationYear: number | null;
    publicationCount: number;
    sampleTitles: string[];
  }>;
};

const EMPTY_FORM: JournalFormState = {
  journalName: '',
  issn: '',
  year: new Date().getFullYear(),
  impactFactor: '',
  quartile: 'Q1',
  source: 'manual',
};

export default function AdminJournalsPage() {
  const [journals, setJournals] = useState<JournalMetricRecord[]>([]);
  const [coverage, setCoverage] = useState<MissingCoverageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [coverageLoading, setCoverageLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [downloadingCoverage, setDownloadingCoverage] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<JournalFormState>(EMPTY_FORM);

  useEffect(() => {
    loadJournals();
    loadCoverage();
  }, []);

  async function loadJournals() {
    setLoading(true);
    setMsg(null);

    try {
      const response = await fetch('/api/journals', { cache: 'no-store' });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Unable to load journal metrics');
      }

      setJournals(data);
    } catch (error: any) {
      setMsg({ type: 'error', text: error.message || 'Unable to load journal metrics.' });
    } finally {
      setLoading(false);
    }
  }

  async function loadCoverage() {
    setCoverageLoading(true);

    try {
      const response = await fetch('/api/journals/coverage', { cache: 'no-store' });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Unable to load journal coverage');
      }

      setCoverage(data);
    } catch (error: any) {
      setMsg(prev => prev || { type: 'error', text: error.message || 'Unable to load journal coverage.' });
    } finally {
      setCoverageLoading(false);
    }
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  function startEdit(journal: JournalMetricRecord) {
    setEditingId(journal.id);
    setForm({
      journalName: journal.journalName,
      issn: journal.issn || '',
      year: journal.year,
      impactFactor: journal.impactFactor != null ? String(journal.impactFactor) : '',
      quartile: journal.quartile || 'Q1',
      source: journal.source || 'manual',
    });
    setMsg(null);
  }

  async function saveJournal() {
    if (!form.journalName.trim()) {
      setMsg({ type: 'error', text: 'Journal name is required.' });
      return;
    }

    setSaving(true);
    setMsg(null);

    try {
      const response = await fetch(editingId ? `/api/journals/${editingId}` : '/api/journals', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          journalName: form.journalName,
          issn: form.issn,
          year: form.year,
          impactFactor: form.impactFactor,
          quartile: form.quartile,
          source: form.source,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Unable to save journal metric');
      }

      if (editingId) {
        setJournals(prev => prev.map(journal => (journal.id === data.id ? data : journal)));
        setMsg({ type: 'success', text: 'Journal metric updated.' });
      } else {
        const createdJournal = Array.isArray(data.journals) ? data.journals[0] : data;
        setJournals(prev => [createdJournal, ...prev]);
        setMsg({ type: 'success', text: 'Journal metric added.' });
      }

      await loadCoverage();
      resetForm();
    } catch (error: any) {
      setMsg({ type: 'error', text: error.message || 'Unable to save journal metric.' });
    } finally {
      setSaving(false);
    }
  }

  async function deleteJournal(journal: JournalMetricRecord) {
    if (!confirm(`Delete the ${journal.year} impact-factor record for ${journal.journalName}?`)) {
      return;
    }

    setDeletingId(journal.id);
    setMsg(null);

    try {
      const response = await fetch(`/api/journals/${journal.id}`, { method: 'DELETE' });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Unable to delete journal metric');
      }

      setJournals(prev => prev.filter(item => item.id !== journal.id));
      if (editingId === journal.id) resetForm();
      setMsg({ type: 'success', text: 'Journal metric deleted.' });
      await loadCoverage();
    } catch (error: any) {
      setMsg({ type: 'error', text: error.message || 'Unable to delete journal metric.' });
    } finally {
      setDeletingId(null);
    }
  }

  async function handleCSVUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setImporting(true);
    setMsg(null);

    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).slice(1).filter(line => line.trim());
      const records = lines.map(line => {
        const [journalName, issn, year, impactFactor, quartile] = line.split(',');
        return {
          journalName: journalName?.trim(),
          issn: issn?.trim(),
          year: year?.trim(),
          impactFactor: impactFactor?.trim(),
          quartile: quartile?.trim() || 'Q1',
          source: 'csv_import',
        };
      }).filter(record => record.journalName && record.year);

      if (records.length === 0) {
        throw new Error('No valid CSV rows were found.');
      }

      const response = await fetch('/api/journals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Unable to import journal metrics');
      }

      await loadJournals();
      await loadCoverage();
      setMsg({
        type: 'success',
        text: `${data.created} new and ${data.updated} updated journal metric records imported.`,
      });
    } catch (error: any) {
      setMsg({ type: 'error', text: error.message || 'Unable to import journal metrics.' });
    } finally {
      setImporting(false);
    }
  }

  async function downloadCoverageCSV() {
    setDownloadingCoverage(true);
    setMsg(null);

    try {
      const response = await fetch('/api/journals/coverage?format=csv', { cache: 'no-store' });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || 'Unable to download missing journal coverage.');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `missing-journal-metrics-${Date.now()}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      setMsg({ type: 'error', text: error.message || 'Unable to download missing journal coverage.' });
    } finally {
      setDownloadingCoverage(false);
    }
  }

  const filteredJournals = useMemo(
    () => journals.filter(journal => {
      if (!search.trim()) return true;
      const haystack = [
        journal.journalName,
        journal.issn || '',
        String(journal.year),
        journal.quartile || '',
      ].join(' ').toLowerCase();
      return haystack.includes(search.trim().toLowerCase());
    }),
    [journals, search],
  );

  const quartileColor: Record<string, string> = {
    Q1: 'bg-green-50 text-green-700',
    Q2: 'bg-brand-50 text-brand-700',
    Q3: 'bg-amber-50 text-amber-700',
    Q4: 'bg-gray-50 text-gray-600',
  };

  return (
    <PageLayout>
      <TopBar
        title="Journal Impact Factors"
        subtitle="Manage year-specific journal metrics used for impact-factor filtering"
      />
      <PageContent>
        {msg && <Alert type={msg.type}>{msg.text}</Alert>}

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="mb-4 relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search journals, ISSN, year, or quartile"
                className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-500"
              />
            </div>

            <Card padding={false}>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50/60">
                      {['Journal', 'ISSN', 'Year', 'IF', 'Quartile', 'Source', ''].map(header => (
                        <th key={header} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center">
                          <Spinner />
                        </td>
                      </tr>
                    ) : filteredJournals.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500">
                          No journal metrics match your search.
                        </td>
                      </tr>
                    ) : filteredJournals.map(journal => (
                      <tr key={journal.id} className="hover:bg-gray-50/50">
                        <td className="max-w-xs px-4 py-3 text-sm font-medium text-gray-900">
                          <p className="truncate">{journal.journalName}</p>
                        </td>
                        <td className="px-4 py-3 text-xs font-mono text-gray-500">{journal.issn || '—'}</td>
                        <td className="px-4 py-3 text-xs text-gray-600">{journal.year}</td>
                        <td className="px-4 py-3">
                          <span className={`text-sm font-bold ${journal.impactFactor != null && journal.impactFactor >= 10 ? 'text-amber-600' : journal.impactFactor != null && journal.impactFactor >= 5 ? 'text-green-700' : 'text-gray-700'}`}>
                            {journal.impactFactor != null ? journal.impactFactor.toFixed(1) : '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`rounded px-2 py-0.5 text-xs font-medium ${quartileColor[journal.quartile || 'Q4'] || quartileColor.Q4}`}>
                            {journal.quartile || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs capitalize text-gray-400">{journal.source.replace('_', ' ')}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="xs" onClick={() => startEdit(journal)}>Edit</Button>
                            <Button
                              variant="ghost"
                              size="xs"
                              className="text-red-600 hover:bg-red-50 hover:text-red-700"
                              onClick={() => deleteJournal(journal)}
                              loading={deletingId === journal.id}
                            >
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{editingId ? 'Edit Journal Metric' : 'Add Journal Metric'}</CardTitle>
              </CardHeader>
              <div className="space-y-3">
                <Input
                  label="Journal Name *"
                  value={form.journalName}
                  onChange={e => setForm(prev => ({ ...prev, journalName: e.target.value }))}
                  placeholder="Full journal name"
                />
                <Input
                  label="ISSN"
                  value={form.issn}
                  onChange={e => setForm(prev => ({ ...prev, issn: e.target.value }))}
                  placeholder="0000-0000"
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    label="Year"
                    type="number"
                    value={form.year}
                    onChange={e => setForm(prev => ({ ...prev, year: Number(e.target.value) }))}
                  />
                  <Input
                    label="Impact Factor"
                    type="number"
                    step="0.1"
                    value={form.impactFactor}
                    onChange={e => setForm(prev => ({ ...prev, impactFactor: e.target.value }))}
                    placeholder="3.5"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-700">Quartile</label>
                    <select
                      value={form.quartile}
                      onChange={e => setForm(prev => ({ ...prev, quartile: e.target.value }))}
                      className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
                    >
                      {['Q1', 'Q2', 'Q3', 'Q4'].map(quartile => (
                        <option key={quartile} value={quartile}>{quartile}</option>
                      ))}
                    </select>
                  </div>
                  <Input
                    label="Source"
                    value={form.source}
                    onChange={e => setForm(prev => ({ ...prev, source: e.target.value }))}
                    placeholder="manual"
                  />
                </div>
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={saveJournal} loading={saving}>
                    {editingId ? 'Save Changes' : 'Add Journal'}
                  </Button>
                  {editingId && (
                    <Button variant="outline" className="flex-1" onClick={resetForm}>
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Import from CSV</CardTitle>
              </CardHeader>
              <p className="mb-3 text-xs text-gray-500">
                Expected columns: <code className="rounded bg-gray-100 px-1 font-mono">journal_name, issn, year, impact_factor, quartile</code>
              </p>
              <label className="flex h-24 w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 transition-colors hover:border-brand-400 hover:bg-brand-50/30">
                <span className="mb-1 text-2xl">📁</span>
                <span className="text-sm text-gray-500">{importing ? 'Importing...' : 'Drop CSV or click to upload'}</span>
                <input type="file" accept=".csv" className="hidden" onChange={handleCSVUpload} disabled={importing} />
              </label>
            </Card>

            <Card>
              <CardHeader className="items-start sm:items-start">
                <div>
                  <CardTitle>Coverage Gap Report</CardTitle>
                  <p className="mt-2 text-xs text-gray-500">
                    Review the journal and year pairs that still cannot resolve an impact factor after fallback matching.
                  </p>
                </div>
              </CardHeader>

              {coverageLoading ? (
                <div className="py-4 text-center">
                  <Spinner size="sm" />
                </div>
              ) : coverage ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2">
                      <p className="text-xs uppercase tracking-wide text-gray-500">Unresolved Publications</p>
                      <p className="mt-1 font-semibold text-gray-900">{coverage.unresolvedPublicationCount}</p>
                    </div>
                    <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2">
                      <p className="text-xs uppercase tracking-wide text-gray-500">Journal/Year Pairs</p>
                      <p className="mt-1 font-semibold text-gray-900">{coverage.unresolvedJournalPairCount}</p>
                    </div>
                    <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2">
                      <p className="text-xs uppercase tracking-wide text-gray-500">Recovered by Fallback</p>
                      <p className="mt-1 font-semibold text-gray-900">{coverage.resolvedByFallbackCount}</p>
                    </div>
                    <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2">
                      <p className="text-xs uppercase tracking-wide text-gray-500">Missing Journal Name</p>
                      <p className="mt-1 font-semibold text-gray-900">{coverage.missingJournalNameCount}</p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={loadCoverage} disabled={coverageLoading}>
                      Refresh Report
                    </Button>
                    <Button variant="outline" className="flex-1" onClick={downloadCoverageCSV} loading={downloadingCoverage}>
                      Export CSV
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {coverage.unresolved.length === 0 ? (
                      <p className="text-sm text-gray-500">All visible publications can currently resolve an impact factor.</p>
                    ) : coverage.unresolved.slice(0, 6).map(item => (
                      <div key={`${item.journalName || 'missing'}-${item.publicationYear || 'unknown'}`} className="rounded border border-gray-200 px-3 py-2">
                        <p className="text-sm font-semibold text-gray-900">{item.journalName || 'Missing journal name'}</p>
                        <p className="mt-1 text-xs text-gray-500">
                          Year: {item.publicationYear ?? 'Unknown'} | Publications blocked: {item.publicationCount}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">{item.sampleTitles.join(' | ')}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500">Coverage details are unavailable right now.</p>
              )}
            </Card>

            <Card>
              <p className="text-xs leading-relaxed text-gray-500">
                <strong className="text-gray-700">Note:</strong> These records are stored by journal and year in the main database, so publication filters can use the impact factor that matched the publication year rather than a single current value.
              </p>
            </Card>
          </div>
        </div>
      </PageContent>
    </PageLayout>
  );
}
