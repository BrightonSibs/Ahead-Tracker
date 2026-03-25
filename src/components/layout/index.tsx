'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { ReactNode, useEffect, useState } from 'react';
import { SluShield } from '@/components/branding/slu-shield';
import { warmJsonCache } from '@/lib/client-cache';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: 'D', exact: true },
  { href: '/researchers', label: 'Researchers', icon: 'R' },
  { href: '/publications', label: 'Publications', icon: 'P' },
  { href: '/analytics', label: 'Analytics', icon: 'A' },
  { href: '/collaborations', label: 'Collaborations', icon: 'C' },
  { href: '/reports', label: 'Reports & Export', icon: 'E' },
];

const ADMIN_NAV = [
  { href: '/admin', label: 'Overview', icon: 'O' },
  { href: '/admin/departments', label: 'Departments', icon: 'T' },
  { href: '/admin/researchers', label: 'Manage Roster', icon: 'M' },
  { href: '/admin/sources', label: 'Data Sources', icon: 'D' },
  { href: '/admin/sync', label: 'Sync Jobs', icon: 'S' },
  { href: '/admin/journals', label: 'Journal IF', icon: 'J' },
];

const NAV_DATA_PREFETCH: Record<string, string[]> = {
  '/dashboard': ['/api/analytics?type=dashboard&sluOnly=false', '/api/analytics?type=full&sluOnly=false'],
  '/researchers': ['/api/researchers'],
  '/publications': ['/api/researchers', '/api/publications'],
  '/analytics': ['/api/analytics?type=dashboard', '/api/analytics?type=full'],
  '/collaborations': ['/api/collaborations'],
  '/reports': ['/api/researchers'],
  '/admin': ['/api/analytics?type=dashboard', '/api/admin/sync'],
  '/admin/departments': ['/api/departments'],
  '/admin/researchers': ['/api/researchers'],
  '/admin/sync': ['/api/admin/sync', '/api/admin/sync/config'],
  '/admin/journals': ['/api/journals'],
};

function NavItem({
  href,
  label,
  icon,
  exact,
  onNavigate,
  onStartNavigate,
}: {
  href: string;
  label: string;
  icon: string;
  exact?: boolean;
  onNavigate?: () => void;
  onStartNavigate?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const active = exact ? pathname === href : pathname.startsWith(href);

  const warmRoute = () => {
    router.prefetch(href);
    warmJsonCache(NAV_DATA_PREFETCH[href] || []);
  };

  return (
    <Link
      href={href}
      prefetch
      onClick={() => {
        onStartNavigate?.();
        onNavigate?.();
      }}
      onMouseEnter={warmRoute}
      onMouseDown={warmRoute}
      onFocus={warmRoute}
      onTouchStart={warmRoute}
      className={cn(
        'flex items-center gap-3 border-l-2 px-3 py-2 text-sm font-medium transition-colors',
        active
          ? 'border-l-brand-100 bg-brand-800 text-white'
          : 'border-l-transparent text-brand-100 hover:border-l-brand-200 hover:bg-brand-800 hover:text-white',
      )}
    >
      <span className={cn('flex h-5 w-5 items-center justify-center text-[10px] font-semibold', active ? 'text-white' : 'text-brand-100')}>
        {icon}
      </span>
      <span className="truncate">{label}</span>
    </Link>
  );
}

function SidebarContent({
  onNavigate,
  onStartNavigate,
}: {
  onNavigate?: () => void;
  onStartNavigate?: () => void;
}) {
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === 'ADMIN';
  const isAnalyst = (session?.user as any)?.role === 'ANALYST';

  return (
    <>
      <div className="border-b border-brand-500 px-4 py-5">
        <div className="flex items-start gap-3">
          <SluShield className="h-14 w-9 flex-shrink-0" />
          <div className="min-w-0 space-y-3">
            <SluWordmark />
            <div>
              <div className="font-display text-sm font-semibold uppercase tracking-[0.08em] text-white">AHEAD Research</div>
              <div className="text-xs uppercase tracking-[0.16em] text-brand-100">Output System</div>
            </div>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
        <p className="px-3 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-200">Main</p>
        {NAV.map(item => (
          <NavItem key={item.href} {...item} onNavigate={onNavigate} onStartNavigate={onStartNavigate} />
        ))}

        {(isAdmin || isAnalyst) && (
          <>
            <p className="px-3 pb-2 pt-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-200">Admin</p>
            {ADMIN_NAV.map(item => (
              <NavItem key={item.href} {...item} onNavigate={onNavigate} onStartNavigate={onStartNavigate} />
            ))}
          </>
        )}
      </nav>

      <div data-user-footer className="border-t border-brand-500 px-3 py-3">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{session?.user?.name || 'User'}</p>
            <p className="truncate text-[10px] uppercase tracking-[0.12em] text-brand-200">{(session?.user as any)?.role?.toLowerCase() || 'viewer'}</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="flex-shrink-0 px-2 py-1 text-sm text-brand-100 transition-colors hover:bg-brand-800 hover:text-white"
            title="Sign out"
          >
            Out
          </button>
        </div>
      </div>
    </>
  );
}

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-brand-900 bg-brand-700 md:flex">
      <SidebarContent />
    </aside>
  );
}

