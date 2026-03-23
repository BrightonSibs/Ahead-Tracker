'use client';
import { useEffect, useState } from 'react';
import { PageLayout, PageContent, TopBar } from '@/components/layout';
import { Card, CardHeader, CardTitle, Button, Input, Alert, Spinner } from '@/components/ui';
import { prisma } from '@/lib/prisma';

export default function AdminJournalsPage() {
  const [journals, setJournals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ journalName: '', issn: '', year: new Date().getFullYear(), impactFactor: '', quartile: 'Q1' });

  useEffect(() => { loadJournals(); }, []);

  async function loadJournals() {
    const r = await fetch('/api/analytics?type=journals').catch(() => ({ json: () => [] }));
    // Use a dedicated journals API if available; fallback to static list
    setLoading(false);
    // Mock for now since we don't have a separate journals endpoint
    setJournals([
      { id: '1', journalName: 'JAMA Internal Medicine', issn: '2168-6106', year: 2024, impactFactor: 21.4, quartile: 'Q1', source: 'JCR' },
      { id: '2', journalName: 'Value in Health', issn: '1098-3015', year: 2024, impactFactor: 5.9, quartile: 'Q1', source: 'JCR' },
      { id: '3', journalName: 'PharmacoEconomics', issn: '1170-7690', year: 2024, impactFactor: 4.1, quartile: 'Q1', source: 'JCR' },
      { id: '4', journalName: 'Health Affairs', issn: '0278-2715', year: 2024, impactFactor: 8.1, quartile: 'Q1', source: 'JCR' },
      { id: '5', journalName: 'Medical Care', issn: '0025-7079', year: 2024, impactFactor: 4.2, quartile: 'Q1', source: 'JCR' },
      { id: '6', journalName: 'Journal of General Internal Medicine', issn: '0884-8734', year: 2024, impactFactor: 4.3, quartile: 'Q1', source: 'JCR' },
      { id: '7', journalName: 'Health Services Research', issn: '0017-9124', year: 2024, impactFactor: 3.8, quartile: 'Q1', source: 'JCR' },
      { id: '8', journalName: 'American Journal of Public Health', issn: '0090-0036', year: 2024, impactFactor: 7.2, quartile: 'Q1', source: 'JCR' },
      { id: '9', journalName: 'Annals of Internal Medicine', issn: '0003-4819', year: 2024, impactFactor: 39.2, quartile: 'Q1', source: 'JCR' },
      { id: '10', journalName: 'PLOS ONE', issn: '1932-6203', year: 2024, impactFactor: 3.7, quartile: 'Q2', source: 'JCR' },
      { id: '11', journalName: 'Psychiatric Services', issn: '1075-2730', year: 2024, impactFactor: 4.0, quartile: 'Q1', source: 'JCR' },
      { id: '12', journalName: 'Journal of Managed Care & Specialty Pharmacy', issn: '2376-0540', year: 2024, impactFactor: 3.1, quartile: 'Q2', source: 'manual' },
    ]);
  }

  async function addJournal() {
    if (!form.journalName || !form.impactFactor) { setMsg({ type: 'error', text: 'Journal name and IF are required.' }); return; }
    setSaving(true);
    // POST to a journals endpoint (to be created)
    setTimeout(() => {
      setJournals(prev => [...prev, { id: Date.now().toString(), ...form, impactFactor: Number(form.impactFactor), source: 'manual' }]);
      setForm({ journalName: '', issn: '', year: new Date().getFullYear(), impactFactor: '', quartile: 'Q1' });
      setMsg({ type: 'success', text: 'Journal added.' });
      setSaving(false);
    }, 600);
  }

  function handleCSVUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const lines = text.split('\n').slice(1); // skip header
      const newJournals = lines
        .filter(l => l.trim())
        .map(l => {
          const [journalName, issn, year, impactFactor, quartile] = l.split(',');
          return { id: Math.random().toString(), journalName: journalName?.trim(), issn: issn?.trim(), year: Number(year), impactFactor: Number(impactFactor), quartile: quartile?.trim() || 'Q1', source: 'csv_import' };
        })
        .filter(j => j.journalName && j.impactFactor);
      setJournals(prev => [...prev, ...newJournals]);
      setMsg({ type: 'success', text: `${newJournals.length} journal records imported from CSV.` });
    };
    reader.readAsText(file);
  }

  const filtered = journals.filter(j => !search || j.journalName.toLowerCase().includes(search.toLowerCase()));

  const quartileColor: Record<string, string> = { Q1: 'bg-green-50 text-green-700', Q2: 'bg-brand-50 text-brand-700', Q3: 'bg-amber-50 text-amber-700', Q4: 'bg-gray-50 text-gray-600' };

  return (
    <PageLayout>
      <TopBar title="Journal Impact Factors" subtitle="Manage journal metrics — used for IF-threshold filtering" />
      <PageContent>
        {msg && <Alert type={msg.type}>{msg.text}</Alert>}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2">
            {/* Search */}
            <div className="mb-4 relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search journals…"
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-300 bg-white focus:border-brand-500 outline-none" />
            </div>

            <Card padding={false}>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50/60">
                      {['Journal', 'ISSN', 'Year', 'IF', 'Quartile', 'Source'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {loading ? (
                      <tr><td colSpan={6} className="px-4 py-8 text-center"><Spinner /></td></tr>
                    ) : filtered.map(j => (
                      <tr key={j.id} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 max-w-xs">
                          <p className="truncate">{j.journalName}</p>
                        </td>
                        <td className="px-4 py-3 text-xs font-mono text-gray-500">{j.issn || '—'}</td>
                        <td className="px-4 py-3 text-xs text-gray-600">{j.year}</td>
                        <td className="px-4 py-3">
                          <span className={`text-sm font-bold ${j.impactFactor >= 10 ? 'text-amber-600' : j.impactFactor >= 5 ? 'text-green-700' : 'text-gray-700'}`}>
                            {j.impactFactor?.toFixed(1)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${quartileColor[j.quartile] || quartileColor.Q4}`}>
                            {j.quartile}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400 capitalize">{j.source?.replace('_', ' ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          <div className="space-y-4">
            {/* Add manually */}
            <Card>
              <CardHeader><CardTitle>Add Journal</CardTitle></CardHeader>
              <div className="space-y-3">
                <Input label="Journal Name *" value={form.journalName} onChange={e => setForm(p => ({ ...p, journalName: e.target.value }))} placeholder="Full journal name" />
                <Input label="ISSN" value={form.issn} onChange={e => setForm(p => ({ ...p, issn: e.target.value }))} placeholder="0000-0000" />
                <div className="grid grid-cols-2 gap-2">
                  <Input label="Year" type="number" value={form.year} onChange={e => setForm(p => ({ ...p, year: Number(e.target.value) }))} />
                  <Input label="Impact Factor *" type="number" step="0.1" value={form.impactFactor} onChange={e => setForm(p => ({ ...p, impactFactor: e.target.value }))} placeholder="3.5" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Quartile</label>
                  <select value={form.quartile} onChange={e => setForm(p => ({ ...p, quartile: e.target.value }))}
                    className="w-full px-3 py-2 text-sm rounded-md border border-gray-300 bg-white focus:border-brand-500 outline-none">
                    {['Q1', 'Q2', 'Q3', 'Q4'].map(q => <option key={q} value={q}>{q}</option>)}
                  </select>
                </div>
                <Button className="w-full" onClick={addJournal} loading={saving}>Add Journal</Button>
              </div>
            </Card>

            {/* CSV Upload */}
            <Card>
              <CardHeader><CardTitle>Import from CSV</CardTitle></CardHeader>
              <p className="text-xs text-gray-500 mb-3">Expected columns: <code className="font-mono bg-gray-100 px-1 rounded">journal_name, issn, year, impact_factor, quartile</code></p>
              <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-brand-400 hover:bg-brand-50/30 transition-colors">
                <span className="text-2xl mb-1">📁</span>
                <span className="text-sm text-gray-500">Drop CSV or click to upload</span>
                <input type="file" accept=".csv" className="hidden" onChange={handleCSVUpload} />
              </label>
            </Card>

            {/* Note */}
            <Card>
              <p className="text-xs text-gray-500 leading-relaxed">
                <strong className="text-gray-700">Note:</strong> Journal Impact Factors come from Clarivate&apos;s Journal Citation Reports (JCR). SLU library may have institutional access. Alternatively, upload manually via CSV. Historical IF values are stored per year to enable accurate filtering by publication year.
              </p>
            </Card>
          </div>
        </div>
      </PageContent>
    </PageLayout>
  );
}
