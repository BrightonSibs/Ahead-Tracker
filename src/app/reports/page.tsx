'use client';
import { useEffect, useState } from 'react';
import { PageLayout, PageContent, TopBar } from '@/components/layout';
import { Card, CardHeader, CardTitle, Button, Alert, Spinner } from '@/components/ui';
import { fetchJsonCached } from '@/lib/client-cache';

export default function ReportsPage() {
  const [researchers, setResearchers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [selectedResearcher, setSelectedResearcher] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [sluOnly, setSluOnly] = useState(false);
  const [yearFrom, setYearFrom] = useState('');
  const [yearTo, setYearTo] = useState('');

  useEffect(() => {
    let cancelled = false;

    fetchJsonCached<any[]>('/api/researchers')
      .then(d => {
        if (!cancelled) {
          setResearchers(d);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function buildParams() {
    const p = new URLSearchParams();
    if (selectedResearcher) p.set('researcherId', selectedResearcher);
    if (selectedDept) p.set('department', selectedDept);
    if (sluOnly) p.set('sluOnly', 'true');
    if (yearFrom) p.set('yearFrom', yearFrom);
    if (yearTo) p.set('yearTo', yearTo);
    return p.toString();
  }

  function downloadCSV(type: string) {
    setGenerating(type);
    const params = buildParams();
    window.location.href = `/api/export?type=${type}&${params}`;
    setTimeout(() => setGenerating(null), 1500);
  }

  async function generatePDF() {
    setGenerating('pdf');
    // In a full implementation this would call a server action to generate PDF
    // For now, trigger print dialog
    setTimeout(() => { window.print(); setGenerating(null); }, 300);
  }

  const reportTypes = [
    {
      id: 'publications',
      title: 'Publications Report',
      icon: '📄',
      desc: 'All publications matching your filters including title, journal, year, citations, authors, and specialty.',
      action: () => downloadCSV('publications'),
    },
    {
      id: 'researchers',
      title: 'Researcher Summary Report',
      icon: '👥',
      desc: 'Faculty roster with h-index, total citations, publication count, ORCID, and aliases.',
      action: () => downloadCSV('researchers'),
    },
    {
      id: 'pdf',
      title: 'Print-Friendly Report',
      icon: '🖨',
      desc: 'Formatted report for printing or saving as PDF using your browser\'s print function.',
      action: generatePDF,
    },
  ];

  return (
    <PageLayout>
      <TopBar title="Reports & Export" subtitle="Download filtered datasets and generate printable reports" />
      <PageContent>
        {/* Filter configuration */}
        <Card>
          <CardHeader><CardTitle>Report Filters</CardTitle></CardHeader>
          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Researcher</label>
              <select value={selectedResearcher} onChange={e => setSelectedResearcher(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-md border border-gray-300 bg-white focus:border-brand-500 outline-none">
                <option value="">All Researchers</option>
                {researchers.map(r => <option key={r.id} value={r.id}>{r.canonicalName}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Department</label>
              <select value={selectedDept} onChange={e => setSelectedDept(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-md border border-gray-300 bg-white focus:border-brand-500 outline-none">
                <option value="">All Departments</option>
                <option value="AHEAD">AHEAD</option>
                <option value="HCOR">HCOR</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Year From</label>
              <input type="number" value={yearFrom} onChange={e => setYearFrom(e.target.value)}
                placeholder="2015" min="2000" max="2030"
                className="w-full px-3 py-2 text-sm rounded-md border border-gray-300 bg-white focus:border-brand-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Year To</label>
              <input type="number" value={yearTo} onChange={e => setYearTo(e.target.value)}
                placeholder="2024" min="2000" max="2030"
                className="w-full px-3 py-2 text-sm rounded-md border border-gray-300 bg-white focus:border-brand-500 outline-none" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
            <input type="checkbox" checked={sluOnly} onChange={e => setSluOnly(e.target.checked)}
              className="rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
            <span>Include only publications within SLU tenure period</span>
          </label>
          {sluOnly && (
            <p className="text-xs text-amber-600 mt-2 ml-5">
              ⚠ Researchers without a set SLU start date will have all publications included regardless.
            </p>
          )}
        </Card>

        {/* Report types */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {reportTypes.map(rt => (
            <Card key={rt.id}>
              <div className="text-3xl mb-3">{rt.icon}</div>
              <h3 className="text-base font-semibold font-display text-gray-900 mb-1">{rt.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed mb-4">{rt.desc}</p>
              <Button variant="outline" className="w-full" loading={generating === rt.id} onClick={rt.action}>
                {rt.id === 'pdf' ? '🖨 Generate PDF' : '⬇ Download CSV'}
              </Button>
            </Card>
          ))}
        </div>

        {/* Export history */}
        <Card>
          <CardHeader>
            <CardTitle>Export History</CardTitle>
            <p className="text-xs text-gray-400">Recent downloads are tracked for audit purposes</p>
          </CardHeader>
          <div className="text-center py-8 text-gray-400">
            <span className="text-3xl block mb-2">📋</span>
            <p className="text-sm">No exports recorded yet in this session.</p>
            <p className="text-xs mt-1">Export history is stored per-user in the database.</p>
          </div>
        </Card>

        {/* Data description */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Card>
            <CardHeader><CardTitle>Publications CSV — Columns</CardTitle></CardHeader>
            <div className="font-mono text-xs text-gray-600 space-y-1">
              {['Title', 'DOI', 'Journal', 'Year', 'Authors', 'Matched Researchers', 'Department', 'Citations', 'Specialties', 'Verified Status'].map(col => (
                <div key={col} className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-400 flex-shrink-0" />
                  {col}
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <CardHeader><CardTitle>Researchers CSV — Columns</CardTitle></CardHeader>
            <div className="font-mono text-xs text-gray-600 space-y-1">
              {['Faculty ID', 'Canonical Name', 'Department', 'ORCID', 'SLU Start Date', 'Publications', 'Total Citations', 'h-index', 'i10-index', 'Aliases', 'Specialties'].map(col => (
                <div key={col} className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-400 flex-shrink-0" />
                  {col}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </PageContent>
    </PageLayout>
  );
}
