'use client';

import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface OsTabItem {
  id: string;
  label: string;
  icon?: LucideIcon;
}

interface OsTabsProps {
  tabs: OsTabItem[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
  ariaLabel?: string;
}

export function OsTabs({
  tabs,
  activeId,
  onChange,
  className,
  ariaLabel = 'Section tabs'
}: OsTabsProps) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn('flex gap-2 border-b border-[#EAE6DF]/60', className)}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const selected = activeId === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => {
              const idx = tabs.findIndex((t) => t.id === tab.id);
              if (event.key === 'ArrowRight') {
                event.preventDefault();
                onChange(tabs[(idx + 1) % tabs.length].id);
              }
              if (event.key === 'ArrowLeft') {
                event.preventDefault();
                onChange(tabs[(idx - 1 + tabs.length) % tabs.length].id);
              }
            }}
            className={cn(
              'flex cursor-pointer select-none items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-950 focus-visible:ring-offset-2',
              selected
                ? 'border-emerald-950 font-bold text-emerald-950'
                : 'border-transparent text-[#5C6560] hover:text-[#1E2522]'
            )}
          >
            {Icon ? <Icon size={13} aria-hidden /> : null}
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
