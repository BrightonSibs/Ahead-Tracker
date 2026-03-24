'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { ReactNode, useEffect, useState } from 'react';
import { SluShield } from '@/components/branding/slu-shield';
import { warmJsonCache } from '@/lib/client-cache';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: '[]', exact: true },
  { href: '/researchers', label: 'Researchers', icon: 'R' },
  { href: '/publications', label: 'Publications', icon: 'P' },
  { href: '/analytics', label: 'Analytics', icon: 'A' },
  { href: '/collaborations', label: 'Collaborations', icon: 'C' },
  { href: '/reports', label: 'Reports & Export', icon: 'E' },
];

const ADMIN_NAV = [
  { href: '/admin', label: 'Overview', icon: 'O' },
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
  '/admin/researchers': ['/api/researchers'],
  '/admin/sync': ['/api/admin/sync', '/api/admin/sync/config'],
  '/admin/journals': ['/api/journals'],
};

const SHELL_PREFETCH_ROUTES = [...NAV.map(item => item.href), ...ADMIN_NAV.map(item => item.href)];
const SHELL_PREFETCH_APIS = Array.from(new Set(Object.values(NAV_DATA_PREFETCH).flat()));

function NavItem({
  href,
  label,
  icon,
  exact,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: string;
  exact?: boolean;
  onNavigate?: () => void;
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
      onClick={onNavigate}
      onMouseEnter={warmRoute}
      onMouseDown={warmRoute}
      onFocus={warmRoute}
      onTouchStart={warmRoute}
      className={cn(
        'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-all',
        active ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
      )}
    >
      <span className="flex h-5 w-5 items-center justify-center rounded bg-gray-100 text-[10px] font-semibold text-gray-500">
        {icon}
      </span>
      <span className="truncate">{label}</span>
      {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-brand-500" />}
    </Link>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === 'ADMIN';
  const isAnalyst = (session?.user as any)?.role === 'ANALYST';

  return (
    <>
      <div className="border-b border-gray-100 px-4 py-4">
        <div className="flex items-center gap-2.5">
          <SluShield className="h-12 w-8 flex-shrink-0" />
          <div className="min-w-0">
            <div className="text-sm font-bold leading-tight text-gray-900">AHEAD Tracker</div>
            <div className="truncate text-[10px] leading-tight text-gray-400">Research Output System</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
        <p className="px-3 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Main</p>
        {NAV.map(item => (
          <NavItem key={item.href} {...item} onNavigate={onNavigate} />
        ))}

        {(isAdmin || isAnalyst) && (
          <>
            <p className="px-3 pb-2 pt-4 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Admin</p>
            {ADMIN_NAV.map(item => (
              <NavItem key={item.href} {...item} onNavigate={onNavigate} />
            ))}
          </>
        )}
      </nav>

      <div className="border-t border-gray-100 px-3 py-3">
        <div className="flex items-center justify-between rounded-md px-2 py-1.5">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-gray-900">{session?.user?.name || 'User'}</p>
            <p className="text-[10px] capitalize text-gray-400">{(session?.user as any)?.role?.toLowerCase() || 'viewer'}</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="rounded px-2 py-1 text-sm text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
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
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col border-r border-gray-200 bg-white shadow-sm md:flex">
      <SidebarContent />
    </aside>
  );
}

function MobileSidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
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
          'fixed inset-y-0 left-0 z-50 flex w-72 max-w-[88vw] flex-col border-r border-gray-200 bg-white shadow-xl transition-transform',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-4">
          <div className="flex items-center gap-2.5">
            <SluShield className="h-12 w-8 flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-sm font-bold leading-tight text-gray-900">AHEAD Tracker</div>
              <div className="truncate text-[10px] leading-tight text-gray-400">Research Output System</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded border border-gray-200 px-2 py-1 text-xs font-medium text-gray-600"
          >
            Close
          </button>
        </div>
        <SidebarContent onNavigate={onClose} />
      </aside>
    </div>
  );
}

function MobileHeader({ onMenu }: { onMenu: () => void }) {
  return (
    <div className="sticky top-0 z-30 border-b border-gray-200 bg-white/95 px-4 py-3 backdrop-blur md:hidden">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <SluShield className="h-10 w-7 flex-shrink-0" />
          <div className="min-w-0">
            <div className="text-sm font-bold text-gray-900">AHEAD Tracker</div>
            <div className="truncate text-[10px] text-gray-400">Research Output System</div>
          </div>
        </div>
        <button
          onClick={onMenu}
          className="rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700"
        >
          Menu
        </button>
      </div>
    </div>
  );
}

export function TopBar({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <header className="sticky top-[65px] z-20 border-b border-gray-200 bg-white px-4 py-3.5 shadow-sm md:top-0 md:px-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h1 className="text-base font-bold text-gray-900">{title}</h1>
          {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
        </div>
        {actions && <div className="flex w-full flex-wrap items-center gap-2 md:w-auto md:justify-end">{actions}</div>}
      </div>
    </header>
  );
}

export function PageLayout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      SHELL_PREFETCH_ROUTES.forEach(route => {
        router.prefetch(route);
      });
      warmJsonCache(SHELL_PREFETCH_APIS, 45_000);
    }, 120);

    return () => {
      window.clearTimeout(timer);
    };
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50">
      <MobileHeader onMenu={() => setMobileOpen(true)} />
      <Sidebar />
      <MobileSidebar open={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="flex min-h-screen flex-col md:pl-56">
        {children}
      </div>
    </div>
  );
}

export function PageContent({ children, className }: { children: ReactNode; className?: string }) {
  return <main className={cn('mx-auto flex-1 w-full space-y-5 p-4 md:max-w-screen-2xl md:p-6', className)}>{children}</main>;
}
