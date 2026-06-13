import nextDynamic from 'next/dynamic';

export const dynamic = 'force-dynamic';

const PremortemOsApp = nextDynamic(
  () => import('@/components/premortem-os/premortem-os-app').then((module) => module.PremortemOsApp),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-screen items-center justify-center text-xs uppercase tracking-[0.24em] text-[#5C6560]">
        Loading reviewer console…
      </div>
    )
  }
);

export default function AppConsolePage() {
  return <PremortemOsApp />;
}
