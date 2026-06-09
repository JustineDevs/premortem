import React from 'react';
import { 
  Project, 
  AuditRun, 
  RiskCluster 
} from '@/lib/premortem-os/types';
import { 
  ShieldCheck, 
  ShieldAlert, 
  AlertOctagon, 
  Settings2, 
  RefreshCw, 
  GitPullRequest, 
  Heart,
  Globe,
  Radio,
  ArrowUpRight,
  TrendingUp,
  Fingerprint
} from 'lucide-react';

interface DashboardViewProps {
  projects: Project[];
  audits: AuditRun[];
  onTriggerScan: (projectId: string) => void;
  onSelectAudit: (auditId: string) => void;
  systemScore: number;
}

export function DashboardView({ 
  projects, 
  audits, 
  onTriggerScan, 
  onSelectAudit,
  systemScore 
}: DashboardViewProps) {
  
  // Calculate vulnerability stats
  const totalAuditsCount = audits.filter(a => a.status === 'COMPLETED').length;
  const recentAudit = audits.find(a => a.status === 'COMPLETED');
  
  const totalFindingsCount = audits.reduce((sum, current) => {
    return sum + (current.findings?.length || 0);
  }, 0);

  const stats = {
    critical: audits.reduce((sum, item) => sum + (item.criticalCount || 0), 0),
    high: audits.reduce((sum, item) => sum + (item.highCount || 0), 0),
    medium: audits.reduce((sum, item) => sum + (item.mediumCount || 0), 0),
    low: audits.reduce((sum, item) => sum + (item.lowCount || 0), 0),
  };

  const riskClusters: RiskCluster[] = [
    {
      id: "clust-1",
      name: "Unencrypted PII in Transit",
      description: "Health/banking records and session API tokens transmitted over non-secure transport protocols",
      severity: "CRITICAL",
      findingsCount: audits.reduce((acc, current) => {
        return acc + (current.findings?.filter(f => f.category === 'unencrypted-transit' && f.status === 'OPEN').length || 0);
      }, 0),
      projectIds: ["proj-payments-middleware", "proj-telemetry-dispatch"]
    },
    {
      id: "clust-2",
      name: "Stale IAM / Hardcoded Credentials",
      description: "Direct string parameters representing secret storage buckets access credentials and diagnostic bypass fallbacks",
      severity: "HIGH",
      findingsCount: audits.reduce((acc, current) => {
        return acc + (current.findings?.filter(f => f.category === 'hardcoded-secrets' && f.status === 'OPEN').length || 0);
      }, 0),
      projectIds: ["proj-user-identity", "proj-payments-middleware"]
    }
  ];

  return (
    <div className="flex-1 overflow-y-auto p-8 font-sans space-y-8 max-w-7xl mx-auto w-full">
      {/* Title Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-[#EAE6DF] pb-6 gap-4">
        <div>
          <span className="text-[10px] uppercase tracking-widest font-mono text-[#8A958F]">
            Continuous Infrastructure Audit Core
          </span>
          <h2 className="text-2xl font-semibold tracking-tight text-[#1E2522] font-display mt-1">
            System Overseer Overview
          </h2>
          <p className="text-xs text-[#5C6560] mt-1 font-sans">
            Real-time compliance validation, AI-guided trace inspections, and automatic risk remediation.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded font-mono text-[11px]">
            <Radio size={12} className="text-emerald-600 animate-pulse" />
            <span>Telemetry online</span>
          </div>
        </div>
      </div>

      {/* Grid of Key Stats & Dial */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Compliance Rating Card */}
        <div className="bg-[#FAF8F5] border border-[#EAE6DF] rounded p-6 flex flex-col justify-between relative overflow-hidden group hover:shadow-sm transition-all">
          <div className="z-10">
            <span className="text-[10px] uppercase font-mono tracking-wider text-[#8A958F]">System Guard</span>
            <h3 className="text-md font-semibold text-[#1E2522] mt-0.5 font-display">Compliance Rating</h3>
            
            <div className="flex items-baseline gap-2 mt-4">
              <span className="text-5xl font-bold font-display tracking-tight text-[#1E2522]">
                {systemScore}
              </span>
              <span className="text-sm font-semibold font-mono text-[#8A958F]">/100</span>
              <span className="ml-3 text-xs font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-700 animate-pulse">
                {systemScore >= 85 ? 'SECURE' : 'ATTENTION REQUIRED'}
              </span>
            </div>
          </div>
          
          <div className="mt-6 pt-4 border-t border-[#EAE6DF]/60 text-xs text-[#5C6560] flex items-center justify-between font-mono z-10">
            <span>AUDITED PROJECTS: {projects.length}</span>
            <div className="flex items-center gap-1 text-emerald-700">
              <TrendingUp size={12} />
              <span>STABLE RUNTIME</span>
            </div>
          </div>

          <div className="absolute right-[-20px] bottom-[-20px] text-[#EBE8E0]/60 -rotate-12 select-none pointer-events-none group-hover:scale-110 transition-transform">
            <ShieldCheck size={160} strokeWidth={0.8} />
          </div>
        </div>

        {/* Multi-tier Risk Stats Counter */}
        <div className="bg-[#FAF8F5] border border-[#EAE6DF] rounded p-6 col-span-1 lg:col-span-2 flex flex-col justify-between">
          <div>
            <span className="text-[10px] uppercase font-mono tracking-wider text-[#8A958F]">Active Vulnerabilities Ledger</span>
            <h3 className="text-md font-semibold text-[#1E2522] mt-0.5 font-display">Severity Distribution</h3>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5">
              {/* Critical */}
              <div className="border border-[#EAE6DF] bg-[#FDFDFD] rounded p-3 text-center relative overflow-hidden group hover:border-[#E15A5A] transition-all">
                <span className="text-[10px] font-mono text-rose-600 font-bold tracking-wider">CRITICAL</span>
                <p className="text-3xl font-bold font-display text-[#1E2522] mt-1">{stats.critical}</p>
                <div className="w-1 h-full bg-rose-600 absolute left-0 top-0" />
              </div>

              {/* High */}
              <div className="border border-[#EAE6DF] bg-[#FDFDFD] rounded p-3 text-center relative overflow-hidden group hover:border-[#E88B5D] transition-all">
                <span className="text-[10px] font-mono text-amber-600 font-bold tracking-wider">HIGH</span>
                <p className="text-3xl font-bold font-display text-[#1E2522] mt-1">{stats.high}</p>
                <div className="w-1 h-full bg-amber-500 absolute left-0 top-0" />
              </div>

              {/* Medium */}
              <div className="border border-[#EAE6DF] bg-[#FDFDFD] rounded p-3 text-center relative overflow-hidden group hover:border-[#8370F2] transition-all">
                <span className="text-[10px] font-mono text-indigo-500 font-bold tracking-wider">MEDIUM</span>
                <p className="text-3xl font-bold font-display text-[#1E2522] mt-1">{stats.medium}</p>
                <div className="w-1 h-full bg-indigo-500 absolute left-0 top-0" />
              </div>

              {/* Low */}
              <div className="border border-[#EAE6DF] bg-[#FDFDFD] rounded p-3 text-center relative overflow-hidden group hover:border-[#7AB355] transition-all">
                <span className="text-[10px] font-mono text-emerald-600 font-bold tracking-wider">LOW</span>
                <p className="text-3xl font-bold font-display text-[#1E2522] mt-1">{stats.low}</p>
                <div className="w-1 h-full bg-emerald-500 absolute left-0 top-0" />
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-[#EAE6DF]/60 text-xs text-[#5C6560] font-mono flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <span>TOTAL FINDINGS OVERALL HISTORY: {totalFindingsCount}</span>
            <span className="text-[10px] px-2 py-0.5 bg-[#FAF8F5] border border-[#EAE6DF] text-[#717A75] rounded">
              LATEST RUN: {recentAudit ? new Date(recentAudit.date).toLocaleDateString() : 'N/A'}
            </span>
          </div>
        </div>
      </div>

      {/* Risk Clusters Section & Active Threats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Risk Clusters Left Column 2 parts */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-[#FAF8F5] border border-[#EAE6DF] rounded p-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <span className="text-[10px] uppercase font-mono tracking-wider text-[#8A958F]">Cluster Grouping</span>
                <h3 className="text-md  font-semibold text-[#1E2522] font-display">Active Risk Clusters</h3>
              </div>
              <span className="text-xs font-mono px-2 py-0.5 bg-neutral-100 border border-neutral-200 rounded text-neutral-600">
                Live Group Aggregate
              </span>
            </div>

            <div className="space-y-4">
              {riskClusters.map((cluster) => (
                <div key={cluster.id} className="border border-[#EAE6DF] bg-[#FDFDFD] rounded p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:border-emerald-950/20 transition-all">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${cluster.severity === 'CRITICAL' ? 'bg-rose-600' : 'bg-amber-500'}`} />
                      <h4 className="text-xs font-bold text-[#1E2522] font-display uppercase tracking-wide">
                        {cluster.name}
                      </h4>
                      <span className="text-[9px] font-mono bg-stone-100 border border-stone-200 px-1.5 py-0.2 rounded text-[#717A75]">
                        {cluster.severity}
                      </span>
                    </div>
                    <p className="text-xs text-[#5C6560] max-w-lg leading-relaxed">
                      {cluster.description}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 shrink-0 font-mono text-[11px]">
                    <div className="text-right">
                      <span className="block text-[#8A958F] text-[9px] uppercase">PROJECTS IMPACTED</span>
                      <span className="font-semibold text-[#1E2522]">{cluster.projectIds.length} instances</span>
                    </div>
                    <div className="px-3 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-800 rounded font-bold text-center min-w-[70px]">
                      {cluster.findingsCount} Open
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Historical Audits Feed */}
          <div className="bg-[#FAF8F5] border border-[#EAE6DF] rounded p-6">
            <h3 className="text-md font-semibold text-[#1E2522] font-display mb-4">
              Audit Logs History
            </h3>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse font-sans">
                <thead>
                  <tr className="border-b border-[#EAE6DF]/80 font-mono text-[10px] text-[#8A958F] uppercase bg-[#FAF8F5]/50">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Project / Repository</th>
                    <th className="py-2.5 px-3">Ref Status</th>
                    <th className="py-2.5 px-3 text-center">Score</th>
                    <th className="py-2.5 px-3 text-center">Open Risks</th>
                    <th className="py-2.5 px-3 text-right">Inspect</th>
                  </tr>
                </thead>
                <tbody className="text-xs divide-y divide-[#EAE6DF]/60">
                  {audits.map((audit) => {
                    const totalRisks = (audit.criticalCount || 0) + (audit.highCount || 0) + (audit.mediumCount || 0) + (audit.lowCount || 0);
                    return (
                      <tr key={audit.id} className="hover:bg-[#FCECF3]/10 transition-all">
                        <td className="py-3 px-3 font-mono text-[11px] text-[#717A75]">
                          {new Date(audit.date).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-3 font-semibold text-[#1E2522] font-display">
                          {audit.projectName}
                        </td>
                        <td className="py-3 px-3">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded border ${
                            audit.score >= 85 
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                              : audit.score >= 60 
                                ? 'bg-amber-50 border-amber-200 text-amber-800'
                                : 'bg-rose-50 border-rose-200 text-rose-800'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              audit.score >= 85 ? 'bg-emerald-600' : audit.score >= 60 ? 'bg-amber-500' : 'bg-rose-600'
                            }`} />
                            {audit.score >= 85 ? 'SECURE' : 'ATTENTION REQUIRED'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-bold">
                          {audit.score}
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-bold text-rose-600 text-sm">
                          {totalRisks}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button 
                            onClick={() => onSelectAudit(audit.id)}
                            className="p-1 px-2 border border-[#EAE6DF] hover:border-emerald-950 text-[10px] rounded hover:bg-[#FAF8F5] transition-all inline-flex items-center gap-1 font-semibold text-[#1E2522]"
                          >
                            <span>Inspect</span>
                            <ArrowUpRight size={12} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Sidebar Trigger Board Right Column */}
        <div className="space-y-6">
          <div className="bg-emerald-950 text-[#FAF8F5] rounded p-6 shadow-sm relative overflow-hidden flex flex-col justify-between h-full min-h-[400px]">
            <div className="z-10 space-y-4">
              <div className="inline-flex py-1 px-2.5 bg-emerald-900 border border-emerald-800 rounded text-[9px] font-mono font-bold uppercase tracking-widest text-[#72C8AF]">
                OPERATIONS RUNTIME
              </div>
              
              <h3 className="text-xl font-bold tracking-tight font-display text-white">
                Launch Security Scan
              </h3>
              
              <p className="text-xs text-[#B2C5BD] leading-relaxed">
                Invoke Premortem's AI Engine to execute a telemetry deep-scan. Gemini will isolate credentials leak indicators, parse transit encryption pathways, and trace request chains.
              </p>

              <div className="space-y-3 pt-2">
                <label className="block text-[10px] font-mono tracking-wider text-[#72C8AF] uppercase">
                  Select Scope Repository:
                </label>
                <div className="space-y-2">
                  {projects.map((proj) => (
                    <button
                      key={proj.id}
                      onClick={() => onTriggerScan(proj.id)}
                      disabled={proj.status === 'SCANNING'}
                      className="w-full text-left p-3 rounded bg-emerald-900/50 border border-emerald-800/80 hover:border-[#72C8AF]/40 hover:bg-emerald-900 transition-all flex justify-between items-center group text-xs text-[#FAF8F5] disabled:opacity-50"
                    >
                      <div>
                        <span className="block font-bold truncate tracking-wide text-white font-display group-hover:text-[#72C8AF]">
                          {proj.name}
                        </span>
                        <span className="text-[10px] text-[#A6BCB4] font-mono">{proj.branch} branch | {proj.provider}</span>
                      </div>
                      <span className="p-1 px-2 bg-emerald-950 border border-emerald-800 rounded group-hover:border-[#72C8AF]/40 group-hover:text-[#72C8AF] text-[10px] font-mono font-bold transition-all">
                        {proj.status === 'SCANNING' ? 'SCANNING...' : 'SCAN'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="z-10 border-t border-emerald-900 pt-4 mt-6 flex justify-between items-center text-[10px] font-mono text-[#A6BCB4]">
              <span>PREMORTEM INTELLIGENCE</span>
              <span className="text-white">v2.4.0</span>
            </div>
            
            {/* Background elements */}
            <div className="absolute right-[-40px] bottom-[-40px] text-emerald-900/40 pointer-events-none noselect select-none rotate-12">
              <ShieldAlert size={280} strokeWidth={0.5} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
