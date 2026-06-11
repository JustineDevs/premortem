'use client';

import { cn } from '@/lib/utils';

export interface OsStep {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'done' | 'error';
}

export function OsStepper({ steps }: { steps: OsStep[] }) {
  return (
    <ol className="flex flex-wrap items-center gap-2" aria-label="Progress">
      {steps.map((step, index) => (
        <li key={step.id} className="flex items-center gap-2">
          <span
            className={cn(
              'flex h-6 min-w-[1.5rem] items-center justify-center rounded-full px-1.5 font-mono text-[9px] font-bold uppercase',
              step.status === 'done' && 'bg-emerald-100 text-emerald-800',
              step.status === 'active' && 'bg-amber-100 text-amber-800 animate-pulse',
              step.status === 'error' && 'bg-rose-100 text-rose-800',
              step.status === 'pending' && 'bg-zinc-100 text-zinc-600'
            )}
          >
            {index + 1}
          </span>
          <span
            className={cn(
              'text-[10px] font-mono font-semibold uppercase tracking-wide',
              step.status === 'active' ? 'text-[#1E2522]' : 'text-[#5C6560]'
            )}
          >
            {step.label}
          </span>
          {index < steps.length - 1 ? (
            <span className="text-[#CDC7BD]" aria-hidden>
              →
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
