'use client';

import { useEffect, useState } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button, Input, Alert, Spinner } from '@/components/ui';
import { SluStackedWordmark } from '@/components/branding/slu-stacked-wordmark';
import { warmJsonCache } from '@/lib/client-cache';

export default function LoginPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    router.prefetch('/dashboard');
    warmJsonCache([
      '/api/analytics?type=dashboard&sluOnly=false',
      '/api/analytics?type=full&sluOnly=false',
    ], 45_000);
  }, [router]);

  useEffect(() => {
    if (session) {
      setRedirecting(true);
      router.replace('/dashboard');
      router.refresh();
    }
  }, [router, session]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await signIn('credentials', { email, password, redirect: false });

    setLoading(false);

    if (result?.ok) {
      setRedirecting(true);
      router.replace(result.url || '/dashboard');
      router.refresh();
    } else if (!result?.error || result.error === 'CredentialsSignin') {
      setError('Invalid email or password.');
    } else if (process.env.NODE_ENV === 'development') {
      setError('Sign-in failed due to app setup. Check .env.local, run db:push, and run db:seed.');
    } else {
      setError('Sign-in is temporarily unavailable.');
    }

    if (!result?.ok) {
      setRedirecting(false);
    }
  }

  const authPending = status === 'loading' || redirecting || !!session;

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-700 px-4 py-5">
      <div className="w-full max-w-[24rem]">
        <div className="mb-3 border border-brand-200 bg-white px-4 py-3.5 text-center shadow-card-lg">
          <SluStackedWordmark compact />
          <div className="mt-3 border-t border-brand-100 pt-2.5">
            <h1 className="text-sm font-bold uppercase tracking-[0.08em] text-brand-900">AHEAD Research Output System</h1>
            <p className="mt-1 text-xs font-medium text-gray-700">Research publication and citation tracking platform</p>
          </div>
        </div>

        <div className="border border-brand-200 bg-white p-4 shadow-card-lg sm:p-5">
          <h2 className="mb-1 text-lg font-bold text-brand-900">Sign in to your account</h2>
          <p className="mb-4 text-sm font-medium text-gray-700">Use your SLU research portal credentials</p>

          {authPending && (
            <div className="mb-4 flex items-center gap-3 border border-brand-200 bg-brand-50 px-3 py-2.5 text-sm font-semibold text-brand-800">
              <Spinner size="sm" />
              <span>{status === 'loading' ? 'Checking your session...' : 'Opening your dashboard...'}</span>
            </div>
          )}

          {error && (
            <div className="mb-4">
              <Alert type="error">{error}</Alert>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <Input
              label="Email address"
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@slu.edu"
            />
            <Input
              label="Password"
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="********"
            />
            <Button type="submit" className="w-full" loading={loading} disabled={authPending}>
              Sign In
            </Button>
          </form>

          <div className="mt-4 border-t border-brand-100 pt-3.5">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-brand-700">Demo credentials</p>
            <div className="space-y-1">
              {[
                { label: 'Admin', email: 'admin@slu.edu', pwd: 'admin123' },
                { label: 'Analyst', email: 'analyst@slu.edu', pwd: 'analyst123' },
                { label: 'Viewer', email: 'viewer@slu.edu', pwd: 'viewer123' },
              ].map(credential => (
                <button
                  key={credential.label}
                  type="button"
                  disabled={authPending}
                  onClick={() => {
                    setEmail(credential.email);
                    setPassword(credential.pwd);
                  }}
                  className="group flex w-full items-center justify-between border border-brand-100 bg-white px-3 py-1.5 text-left transition-colors hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="text-xs font-semibold text-gray-900 group-hover:text-brand-700">{credential.label}</span>
                  <span className="font-mono text-xs font-semibold text-gray-600">{credential.email}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="mt-3 text-center font-display text-[11px] font-bold uppercase tracking-[0.14em] text-brand-100">
          SLU research departments | Internal Use Only
        </p>
      </div>
    </div>
  );
}
