'use client';
import { useEffect, useState } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button, Input, Alert } from '@/components/ui';
import { SluShield } from '@/components/branding/slu-shield';

export default function LoginPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session) {
      router.replace('/dashboard');
    }
  }, [router, session]);

  if (status === 'loading' || session) {
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    const result = await signIn('credentials', { email, password, redirect: false });
    setLoading(false);
    if (result?.ok) router.push('/dashboard');
    else if (!result?.error || result.error === 'CredentialsSignin') {
      setError('Invalid email or password.');
    } else if (process.env.NODE_ENV === 'development') {
      setError('Sign-in failed due to app setup. Check .env.local, run db:push, and run db:seed.');
    } else {
      setError('Sign-in is temporarily unavailable.');
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-900 via-brand-800 to-teal-900 flex items-center justify-center px-4 py-6 sm:py-8">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-5 pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '32px 32px' }} />

      <div className="relative w-full max-w-sm">
        {/* Logo card */}
        <div className="mb-5 text-center sm:mb-6">
          <div className="mb-3 inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-white/12 p-3 shadow-lg backdrop-blur border border-white/20 sm:mb-4 sm:h-24 sm:w-24">
            <SluShield className="w-full h-full drop-shadow-sm" />
          </div>
          <h1 className="text-xl font-bold font-display text-white sm:text-2xl">AHEAD Research Tracker</h1>
          <p className="mt-1 text-sm text-brand-200">Saint Louis University</p>
        </div>

        {/* Login form */}
        <div className="rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
          <h2 className="mb-1 text-lg font-semibold text-gray-900">Sign in to your account</h2>
          <p className="mb-5 text-sm text-gray-500 sm:mb-6">Use your SLU research portal credentials</p>

          {error && <div className="mb-4"><Alert type="error">{error}</Alert></div>}

          <form onSubmit={handleSubmit} className="space-y-3.5 sm:space-y-4">
            <Input
              label="Email address"
              id="email" type="email" required autoComplete="email"
              value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@slu.edu"
            />
            <Input
              label="Password"
              id="password" type="password" required autoComplete="current-password"
              value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
            />
            <Button type="submit" className="w-full" loading={loading}>
              Sign In
            </Button>
          </form>

          {/* Demo credentials */}
          <div className="mt-5 border-t border-gray-100 pt-4 sm:mt-6 sm:pt-5">
            <p className="mb-2.5 text-xs font-medium text-gray-400 uppercase tracking-wide sm:mb-3">Demo credentials</p>
            <div className="space-y-1.5">
              {[
                { label: 'Admin', email: 'admin@slu.edu', pwd: 'admin123' },
                { label: 'Analyst', email: 'analyst@slu.edu', pwd: 'analyst123' },
                { label: 'Viewer', email: 'viewer@slu.edu', pwd: 'viewer123' },
              ].map(c => (
                <button key={c.label} type="button"
                  onClick={() => { setEmail(c.email); setPassword(c.pwd); }}
                  className="group flex w-full items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-left transition-colors hover:border-brand-200 hover:bg-brand-50 sm:py-2"
                >
                  <span className="text-xs font-medium text-gray-700 group-hover:text-brand-700">{c.label}</span>
                  <span className="text-xs text-gray-400 font-mono">{c.email}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-brand-300 sm:mt-5">
          AHEAD & HCOR Departments · Internal Use Only
        </p>
      </div>
    </div>
  );
}
