'use client';

import React, { useState } from 'react';
import { Pause, Play, Terminal } from 'lucide-react';

import {
  AUDIT_PIPELINE_STEPS,
  derivePipelineProgress,
  buildConsoleLogLines
} from '@/lib/premortem-os/audit-pipeline';
import { parseAuditCheckpoint } from '@premortem/domain';

interface AuditRuntimeConsoleProps {
  panelTitle?: string;
  auditId: string;
  auditStatus: string;
  runtimeModeLabel?: string;
  agentRuns: Array<{ agentName: string; status: string; startedAt?: string | null }>;
  events: Array<{ eventType: string; actor: string; createdAt: string }>;
  summary?: unknown;
  compact?: boolean;
  onStartAudit?: () => void | Promise<void>;
  onPause?: (auditId: string) => void | Promise<void>;
  onStopAll?: () => void | Promise<void>;
  onResume?: (auditId: string) => void | Promise<void>;
  showStopAll?: boolean;
  isPausePending?: boolean;
  isStopAllPending?: boolean;
  isResumePending?: boolean;
  isStartAuditPending?: boolean;
}

export function AuditRuntimeConsole({
  panelTitle = 'Audit Runtime Monitor',
  auditId,
  auditStatus,
  runtimeModeLabel = 'Manual',
  agentRuns,
  events,
  summary,
  compact = false,
  onStartAudit,
  onPause,
  onStopAll,
  onResume,
  showStopAll = false,
  isPausePending = false,
  isStopAllPending = false,
  isResumePending = false,
  isStartAuditPending = false
}: AuditRuntimeConsoleProps) {
  const [controlError, setControlError] = useState<string | null>(null);
  const { activeStepIndex, animating } = derivePipelineProgress({ auditStatus, agentRuns, summary });
  const logs = buildConsoleLogLines({ events, agentRuns, summary });
  const progressPct = Math.round(((activeStepIndex + 1) / AUDIT_PIPELINE_STEPS.length) * 100);
  const checkpoint = parseAuditCheckpoint(summary);
  const isQueued = auditStatus === 'QUEUED';
  const isRunning = auditStatus === 'RUNNING';
  const isPaused = auditStatus === 'PAUSED';
  const isCancelled = auditStatus === 'CANCELLED';
  const controlState =
    isRunning || isQueued
      ? 'active'
      : isPaused
        ? 'paused'
        : 'idle';
  const canPause = (isRunning || isQueued) && Boolean(onPause);
  const canResume = isPaused && Boolean(onResume);
  const canStartAudit = controlState === 'idle' && Boolean(onStartAudit);
  const canStopAll = showStopAll && controlState !== 'idle' && Boolean(onStopAll);

  const handleStopAll = async () => {
    if (!onStopAll) return;
    setControlError(null);
    try {
      await onStopAll();
    } catch (error) {
      setControlError(error instanceof Error ? error.message : 'Failed to stop runtime.');
    }
  };

  const handleStartAudit = async () => {
    if (!onStartAudit) return;
    setControlError(null);
    try {
      await onStartAudit();
    } catch (error) {
      setControlError(error instanceof Error ? error.message : 'Failed to start audit.');
    }
  };

  const handlePause = async () => {
    if (!onPause) return;
    setControlError(null);
    try {
      await onPause(auditId);
    } catch (error) {
      setControlError(error instanceof Error ? error.message : 'Failed to pause audit run.');
    }
  };

  const handleResume = async () => {
    if (!onResume) return;
    setControlError(null);
    try {
      await onResume(auditId);
    } catch (error) {
      setControlError(error instanceof Error ? error.message : 'Failed to resume audit run.');
    }
  };

  return (
    <section
      className={`border border-[#EAE6DF] bg-[#FAF8F5] rounded-lg overflow-hidden ${
        compact ? '' : 'shadow-sm'
      }`}
      aria-label={panelTitle}
    >
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] border-b border-[#EAE6DF]">
        <div className="p-4 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-widest text-[#8A958F]">{panelTitle}</p>
              <p className="text-xs font-semibold text-[#1E2522] font-display">Premortem pipeline execution</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded border border-[#EAE6DF] bg-white px-2.5 py-1 text-[9px] font-mono uppercase tracking-wider text-[#5C6560]">
                Mode · {runtimeModeLabel}
              </span>
              {canStartAudit ? (
                <button
                  type="button"
                  onClick={() => void handleStartAudit()}
                  disabled={isStartAuditPending}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-emerald-800 bg-emerald-950 text-[10px] font-mono uppercase tracking-wider font-bold text-[#72C8AF] hover:bg-emerald-900 disabled:opacity-60"
                  title="Start a new security audit"
                >
                  <Play size={11} />
                  {isStartAuditPending ? 'Starting…' : 'Start audit'}
                </button>
              ) : canPause ? (
                <button
                  type="button"
                  onClick={() => void handlePause()}
                  disabled={isPausePending}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-amber-300 bg-amber-50 text-[10px] font-mono uppercase tracking-wider font-bold text-amber-900 hover:bg-amber-100 disabled:opacity-60"
                  title="Pause the current audit run"
                >
                  <Pause size={11} />
                  {isPausePending ? 'Pausing…' : 'Pause'}
                </button>
              ) : canResume ? (
                <button
                  type="button"
                  onClick={() => void handleResume()}
                  disabled={isResumePending}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-emerald-300 bg-emerald-50 text-[10px] font-mono uppercase tracking-wider font-bold text-emerald-900 hover:bg-emerald-100 disabled:opacity-60"
                  title="Resume the paused audit run"
                >
                  <Play size={11} />
                  {isResumePending ? 'Resuming…' : 'Resume'}
                </button>
              ) : null}
              {canStopAll ? (
                <button
                  type="button"
                  onClick={() => void handleStopAll()}
                  disabled={isStopAllPending}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-rose-300 bg-rose-50 text-[10px] font-mono uppercase tracking-wider font-bold text-rose-900 hover:bg-rose-100 disabled:opacity-60"
                  title="Stop all audits and turn off automatic rotation"
                >
                  {isStopAllPending ? 'Stopping all…' : 'Stop all'}
                </button>
              ) : null}
              <span
                className={`inline-flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-wider font-bold ${
                  isRunning || isQueued
                    ? 'text-emerald-700'
                    : isPaused
                      ? 'text-amber-700'
                      : isCancelled
                        ? 'text-[#717A75]'
                      : 'text-[#717A75]'
                }`}
              >
                <span
                  className={`continuous-audit-live-dot ${(isRunning || isQueued) && animating ? 'on' : ''}`}
                  aria-hidden="true"
                />
                {isRunning ? 'Running' : isQueued ? 'Queued' : isPaused ? 'Paused' : isCancelled ? 'Stopped' : 'Stopped'}
              </span>
            </div>
          </div>
          <p className="text-[10px] font-mono text-[#717A75] truncate" title={auditId}>
            RUN ID · {auditId}
          </p>
          {checkpoint ? (
            <div className="grid grid-cols-1 gap-1 text-[10px] font-mono text-amber-800">
              <p>
                Checkpoint · {checkpoint.phase.replace(/_/g, ' ')} · {checkpoint.completedSpecialists.length} agents
              </p>
              <p className="text-[#5C6560]">
                Findings {checkpoint.findingCount} · Clusters {checkpoint.clusterCount} · Saved{' '}
                {new Date(checkpoint.savedAt).toLocaleTimeString()}
              </p>
              {checkpoint.reason ? <p className="text-[#8A958F]">{checkpoint.reason}</p> : null}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-1 text-[10px] font-mono text-[#5C6560]">
              <p>
                Execution milestone · {isRunning ? 'running' : isQueued ? 'queued' : isPaused ? 'paused' : isCancelled ? 'stopped' : auditStatus.toLowerCase()}
              </p>
              <p>
                Findings {agentRuns.length > 0 ? agentRuns.length : logs.filter((line) => line.msg.includes('finding')).length} ·{' '}
                Agents {agentRuns.length} · No persisted checkpoint yet
              </p>
            </div>
          )}
          {controlError ? (
            <p className="text-[10px] font-mono text-rose-700">{controlError}</p>
          ) : null}
        </div>
        <div className="p-4 border-t lg:border-t-0 lg:border-l border-[#EAE6DF] bg-white/60">
          <p className="text-[9px] font-mono uppercase tracking-wider text-[#8A958F]">Active agents</p>
          <p className="text-lg font-bold font-display text-[#1E2522]">{agentRuns.length}</p>
        </div>
      </div>

      <div className={`process-status ${animating ? 'animating' : ''} px-4 py-3 border-b border-[#EAE6DF] bg-white/50`}>
        <div className="flex items-center gap-3 mb-2">
          <span className="text-[9px] font-mono uppercase tracking-wider text-[#8A958F] font-bold">
            Pipeline status
          </span>
          <div className="flex-1 h-1.5 bg-[#EAE6DF] rounded-full overflow-hidden">
            <div
              className={`h-full bg-emerald-700 transition-all duration-500 ${
                animating ? 'process-bar-indeterminate' : auditStatus === 'PAUSED' ? 'bg-amber-600' : ''
              }`}
              style={animating ? undefined : { width: `${progressPct}%` }}
            />
          </div>
          <span className="text-[9px] font-mono text-[#717A75]">{progressPct}%</span>
        </div>
        <ol className="flex flex-wrap gap-2">
          {AUDIT_PIPELINE_STEPS.map((step, idx) => {
            const state =
              idx < activeStepIndex ? 'done' : idx === activeStepIndex ? 'active' : 'pending';
            return (
              <li
                key={step}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-mono uppercase tracking-wide border ${
                  state === 'done'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : state === 'active'
                      ? auditStatus === 'PAUSED'
                        ? 'bg-amber-100 border-amber-300 text-amber-900'
                        : 'bg-neutral-900 border-neutral-950 text-white'
                      : 'bg-white border-[#EAE6DF] text-[#8A958F]'
                }`}
              >
                <span>{idx + 1}</span>
                <span>{step}</span>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="p-4">
        <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-[#8A958F] mb-2">
          <Terminal size={12} />
          Output terminal
        </div>
        <div
          className={`bg-neutral-950 font-mono text-[11px] text-zinc-300 rounded-lg p-4 overflow-y-auto border border-neutral-800 leading-relaxed ${
            compact ? 'max-h-40' : 'max-h-52'
          }`}
        >
          {logs.length === 0 ? (
            <p className="text-zinc-500 italic">Awaiting orchestrator telemetry…</p>
          ) : (
            logs.map((log, idx) => (
              <p key={`${log.time}-${idx}`} className="text-zinc-300">
                <span className="text-zinc-500">[{log.time}]</span> {log.msg}
              </p>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
