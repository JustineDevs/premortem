'use client';

import React, { useEffect, useState } from 'react';
import { Lock, LockOpen, Radio } from 'lucide-react';

interface ContinuousAuditLockToggleProps {
  enabled: boolean;
  onToggle: () => void;
  isPending?: boolean;
  pipelineActive?: boolean;
  layout?: 'sidebar' | 'card';
}

export function ContinuousAuditLockToggle({
  enabled,
  onToggle,
  isPending = false,
  pipelineActive = false,
  layout = 'sidebar'
}: ContinuousAuditLockToggleProps) {
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    setAnimating(true);
    const timer = window.setTimeout(() => setAnimating(false), 420);
    return () => window.clearTimeout(timer);
  }, [enabled]);

  const showLive = enabled && pipelineActive;
  const LockIcon = enabled ? Lock : LockOpen;
  const statusHint = enabled
    ? pipelineActive
      ? 'Automatic audits running: rotation active while scans are in progress.'
      : 'Automatic rotation armed: idle projects will be scanned on a ~90s cycle.'
    : 'Manual scans only: audits run when you trigger them, not automatically.';

  const toggleLabel = enabled ? 'Turn off automatic audit rotation' : 'Turn on automatic audit rotation';

  const buttonClass =
    layout === 'card'
      ? 'group w-full flex items-start justify-between gap-3 border border-[#EAE6DF] bg-[#FAF8F5] rounded-lg p-4 cursor-pointer disabled:opacity-60 disabled:cursor-wait hover:border-emerald-900/20 transition-colors'
      : 'group w-full flex items-center justify-between border-t border-[#EAE6DF]/60 pt-3 cursor-pointer disabled:opacity-60 disabled:cursor-wait';

  return (
    <div className={layout === 'card' ? 'space-y-2' : undefined}>
      <button
        type="button"
        onClick={onToggle}
        disabled={isPending}
        aria-pressed={enabled}
        aria-label={toggleLabel}
        title={statusHint}
        className={buttonClass}
      >
        <div className="flex flex-col items-start gap-1 text-left">
          <div className="flex items-center gap-1.5 text-[10px] font-mono tracking-wide font-medium">
            <span
              className={`continuous-audit-live-dot ${showLive ? 'on' : ''}`}
              aria-hidden="true"
            />
            <Radio
              size={11}
              className={
                showLive
                  ? 'text-emerald-500 continuous-audit-radio-on'
                  : enabled
                    ? 'text-emerald-700'
                    : 'text-[#8A958F]'
              }
            />
            <span className={enabled ? 'text-emerald-800' : 'text-[#717A75]'}>
              CONTINUOUS AUDIT {enabled ? 'ON' : 'OFF'}
            </span>
          </div>
          {layout === 'card' ? (
            <p className="text-[10px] font-sans text-[#5C6560] leading-relaxed max-w-sm">{statusHint}</p>
          ) : null}
        </div>

        <span
          className={`continuous-audit-lock-icon shrink-0 ${animating ? (enabled ? 'locking' : 'unlocking') : ''} ${
            enabled ? 'is-locked' : 'is-unlocked'
          }`}
        >
          <LockIcon size={14} strokeWidth={2.25} />
        </span>
      </button>
      {layout === 'sidebar' ? (
        <p className="text-[9px] font-sans text-[#8A958F] leading-snug px-0.5">{statusHint}</p>
      ) : null}
    </div>
  );
}
