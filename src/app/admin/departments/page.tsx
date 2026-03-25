'use client';

import { useEffect, useState } from 'react';
import { PageLayout, PageContent, TopBar, TopBarActions } from '@/components/layout';
import { Card, CardHeader, CardTitle, Button, Input, Alert, Spinner } from '@/components/ui';
import type { DepartmentSummary } from '@/types';

type DepartmentForm = {
  code: string;
  name: string;
  shortName: string;
  color: string;
  activeStatus: boolean;
  displayOrder: string;
};

const EMPTY_FORM: DepartmentForm = {
  code: '',
  name: '',
  shortName: '',
  color: '',
  activeStatus: true,
  displayOrder: '0',
};

export default function AdminDepartmentsPage() {
  const [departments, setDepartments] = useState<DepartmentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [addForm, setAddForm] = useState<DepartmentForm>(EMPTY_FORM);
  const [editForm, setEditForm] = useState<DepartmentForm>(EMPTY_FORM);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  async function loadDepartments() {
    const response = await fetch('/api/departments');
    const payload = await response.json();
    setDepartments(Array.isArray(payload) ? payload : []);
    setLoading(false);
  }

  useEffect(() => {
    loadDepartments().catch(() => setLoading(false));
  }, []);

  function beginEdit(department: DepartmentSummary) {
    setEditingCode(department.code);
    setEditForm({
      code: department.code,
      name: department.name,
      shortName: department.shortName || '',
      color: department.color || '',
      activeStatus: department.activeStatus,
      displayOrder: String(department.displayOrder),
    });
  }

  async function saveNewDepartment() {
    try {
      setSaving(true);
      setMessage(null);

      const response = await fetch('/api/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...addForm,
          displayOrder: Number(addForm.displayOrder || 0),
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Unable to create department');
      }

      setShowAddForm(false);
      setAddForm(EMPTY_FORM);
      setMessage({ type: 'success', text: `${payload.name} created.` });
      await loadDepartments();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Unable to create department.' });
    } finally {
      setSaving(false);
    }
  }

  async function saveDepartment(code: string) {
    try {
      setSaving(true);
      setMessage(null);

      const response = await fetch(`/api/departments/${code}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editForm,
          displayOrder: Number(editForm.displayOrder || 0),
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Unable to update department');
      }

      setEditingCode(null);
      setMessage({ type: 'success', text: `${payload.name} updated.` });
      await loadDepartments();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Unable to update department.' });
    } finally {
      setSaving(false);
    }
  }

  async function deleteDepartment(code: string) {
    try {
      setSaving(true);
      setMessage(null);

      const response = await fetch(`/api/departments/${code}`, { method: 'DELETE' });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Unable to delete department');
      }

      setMessage({ type: 'success', text: `${code} deleted.` });
      await loadDepartments();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Unable to delete department.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageLayout>
      <TopBar
        title="Departments"
        subtitle="Manage department codes, labels, colors, and availability across the platform"
        actions={
          <TopBarActions>
            <Button variant="primary" size="sm" onClick={() => setShowAddForm(current => !current)}>
              {showAddForm ? 'Cancel' : '+ Add Department'}
            </Button>
          </TopBarActions>
        }
      />
      <PageContent>
        {message && <Alert type={message.type}>{message.text}</Alert>}

        {showAddForm && (
          <Card>
            <CardHeader>
              <CardTitle>Add Department</CardTitle>
            </CardHeader>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Input label="Code *" value={addForm.code} onChange={e => setAddForm(prev => ({ ...prev, code: e.target.value }))} placeholder="e.g. PEDS" />
              <Input label="Name *" value={addForm.name} onChange={e => setAddForm(prev => ({ ...prev, name: e.target.value }))} placeholder="Department of Pediatrics" />
              <Input label="Short Name" value={addForm.shortName} onChange={e => setAddForm(prev => ({ ...prev, shortName: e.target.value }))} placeholder="Pediatrics" />
              <Input label="Color" value={addForm.color} onChange={e => setAddForm(prev => ({ ...prev, color: e.target.value }))} placeholder="#2563eb" />
              <Input label="Display Order" type="number" value={addForm.displayOrder} onChange={e => setAddForm(prev => ({ ...prev, displayOrder: e.target.value }))} />
              <label className="flex items-center gap-2 self-end rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={addForm.activeStatus}
                  onChange={e => setAddForm(prev => ({ ...prev, activeStatus: e.target.checked }))}
                  className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                />
                Active
              </label>
            </div>
            <div className="mt-4 flex gap-2">
              <Button onClick={saveNewDepartment} loading={saving}>Save Department</Button>
              <Button variant="outline" onClick={() => setShowAddForm(false)}>Close</Button>
            </div>
          </Card>
        )}

        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : (
          <Card padding={false}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    {['Code', 'Name', 'Short Name', 'Researchers', 'Color', 'Status', 'Order', 'Actions'].map(header => (
                      <th key={header} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {departments.map(department => (
                    <tr key={department.code} className="hover:bg-gray-50/60">
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">
                        {editingCode === department.code ? (
                          <input
                            value={editForm.code}
                            onChange={e => setEditForm(prev => ({ ...prev, code: e.target.value }))}
                            className="w-24 rounded border border-gray-300 px-2 py-1 text-xs"
                          />
                        ) : department.code}
                      </td>
                      <td className="px-4 py-3">
                        {editingCode === department.code ? (
                          <input
                            value={editForm.name}
                            onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                            className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                          />
                        ) : (
                          <span className="text-sm font-medium text-gray-900">{department.name}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editingCode === department.code ? (
                          <input
                            value={editForm.shortName}
                            onChange={e => setEditForm(prev => ({ ...prev, shortName: e.target.value }))}
                            className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                          />
                        ) : (
                          <span className="text-sm text-gray-600">{department.shortName || '—'}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{department.researcherCount || 0}</td>
                      <td className="px-4 py-3">
                        {editingCode === department.code ? (
                          <input
                            value={editForm.color}
                            onChange={e => setEditForm(prev => ({ ...prev, color: e.target.value }))}
                            className="w-28 rounded border border-gray-300 px-2 py-1 text-sm"
                          />
                        ) : (
                          <div className="flex items-center gap-2">
                            <span
                              className="h-3 w-3 rounded-full border border-gray-200"
                              style={{ backgroundColor: department.color || '#cbd5e1' }}
                            />
                            <span className="font-mono text-xs text-gray-500">{department.color || 'auto'}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editingCode === department.code ? (
                          <label className="flex items-center gap-2 text-sm text-gray-700">
                            <input
                              type="checkbox"
                              checked={editForm.activeStatus}
                              onChange={e => setEditForm(prev => ({ ...prev, activeStatus: e.target.checked }))}
                              className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                            />
                            Active
                          </label>
                        ) : (
                          <span className={`rounded px-2 py-0.5 text-xs font-medium ${department.activeStatus ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {department.activeStatus ? 'Active' : 'Inactive'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editingCode === department.code ? (
                          <input
                            type="number"
                            value={editForm.displayOrder}
                            onChange={e => setEditForm(prev => ({ ...prev, displayOrder: e.target.value }))}
                            className="w-20 rounded border border-gray-300 px-2 py-1 text-sm"
                          />
                        ) : (
                          <span className="text-sm text-gray-600">{department.displayOrder}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editingCode === department.code ? (
                          <div className="flex gap-2">
                            <Button size="xs" loading={saving} onClick={() => saveDepartment(department.code)}>Save</Button>
                            <Button size="xs" variant="outline" onClick={() => setEditingCode(null)}>Cancel</Button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <Button size="xs" variant="outline" onClick={() => beginEdit(department)}>Edit</Button>
                            <Button
                              size="xs"
                              variant="danger"
                              disabled={(department.researcherCount || 0) > 0 || saving}
                              onClick={() => deleteDepartment(department.code)}
                            >
                              Delete
                            </Button>
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
