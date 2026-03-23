'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { signOut, useSession } from 'next-auth/react';
import { ReactNode, useState } from 'react';
import { SluShield } from '@/components/branding/slu-shield';

const NAV = [
  { href: '/dashboard',      label: 'Dashboard',       icon: '⬡',  exact: true },
  { href: '/researchers',    label: 'Researchers',      icon: '👥' },
  { href: '/publications',   label: 'Publications',     icon: '📄' },
  { href: '/analytics',      label: 'Analytics',        icon: '📊' },
  { href: '/collaborations', label: 'Collaborations',   icon: '🕸' },
  { href: '/reports',        label: 'Reports & Export', icon: '📋' },
];

const ADMIN_NAV = [
  { href: '/admin',              label: 'Overview',       icon: '🛡' },
  { href: '/admin/researchers',  label: 'Manage Roster',  icon: '👤' },
  { href: '/admin/sources',      label: 'Data Sources',   icon: '🔌' },
  { href: '/admin/sync',         label: 'Sync Jobs',      icon: '🔄' },
  { href: '/admin/journals',     label: 'Journal IF',     icon: '📰' },
];

function NavItem({ href, label, icon, exact }: { href: string; label: string; icon: string; exact?: boolean }) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname.startsWith(href);
  return (
    <Link href={href} className={cn(
      'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-all',
      active
        ? 'bg-brand-50 text-brand-700 font-semibold'
        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
    )}>
      <span className="text-base w-5 text-center">{icon}</span>
      {label}
      {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-500" />}
    </Link>
  );
}

export function Sidebar() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === 'ADMIN';
  const isAnalyst = (session?.user as any)?.role === 'ANALYST';

  return (
    <aside className="fixed inset-y-0 left-0 w-56 bg-white border-r border-gray-200 flex flex-col z-30 shadow-sm">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <SluShield className="w-8 h-12 flex-shrink-0" />
          <div className="min-w-0">
            <div className="text-sm font-bold text-gray-900 leading-tight">AHEAD Tracker</div>
            <div className="text-[10px] text-gray-400 leading-tight truncate">Research Output System</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        <p className="px-3 pt-1 pb-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Main</p>
        {NAV.map(n => <NavItem key={n.href} {...n} />)}

        {(isAdmin || isAnalyst) && (
          <>
            <p className="px-3 pt-4 pb-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Admin</p>
            {ADMIN_NAV.map(n => <NavItem key={n.href} {...n} />)}
          </>
        )}
      </nav>

      {/* User */}
      <div className="px-3 py-3 border-t border-gray-100">
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md">
          <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
            <span className="text-brand-700 text-xs font-bold">
              {session?.user?.name?.[0]?.toUpperCase() || 'U'}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-gray-900 truncate">{session?.user?.name || 'User'}</p>
            <p className="text-[10px] text-gray-400 capitalize">{(session?.user as any)?.role?.toLowerCase() || 'viewer'}</p>
          </div>
          <button onClick={() => signOut({ callbackUrl: '/login' })} className="text-gray-400 hover:text-gray-600 text-sm" title="Sign out">⏏</button>
        </div>
      </div>
    </aside>
  );
}

export function TopBar({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <header className="bg-white border-b border-gray-200 px-6 py-3.5 flex items-center justify-between sticky top-0 z-20 shadow-sm">
      <div>
        <h1 className="text-base font-bold text-gray-900">{title}</h1>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}

export function PageLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="pl-56 flex-1 flex flex-col min-w-0">
        {children}
      </div>
    </div>
  );
}

export function PageContent({ children, className }: { children: ReactNode; className?: string }) {
  return <main className={cn('flex-1 p-6 space-y-5 max-w-screen-2xl', className)}>{children}</main>;
}
