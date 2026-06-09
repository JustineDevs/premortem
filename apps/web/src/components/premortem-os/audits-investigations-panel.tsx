'use client';

import { useState } from 'react';
import { Clock, PanelLeftClose, PanelLeftOpen } from 'lucide-react';

import type { AuditRun } from '@/lib/premortem-os/types';

type AuditsInvestigationsPanelProps = {
  audits: AuditRun[];
  selectedAuditId: string;
  onSelectAudit: (auditId: string) => void;
};

export function AuditsInvestigationsPanel({
  audits,
  selectedAuditId,
  onSelectAudit
}: AuditsInvestigationsPanelProps) {
  const [isOpen, setIsOpen] = useState(true);

  if (!isOpen) {
    return (
      <div className="relative shrink-0 h-full flex items-stretch border-r border-[#D8D2C8]">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="flex flex-col items-center justify-center gap-1 w-10 bg-[#FAF8F5] border-0 border-r border-[#D8D2C8] text-[#5C6560] hover:bg-[#F2EFF6] hover:text-[#1E2522] transition-colors cursor-pointer"
          aria-label="Show investigations log"
          title="Show investigations log"
        >
          <PanelLeftOpen size={16} />
          <span className="text-[8px] font-mono uppercase tracking-wider [writing-mode:vertical-rl] rotate-180">
            Audits
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-80 bg-[#FAF8F5] border-r border-[#D8D2C8] h-full flex flex-col shrink-0 shadow-[inset_-1px_0_0_#EAE6DF]">
      <div className="p-4 border-b border-[#EAE6DF]">
        <span className="text-[9px] uppercase tracking-widest font-mono text-[#8A958F] block">
          Investigations Log Check
        </span>
        <h3 className="text-xs font-bold uppercase text-[#1C1D1B] font-display mt-0.5">Audit Targets</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2 pb-14">
        {audits.map((audit) => {
          const isSelected = audit.id === selectedAuditId;
          const openRisks =
            audit.findings?.filter(
              (finding) =>
                finding.status !== 'RESOLVED' && finding.status !== 'DISMISSED' && !finding.mergedIntoId
            ).length || 0;

          return (
            <button
              key={audit.id}
              type="button"
              onClick={() => onSelectAudit(audit.id)}
              className={`w-full text-left p-3 rounded border text-xs font-medium cursor-pointer transition-all ${
                isSelected
                  ? 'bg-white border-emerald-950 shadow-sm relative z-10'
                  : 'bg-[#FDFDFD] border-[#EAE6DF] hover:bg-[#FAF8F5]'
              }`}
            >
              <div className="flex justify-between items-start gap-1">
                <span className="font-semibold text-[#1C1D1B] truncate font-display max-w-[150px]">
                  {audit.projectName}
                </span>
                <span
                  className={`text-[9px] px-1.5 py-0.5 rounded font-bold font-mono ${
                    audit.score >= 85
                      ? 'bg-emerald-50 text-emerald-700'
                      : audit.score >= 60
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-rose-50 text-rose-700'
                  }`}
                >
                  {audit.score}/100
                </span>
              </div>

              <div className="flex justify-between items-center mt-3 font-mono text-[9px] text-[#717A75]">
                <div className="flex items-center gap-1">
                  <Clock size={10} />
                  <span>{new Date(audit.date).toLocaleDateString()}</span>
                </div>
                <span className="font-bold text-rose-600">{openRisks} open risks</span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="absolute bottom-0 right-0 left-0 p-3 border-t border-[#EAE6DF] bg-[#FAF8F5]/95 flex justify-end">
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="inline-flex items-center justify-center border-0 bg-transparent p-1.5 rounded text-[#5C6560] hover:text-[#1E2522] hover:bg-[#F2EFF6] transition-colors cursor-pointer"
          aria-label="Hide investigations log"
          title="Hide investigations log"
        >
          <PanelLeftClose size={16} />
        </button>
      </div>
    </div>
  );
}
