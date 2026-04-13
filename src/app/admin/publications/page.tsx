'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { PageLayout, PageContent, TopBar, TopBarActions } from '@/components/layout';
import { Alert, Button, Card, CardHeader, CardTitle, Input, Spinner } from '@/components/ui';
import type { PaginatedResult, PublicationSummary } from '@/types';

const SOURCE_OPTIONS = ['MANUAL', 'CROSSREF', 'PUBMED', 'EUROPE_PMC', 'ORCID', 'OPENALEX', 'GOOGLE_SCHOLAR'];

const EMPTY_FORM = {
  title: '',
  doi: '',
  journalName: '',
  publicationDate: '',
  publicationYear: '',
  abstract: '',
  authorsText: '',
  sourcePrimary: 'MANUAL',
  citationCount: '',
};

export default function AdminPublicationsPage() {
  const [researchers, setResearchers] = useState<any[]>([]);
  const [recentPublications, setRecentPublications] = useState<PublicationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [researcherFilter, setResearcherFilter] = useState('');
  const [selectedResearcherIds, setSelectedResearcherIds] = useState<string[]>([]);

  async function loadData() {
    setLoading(true);

    try {
      const [researcherResponse, publicationResponse] = await Promise.all([
        fetch('/api/researchers'),
        fetch('/api/publications?source=MANUAL&pageSize=10'),
      ]);

      const researcherData = await researcherResponse.json();
      const publicationData = await publicationResponse.json();

      if (!researcherResponse.ok) {
        throw new Error(researcherData.error || 'Unable to load researchers');
      }

      if (!publicationResponse.ok) {
        throw new Error(publicationData.error || 'Unable to load recent publications');
      }

      setResearchers(Array.isArray(researcherData) ? researcherData : []);
      setRecentPublications((publicationData as PaginatedResult<PublicationSummary>)?.data || []);
    } catch (error: any) {
      setMsg({ type: 'error', text: error.message || 'Unable to load publication management data.' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const filteredResearchers = useMemo(() => {
    const query = researcherFilter.trim().toLowerCase();
    if (!query) return researchers;
    return researchers.filter(researcher =>
      `${researcher.canonicalName} ${researcher.department}`.toLowerCase().includes(query),
    );
  }, [researchers, researcherFilter]);

  function toggleResearcher(researcherId: string) {
    setSelectedResearcherIds(prev =>
      prev.includes(researcherId)
        ? prev.filter(id => id !== researcherId)
        : [...prev, researcherId],
    );
  }

  async function savePublication() {
    if (!form.title.trim()) {
      setMsg({ type: 'error', text: 'Publication title is required.' });
      return;
    }

    setSaving(true);
    setMsg(null);

    const authors = form.authorsText
      .split(';')
      .map(author => author.trim())
      .filter(Boolean);

    try {
      const response = await fetch('/api/publications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          doi: form.doi || null,
          journalName: form.journalName || null,
          publicationDate: form.publicationDate || null,
          publicationYear: form.publicationYear ? Number(form.publicationYear) : null,
          abstract: form.abstract || null,
          sourcePrimary: form.sourcePrimary,
          authors,
          researcherIds: selectedResearcherIds,
          citationCount: form.citationCount === '' ? null : Number(form.citationCount),
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || 'Unable to create publication');
      }

      setForm(EMPTY_FORM);
      setSelectedResearcherIds([]);
      setResearcherFilter('');
      setMsg({ type: 'success', text: 'Publication created successfully.' });
      await loadData();
    } catch (error: any) {
      setMsg({ type: 'error', text: error.message || 'Unable to create publication.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageLayout>
      <TopBar
        title="Manage Publications"
        subtitle="Add manual publications and attach citation snapshots without disturbing sync workflows"
        actions={
          <TopBarActions>
            <Link href="/publications">
              <Button variant="ghost" size="sm">View Publications</Button>
            </Link>
          </TopBarActions>
        }
      />
      <PageContent>
        {msg && <Alert type={msg.type}>{msg.text}</Alert>}

        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Add Manual Publication</CardTitle>
              </CardHeader>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <Input
                    label="Title *"
                    value={form.title}
                    onChange={event => setForm(prev => ({ ...prev, title: event.target.value }))}
                    placeholder="Full publication title"
                  />
                </div>

                <Input
                  label="DOI"
                  value={form.doi}
                  onChange={event => setForm(prev => ({ ...prev, doi: event.target.value }))}
                  placeholder="10.xxxx/xxxxx"
                />

                <Input
                  label="Journal"
                  value={form.journalName}
                  onChange={event => setForm(prev => ({ ...prev, journalName: event.target.value }))}
                  placeholder="Journal name"
                />

                <Input
                  label="Publication Date"
                  type="date"
                  value={form.publicationDate}
                  onChange={event => setForm(prev => ({ ...prev, publicationDate: event.target.value }))}
                />

                <Input
                  label="Publication Year"
                  type="number"
                  value={form.publicationYear}
                  onChange={event => setForm(prev => ({ ...prev, publicationYear: event.target.value }))}
                  placeholder="2025"
                />

                <Input
                  label="Initial Citation Count"
                  type="number"
                  min="0"
                  value={form.citationCount}
                  onChange={event => setForm(prev => ({ ...prev, citationCount: event.target.value }))}
                  placeholder="0"
                />

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Source Label</label>
                  <select
                    value={form.sourcePrimary}
                    onChange={event => setForm(prev => ({ ...prev, sourcePrimary: event.target.value }))}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
                  >
                    {SOURCE_OPTIONS.map(source => (
                      <option key={source} value={source}>{source.replace('_', ' ')}</option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-gray-700">Authors</label>
                  <textarea
                    value={form.authorsText}
                    onChange={event => setForm(prev => ({ ...prev, authorsText: event.target.value }))}
                    rows={3}
                    placeholder="Separate authors with semicolons"
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-gray-700">Abstract</label>
                  <textarea
                    value={form.abstract}
                    onChange={event => setForm(prev => ({ ...prev, abstract: event.target.value }))}
                    rows={5}
                    placeholder="Optional abstract"
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div className="mt-5 border-t border-gray-100 pt-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Link Researchers</p>
                    <p className="text-xs text-gray-500">Manual assignment still respects SLU tenure logic when a start date is present.</p>
                  </div>
                  <span className="text-xs text-gray-400">{selectedResearcherIds.length} selected</span>
                </div>

                <Input
                  label="Find Researchers"
                  value={researcherFilter}
                  onChange={event => setResearcherFilter(event.target.value)}
                  placeholder="Search by name or department"
                />

                <div className="mt-3 max-h-64 space-y-2 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-3">
                  {filteredResearchers.map(researcher => (
                    <label key={researcher.id} className="flex cursor-pointer items-start gap-2 rounded-md bg-white px-3 py-2 text-sm hover:border-brand-200">
                      <input
                        type="checkbox"
                        checked={selectedResearcherIds.includes(researcher.id)}
                        onChange={() => toggleResearcher(researcher.id)}
                        className="mt-0.5 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                      />
                      <span>
                        <span className="block font-medium text-gray-800">{researcher.canonicalName}</span>
                        <span className="text-xs text-gray-500">{researcher.department}</span>
                      </span>
                    </label>
                  ))}
                  {filteredResearchers.length === 0 && (
                    <p className="text-sm text-gray-400">No researchers match your filter.</p>
                  )}
                </div>
              </div>

              <div className="mt-5 flex gap-2">
                <Button onClick={savePublication} loading={saving}>Save Publication</Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setForm(EMPTY_FORM);
                    setSelectedResearcherIds([]);
                    setResearcherFilter('');
                    setMsg(null);
                  }}
                >
                  Reset
                </Button>
              </div>
            </Card>

            <div className="space-y-5">
              <Card>
                <CardHeader>
                  <CardTitle>What This Adds</CardTitle>
                </CardHeader>
                <div className="space-y-2 text-sm text-gray-600">
                  <p>Manual publication entry for gaps that external sources miss.</p>
                  <p>Optional initial citation snapshot so analytics can start tracking immediately.</p>
                  <p>Manual researcher assignment with the same SLU tenure inclusion logic used elsewhere in the app.</p>
                </div>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recent Manual Publications</CardTitle>
                </CardHeader>
                <div className="space-y-3">
                  {recentPublications.length > 0 ? recentPublications.map(publication => (
                    <Link key={publication.id} href={`/publications/${publication.id}`} className="block rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 hover:border-brand-200 hover:bg-brand-50">
                      <p className="line-clamp-2 text-sm font-medium text-gray-800">{publication.title}</p>
                      <p className="mt-1 text-xs text-gray-500">
                        {publication.journalName || 'Unknown journal'} | {publication.publicationYear ?? 'Unknown year'}
                      </p>
                    </Link>
                  )) : (
                    <p className="text-sm text-gray-400">No manual publications found yet.</p>
                  )}
                </div>
              </Card>
            </div>
          </div>
        )}
      </PageContent>
    </PageLayout>
  );
}
