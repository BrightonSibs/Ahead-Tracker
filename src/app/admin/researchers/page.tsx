'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PageLayout, PageContent, TopBar, TopBarActions } from '@/components/layout';
import { Alert, Button, Card, CardHeader, CardTitle, Input, Spinner } from '@/components/ui';
import { departmentColor } from '@/lib/utils';
import type { DepartmentSummary } from '@/types';

const ALIAS_TYPES = ['NAME_VARIANT', 'MAIDEN_NAME', 'ABBREVIATED', 'INITIALS_ONLY', 'LEGACY'];

export default function AdminResearchersPage() {
  const [researchers, setResearchers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [departments, setDepartments] = useState<DepartmentSummary[]>([]);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({
    facultyId: '',
    canonicalName: '',
    department: '',
    orcid: '',
    sluStartDate: '',
    notes: '',
    aliases: [] as { aliasName: string; aliasType: string }[],
  });
  const [newAddAlias, setNewAddAlias] = useState({ aliasName: '', aliasType: 'NAME_VARIANT' });

  useEffect(() => {
    Promise.allSettled([
      fetch('/api/researchers').then(response => response.json()),
      fetch('/api/departments').then(response => response.json()),
    ])
      .then(([researcherResult, departmentResult]) => {
        const researcherData =
          researcherResult.status === 'fulfilled' && Array.isArray(researcherResult.value)
            ? researcherResult.value
            : [];
        const departmentData =
          departmentResult.status === 'fulfilled' && Array.isArray(departmentResult.value)
            ? departmentResult.value
            : Array.from(new Set(researcherData.map(item => item.department))).map((code, index) => ({
                id: `fallback-${code}`,
                code,
                name: code,
                shortName: code,
                color: null,
                activeStatus: true,
                displayOrder: index,
                researcherCount: researcherData.filter(item => item.department === code).length,
              }));

        setResearchers(researcherData);
        setDepartments(departmentData);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!addForm.department && departments.length > 0) {
      setAddForm(prev => ({ ...prev, department: departments[0].code }));
    }
  }, [departments, addForm.department]);

  async function saveEdit(id: string) {
    setSaving(true);

    const response = await fetch(`/api/researchers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    });

    if (response.ok) {
      setMsg({ type: 'success', text: 'Researcher updated.' });
      setEditingId(null);
      const updated = await fetch('/api/researchers').then(result => result.json());
      setResearchers(updated);
    } else {
      setMsg({ type: 'error', text: 'Update failed.' });
    }

    setSaving(false);
  }

  async function addResearcher() {
    if (!addForm.canonicalName || !addForm.facultyId) {
      setMsg({ type: 'error', text: 'Faculty ID and canonical name are required.' });
      return;
    }

    setSaving(true);

    const response = await fetch('/api/researchers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...addForm, facultyId: Number(addForm.facultyId) }),
    });

    if (response.ok) {
      setMsg({ type: 'success', text: `${addForm.canonicalName} added successfully.` });
      setShowAddForm(false);
      setAddForm({
        facultyId: '',
        canonicalName: '',
        department: departments[0]?.code || '',
        orcid: '',
        sluStartDate: '',
        notes: '',
        aliases: [],
      });
      const updated = await fetch('/api/researchers').then(result => result.json());
      setResearchers(updated);
    } else {
      const error = await response.json();
      setMsg({ type: 'error', text: error.error || 'Failed to add researcher.' });
    }

    setSaving(false);
  }

  function startEdit(researcher: any) {
    setEditingId(researcher.id);
    setEditForm({
      canonicalName: researcher.canonicalName,
      department: researcher.department,
      orcid: researcher.orcid || '',
      sluStartDate: researcher.sluStartDate ? researcher.sluStartDate.split('T')[0] : '',
      notes: researcher.notes || '',
    });
  }

  return (
    <PageLayout>
      <TopBar
        title="Manage Researchers"
        subtitle="Add, edit, and manage the faculty roster and name aliases"
        actions={
          <TopBarActions>
            <Button variant="primary" size="sm" onClick={() => setShowAddForm(current => !current)}>
              {showAddForm ? 'Cancel' : '+ Add Researcher'}
            </Button>
          </TopBarActions>
        }
      />
      <PageContent>
        {msg && <Alert type={msg.type} title={msg.type === 'success' ? 'Success' : 'Error'}>{msg.text}</Alert>}
        <Alert type="info" title="Matching Rule">
          Automatic publication matching now uses only each researcher&apos;s canonical name and approved alias roster.
        </Alert>

        {showAddForm && (
          <Card>
            <CardHeader>
              <CardTitle>Add New Researcher</CardTitle>
            </CardHeader>

            <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-3">
              <Input
                label="Faculty ID *"
                type="number"
                value={addForm.facultyId}
                onChange={event => setAddForm(prev => ({ ...prev, facultyId: event.target.value }))}
                placeholder="e.g. 16"
              />
              <Input
                label="Canonical Name *"
                value={addForm.canonicalName}
                onChange={event => setAddForm(prev => ({ ...prev, canonicalName: event.target.value }))}
                placeholder="e.g. Jane A. Smith"
              />
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Department *</label>
                <select
                  value={addForm.department}
                  onChange={event => setAddForm(prev => ({ ...prev, department: event.target.value }))}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
                >
                  <option value="">Select department</option>
                  {departments
                    .filter(department => department.activeStatus)
                    .map(department => (
                      <option key={department.code} value={department.code}>
                        {department.shortName || department.name}
                      </option>
                    ))}
                </select>
              </div>
              <Input
                label="ORCID"
                value={addForm.orcid}
                onChange={event => setAddForm(prev => ({ ...prev, orcid: event.target.value }))}
                placeholder="0000-0000-0000-0000"
              />
              <Input
                label="SLU Start Date"
                type="date"
                value={addForm.sluStartDate}
                onChange={event => setAddForm(prev => ({ ...prev, sluStartDate: event.target.value }))}
              />
              <Input
                label="Notes"
                value={addForm.notes}
                onChange={event => setAddForm(prev => ({ ...prev, notes: event.target.value }))}
                placeholder="Optional notes"
              />
            </div>

            <div className="mb-4">
              <label className="mb-2 block text-xs font-medium text-gray-700">Name Aliases</label>
              <div className="mb-2 flex gap-2">
                <input
                  value={newAddAlias.aliasName}
                  onChange={event => setNewAddAlias(prev => ({ ...prev, aliasName: event.target.value }))}
                  placeholder="Alias name"
                  className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
                />
                <select
                  value={newAddAlias.aliasType}
                  onChange={event => setNewAddAlias(prev => ({ ...prev, aliasType: event.target.value }))}
                  className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
                >
                  {ALIAS_TYPES.map(type => (
                    <option key={type} value={type}>
                      {type.replace('_', ' ')}
                    </option>
                  ))}
                </select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (!newAddAlias.aliasName) return;
                    setAddForm(prev => ({ ...prev, aliases: [...prev.aliases, { ...newAddAlias }] }));
                    setNewAddAlias({ aliasName: '', aliasType: 'NAME_VARIANT' });
                  }}
                >
                  + Add
                </Button>
              </div>

              {addForm.aliases.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {addForm.aliases.map((alias, index) => (
                    <span key={index} className="flex items-center gap-1 rounded bg-gray-100 px-2 py-1 text-xs text-gray-700">
                      {alias.aliasName} <span className="text-gray-400">({alias.aliasType.replace('_', ' ')})</span>
                      <button
                        type="button"
                        onClick={() => setAddForm(prev => ({ ...prev, aliases: prev.aliases.filter((_, itemIndex) => itemIndex !== index) }))}
                        className="ml-1 text-gray-400 hover:text-red-500"
                      >
                        Remove
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button onClick={addResearcher} loading={saving}>Save Researcher</Button>
              <Button variant="outline" onClick={() => setShowAddForm(false)}>Cancel</Button>
            </div>
          </Card>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : (
          <Card padding={false}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    {['ID', 'Canonical Name', 'Dept', 'ORCID', 'SLU Start Date', 'Aliases', 'Publications', 'Status', 'Actions'].map(
                      (header, index) => (
                        <th
                          key={index}
                          className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500"
                        >
                          {header}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {researchers.map(researcher => (
                    <tr key={researcher.id} className="transition-colors hover:bg-gray-50/50">
                      <td className="px-4 py-3 text-xs font-mono text-gray-400">{researcher.facultyId}</td>
                      <td className="px-4 py-3">
                        {editingId === researcher.id ? (
                          <input
                            value={editForm.canonicalName}
                            onChange={event => setEditForm((prev: any) => ({ ...prev, canonicalName: event.target.value }))}
                            className="w-40 rounded border border-brand-300 px-2 py-1 text-sm focus:outline-none"
                          />
                        ) : (
                          <div>
                            <p className="text-sm font-medium text-gray-900">{researcher.canonicalName}</p>
                            {researcher.notes && (
                              <p className="mt-0.5 text-[10px] text-amber-600">
                                Warning: {researcher.notes.slice(0, 60)}
                                {researcher.notes.length > 60 ? '...' : ''}
                              </p>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editingId === researcher.id ? (
                          <select
                            value={editForm.department}
                            onChange={event => setEditForm((prev: any) => ({ ...prev, department: event.target.value }))}
                            className="rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none"
                          >
                            {departments.map(department => (
                              <option key={department.code} value={department.code}>
                                {department.shortName || department.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className={`rounded px-2 py-0.5 text-xs font-medium ${departmentColor(researcher.department)}`}>
                            {researcher.department}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editingId === researcher.id ? (
                          <input
                            value={editForm.orcid}
                            onChange={event => setEditForm((prev: any) => ({ ...prev, orcid: event.target.value }))}
                            placeholder="0000-0000-0000-0000"
                            className="w-36 rounded border border-gray-300 px-2 py-1 text-xs font-mono focus:outline-none"
                          />
                        ) : researcher.orcid ? (
                          <a
                            href={`https://orcid.org/${researcher.orcid}`}
                            target="_blank"
                            rel="noopener"
                            className="font-mono text-xs text-teal-600 hover:text-teal-700"
                          >
                            {researcher.orcid}
                          </a>
                        ) : (
                          <span className="text-xs text-amber-500">Missing</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editingId === researcher.id ? (
                          <input
                            type="date"
                            value={editForm.sluStartDate}
                            onChange={event => setEditForm((prev: any) => ({ ...prev, sluStartDate: event.target.value }))}
                            className="rounded border border-gray-300 px-2 py-1 text-xs focus:outline-none"
                          />
                        ) : researcher.sluStartDate ? (
                          <span className="font-mono text-xs text-gray-600">{researcher.sluStartDate.split('T')[0]}</span>
                        ) : (
                          <span className="text-xs font-medium text-amber-500">Not set</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{researcher.aliasCount}</td>
                      <td className="px-4 py-3 text-xs text-gray-600">{researcher.publicationCount}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-medium ${
                            researcher.activeStatus ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {researcher.activeStatus ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {editingId === researcher.id ? (
                          <div className="flex gap-1">
                            <Button size="xs" loading={saving} onClick={() => saveEdit(researcher.id)}>Save</Button>
                            <Button size="xs" variant="ghost" onClick={() => setEditingId(null)}>Close</Button>
                          </div>
                        ) : (
                          <div className="flex gap-1">
                            <Button size="xs" variant="outline" onClick={() => startEdit(researcher)}>Edit</Button>
                            <Link href={`/researchers/${researcher.id}`}>
                              <Button size="xs" variant="ghost">View</Button>
                            </Link>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </PageContent>
    </PageLayout>
  );
}
