'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { startTransition, useCallback, useEffect, useState } from 'react';
import { Toggle } from '@/components/ui';
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

    params.delete('page');

    const nextUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    startTransition(() => {
      router.replace(nextUrl, { scroll: false });
    });
  }, [router, pathname, searchParams]);

  const reset = useCallback(() => {
    startTransition(() => {
      router.replace(pathname, { scroll: false });
    });
  }, [router, pathname]);

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

function DebouncedTextFilterInput({
  value,
  placeholder,
  className,
  onCommit,
}: {
  value: string;
  placeholder: string;
  className?: string;
  onCommit: (value: string | null) => void;
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (draft === value) return undefined;

    const timeoutId = window.setTimeout(() => {
      onCommit(draft || null);
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [draft, onCommit, value]);

  return (
    <div className={cn('relative', className || 'w-64')}>
      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-gray-400">/</span>
      <input
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => onCommit(draft || null)}
        placeholder={placeholder}
        className="w-full rounded-md border border-gray-300 bg-white py-2 pl-8 pr-3 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
      />
    </div>
  );
}

export function FilterBar({ filters, className }: FilterBarProps) {
  const { get, set, reset } = useFilters();
  const hasActive = filters.some(f => !!get(f.key));

  return (
    <div className={cn('flex flex-wrap items-end gap-3', className)}>
      {filters.map(f => {
        if (f.type === 'search') {
          return (
            <DebouncedTextFilterInput
              key={f.key}
              value={get(f.key)}
              onCommit={value => set({ [f.key]: value })}
              placeholder={f.placeholder}
              className={f.className}
            />
          );
        }

        if (f.type === 'select') {
          return (
            <div key={f.key} className="min-w-[140px]">
              <select
                value={get(f.key)}
                onChange={e => set({ [f.key]: e.target.value || null })}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              >
                <option value="">{f.placeholder || f.label}</option>
                {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          );
        }

        if (f.type === 'toggle') {
          return (
            <div key={f.key} className="flex h-9 items-center gap-2">
              <Toggle
                checked={get(f.key) === 'true'}
                onChange={v => set({ [f.key]: v ? 'true' : null })}
                label={f.label}
              />
            </div>
          );
        }

        if (f.type === 'number') {
          return (
            <div key={f.key} className="w-28">
              <input
                type="number"
                value={get(f.key)}
                onChange={e => set({ [f.key]: e.target.value || null })}
                placeholder={f.placeholder || f.label}
                min={0}
                step={0.1}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              />
            </div>
          );
        }

        return null;
      })}

      {hasActive && (
        <button onClick={reset} className="flex items-center gap-1 rounded px-2 py-2 text-sm text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700">
          x Clear filters
        </button>
      )}
    </div>
  );
}

export function ActiveFilters({ labels }: { labels: { key: string; label: string; value: string }[] }) {
  const { set } = useFilters();

  if (!labels.length) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {labels.map(l => (
        <span key={l.key} className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-2 py-1 text-xs text-brand-700">
          <span className="font-medium">{l.label}:</span> {l.value}
          <button onClick={() => set({ [l.key]: null })} className="ml-0.5 hover:text-brand-900">x</button>
        </span>
      ))}
    </div>
  );
}
