'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { Button, Card, CardHeader, CardTitle } from '@/components/ui';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>Something Went Wrong</CardTitle>
        </CardHeader>
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            The app hit an unexpected error. Your data was not changed, and you can retry safely.
          </p>
          {error.digest && (
            <p className="text-xs font-mono text-gray-400">Reference: {error.digest}</p>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button onClick={reset}>Try again</Button>
            <Link href="/dashboard">
              <Button variant="outline">Back to dashboard</Button>
            </Link>
            <Link href="/login">
              <Button variant="ghost">Go to sign in</Button>
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
