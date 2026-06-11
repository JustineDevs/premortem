'use client';

import { CheckCircle2 } from 'lucide-react';

export function OsToast({ message }: { message: string }) {
  if (!message) return null;

  return (
    <div
      className="fixed bottom-6 right-6 z-50 flex max-w-sm items-center gap-2 rounded border border-emerald-800 bg-emerald-950 p-3 px-5 text-xs font-mono uppercase tracking-wider text-[#FAF8F5] shadow-xl"
      role="status"
      aria-live="polite"
    >
      <CheckCircle2 size={14} className="shrink-0 text-emerald-400" aria-hidden />
      <span>{message}</span>
    </div>
  );
}
