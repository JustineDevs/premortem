'use client';

import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OsEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

export function OsEmptyState({
  icon: Icon,
  title,
  description,
  action,
  className
}: OsEmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-dashed border-[#EAE6DF] bg-[#FAF8F5] p-10 text-center',
        className
      )}
    >
      <Icon className="mb-3 text-[#8A958F]" size={28} aria-hidden />
      <h3 className="font-display text-sm font-semibold text-[#1E2522]">{title}</h3>
      <p className="mt-1 max-w-md text-xs leading-relaxed text-[#5C6560]">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
