'use client';

import { AlertTriangle, ArrowRight } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { DiagnosticSummary } from '@/lib/diagnostics';

interface OsDiagnosticBannerProps {
  diagnostic: DiagnosticSummary;
  className?: string;
}

export function OsDiagnosticBanner({ diagnostic, className }: OsDiagnosticBannerProps) {
  return (
    <section
      className={cn(
        'rounded-2xl border border-amber-200 bg-amber-50 px-6 py-5 text-[#1E2522] shadow-sm',
        className
      )}
      aria-label={diagnostic.title}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.24em] text-amber-900">
            <AlertTriangle size={14} aria-hidden />
            <span>{diagnostic.title}</span>
          </div>
          <div className="space-y-2 text-sm leading-relaxed text-[#33423A]">
            <p>
              <strong className="font-semibold text-[#1E2522]">Scope:</strong> {diagnostic.scope}
            </p>
            <p>
              <strong className="font-semibold text-[#1E2522]">Likely cause:</strong> {diagnostic.likelyCause}
            </p>
            <p>
              <strong className="font-semibold text-[#1E2522]">Remediation:</strong> {diagnostic.remediation}
            </p>
            {diagnostic.detail ? (
              <p className="rounded-xl border border-amber-200 bg-white px-4 py-3 text-xs text-[#5C6560]">
                {diagnostic.detail}
              </p>
            ) : null}
          </div>
        </div>

        {diagnostic.action ? (
          <a
            href={diagnostic.action.href}
            className="inline-flex items-center gap-2 self-start rounded-full border border-amber-300 bg-white px-4 py-2 text-xs font-semibold text-[#1E2522] shadow-sm transition hover:border-amber-400 hover:bg-amber-100"
          >
            <span>{diagnostic.action.label}</span>
            <ArrowRight size={14} aria-hidden />
          </a>
        ) : null}
      </div>
    </section>
  );
}
