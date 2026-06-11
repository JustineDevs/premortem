'use client';

import { cn } from '@/lib/utils';

export function OsSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('animate-pulse rounded bg-[#EAE6DF]/80', className)}
      aria-hidden
    />
  );
}

export function OsTableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <OsSkeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}
