'use client';

import dynamic from 'next/dynamic';

const PremortemOsApp = dynamic(
  () => import('@/components/premortem-os/premortem-os-app').then((module) => module.PremortemOsApp),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-screen items-center justify-center bg-[#FAF8F5] font-mono text-xs text-[#5C6560]">
        Loading Premortem console…
      </div>
    )
  }
);

export function AppConsoleClient() {
  return <PremortemOsApp />;
}
