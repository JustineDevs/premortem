'use client';

import { CheckCircle2 } from 'lucide-react';

type ToastTone = 'success' | 'error' | 'info';

const TONE_STYLES: Record<ToastTone, { container: string; icon: string }> = {
  success: {
    container: 'border-emerald-800 bg-emerald-950 text-[#FAF8F5]',
    icon: 'text-emerald-400'
  },
  error: {
    container: 'border-rose-800 bg-rose-950 text-[#FFF7F7]',
    icon: 'text-rose-300'
  },
  info: {
    container: 'border-slate-700 bg-slate-950 text-[#F5F7FA]',
    icon: 'text-sky-300'
  }
};

export function OsToast({ message, tone = 'success' }: { message: string; tone?: ToastTone }) {
  if (!message) return null;
  const style = TONE_STYLES[tone];

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex max-w-sm items-center gap-2 rounded p-3 px-5 text-xs font-mono uppercase tracking-wider shadow-xl ${style.container}`}
      role="status"
      aria-live="polite"
    >
      <CheckCircle2 size={14} className={`shrink-0 ${style.icon}`} aria-hidden />
      <span>{message}</span>
    </div>
  );
}
