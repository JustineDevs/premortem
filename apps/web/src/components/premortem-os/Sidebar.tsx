'use client';

import {
  LayoutDashboard,
  FolderGit2,
  ShieldAlert,
  Terminal,
  Settings2,
  Workflow,
  History,
  Radio
} from 'lucide-react';

import { premortemBrand } from '@/lib/premortem-os/branding';

import { OsLogoHeader } from './os-logo-header';
import { ContinuousAuditLockToggle } from './continuous-audit-lock-toggle';

const menuItems = [
  { id: 'dashboard', label: 'Monitor Dashboard', icon: LayoutDashboard },
  { id: 'projects', label: 'Projects Inventory', icon: FolderGit2, countSuffix: true },
  { id: 'audits', label: 'Audits & Tracing', icon: ShieldAlert, badge: 'Active' },
  { id: 'canvas', label: 'Workflow Canvas', icon: Workflow },
  { id: 'history', label: 'Audit History Logs', icon: History },
  { id: 'sandbox', label: 'Sandbox Audit', icon: Terminal },
  { id: 'settings', label: 'Integrations & Scope', icon: Settings2 }
] as const;

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  systemScore: number;
  workspaceName?: string;
  workspaceSlug?: string;
  runningAudits?: number;
  apiHealthy?: boolean | null;
  continuousAuditEnabled?: boolean;
  onToggleContinuousAudit?: () => void;
  isTogglingContinuousAudit?: boolean;
  continuousAuditPipelineActive?: boolean;
  runtimeModeLabel?: string;
}

export function Sidebar({
  activeTab,
  setActiveTab,
  systemScore,
  workspaceName,
  workspaceSlug,
  runningAudits = 0,
  apiHealthy = null,
  continuousAuditEnabled = false,
  onToggleContinuousAudit,
  isTogglingContinuousAudit = false,
  continuousAuditPipelineActive = false,
  runtimeModeLabel = 'Manual'
}: SidebarProps) {
  const runtimeStatusLabel =
    apiHealthy === false ? 'Runtime offline' : apiHealthy === true ? 'Runtime online' : 'Checking runtime…';
  const runtimeStatusTone =
    apiHealthy === false
      ? 'bg-rose-50 text-rose-800 border-rose-200'
      : apiHealthy === true
        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
        : 'bg-zinc-50 text-zinc-600 border-zinc-200';

  return (
    <aside className="flex h-auto w-full shrink-0 flex-col border-b border-[#EAE6DF] bg-[#FAF8F5] font-sans select-none lg:h-dvh lg:w-64 lg:border-b-0 lg:border-r">
      <OsLogoHeader />

      <div className="space-y-2 border-b border-[#EAE6DF] bg-[#FAF8F5]/60 px-4 py-3 lg:px-5">
        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border font-mono text-[10px] ${runtimeStatusTone}`}>
          <Radio size={12} className={apiHealthy === true ? 'text-emerald-600 animate-pulse' : 'text-current'} />
          <span className="font-bold uppercase tracking-[0.18em]">{runtimeStatusLabel}</span>
        </div>
        <div className="text-[10px] leading-relaxed text-[#717A75]">
          <p className="mt-1">
            {runtimeModeLabel} mode · {runningAudits} active run{runningAudits === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      <div className="border-b border-[#EAE6DF] bg-[#FAF8F5]/50 px-4 py-3 lg:px-6">
        <p className="text-[10px] uppercase tracking-widest text-[#8A958F] font-mono mb-0.5">
          Workspace
        </p>
        <p className="text-xs font-semibold text-[#3C4A42] font-display truncate">
          {workspaceName ?? premortemBrand.workspaceName}
        </p>
        <p className="text-[10px] text-[#717A75] font-mono mt-1 truncate">{workspaceSlug ?? premortemBrand.domain}</p>
      </div>

      <nav className="flex gap-1.5 overflow-x-auto px-3 py-4 lg:flex-1 lg:flex-col lg:overflow-y-auto lg:p-4">
        {menuItems.map((item) => {
          const IconComponent = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              type="button"
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`shrink-0 flex items-center justify-between rounded px-3 py-2.5 text-xs font-medium transition-all group border-0 cursor-pointer lg:w-full ${
                isActive
                  ? 'bg-emerald-950 text-[#FDFDFD] font-semibold shadow-sm'
                  : 'text-[#4A5550] hover:bg-[#F2EFF6] hover:text-[#1E2522]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <IconComponent
                  size={16}
                  className={isActive ? 'text-[#FDFDFD]' : 'text-[#8A958F] group-hover:text-[#4A5550]'}
                />
                <span className="font-sans">{item.label}</span>
              </div>

              {item.id === 'audits' && runningAudits > 0 && !isActive && (
                <span className="px-1.5 py-0.5 text-[9px] font-mono uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-sm">
                  Active
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {onToggleContinuousAudit ? (
      <div className="px-3 pb-3 lg:px-4">
          <ContinuousAuditLockToggle
            layout="sidebar"
            enabled={continuousAuditEnabled}
            onToggle={onToggleContinuousAudit}
            isPending={isTogglingContinuousAudit}
            pipelineActive={continuousAuditPipelineActive}
          />
        </div>
      ) : null}

      <div className="border-t border-[#EAE6DF] bg-[#F5F3ED]/40 p-3 lg:p-4">
        <div className="space-y-1">
          <div className="flex justify-between items-center text-[10px] text-[#717A75] font-mono">
            <span>COMPLIANCE INDEX</span>
            <span className={`font-bold ${systemScore >= 80 ? 'text-emerald-700' : 'text-amber-700'}`}>
              {systemScore}%
            </span>
          </div>
          <div className="h-1.5 bg-[#EAE6DF] rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                systemScore >= 85 ? 'bg-emerald-700' : systemScore >= 60 ? 'bg-amber-600' : 'bg-rose-600'
              }`}
              style={{ width: `${systemScore}%` }}
            />
          </div>
        </div>
      </div>
    </aside>
  );
}
