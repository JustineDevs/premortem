import { RotateCw } from 'lucide-react';

import { premortemBrand } from '@/lib/premortem-os/branding';

import { osAssets } from './os-assets';

type OsLoadingScreenProps = {
  title?: string;
  description?: string;
};

export function OsLoadingScreen({
  title = premortemBrand.loadingTitle,
  description = premortemBrand.loadingDescription
}: OsLoadingScreenProps) {
  return (
    <div className="w-screen h-screen bg-[#FBFBFA] flex flex-col items-center justify-center font-sans px-6">
      <img
        src={osAssets.logoHeader}
        alt={premortemBrand.productName}
        width={208}
        height={48}
        className="h-10 w-auto max-w-[220px] object-contain mb-8"
      />
      <div className="flex flex-col items-center justify-center space-y-4 max-w-md text-center">
        <RotateCw className="text-emerald-950 animate-spin" size={32} aria-hidden="true" />
        <div className="space-y-2">
          <h3 className="font-display font-medium text-lg text-zinc-900 tracking-tight">{title}</h3>
          <p className="text-xs text-[#5C6560] leading-relaxed">{description}</p>
          <p className="text-[10px] font-mono uppercase tracking-wider text-[#8A958F]">
            {premortemBrand.domain}
          </p>
        </div>
      </div>
    </div>
  );
}
