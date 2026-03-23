'use client';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback, useState } from 'react';
import { Button, Input, Select, Toggle } from '@/components/ui';
import { cn } from '@/lib/utils';

export function useFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const get = (key: string) => searchParams.get(key) || '';

  const set = useCallback((updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([k, v]) => {
      if (v === null || v === '') params.delete(k);
      else params.set(k, v);
    });
    params.delete('page'); // reset pagination on filter change
    router.push(`${pathname}?${params.toString()}`);
  }, [router, pathname, searchParams]);

  const reset = useCallback(() => router.push(pathname), [router, pathname]);

  return { get, set, reset, params: searchParams };
}

interface FilterBarProps {
  filters: Array<
    | { type: 'search'; key: string; placeholder: string; className?: string }
    | { type: 'select'; key: string; label: string; options: { value: string; label: string }[]; placeholder?: string }
    | { type: 'toggle'; key: string; label: string }
    | { type: 'number'; key: string; label: string; placeholder?: string }
  >;
  onReset?: () => void;
  className?: string;
}

export function FilterBar({ filters, className }: FilterBarProps) {
  const { get, set, reset } = useFilters();
  const hasActive = filters.some(f => !!get(f.key));

  return (
    <div className={cn('flex flex-wrap items-end gap-3', className)}>
      {filters.map(f => {
        if (f.type === 'search') return (
          <div key={f.key} className={cn('relative', f.className || 'w-64')}>
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
            <input
              value={get(f.key)}
              onChange={e => set({ [f.key]: e.target.value || null })}
              placeholder={f.placeholder}
              className="w-full pl-8 pr-3 py-2 text-sm rounded-md border border-gray-300 bg-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
            />
          </div>
        );

        if (f.type === 'select') return (
          <div key={f.key} className="min-w-[140px]">
            <select
              value={get(f.key)}
              onChange={e => set({ [f.key]: e.target.value || null })}
              className="w-full px-3 py-2 text-sm rounded-md border border-gray-300 bg-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
            >
              <option value="">{f.placeholder || f.label}</option>
              {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        );

        if (f.type === 'toggle') return (
          <div key={f.key} className="flex items-center gap-2 h-9">
            <Toggle
              checked={get(f.key) === 'true'}
              onChange={v => set({ [f.key]: v ? 'true' : null })}
              label={f.label}
            />
          </div>
        );

        if (f.type === 'number') return (
          <div key={f.key} className="w-28">
            <input
              type="number"
              value={get(f.key)}
              onChange={e => set({ [f.key]: e.target.value || null })}
              placeholder={f.placeholder || f.label}
              min={0} step={0.1}
              className="w-full px-3 py-2 text-sm rounded-md border border-gray-300 bg-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
            />
          </div>
        );

        return null;
      })}

      {hasActive && (
        <button onClick={reset} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 px-2 py-2 rounded hover:bg-gray-100 transition-colors">
          ✕ Clear filters
        </button>
      )}
    </div>
  );
}

// Active filter pills
export function ActiveFilters({ labels }: { labels: { key: string; label: string; value: string }[] }) {
  const { set } = useFilters();
  if (!labels.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {labels.map(l => (
        <span key={l.key} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-brand-50 text-brand-700 border border-brand-200">
          <span className="font-medium">{l.label}:</span> {l.value}
          <button onClick={() => set({ [l.key]: null })} className="ml-0.5 hover:text-brand-900">✕</button>
        </span>
      ))}
    </div>
  );
}
