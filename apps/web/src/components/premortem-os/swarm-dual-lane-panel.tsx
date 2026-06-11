'use client';

import React from 'react';
import { Activity, GitBranch, Shield, type LucideIcon } from 'lucide-react';

import type { SwarmLaneAgent, SwarmTimelineAction } from '@/lib/premortem-os/swarm-lanes';

interface SwarmDualLanePanelProps {
  repositoryAgents: SwarmLaneAgent[];
  runtimeAgents: SwarmLaneAgent[];
  timeline: SwarmTimelineAction[];
  activeAgentId: string;
  onSelectAgent: (agentId: string) => void;
}

function LaneCard({
  title,
  subtitle,
  icon: Icon,
  agents,
  activeAgentId,
  onSelectAgent,
  accentClass
}: {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  agents: SwarmLaneAgent[];
  activeAgentId: string;
  onSelectAgent: (id: string) => void;
  accentClass: string;
}) {
  const activeCount = agents.filter((agent) => agent.status === 'ACTIVE').length;
  const findingsTotal = agents.reduce((sum, agent) => sum + agent.findingsCount, 0);

  return (
    <div className="border border-[#EAE6DF] rounded-lg bg-white overflow-hidden">
      <div className={`px-4 py-3 border-b border-[#EAE6DF] ${accentClass}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Icon size={14} />
            <div>
              <p className="text-xs font-bold font-display uppercase tracking-wide">{title}</p>
              <p className="text-[10px] opacity-80">{subtitle}</p>
            </div>
          </div>
          <div className="text-right font-mono text-[9px]">
            <p>{agents.length} agents</p>
            <p>{activeCount > 0 ? `${activeCount} live` : `${findingsTotal} findings`}</p>
          </div>
        </div>
      </div>

      <div className="p-3 space-y-2 max-h-64 overflow-y-auto">
        {agents.length === 0 ? (
          <p className="text-[11px] text-[#717A75] italic p-2">No agents assigned to this lane yet.</p>
        ) : (
          agents.map((agent) => {
            const selected = agent.id === activeAgentId;
            return (
              <button
                key={agent.id}
                type="button"
                onClick={() => onSelectAgent(agent.id)}
                className={`w-full text-left p-3 rounded border transition-all cursor-pointer ${
                  selected
                    ? 'bg-neutral-900 text-neutral-100 border-neutral-950'
                    : 'bg-[#FAF8F5] border-[#EAE6DF] hover:border-emerald-900/30'
                }`}
              >
                <div className="flex justify-between items-start gap-2">
                  <span
                    className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded border ${
                      agent.status === 'COMPLETED'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : agent.status === 'FAILED'
                          ? 'bg-rose-50 border-rose-200 text-rose-800'
                          : 'bg-amber-50 border-amber-200 text-amber-800 animate-pulse'
                    }`}
                  >
                    {agent.status}
                  </span>
                  <span className={`text-[9px] font-mono ${selected ? 'text-zinc-400' : 'text-[#8A958F]'}`}>
                    {agent.findingsCount} risks
                  </span>
                </div>
                <p className={`text-xs font-bold font-display mt-2 ${selected ? 'text-white' : 'text-[#1E2522]'}`}>
                  {agent.name}
                </p>
                <p className={`text-[10px] mt-1 ${selected ? 'text-zinc-300' : 'text-[#5C6560]'}`}>
                  {agent.memoryState}
                </p>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

export function SwarmDualLanePanel({
  repositoryAgents,
  runtimeAgents,
  timeline,
  activeAgentId,
  onSelectAgent
}: SwarmDualLanePanelProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <LaneCard
          title="Repository Lens"
          subtitle="Static topology, dependencies, and code integrity"
          icon={GitBranch}
          agents={repositoryAgents}
          activeAgentId={activeAgentId}
          onSelectAgent={onSelectAgent}
          accentClass="bg-indigo-50/80 text-indigo-950"
        />
        <LaneCard
          title="Runtime Lens"
          subtitle="Release safety, trust boundaries, and operability"
          icon={Shield}
          agents={runtimeAgents}
          activeAgentId={activeAgentId}
          onSelectAgent={onSelectAgent}
          accentClass="bg-emerald-50/80 text-emerald-950"
        />
      </div>

      <div className="border border-[#EAE6DF] rounded-lg bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-[#EAE6DF] flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold font-display uppercase tracking-wide text-[#1E2522]">
            <Activity size={14} className="text-emerald-700" />
            Swarm action feed
          </div>
          <span className="text-[9px] font-mono text-[#8A958F]">{timeline.length} events</span>
        </div>
        <div className="max-h-56 overflow-y-auto divide-y divide-[#EAE6DF]/80">
          {timeline.length === 0 ? (
            <p className="p-4 text-[11px] text-[#717A75] italic">No lane activity recorded for this audit yet.</p>
          ) : (
            timeline.map((action) => (
              <div key={action.id} className="px-4 py-2.5 flex items-start gap-3 text-[11px]">
                <span
                  className={`shrink-0 mt-0.5 text-[8px] font-mono uppercase px-1.5 py-0.5 rounded border ${
                    action.lane === 'repository'
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-800'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  }`}
                >
                  {action.lane === 'repository' ? 'REPO' : 'RUNTIME'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[9px] text-[#8A958F]">
                    {new Date(action.timestamp).toLocaleTimeString()} · {action.agentName}
                  </p>
                  <p
                    className={`text-[#1E2522] ${
                      action.severity === 'critical' || action.severity === 'CRITICAL'
                        ? 'text-rose-700 font-semibold'
                        : ''
                    }`}
                  >
                    {action.message}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
