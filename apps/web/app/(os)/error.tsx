'use client';

import { AlertCircle, RotateCw } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';

import { premortemBrand } from '@/lib/premortem-os/branding';

export default function OsError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="w-screen h-screen bg-[#FBFBFA] flex items-center justify-center font-sans px-6">
      <div className="max-w-md p-6 border border-rose-200 bg-rose-50 text-xs rounded text-rose-800 space-y-4 shadow-sm">
        <div className="flex gap-2 items-center font-display font-semibold uppercase text-[10px] tracking-wider text-rose-800">
          <AlertCircle size={14} className="text-rose-600 animate-pulse" />
          <span>{premortemBrand.errorTitle}</span>
        </div>
        <p className="leading-relaxed">
          The reviewer console hit an error. Retry to reload the current view, or contact support if
          the problem keeps happening.
        </p>
        <div className="flex flex-wrap gap-2 pt-2 border-t border-rose-100">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-2 rounded border border-rose-300 bg-white px-3 py-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-rose-900 hover:bg-rose-100"
          >
            <RotateCw size={12} />
            Retry
          </button>
          <Link
            href="/login?next=/app"
            className="inline-flex items-center rounded border border-rose-300 bg-white px-3 py-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-rose-900 hover:bg-rose-100"
          >
            Sign in
          </Link>
          <a
            href={`mailto:${premortemBrand.supportEmail}`}
            className="inline-flex items-center rounded border border-rose-300 bg-white px-3 py-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-rose-900 hover:bg-rose-100"
          >
            {premortemBrand.errorSupportLabel}
          </a>
        </div>
      </div>
    </div>
  );
}
