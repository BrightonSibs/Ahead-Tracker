'use client';
import { cn } from '@/lib/utils';
import { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes } from 'react';

// ── Badge ─────────────────────────────────────────────────────────────────
export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', className)}>
      {children}
    </span>
  );
}

// ── Button ────────────────────────────────────────────────────────────────
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export function Button({ variant = 'primary', size = 'md', loading, className, children, disabled, ...props }: ButtonProps) {
  const base = 'inline-flex items-center justify-center font-medium rounded transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed';
  const variants = {
    primary:   'bg-brand-600 text-white hover:bg-brand-700 focus:ring-brand-500',
    secondary: 'bg-teal-600 text-white hover:bg-teal-700 focus:ring-teal-500',
    outline:   'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus:ring-brand-400',
    ghost:     'bg-transparent text-gray-600 hover:bg-gray-100 focus:ring-gray-300',
    danger:    'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
  };
  const sizes = {
    xs: 'text-xs px-2 py-1 gap-1',
    sm: 'text-sm px-3 py-1.5 gap-1.5',
    md: 'text-sm px-4 py-2 gap-2',
    lg: 'text-base px-5 py-2.5 gap-2',
  };
  return (
    <button className={cn(base, variants[variant], sizes[size], className)} disabled={disabled || loading} {...props}>
      {loading && <span className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" />}
      {children}
    </button>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────
export function Card({ children, className, padding = true }: { children: ReactNode; className?: string; padding?: boolean }) {
  return (
    <div className={cn('bg-white rounded-lg border border-gray-200 shadow-card', padding && 'p-5', className)}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex items-center justify-between mb-4', className)}>{children}</div>;
}

export function CardTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h3 className={cn('text-sm font-semibold text-gray-900', className)}>{children}</h3>;
}

// ── KPI Card ──────────────────────────────────────────────────────────────
export function KpiCard({
  label, value, sub, delta, icon, color = 'blue',
}: {
  label: string; value: string | number; sub?: string; delta?: string; icon?: ReactNode; color?: 'blue' | 'teal' | 'green' | 'amber' | 'red';
}) {
  const colors = {
    blue:  { border: 'border-l-brand-500', bg: 'bg-brand-50',  text: 'text-brand-700',  val: 'text-brand-900' },
    teal:  { border: 'border-l-teal-500',  bg: 'bg-teal-50',   text: 'text-teal-700',   val: 'text-teal-900' },
    green: { border: 'border-l-green-500', bg: 'bg-green-50',  text: 'text-green-700',  val: 'text-green-900' },
    amber: { border: 'border-l-amber-500', bg: 'bg-amber-50',  text: 'text-amber-700',  val: 'text-amber-900' },
    red:   { border: 'border-l-red-500',   bg: 'bg-red-50',    text: 'text-red-700',    val: 'text-red-900' },
  };
  const c = colors[color];
  return (
    <div className={cn('bg-white rounded-lg border border-gray-200 border-l-4 p-5 shadow-card', c.border)}>
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
          <p className={cn('mt-1 text-2xl font-bold font-display', c.val)}>{value}</p>
          {sub && <p className="mt-0.5 text-xs text-gray-500">{sub}</p>}
          {delta && <p className="mt-1 text-xs font-medium text-green-600">↑ {delta}</p>}
        </div>
        {icon && <div className={cn('ml-3 flex-shrink-0 p-2 rounded-lg', c.bg)}><span className={cn('text-xl', c.text)}>{icon}</span></div>}
      </div>
    </div>
  );
}

// ── Input ─────────────────────────────────────────────────────────────────
interface InputProps extends InputHTMLAttributes<HTMLInputElement> { label?: string; error?: string; helperText?: string; }
export function Input({ label, error, helperText, className, id, ...props }: InputProps) {
  return (
    <div className="w-full">
      {label && <label htmlFor={id} className="block text-xs font-medium text-gray-700 mb-1">{label}</label>}
      <input id={id} className={cn('block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors disabled:bg-gray-50 disabled:text-gray-500', error && 'border-red-400 focus:border-red-500 focus:ring-red-400', className)} {...props} />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {helperText && !error && <p className="mt-1 text-xs text-gray-500">{helperText}</p>}
    </div>
  );
}

// ── Select ────────────────────────────────────────────────────────────────
interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> { label?: string; options: { value: string; label: string }[]; placeholder?: string; }
export function Select({ label, options, placeholder, className, id, ...props }: SelectProps) {
  return (
    <div className="w-full">
      {label && <label htmlFor={id} className="block text-xs font-medium text-gray-700 mb-1">{label}</label>}
      <select id={id} className={cn('block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors', className)} {...props}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

// ── Alert ─────────────────────────────────────────────────────────────────
export function Alert({ type = 'info', title, children }: { type?: 'info' | 'warning' | 'error' | 'success'; title?: string; children: ReactNode }) {
  const styles = {
    info:    { wrapper: 'bg-blue-50 border-blue-200',  icon: '🔵', title: 'text-blue-800',  body: 'text-blue-700' },
    warning: { wrapper: 'bg-amber-50 border-amber-200', icon: '⚠️', title: 'text-amber-800', body: 'text-amber-700' },
    error:   { wrapper: 'bg-red-50 border-red-200',    icon: '🔴', title: 'text-red-800',   body: 'text-red-700' },
    success: { wrapper: 'bg-green-50 border-green-200', icon: '✅', title: 'text-green-800', body: 'text-green-700' },
  };
  const s = styles[type];
  return (
    <div className={cn('rounded-lg border p-4', s.wrapper)}>
      <div className="flex gap-3">
        <span className="text-base leading-5">{s.icon}</span>
        <div>
          {title && <p className={cn('text-sm font-semibold mb-0.5', s.title)}>{title}</p>}
          <div className={cn('text-sm', s.body)}>{children}</div>
        </div>
      </div>
    </div>
  );
}

// ── Spinner ───────────────────────────────────────────────────────────────
export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-8 w-8' };
  return <span className={cn('animate-spin border-2 border-brand-600 border-t-transparent rounded-full inline-block', sizes[size])} />;
}

// ── Empty state ───────────────────────────────────────────────────────────
export function EmptyState({ icon, title, description, action }: { icon?: string; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && <span className="text-4xl mb-3">{icon}</span>}
      <h3 className="text-base font-semibold text-gray-900 mb-1">{title}</h3>
      {description && <p className="text-sm text-gray-500 max-w-xs mb-4">{description}</p>}
      {action}
    </div>
  );
}

// ── Tabs ──────────────────────────────────────────────────────────────────
export function Tabs({ tabs, active, onChange }: { tabs: { id: string; label: string; count?: number }[]; active: string; onChange: (id: string) => void }) {
  return (
    <div className="flex gap-1 border-b border-gray-200 mb-5">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            'px-4 py-2.5 text-sm font-medium rounded-t-md border-b-2 -mb-px transition-colors',
            active === tab.id
              ? 'border-brand-600 text-brand-700 bg-brand-50/40'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          )}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className={cn('ml-1.5 px-1.5 py-0.5 rounded text-xs', active === tab.id ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-600')}>
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ── Stat row ──────────────────────────────────────────────────────────────
export function StatRow({ stats }: { stats: { label: string; value: string | number; color?: string }[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {stats.map((s, i) => (
        <div key={i} className="bg-gray-50 rounded-lg p-3 text-center">
          <div className={cn('text-xl font-bold font-display', s.color || 'text-gray-900')}>{s.value}</div>
          <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

// ── Progress bar ─────────────────────────────────────────────────────────
export function ProgressBar({ value, max = 100, color = 'blue', label }: { value: number; max?: number; color?: 'blue' | 'teal' | 'green' | 'amber'; label?: string }) {
  const pct = Math.min(100, (value / max) * 100);
  const colors = { blue: 'bg-brand-500', teal: 'bg-teal-500', green: 'bg-green-500', amber: 'bg-amber-500' };
  return (
    <div className="w-full">
      {label && <div className="flex justify-between text-xs text-gray-500 mb-1"><span>{label}</span><span>{value}</span></div>}
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', colors[color])} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ── Toggle ────────────────────────────────────────────────────────────────
export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn('relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1', checked ? 'bg-brand-600' : 'bg-gray-200')}
      >
        <span className={cn('inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform', checked ? 'translate-x-4' : 'translate-x-1')} />
      </button>
      {label && <span className="text-sm text-gray-700">{label}</span>}
    </label>
  );
}
