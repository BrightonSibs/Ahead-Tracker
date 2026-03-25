'use client';

import { Skeleton } from '@/components/ui';

export default function GlobalLoading() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b border-gray-300 bg-white px-6 py-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>

      <main className="mx-auto w-full max-w-screen-2xl space-y-5 p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="border border-gray-300 bg-white p-5">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="mt-3 h-8 w-24" />
              <Skeleton className="mt-2 h-3 w-36" />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="border border-gray-300 bg-white p-5 lg:col-span-2">
            <Skeleton className="h-5 w-52" />
            <Skeleton className="mt-2 h-4 w-80" />
            <Skeleton className="mt-6 h-64 w-full" />
          </div>
          <div className="border border-gray-300 bg-white p-5">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="mt-6 mx-auto h-52 w-52 rounded-full" />
          </div>
        </div>
      </main>
    </div>
  );
}
