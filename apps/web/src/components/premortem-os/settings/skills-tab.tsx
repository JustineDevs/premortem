'use client';

import { useMemo, useState } from 'react';
import { Download, Sparkles, ShieldCheck, TriangleAlert, CheckCircle2, Inbox } from 'lucide-react';
import type { WorkspaceSkillState } from '@premortem/skills';

function formatCoveragePercent(ratio: number) {
  return `${Math.round(Math.max(0, Math.min(1, ratio)) * 100)}%`;
}

function downloadSkillMarkdown(skillId: string, markdown: string) {
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${skillId.replace(/^skill:/, '')}.md`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function SkillsTab({
  skills,
  canManageOrganization,
  onInstallSkill
}: {
  skills: WorkspaceSkillState;
  canManageOrganization: boolean;
  onInstallSkill: (skillId: string) => Promise<void>;
}) {
  const [installingSkillId, setInstallingSkillId] = useState<string | null>(null);

  const coverageReport = skills.coverageReport;
  const draftCount = skills.drafts.length;
  const installedCount = skills.installedSkillIds.length;
  const missingCategories = coverageReport?.missingCategories ?? [];
  const coverageChips = useMemo(
    () =>
      [
        { label: 'Coverage', value: coverageReport ? formatCoveragePercent(coverageReport.coverageRatio) : '0%' },
        { label: 'Drafts', value: String(draftCount) },
        { label: 'Installed', value: String(installedCount) }
      ],
    [coverageReport, draftCount, installedCount]
  );

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="bg-[#FAF8F5] border border-[#EAE6DF] rounded-lg p-6 space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <span className="text-[10px] uppercase tracking-[0.28em] font-mono text-[#6F7974] font-bold">
              Skill Marketplace
            </span>
            <h3 className="text-md font-bold text-[#1E2522] font-display">
              Coverage gaps become real skills
            </h3>
            <p className="text-xs text-[#5C6560] max-w-2xl">
              Every completed audit emits a coverage report from the registry,
              drafts concrete SKILL.md artifacts for uncovered categories, and
              stores the versioned bundle alongside the workspace.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 text-[11px]">
            {coverageChips.map((chip) => (
              <div key={chip.label} className="rounded border border-[#EAE6DF] bg-white px-3 py-2">
                <div className="text-[9px] uppercase tracking-[0.22em] text-[#7C8680] font-mono">
                  {chip.label}
                </div>
                <div className="mt-1 text-sm font-bold text-[#1E2522]">{chip.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded border border-[#EAE6DF] bg-white p-4">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-[0.24em] text-[#6F7974]">
              <ShieldCheck size={14} />
              Current state
            </div>
            <div className="mt-2 text-sm font-medium text-[#1E2522]">
              {coverageReport
                ? `${coverageReport.coveredCategories.length} categories covered out of ${coverageReport.totalCategories}.`
                : 'No skill coverage report has been generated yet.'}
            </div>
          </div>
          <div className="rounded border border-[#EAE6DF] bg-white p-4">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-[0.24em] text-[#6F7974]">
              <TriangleAlert size={14} />
              Gaps detected
            </div>
            <div className="mt-2 text-sm font-medium text-[#1E2522]">
              {missingCategories.length > 0
                ? `${missingCategories.length} skills need coverage.`
                : 'No missing coverage categories detected in the latest run.'}
            </div>
          </div>
          <div className="rounded border border-[#EAE6DF] bg-white p-4">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-[0.24em] text-[#6F7974]">
              <Sparkles size={14} />
              Generated drafts
            </div>
            <div className="mt-2 text-sm font-medium text-[#1E2522]">
              {draftCount > 0
                ? `${draftCount} generated SKILL.md drafts are ready for download and install.`
                : 'No drafts were generated from the latest audit yet.'}
            </div>
          </div>
        </div>
      </div>

      {coverageReport && missingCategories.length > 0 && (
        <div className="bg-white border border-[#EAE6DF] rounded-lg p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Inbox size={15} className="text-[#61706A]" />
            <h4 className="text-sm font-bold text-[#1E2522]">Missing coverage categories</h4>
          </div>
          <div className="flex flex-wrap gap-2">
            {missingCategories.map((category) => (
              <span
                key={category}
                className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-mono uppercase tracking-[0.18em] text-amber-900"
              >
                {category}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        {skills.drafts.length === 0 ? (
          <div className="bg-white border border-[#EAE6DF] rounded-lg p-6 text-sm text-[#5C6560]">
            Run an audit to generate marketplace drafts for any uncovered skill categories.
          </div>
        ) : (
          skills.drafts.map((draft) => {
            const installed = skills.installedSkillIds.includes(draft.id) || draft.installed;
            const locked = !canManageOrganization;
            return (
              <article
                key={draft.id}
                className="bg-white border border-[#EAE6DF] rounded-lg p-5 shadow-sm space-y-4"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="rounded-full bg-emerald-50 text-emerald-900 border border-emerald-200 px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.2em]">
                        {draft.category}
                      </span>
                      {installed ? (
                        <span className="rounded-full bg-[#F0F7F3] text-emerald-950 border border-emerald-200 px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.2em] inline-flex items-center gap-1">
                          <CheckCircle2 size={11} />
                          Installed
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-50 text-amber-900 border border-amber-200 px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.2em]">
                          Draft
                        </span>
                      )}
                    </div>
                    <h4 className="text-lg font-bold text-[#1E2522]">{draft.title}</h4>
                    <p className="text-sm text-[#5C6560] max-w-3xl">{draft.summary}</p>
                    <p className="text-[11px] uppercase tracking-[0.2em] font-mono text-[#7C8680]">
                      Owner: {draft.ownerAgentName}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => downloadSkillMarkdown(draft.id, draft.markdown)}
                      className="inline-flex items-center gap-2 rounded border border-[#D9E0DB] bg-white px-3 py-2 text-xs font-medium text-[#1E2522] hover:bg-[#FAF8F5]"
                    >
                      <Download size={14} />
                      Download
                    </button>
                    <button
                      type="button"
                      disabled={installed || locked || installingSkillId === draft.id}
                      onClick={async () => {
                        try {
                          setInstallingSkillId(draft.id);
                          await onInstallSkill(draft.id);
                        } finally {
                          setInstallingSkillId(null);
                        }
                      }}
                      className="inline-flex items-center gap-2 rounded bg-emerald-950 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Sparkles size={14} />
                      {installed ? 'Installed' : locked ? 'Admin access required' : 'Install'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="rounded border border-[#EAE6DF] bg-[#FAF8F5] p-4">
                    <div className="text-[10px] uppercase tracking-[0.22em] font-mono text-[#6F7974]">
                      SKILL.md draft
                    </div>
                    <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap text-[12px] leading-6 text-[#1E2522]">
                      {draft.markdown}
                    </pre>
                  </div>

                  <div className="rounded border border-[#EAE6DF] bg-[#FAF8F5] p-4">
                    <div className="text-[10px] uppercase tracking-[0.22em] font-mono text-[#6F7974]">
                      Registry entry
                    </div>
                    <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap text-[12px] leading-6 text-[#1E2522]">
                      {draft.registryEntry}
                    </pre>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
