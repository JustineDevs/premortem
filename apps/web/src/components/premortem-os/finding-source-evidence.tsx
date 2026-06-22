'use client';

import React from 'react';
import { FileCode } from 'lucide-react';
import { formatSourceCodeEvidence } from '@premortem/domain';

import type { Finding } from '@/lib/premortem-os/types';

interface FindingSourceEvidenceProps {
  finding: Pick<Finding, 'evidence' | 'evidenceRefs' | 'filepath' | 'line' | 'trace' | 'suggestedPatchCode'>;
  title?: string;
  compact?: boolean;
  className?: string;
}

export function FindingSourceEvidence({
  finding,
  title = 'Source code evidence',
  compact = false,
  className = ''
}: FindingSourceEvidenceProps) {
  const traceWithSnippets = finding.trace.filter((step) => step.codeSnippet?.trim());
  const hasTraceSnippets = traceWithSnippets.length > 0;
  const evidenceText = finding.evidenceRefs?.length
    ? formatSourceCodeEvidence(finding.evidenceRefs)
    : finding.evidence?.trim() ?? '';
  const hasEvidenceText = Boolean(evidenceText);
  const hasSuggestedPatch = Boolean(finding.suggestedPatchCode?.trim());

  if (!hasEvidenceText && !hasTraceSnippets && !hasSuggestedPatch) {
    return (
      <div className={`rounded border border-dashed border-zinc-300 bg-zinc-50 p-3 ${className}`}>
        <p className="font-mono text-[9px] uppercase tracking-wide text-zinc-500">{title}</p>
        <p className="mt-1 text-[10px] text-zinc-600">
          No source snippets were resolved for this finding. Re-run the audit with an active GitLab
          connection to fetch repository file content.
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between font-mono text-[8.5px] text-zinc-500">
        <span className="flex items-center gap-1 font-bold uppercase text-emerald-800">
          <FileCode size={compact ? 10 : 12} aria-hidden />
          {title}
        </span>
        <span className="text-zinc-500">
          {finding.filepath}:{finding.line}
        </span>
      </div>

      {hasEvidenceText && (
        <div className="overflow-hidden rounded border border-neutral-800 bg-neutral-950 shadow-inner">
          {!compact && (
            <div className="flex items-center gap-1.5 border-b border-neutral-800 bg-neutral-950/80 p-2 font-mono text-[9px] text-zinc-500">
              <span className="h-2.5 w-2.5 rounded-full bg-[#E15A5A]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#E88B5D]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#7AB355]" />
              <span className="ml-1 select-none font-bold text-[#A6BCB4]">Violation segment</span>
            </div>
          )}
          <pre className="overflow-x-auto p-3 font-mono text-[10px] leading-relaxed text-zinc-300 select-text">
            <code>{evidenceText}</code>
          </pre>
        </div>
      )}

      {hasSuggestedPatch && (
        <div className="overflow-hidden rounded border border-emerald-900/30 bg-emerald-950 shadow-inner">
          {!compact && (
            <div className="flex items-center gap-1.5 border-b border-emerald-900/40 bg-emerald-950/80 p-2 font-mono text-[9px] text-emerald-200">
              <span className="h-2.5 w-2.5 rounded-full bg-[#E15A5A]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#E88B5D]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#7AB355]" />
              <span className="ml-1 select-none font-bold text-[#CDE2D3]">Recommended code DNA</span>
            </div>
          )}
          <pre className="overflow-x-auto p-3 font-mono text-[10px] leading-relaxed text-emerald-50 select-text">
            <code>{finding.suggestedPatchCode}</code>
          </pre>
        </div>
      )}

      {hasTraceSnippets && (
        <div className="space-y-2">
          {traceWithSnippets.map((step) => (
            <div key={`${step.step}-${step.location}`} className="overflow-hidden rounded border border-neutral-800">
              <div className="border-b border-neutral-800 bg-neutral-900 px-2 py-1 font-mono text-[8.5px] uppercase text-zinc-400">
                Step {step.step} · {step.location}
              </div>
              <pre className="overflow-x-auto bg-neutral-950 p-2 font-mono text-[9.5px] leading-relaxed text-zinc-300 select-text">
                {step.codeSnippet}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
