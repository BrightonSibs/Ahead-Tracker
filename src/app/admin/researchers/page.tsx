'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PageLayout, PageContent, TopBar } from '@/components/layout';
import { Card, CardHeader, CardTitle, Button, Input, Alert, Spinner } from '@/components/ui';
import { departmentColor } from '@/lib/utils';

const ALIAS_TYPES = ['NAME_VARIANT', 'MAIDEN_NAME', 'ABBREVIATED', 'INITIALS_ONLY', 'LEGACY'];

export default function AdminResearchersPage() {
  const [researchers, setResearchers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [newAlias, setNewAlias] = useState({ aliasName: '', aliasType: 'NAME_VARIANT' });
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({
    facultyId: '', canonicalName: '', department: 'AHEAD',
    orcid: '', sluStartDate: '', notes: '',
    aliases: [] as { aliasName: string; aliasType: string }[],
  });
  const [newAddAlias, setNewAddAlias] = useState({ aliasName: '', aliasType: 'NAME_VARIANT' });

  useEffect(() => {
    fetch('/api/researchers')
      .then(r => r.json())
      .then(d => { setResearchers(d); setLoading(false); });
  }, []);

  async function saveEdit(id: string) {
    setSaving(true);
    const r = await fetch(`/api/researchers/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    });
    if (r.ok) {
      setMsg({ type: 'success', text: 'Researcher updated.' });
      setEditingId(null);
      const updated = await fetch('/api/researchers').then(res => res.json());
      setResearchers(updated);
    } else {
      setMsg({ type: 'error', text: 'Update failed.' });
    }
    setSaving(false);
  }

  async function addResearcher() {
    if (!addForm.canonicalName || !addForm.facultyId) {
      setMsg({ type: 'error', text: 'Faculty ID and canonical name are required.' }); return;
    }
    setSaving(true);
    const r = await fetch('/api/researchers', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...addForm, facultyId: Number(addForm.facultyId) }),
    });
    if (r.ok) {
      setMsg({ type: 'success', text: `${addForm.canonicalName} added successfully.` });
      setShowAddForm(false);
      setAddForm({ facultyId: '', canonicalName: '', department: 'AHEAD', orcid: '', sluStartDate: '', notes: '', aliases: [] });
      const updated = await fetch('/api/researchers').then(res => res.json());
      setResearchers(updated);
    } else {
      const err = await r.json();
      setMsg({ type: 'error', text: err.error || 'Failed to add researcher.' });
    }
    setSaving(false);
  }

  function startEdit(r: any) {
    setEditingId(r.id);
    setEditForm({
      canonicalName: r.canonicalName,
      department: r.department,
      orcid: r.orcid || '',
      sluStartDate: r.sluStartDate ? r.sluStartDate.split('T')[0] : '',
      notes: r.notes || '',
    });
  }

  return (
    <PageLayout>
      <TopBar title="Manage Researchers" subtitle="Add, edit, and manage the faculty roster and name aliases"
        actions={
          <Button variant="primary" size="sm" onClick={() => setShowAddForm(!showAddForm)}>
            {showAddForm ? '✕ Cancel' : '+ Add Researcher'}
          </Button>
        }
      />
      <PageContent>
        {msg && <Alert type={msg.type} title={msg.type === 'success' ? 'Success' : 'Error'}>{msg.text}</Alert>}

        {/* Add form */}
        {showAddForm && (
          <Card>
            <CardHeader><CardTitle>Add New Researcher</CardTitle></CardHeader>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              <Input label="Faculty ID *" type="number" value={addForm.facultyId} onChange={e => setAddForm(p => ({ ...p, facultyId: e.target.value }))} placeholder="e.g. 16" />
              <Input label="Canonical Name *" value={addForm.canonicalName} onChange={e => setAddForm(p => ({ ...p, canonicalName: e.target.value }))} placeholder="e.g. Jane A. Smith" />
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Department *</label>
                <select value={addForm.department} onChange={e => setAddForm(p => ({ ...p, department: e.target.value }))}
                  className="w-full px-3 py-2 text-sm rounded-md border border-gray-300 bg-white focus:border-brand-500 outline-none">
                  <option value="AHEAD">AHEAD</option>
                  <option value="HCOR">HCOR</option>
                </select>
              </div>
              <Input label="ORCID" value={addForm.orcid} onChange={e => setAddForm(p => ({ ...p, orcid: e.target.value }))} placeholder="0000-0000-0000-0000" />
              <Input label="SLU Start Date" type="date" value={addForm.sluStartDate} onChange={e => setAddForm(p => ({ ...p, sluStartDate: e.target.value }))} />
              <Input label="Notes" value={addForm.notes} onChange={e => setAddForm(p => ({ ...p, notes: e.target.value }))} placeholder="Optional notes" />
            </div>

            {/* Aliases for new researcher */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-700 mb-2">Name Aliases</label>
              <div className="flex gap-2 mb-2">
                <input value={newAddAlias.aliasName} onChange={e => setNewAddAlias(p => ({ ...p, aliasName: e.target.value }))}
                  placeholder="Alias name" className="flex-1 px-3 py-2 text-sm rounded-md border border-gray-300 bg-white focus:border-brand-500 outline-none" />
                <select value={newAddAlias.aliasType} onChange={e => setNewAddAlias(p => ({ ...p, aliasType: e.target.value }))}
                  className="px-3 py-2 text-sm rounded-md border border-gray-300 bg-white focus:border-brand-500 outline-none">
                  {ALIAS_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                </select>
                <Button variant="outline" size="sm" onClick={() => {
                  if (!newAddAlias.aliasName) return;
                  setAddForm(p => ({ ...p, aliases: [...p.aliases, { ...newAddAlias }] }));
                  setNewAddAlias({ aliasName: '', aliasType: 'NAME_VARIANT' });
                }}>+ Add</Button>
              </div>
              {addForm.aliases.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {addForm.aliases.map((a, i) => (
                    <span key={i} className="flex items-center gap-1 px-2 py-1 rounded bg-gray-100 text-xs text-gray-700">
                      {a.aliasName} <span className="text-gray-400">({a.aliasType.replace('_', ' ')})</span>
                      <button onClick={() => setAddForm(p => ({ ...p, aliases: p.aliases.filter((_, j) => j !== i) }))} className="ml-1 text-gray-400 hover:text-red-500">✕</button>
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

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-12"><Spinner size="lg" /></div>
        ) : (
          <Card padding={false}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    {['ID', 'Canonical Name', 'Dept', 'ORCID', 'SLU Start Date', 'Aliases', 'Publications', 'Status', 'Actions'].map((h, i) => (
                      <th key={i} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {researchers.map(r => (
                    <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 text-xs font-mono text-gray-400">{r.facultyId}</td>
                      <td className="px-4 py-3">
                        {editingId === r.id ? (
                          <input value={editForm.canonicalName} onChange={e => setEditForm((p: any) => ({ ...p, canonicalName: e.target.value }))}
                            className="px-2 py-1 text-sm border border-brand-300 rounded w-40 focus:outline-none" />
                        ) : (
                          <div>
                            <p className="text-sm font-medium text-gray-900">{r.canonicalName}</p>
                            {r.notes && <p className="text-[10px] text-amber-600 mt-0.5">⚠ {r.notes.slice(0, 60)}…</p>}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editingId === r.id ? (
                          <select value={editForm.department} onChange={e => setEditForm((p: any) => ({ ...p, department: e.target.value }))}
                            className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none">
                            <option value="AHEAD">AHEAD</option><option value="HCOR">HCOR</option>
                          </select>
                        ) : (
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${departmentColor(r.department)}`}>{r.department}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editingId === r.id ? (
                          <input value={editForm.orcid} onChange={e => setEditForm((p: any) => ({ ...p, orcid: e.target.value }))}
                            placeholder="0000-0000-0000-0000"
                            className="px-2 py-1 text-xs font-mono border border-gray-300 rounded w-36 focus:outline-none" />
                        ) : r.orcid ? (
                          <a href={`https://orcid.org/${r.orcid}`} target="_blank" rel="noopener"
                            className="text-xs text-teal-600 hover:text-teal-700 font-mono">{r.orcid}</a>
                        ) : (
                          <span className="text-xs text-amber-500">⚠ Missing</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editingId === r.id ? (
                          <input type="date" value={editForm.sluStartDate} onChange={e => setEditForm((p: any) => ({ ...p, sluStartDate: e.target.value }))}
                            className="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none" />
                        ) : r.sluStartDate ? (
                          <span className="text-xs font-mono text-gray-600">{r.sluStartDate.split('T')[0]}</span>
                        ) : (
                          <span className="text-xs text-amber-500 font-medium">⚠ Not set</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{r.aliasCount}</td>
                      <td className="px-4 py-3 text-xs text-gray-600">{r.publicationCount}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${r.activeStatus ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {r.activeStatus ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {editingId === r.id ? (
                          <div className="flex gap-1">
                            <Button size="xs" loading={saving} onClick={() => saveEdit(r.id)}>Save</Button>
                            <Button size="xs" variant="ghost" onClick={() => setEditingId(null)}>✕</Button>
                          </div>
                        ) : (
                          <div className="flex gap-1">
                            <Button size="xs" variant="outline" onClick={() => startEdit(r)}>Edit</Button>
                            <Link href={`/researchers/${r.id}`}>
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
