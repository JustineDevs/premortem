'use client';

import { integrationConnectOptions, integrationConnectHref } from '@/lib/integration-connect';
import { gitLabAccessSummary, resolveGitLabAccessState } from '@/lib/provider-access';
import { ProviderIcon } from './ProviderIcon';
import { ExternalLink, Lock } from 'lucide-react';
import type { WorkspaceIntegration } from '@/hooks/workspace-types';

interface ProviderConnectCardsProps {
  connectedProviders: string[];
  integrations?: WorkspaceIntegration[];
}

export function ProviderConnectCards({
  connectedProviders,
  integrations = []
}: ProviderConnectCardsProps) {
  const connected = new Set(connectedProviders.map((name) => name.toLowerCase()));
  const gitLabAccess = resolveGitLabAccessState(integrations);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {integrationConnectOptions.map((option) => {
        const isConnected =
          option.id === 'gitlab'
            ? gitLabAccess.phase === 'repository_access'
            : connected.has(option.id) || connected.has(option.name.toLowerCase());
        const isAvailable = option.status === 'available';
        const needsRepositoryAccess =
          option.id === 'gitlab' &&
          gitLabAccess.phase === 'identity_only' &&
          !gitLabAccess.integration;

        return (
          <div
            key={option.id}
            className="border border-[#EAE6DF] bg-white rounded-lg p-4 flex flex-col gap-3 hover:border-emerald-950/20 transition-all"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded border border-[#EAE6DF] bg-[#FAF8F5] flex items-center justify-center">
                  <ProviderIcon slug={option.id === 'azure-devops' ? 'azure-devops' : option.id} size={20} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#1E2522] font-display">{option.name}</h4>
                  <p className="text-[10px] font-mono text-[#717A75]">{option.scopes}</p>
                </div>
              </div>
              {isConnected ? (
                <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800">
                  Repository access
                </span>
              ) : needsRepositoryAccess ? (
                <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-900">
                  Sign-in only
                </span>
              ) : option.status === 'coming_soon' ? (
                <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-zinc-100 border border-zinc-200 text-zinc-600">
                  Soon
                </span>
              ) : null}
            </div>

            <p className="text-xs text-[#5C6560] leading-relaxed">
              {option.id === 'gitlab' && needsRepositoryAccess
                ? gitLabAccessSummary('identity_only')
                : option.description}
            </p>

            {isAvailable ? (
              <a
                href={integrationConnectHref(
                  option.id,
                  option.id === 'gitlab' ? '/app?tab=projects&discover=1' : '/app?tab=settings'
                )}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-950 hover:bg-emerald-900 text-[#FAF8F5] rounded font-bold text-[10px] uppercase font-mono tracking-wider transition-all"
              >
                <ExternalLink size={12} />
                {isConnected ? 'Reconnect repository access' : needsRepositoryAccess ? 'Grant repository access' : 'Connect with OAuth'}
              </a>
            ) : (
              <button
                type="button"
                disabled
                className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-[#EAE6DF] bg-[#FAF8F5] text-[#8A958F] rounded font-bold text-[10px] uppercase font-mono tracking-wider cursor-not-allowed"
              >
                <Lock size={12} />
                Coming soon
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
