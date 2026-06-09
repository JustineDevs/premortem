import React from 'react';
import { 
  LayoutDashboard, 
  FolderGit2, 
  ShieldAlert, 
  Terminal, 
  Settings2,
  Lock,
  Radio,
  Workflow,
  History
} from 'lucide-react';

import { premortemBrand } from '@/lib/premortem-os/branding';

import { OsLogoHeader } from './os-logo-header';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  systemScore: number;
}

export function Sidebar({ activeTab, setActiveTab, systemScore }: SidebarProps) {
  const menuItems = [
    { id: 'dashboard', label: 'Monitor Dashboard', icon: LayoutDashboard },
    { id: 'projects', label: 'Projects Inventory', icon: FolderGit2, countSuffix: true },
    { id: 'audits', label: 'Audits & Tracing', icon: ShieldAlert, badge: 'Active' },
    { id: 'canvas', label: 'Workflow Canvas', icon: Workflow },
    { id: 'history', label: 'Audit History Logs', icon: History },
    { id: 'sandbox', label: 'AI Code Playground', icon: Terminal, highlight: true },
    { id: 'settings', label: 'Integrations & Scope', icon: Settings2 },
  ];

  return (
    <aside className="w-64 bg-[#FAF8F5] border-r border-[#EAE6DF] flex flex-col h-screen shrink-0 font-sans select-none">
      <OsLogoHeader />

      {/* Organization Badge */}
      <div className="px-6 py-3 border-b border-[#EAE6DF] bg-[#FAF8F5]/50">
        <p className="text-[10px] uppercase tracking-widest text-[#8A958F] font-mono mb-0.5">
          Workspace
        </p>
        <p className="text-xs font-semibold text-[#3C4A42] font-display truncate">
          {premortemBrand.workspaceName}
        </p>
        <p className="text-[10px] text-[#717A75] font-mono mt-1 truncate">{premortemBrand.domain}</p>
      </div>

      {/* Navigation Space */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const IconComponent = item.icon;
          const isActive = activeTab === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded text-xs font-medium transition-all group border-0 cursor-pointer ${
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
              
              {item.badge && !isActive && (
                <span className="px-1.5 py-0.5 text-[9px] font-mono uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-sm">
                  {item.badge}
                </span>
              )}
              {item.highlight && !isActive && (
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              )}
            </button>
          );
        })}
      </nav>

      {/* System Status Foot */}
      <div className="p-4 border-t border-[#EAE6DF] bg-[#F5F3ED]/40 space-y-3">
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

        <div className="flex items-center justify-between border-t border-[#EAE6DF]/60 pt-3">
          <div className="flex items-center gap-1.5 text-[10px] text-[#4A5550]">
            <Radio size={11} className="text-emerald-500 animate-pulse" />
            <span className="font-mono tracking-wide font-medium">CONTINUOUS AUDIT ON</span>
          </div>
          <Lock size={12} className="text-[#8A958F]" />
        </div>
      </div>
    </aside>
  );
}
