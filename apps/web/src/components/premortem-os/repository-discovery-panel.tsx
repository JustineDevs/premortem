'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Globe, Loader2, RefreshCw, Search } from 'lucide-react';

import type { WorkspaceIntegration } from '@/hooks/workspace-types';
import { useRepositoryDiscoveryMutations } from '@/hooks/use-os-console-data';
import { integrationConnectHref } from '@/lib/integration-connect';
import { gitLabAccessSummary, type ProviderAccessPhase } from '@/lib/provider-access';

type DiscoveredRow = {
  externalProjectId: string;
  name: string;
  repoUrl: string;
  defaultBranch: string;
  visibility: string;
  enabled: boolean;
  projectId: string | null;
  canWriteIssues: boolean;
};

interface RepositoryDiscoveryPanelProps {
  gitlabIntegration: WorkspaceIntegration | null;
  gitlabAccessPhase?: ProviderAccessPhase;
  autoDiscoverOnMount?: boolean;
  skipDiscoverSessionCache?: boolean;
  onProjectsChanged?: () => void;
}

export function RepositoryDiscoveryPanel({
  gitlabIntegration,
  gitlabAccessPhase = gitlabIntegration ? 'repository_access' : 'identity_only',
  autoDiscoverOnMount = false,
  skipDiscoverSessionCache = false,
  onProjectsChanged
}: RepositoryDiscoveryPanelProps) {
  const { discoverRepositories, enableRepositories, registerPublicRepository } =
    useRepositoryDiscoveryMutations();

  const [mode, setMode] = useState<'discover' | 'public'>('discover');
  const [catalog, setCatalog] = useState<DiscoveredRow[]>([]);
  const [catalogQuery, setCatalogQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [publicReference, setPublicReference] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const autoDiscoverAttemptedRef = useRef(false);

  const filteredCatalog = useMemo(() => {
    const q = catalogQuery.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter(
      (row) =>
        row.name.toLowerCase().includes(q) ||
        row.externalProjectId.toLowerCase().includes(q) ||
        row.repoUrl.toLowerCase().includes(q)
    );
  }, [catalog, catalogQuery]);

  const handleDiscover = async () => {
    if (!gitlabIntegration?.id) return;
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const payload = await discoverRepositories.mutateAsync(gitlabIntegration.id);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(`premortem:catalog:${gitlabIntegration.id}`, '1');
      }
      setCatalog(payload.repositories);
      setSelectedIds(new Set());
      setStatusMessage(
        payload.lastSyncedAt
          ? `Found ${payload.repositories.length} accessible repositories.`
          : 'Discovery complete.'
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Discovery failed.');
    }
  };

  useEffect(() => {
    if (!autoDiscoverOnMount || !gitlabIntegration?.id || autoDiscoverAttemptedRef.current) {
      return;
    }

    const sessionKey = `premortem:catalog:${gitlabIntegration.id}`;
    if (
      !skipDiscoverSessionCache &&
      typeof window !== 'undefined' &&
      sessionStorage.getItem(sessionKey) === '1'
    ) {
      return;
    }

    autoDiscoverAttemptedRef.current = true;
    setErrorMessage(null);
    setStatusMessage(null);
    void discoverRepositories
      .mutateAsync(gitlabIntegration.id)
      .then((payload) => {
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(sessionKey, '1');
        }
        setCatalog(payload.repositories);
        setSelectedIds(new Set());
        setStatusMessage(
          payload.lastSyncedAt
            ? `Found ${payload.repositories.length} accessible repositories.`
            : 'Discovery complete.'
        );
      })
      .catch((error: unknown) => {
        autoDiscoverAttemptedRef.current = false;
        setErrorMessage(error instanceof Error ? error.message : 'Discovery failed.');
      });
  }, [autoDiscoverOnMount, gitlabIntegration?.id, discoverRepositories, skipDiscoverSessionCache]);

  const toggleSelection = (externalProjectId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(externalProjectId)) next.delete(externalProjectId);
      else next.add(externalProjectId);
      return next;
    });
  };

  const handleEnableSelected = async () => {
    if (!gitlabIntegration?.id || selectedIds.size === 0) return;
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const result = await enableRepositories.mutateAsync({
        integrationId: gitlabIntegration.id,
        externalProjectIds: [...selectedIds]
      });
      const enabledCount = result.enabled?.length ?? 0;
      const errorCount = result.errors?.length ?? 0;
      setStatusMessage(
        enabledCount > 0
          ? `Enabled ${enabledCount} repositor${enabledCount === 1 ? 'y' : 'ies'}.${errorCount > 0 ? ` ${errorCount} could not be enabled.` : ''}`
          : 'No repositories were enabled.'
      );
      if (errorCount > 0 && result.errors[0]?.error) {
        setErrorMessage(result.errors.map((e) => `${e.externalProjectId}: ${e.error}`).join(' '));
      }
      setSelectedIds(new Set());
      await handleDiscover();
      onProjectsChanged?.();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Enable failed.');
    }
  };

  const handleRegisterPublic = async (event: React.FormEvent) => {
    event.preventDefault();
    const reference = publicReference.trim();
    if (!reference) return;
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      await registerPublicRepository.mutateAsync(reference);
      setPublicReference('');
      setStatusMessage('Public repository added for read-only audits.');
      onProjectsChanged?.();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Registration failed.');
    }
  };

  return (
    <div className="bg-[#FAF8F5] border border-[#EAE6DF] rounded p-6 shadow-sm space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-[#EAE6DF] pb-4">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide text-[#1E2522] font-display">
            Add repositories
          </h3>
          <p className="text-xs text-[#5C6560] mt-1">
            After GitLab repository access is granted, catalogs load automatically. Public repos need no OAuth.
          </p>
        </div>
        <div className="flex gap-1 text-[10px] font-mono uppercase">
          <button
            type="button"
            onClick={() => setMode('discover')}
            className={`px-3 py-1.5 rounded border cursor-pointer ${
              mode === 'discover'
                ? 'bg-emerald-950 text-white border-emerald-950'
                : 'bg-white border-[#EAE6DF] text-[#4A5550]'
            }`}
          >
            GitLab discover
          </button>
          <button
            type="button"
            onClick={() => setMode('public')}
            className={`px-3 py-1.5 rounded border cursor-pointer flex items-center gap-1 ${
              mode === 'public'
                ? 'bg-emerald-950 text-white border-emerald-950'
                : 'bg-white border-[#EAE6DF] text-[#4A5550]'
            }`}
          >
            <Globe size={12} />
            Public watch
          </button>
        </div>
      </div>

      {statusMessage ? (
        <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded px-3 py-2">
          {statusMessage}
        </p>
      ) : null}
      {errorMessage ? (
        <p className="text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded px-3 py-2" role="alert">
          {errorMessage}
        </p>
      ) : null}

      {mode === 'discover' ? (
        !gitlabIntegration ? (
          <div className="text-xs text-[#5C6560] space-y-3">
            <p>{gitLabAccessSummary(gitlabAccessPhase)}</p>
            <p className="text-[10px] text-[#868A81]">
              Sign-in uses read-only identity scopes. Repository discovery and issue publish require a one-time
              repository access grant (read_user, api, read_repository).
            </p>
            <a
              href={integrationConnectHref('gitlab', '/app?tab=projects&discover=1')}
              className="inline-flex px-3 py-2 bg-emerald-950 text-white rounded text-xs font-semibold hover:bg-emerald-900"
            >
              Grant GitLab repository access
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
              <p className="text-xs text-[#5C6560]">
                Connected as <span className="font-mono">{gitlabIntegration.vcsOwner}</span>
                {discoverRepositories.isPending ? (
                  <span className="ml-2 inline-flex items-center gap-1 text-emerald-800">
                    <Loader2 size={12} className="animate-spin" />
                    Loading catalog…
                  </span>
                ) : null}
              </p>
              <button
                type="button"
                onClick={() => void handleDiscover()}
                disabled={discoverRepositories.isPending}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border border-[#EAE6DF] rounded bg-white hover:bg-[#FDFDFD] cursor-pointer disabled:opacity-50"
              >
                {discoverRepositories.isPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <RefreshCw size={14} />
                )}
                Refresh catalog
              </button>
            </div>

            {catalog.length > 0 ? (
              <>
                <div className="relative text-xs">
                  <Search size={14} className="absolute left-2.5 top-2.5 text-[#8A958F]" />
                  <input
                    type="text"
                    placeholder="Filter repositories..."
                    value={catalogQuery}
                    onChange={(e) => setCatalogQuery(e.target.value)}
                    className="w-full p-2 pl-8 border border-[#EAE6DF] bg-white rounded focus:outline-none focus:border-emerald-950"
                  />
                </div>

                <div className="max-h-64 overflow-y-auto border border-[#EAE6DF] rounded bg-white divide-y divide-[#EAE6DF]/60">
                  {filteredCatalog.map((row) => (
                    <label
                      key={row.externalProjectId}
                      className="flex items-start gap-3 p-3 cursor-pointer hover:bg-slate-50/80 text-xs"
                    >
                      <input
                        type="checkbox"
                        checked={row.enabled || selectedIds.has(row.externalProjectId)}
                        disabled={row.enabled}
                        onChange={() => toggleSelection(row.externalProjectId)}
                        className="mt-0.5"
                      />
                      <span className="flex-1 min-w-0">
                        <span className="font-semibold text-[#1E2522] block truncate">{row.name}</span>
                        <span className="font-mono text-[10px] text-[#5C6560] block truncate">
                          {row.externalProjectId}
                        </span>
                        <span className="text-[10px] text-[#868A81]">
                          {row.visibility}
                          {row.canWriteIssues ? ' · can publish issues' : ' · read-only publish'}
                        </span>
                      </span>
                      {row.enabled ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 font-mono uppercase">
                          <CheckCircle2 size={12} />
                          Enabled
                        </span>
                      ) : null}
                    </label>
                  ))}
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => void handleEnableSelected()}
                    disabled={selectedIds.size === 0 || enableRepositories.isPending}
                    className="px-4 py-2 bg-emerald-950 text-white rounded text-xs font-semibold hover:bg-emerald-900 disabled:opacity-50 cursor-pointer"
                  >
                    {enableRepositories.isPending ? 'Enabling…' : `Enable selected (${selectedIds.size})`}
                  </button>
                </div>
              </>
            ) : (
              <p className="text-xs text-[#5C6560] italic">
                {discoverRepositories.isPending
                  ? 'Discovering repositories from GitLab…'
                  : 'Catalog is empty. Refresh to load repositories from your GitLab account.'}
              </p>
            )}
          </div>
        )
      ) : (
        <form onSubmit={(e) => void handleRegisterPublic(e)} className="space-y-3 text-xs">
          <label className="block space-y-1.5">
            <span className="font-mono font-bold uppercase tracking-wider text-[#717A75]">
              GitLab URL or namespace/project
            </span>
            <input
              type="text"
              value={publicReference}
              onChange={(e) => setPublicReference(e.target.value)}
              placeholder="e.g. gitlab.com/org/repo or https://gitlab.com/org/repo"
              className="w-full p-2.5 bg-white border border-[#EAE6DF] rounded focus:outline-none focus:border-emerald-950 font-mono"
            />
          </label>
          <p className="text-[10px] text-[#868A81]">
            Public watch runs audits only. Issue publish stays disabled until you connect GitLab with write access.
          </p>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!publicReference.trim() || registerPublicRepository.isPending}
              className="px-4 py-2 bg-emerald-950 text-white rounded font-semibold hover:bg-emerald-900 disabled:opacity-50 cursor-pointer"
            >
              {registerPublicRepository.isPending ? 'Adding…' : 'Add public repository'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
