import Link from 'next/link';

import { premortemBrand } from '@/lib/premortem-os/branding';

import { osAssets } from './os-assets';

type OsLogoHeaderProps = {
  showEngineBadge?: boolean;
};

export function OsLogoHeader({ showEngineBadge = true }: OsLogoHeaderProps) {
  return (
    <div className="px-5 py-4 border-b border-[#EAE6DF]">
      <Link href="/" className="inline-flex max-w-[208px]" aria-label="Premortem home">
        <img
          src={osAssets.logoHeader}
          alt="Premortem"
          width={208}
          height={48}
          className="h-11 w-auto max-w-[208px] object-contain object-left"
        />
      </Link>
      {showEngineBadge ? (
        <div className="mt-3 flex max-w-[208px] items-center gap-2 text-[10px] leading-none text-[#717A75] font-mono">
          <span className="shrink-0 tracking-wide">ENGINE {premortemBrand.engineVersion}</span>
          <span className="inline-flex shrink-0 items-center px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 font-bold leading-none">
            STABLE
          </span>
        </div>
      ) : null}
    </div>
  );
}