function MobileSidebar({
  open,
  onClose,
  onStartNavigate,
}: {
  open: boolean;
  onClose: () => void;
  onStartNavigate?: () => void;
}) {
  return (
    <div className={cn('md:hidden', open ? 'pointer-events-auto' : 'pointer-events-none')}>
      <div
        className={cn(
          'fixed inset-0 z-40 bg-gray-900/40 transition-opacity',
          open ? 'opacity-100' : 'opacity-0',
        )}
        onClick={onClose}
      />
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-72 max-w-[88vw] flex-col border-r border-brand-900 bg-brand-700 transition-transform',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center justify-between border-b border-brand-500 px-4 py-4">
          <div className="flex items-start gap-3">
            <SluShield className="h-12 w-8 flex-shrink-0" />
            <div className="min-w-0">
              <SluWordmark compact />
              <div className="mt-2 text-[11px] uppercase tracking-[0.12em] text-brand-100">AHEAD Research Output System</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="border border-brand-300 px-2 py-1 text-xs font-medium text-white"
          >
            Close
          </button>
        </div>
        <SidebarContent onNavigate={onClose} onStartNavigate={onStartNavigate} />
      </aside>
    </div>
  );
}

function MobileHeader({ onMenu }: { onMenu: () => void }) {
  return (
    <div className="sticky top-0 z-30 border-b border-brand-900 bg-brand-700 px-4 py-3 md:hidden">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <SluShield className="h-10 w-7 flex-shrink-0" />
          <SluWordmark compact />
        </div>
        <button
          onClick={onMenu}
          className="border border-brand-300 px-3 py-2 text-sm font-medium text-white"
        >
          Menu
        </button>
      </div>
    </div>
  );
}

export function TopBar({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <header className="sticky top-[65px] z-20 border-b border-brand-100 bg-white px-4 py-5 md:top-0 md:px-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-brand-900">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-gray-600">{subtitle}</p>}
        </div>
        {actions && <div className="flex w-full flex-wrap items-center gap-2 md:w-auto md:justify-end">{actions}</div>}
      </div>
    </header>
  );
}

export function PageLayout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setNavigating(false);
  }, [pathname]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div
        className={cn(
          'fixed left-0 right-0 top-0 z-[60] h-1 origin-left bg-brand-500 transition-all duration-300',
          navigating ? 'scale-x-100 opacity-100' : 'scale-x-0 opacity-0',
        )}
      />
      <MobileHeader onMenu={() => setMobileOpen(true)} />
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-brand-900 bg-brand-700 md:flex">
        <SidebarContent onStartNavigate={() => setNavigating(true)} />
      </aside>
      <MobileSidebar open={mobileOpen} onClose={() => setMobileOpen(false)} onStartNavigate={() => setNavigating(true)} />
      <div className="flex min-h-screen flex-col md:pl-64">
        {children}
      </div>
    </div>
  );
}

export function PageContent({ children, className }: { children: ReactNode; className?: string }) {
  return <main className={cn('mx-auto flex-1 w-full space-y-5 p-4 md:max-w-screen-2xl md:p-6', className)}>{children}</main>;
}
function SluWordmark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="min-w-0">
      <div className={cn('font-display font-semibold uppercase tracking-[0.12em] text-white', compact ? 'text-sm' : 'text-base')}>
        Saint Louis
      </div>
      <div className={cn('font-display font-semibold uppercase tracking-[0.18em] text-brand-100', compact ? 'text-xs' : 'text-sm')}>
        University
      </div>
    </div>
  );
}
