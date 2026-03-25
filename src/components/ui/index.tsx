'use client';

import { cn } from '@/lib/utils';
import { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes } from 'react';

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center border border-brand-200 bg-brand-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-brand-800',
        className,
      )}
    >
      {children}
    </span>
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center whitespace-nowrap border font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:cursor-not-allowed disabled:opacity-60';
  const variants = {
    primary: 'border-brand-700 bg-brand-700 text-white hover:bg-brand-800 hover:border-brand-800',
    secondary: 'border-grand-900 bg-grand-900 text-white hover:bg-grand-800 hover:border-grand-800',
    outline: 'border-brand-700 bg-white text-brand-700 hover:bg-brand-50',
    ghost: 'border-transparent bg-transparent text-brand-700 hover:bg-brand-50',
    danger: 'border-bronze-700 bg-white text-bronze-700 hover:bg-bronze-50',
  };
  const sizes = {
    xs: 'px-2.5 py-1 text-xs',
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-2.5 text-sm',
  };

  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <span
          className={cn(
            'mr-2 inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent',
            variant === 'primary' || variant === 'secondary' ? 'text-white' : 'text-current',
          )}
        />
      )}
      {children}
    </button>
  );
}

export function Card({
  children,
  className,
  padding = true,
}: {
  children: ReactNode;
  className?: string;
  padding?: boolean;
}) {
  return <div className={cn('border border-gray-300 bg-white shadow-card', padding && 'p-5', className)}>{children}</div>;
}

export function CardHeader({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('mb-4 flex flex-col items-start justify-between gap-3 border-b border-brand-100 pb-3 sm:flex-row sm:items-center', className)}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h3 className={cn('text-lg font-bold uppercase tracking-[0.08em] text-brand-900', className)}>{children}</h3>;
}

export function KpiCard({
  label,
  value,
  sub,
  delta,
  icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  delta?: string;
  icon?: ReactNode;
  color?: 'blue' | 'teal' | 'green' | 'amber' | 'red';
}) {
  return (
    <div className="border border-brand-200 bg-white p-5 shadow-card">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-3 h-1.5 w-12 bg-brand-600" />
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-800">{label}</p>
          <p className="mt-2 text-[2.1rem] font-bold leading-none text-grand-900">{value}</p>
          {sub && <p className="mt-2 text-sm font-medium text-gray-700">{sub}</p>}
          {delta && <p className="mt-2 text-sm font-semibold text-brand-700">{delta}</p>}
        </div>
        {icon && (
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center border border-brand-200 bg-brand-50 text-xl font-bold text-brand-700">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export function Input({ label, error, helperText, className, id, ...props }: InputProps) {
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-gray-900">
          {label}
        </label>
      )}
      <input
        id={id}
        className={cn(
          'block w-full border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-900 placeholder-gray-400 outline-none transition-colors focus:border-brand-700 focus:ring-2 focus:ring-brand-100 disabled:bg-gray-100 disabled:text-gray-500',
          error && 'border-red-500 focus:border-red-500 focus:ring-red-100',
          className,
        )}
        {...props}
      />
      {error && <p className="mt-1.5 text-xs text-red-700">{error}</p>}
      {helperText && !error && <p className="mt-1.5 text-xs text-gray-500">{helperText}</p>}
    </div>
  );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export function Select({ label, options, placeholder, className, id, ...props }: SelectProps) {
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-gray-900">
          {label}
        </label>
      )}
      <select
        id={id}
        className={cn(
          'block w-full border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-900 outline-none transition-colors focus:border-brand-700 focus:ring-2 focus:ring-brand-100',
          className,
        )}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function Alert({
  type = 'info',
  title,
  children,
}: {
  type?: 'info' | 'warning' | 'error' | 'success';
  title?: string;
  children: ReactNode;
}) {
  const styles = {
    info: 'border-l-brand-700 bg-brand-50/40',
    success: 'border-l-brand-700 bg-brand-50/40',
    warning: 'border-l-bronze-700 bg-bronze-50/40',
    error: 'border-l-red-700 bg-red-50/40',
  };

  return (
    <div className={cn('border border-gray-300 border-l-4 px-4 py-3 shadow-card', styles[type])}>
      {title && <p className="mb-1 text-sm font-bold text-gray-900">{title}</p>}
      <div className="text-sm font-medium text-gray-700">{children}</div>
    </div>
  );
}

export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-8 w-8' };
  return <span className={cn('inline-block animate-spin rounded-full border-2 border-brand-700 border-t-transparent', sizes[size])} />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse bg-brand-50', className)} />;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center border border-dashed border-brand-200 bg-white px-6 py-16 text-center">
      {icon && <div className="mb-3 text-sm font-bold uppercase tracking-[0.12em] text-brand-700">{icon}</div>}
      <h3 className="text-lg font-bold uppercase tracking-[0.08em] text-brand-900">{title}</h3>
      {description && <p className="mt-2 max-w-md text-sm font-medium text-gray-700">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: string; label: string; count?: number }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="-mx-4 mb-5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="flex min-w-max gap-6 border-b border-brand-100">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              '-mb-px border-b-2 pb-3 text-sm font-semibold transition-colors',
              active === tab.id
                ? 'border-brand-700 text-brand-700'
                : 'border-transparent text-gray-500 hover:border-brand-200 hover:text-brand-800',
            )}
          >
            {tab.label}
            {tab.count !== undefined && <span className="ml-1.5 text-xs text-gray-500">{tab.count}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

export function StatRow({ stats }: { stats: { label: string; value: string | number; color?: string }[] }) {
  return (
    <div className="grid grid-cols-2 gap-px border border-brand-100 bg-brand-100 sm:grid-cols-4">
      {stats.map((stat, index) => (
        <div key={index} className="bg-white px-4 py-3 text-center">
          <div className={cn('text-xl font-bold text-grand-900', stat.color || 'text-grand-900')}>{stat.value}</div>
          <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-brand-700">{stat.label}</div>
        </div>
      ))}
    </div>
  );
}

export function ProgressBar({
  value,
  max = 100,
  color = 'blue',
  label,
}: {
  value: number;
  max?: number;
  color?: 'blue' | 'teal' | 'green' | 'amber';
  label?: string;
}) {
  const pct = Math.min(100, (value / max) * 100);
  const colors = {
    blue: 'bg-brand-700',
    teal: 'bg-grand-900',
    green: 'bg-brand-500',
    amber: 'bg-bronze-600',
  };

  return (
    <div className="w-full">
      {label && (
        <div className="mb-1 flex justify-between text-xs text-gray-500">
          <span className="font-semibold">{label}</span>
          <span className="font-semibold">{value}</span>
        </div>
      )}
      <div className="h-2 overflow-hidden bg-brand-50">
        <div className={cn('h-full transition-all', colors[color])} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  className,
  labelClassName,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  className?: string;
  labelClassName?: string;
}) {
  return (
    <label className={cn('flex cursor-pointer items-center gap-3 select-none', className)}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-brand-200',
          checked ? 'border-brand-700 bg-brand-700' : 'border-gray-300 bg-gray-200',
        )}
      >
        <span
          className={cn(
            'inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
            checked ? 'translate-x-5' : 'translate-x-1',
          )}
        />
      </button>
      {label && <span className={cn('text-sm font-semibold text-gray-800', labelClassName)}>{label}</span>}
    </label>
  );
}
