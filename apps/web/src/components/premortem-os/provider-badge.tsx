import type { ProviderType } from '@/lib/premortem-os/types';

import { ProviderIcon } from './ProviderIcon';

const PROVIDER_BADGE_BASE =
  'inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-solid uppercase text-[9px] font-semibold mr-1.5 font-mono tracking-wide';

const PROVIDER_BADGE_CONFIG: Record<
  ProviderType,
  { label: string; style: string; icon: string }
> = {
  github: {
    label: 'GitHub',
    style: 'bg-white border-[#D5D5D5] text-[#1E2522]',
    icon: 'github'
  },
  gitlab: {
    label: 'GitLab',
    style: 'bg-orange-50 border-orange-200 text-orange-800',
    icon: 'gitlab'
  },
  bitbucket: {
    label: 'Bitbucket',
    style: 'bg-blue-50 border-blue-200 text-blue-800 font-semibold',
    icon: 'bitbucket'
  },
  aws: {
    label: 'AWS',
    style: 'bg-amber-50 border-amber-200 text-amber-800',
    icon: 'aws'
  },
  azure: {
    label: 'Azure',
    style: 'bg-sky-50 border-sky-200 text-sky-800',
    icon: 'azure-devops'
  },
  gitea: {
    label: 'Gitea',
    style: 'bg-emerald-50 border-emerald-200 text-emerald-800 font-bold',
    icon: 'gitea'
  },
  gcp: {
    label: 'GCP Source',
    style: 'bg-indigo-50 border-indigo-200 text-indigo-800',
    icon: 'google-cloud'
  },
  custom_git: {
    label: 'Custom Git',
    style: 'bg-neutral-50 border-neutral-300 text-neutral-800',
    icon: 'git'
  }
};

type ProviderBadgeProps = {
  provider: ProviderType;
  className?: string;
};

export function ProviderBadge({ provider, className = '' }: ProviderBadgeProps) {
  const config = PROVIDER_BADGE_CONFIG[provider] ?? {
    label: String(provider).toUpperCase(),
    style: 'bg-neutral-50 border-neutral-200 text-neutral-800',
    icon: 'git'
  };

  return (
    <span className={`${PROVIDER_BADGE_BASE} ${config.style} ${className}`}>
      <ProviderIcon slug={config.icon} className="w-3 h-3 inline shrink-0" />
      <span>{config.label}</span>
    </span>
  );
}

export { PROVIDER_BADGE_BASE, PROVIDER_BADGE_CONFIG };
