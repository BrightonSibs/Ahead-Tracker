'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui';

function ChartSkeleton({ heightClass }: { heightClass: string }) {
  return (
    <div className="space-y-3">
      <Skeleton className={`w-full ${heightClass}`} />
    </div>
  );
}

export const CitationTrendChart = dynamic(
  () => import('./index').then(module => module.CitationTrendChart),
  { ssr: false, loading: () => <ChartSkeleton heightClass="h-[280px]" /> },
);

export const PublicationBarChart = dynamic(
  () => import('./index').then(module => module.PublicationBarChart),
  { ssr: false, loading: () => <ChartSkeleton heightClass="h-[260px]" /> },
);

export const HIndexChart = dynamic(
  () => import('./index').then(module => module.HIndexChart),
  { ssr: false, loading: () => <ChartSkeleton heightClass="h-[280px]" /> },
);

export const DeptPieChart = dynamic(
  () => import('./index').then(module => module.DeptPieChart),
  { ssr: false, loading: () => <ChartSkeleton heightClass="h-[260px]" /> },
);

export const ImpactFactorChart = dynamic(
  () => import('./index').then(module => module.ImpactFactorChart),
  { ssr: false, loading: () => <ChartSkeleton heightClass="h-[220px]" /> },
);

export const SpecialtyBarChart = dynamic(
  () => import('./index').then(module => module.SpecialtyBarChart),
  { ssr: false, loading: () => <ChartSkeleton heightClass="h-[280px]" /> },
);
