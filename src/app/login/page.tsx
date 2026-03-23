'use client';
import { useState } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button, Input, Alert } from '@/components/ui';
import { SluShield } from '@/components/branding/slu-shield';

export default function LoginPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (session) { router.push('/dashboard'); return null; }

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
    <div className="min-h-screen bg-gradient-to-br from-brand-900 via-brand-800 to-teal-900 flex items-center justify-center p-4">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-5 pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '32px 32px' }} />

      <div className="w-full max-w-sm relative">
        {/* Logo card */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-white/12 backdrop-blur border border-white/20 mb-4 shadow-lg p-3">
            <SluShield className="w-full h-full drop-shadow-sm" />
          </div>
          <h1 className="text-2xl font-bold font-display text-white">AHEAD Research Tracker</h1>
          <p className="text-brand-200 text-sm mt-1">Saint Louis University</p>
        </div>

        {/* Login form */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Sign in to your account</h2>
          <p className="text-sm text-gray-500 mb-6">Use your SLU research portal credentials</p>

          {error && <div className="mb-4"><Alert type="error">{error}</Alert></div>}

          <form onSubmit={handleSubmit} className="space-y-4">
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
          <div className="mt-6 pt-5 border-t border-gray-100">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Demo credentials</p>
            <div className="space-y-1.5">
              {[
                { label: 'Admin', email: 'admin@slu.edu', pwd: 'admin123' },
                { label: 'Analyst', email: 'analyst@slu.edu', pwd: 'analyst123' },
                { label: 'Viewer', email: 'viewer@slu.edu', pwd: 'viewer123' },
              ].map(c => (
                <button key={c.label} type="button"
                  onClick={() => { setEmail(c.email); setPassword(c.pwd); }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 hover:bg-brand-50 border border-gray-200 hover:border-brand-200 transition-colors text-left group"
                >
                  <span className="text-xs font-medium text-gray-700 group-hover:text-brand-700">{c.label}</span>
                  <span className="text-xs text-gray-400 font-mono">{c.email}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="text-center text-brand-300 text-xs mt-6">
          AHEAD & HCOR Departments · Internal Use Only
        </p>
      </div>
    </div>
  );
}
