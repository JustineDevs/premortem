import React, { useState, useEffect } from 'react';
import { Project, ProviderType } from '@/lib/premortem-os/types';
import { ProviderBadge } from './provider-badge';
import { ProviderIcon } from './ProviderIcon';
import { OsEmptyState } from './os-empty-state';
import { RepositoryDiscoveryPanel } from './repository-discovery-panel';
import type { WorkspaceIntegration } from '@/hooks/workspace-types';
import { 
  FolderGit2, 
  GitBranch, 
  Plus, 
  Search, 
  CheckCircle, 
  AlertTriangle,
  XCircle,
  HelpCircle,
  Play,
  Database,
  Globe,
  Lock,
  GitPullRequest
} from 'lucide-react';

interface ProjectsViewProps {
  projects: Project[];
  gitlabIntegration?: WorkspaceIntegration | null;
  gitlabAccessPhase?: 'identity_only' | 'repository_access';
  onProjectsChanged?: () => void;
  onTriggerScan: (projectId: string) => void;
  onRegisterProject: (project: {
    name: string;
    repoUrl: string;
    branch: string;
    provider: ProviderType;
    scanCodeSnippet?: string;
  }) => void;
}

export function ProjectsView({
  projects,
  gitlabIntegration = null,
  gitlabAccessPhase = 'identity_only',
  onProjectsChanged,
  onTriggerScan,
  onRegisterProject
}: ProjectsViewProps) {
  const safeProjects = Array.isArray(projects) ? projects : [];
  const [filterType, setFilterType] = useState<'all' | ProviderType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAdvancedForm, setShowAdvancedForm] = useState(false);
  const [autoDiscoverCatalog, setAutoDiscoverCatalog] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('discover') === '1') {
      setAutoDiscoverCatalog(true);
      params.delete('discover');
      const nextUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
      window.history.replaceState({}, '', nextUrl);
    }
  }, []);

  const [newProjName, setNewProjName] = useState('');
  const [newProjUrl, setNewProjUrl] = useState('');
  const [newProjBranch, setNewProjBranch] = useState('main');
  const [newProjProvider, setNewProjProvider] = useState<ProviderType>('gitlab');
  const [formErrors, setFormErrors] = useState<{ name?: string; url?: string }>({});
  const [newProjSnippet, setNewProjSnippet] = useState('');

  const filteredProjects = safeProjects.filter((p) => {
    const matchesProvider = filterType === 'all' || p.provider === filterType;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.repoUrl.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesProvider && matchesSearch;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: { name?: string; url?: string } = {};
    if (!newProjName.trim()) errors.name = 'Project name is required.';
    if (!newProjUrl.trim()) {
      errors.url = 'Repository URL is required.';
    } else {
      try {
        const parsed = new URL(newProjUrl.trim());
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          errors.url = 'URL must use http or https.';
        }
      } catch {
        errors.url = 'Enter a valid repository URL (https://…).';
      }
    }
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    onRegisterProject({
      name: newProjName.trim(),
      repoUrl: newProjUrl.trim(),
      branch: newProjBranch,
      provider: newProjProvider,
      scanCodeSnippet: newProjSnippet.trim() ? newProjSnippet.trim() : undefined
    });

    setNewProjName('');
    setNewProjUrl('');
    setNewProjBranch('main');
    setNewProjProvider('gitlab');
    setFormErrors({});
    setShowAdvancedForm(false);
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 font-sans max-w-7xl mx-auto w-full space-y-8">
      {/* View Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-[#EAE6DF] pb-6 gap-4">
        <div>
          <span className="text-[10px] uppercase tracking-widest font-mono text-[#8A958F]">
            Inventory Registers
          </span>
          <h2 className="text-2xl font-semibold tracking-tight text-[#1E2522] font-display mt-1">
            Projects Inventory
          </h2>
          <p className="text-xs text-[#5C6560] mt-1">
            Browse registered repositories, check branch compliance ratings, and register code assets.
          </p>
        </div>

        <button
          onClick={() => setShowAdvancedForm(!showAdvancedForm)}
          className="px-3 py-2 bg-white text-[#1E2522] hover:bg-[#FAF8F5] border border-[#EAE6DF] text-xs font-semibold rounded flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
        >
          <Plus size={14} />
          <span>Advanced manual register</span>
        </button>
      </div>

      <RepositoryDiscoveryPanel
        gitlabIntegration={gitlabIntegration}
        gitlabAccessPhase={gitlabAccessPhase}
        autoDiscoverOnMount={autoDiscoverCatalog}
        skipDiscoverSessionCache={autoDiscoverCatalog}
        onProjectsChanged={onProjectsChanged}
      />

      {/* Advanced manual registration */}
      {showAdvancedForm && (
        <div className="bg-[#FAF8F5] border border-[#EAE6DF] rounded p-6 shadow-sm animate-fadeIn">
          <h3 className="text-sm font-bold uppercase tracking-wide text-[#1E2522] font-display mb-4 border-b border-[#EAE6DF] pb-2">
            Register repository asset
          </h3>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1.5">
                <label className="block font-mono font-bold uppercase tracking-wider text-[#717A75]">
                  Project name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Identity Management Core"
                  value={newProjName}
                  onChange={(e) => {
                    setNewProjName(e.target.value);
                    if (formErrors.name) setFormErrors((prev) => ({ ...prev, name: undefined }));
                  }}
                  aria-invalid={Boolean(formErrors.name)}
                  className="w-full p-2.5 bg-[#FDFDFD] border border-[#EAE6DF] rounded focus:outline-none focus:border-emerald-950 font-sans text-[#1F2937]"
                />
                {formErrors.name ? (
                  <p className="text-[10px] text-rose-700" role="alert">{formErrors.name}</p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <label className="block font-mono font-bold uppercase tracking-wider text-[#5C6560]">
                  Repository URL
                </label>
                <input
                  type="url"
                  required
                  placeholder="e.g. https://gitlab.com/org/repo"
                  value={newProjUrl}
                  onChange={(e) => {
                    setNewProjUrl(e.target.value);
                    if (formErrors.url) setFormErrors((prev) => ({ ...prev, url: undefined }));
                  }}
                  aria-invalid={Boolean(formErrors.url)}
                  className="w-full p-2.5 bg-[#FDFDFD] border border-[#EAE6DF] rounded focus:outline-none focus:border-emerald-950 font-sans text-xs"
                />
                {formErrors.url ? (
                  <p className="text-[10px] text-rose-700" role="alert">{formErrors.url}</p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <label className="block font-mono font-bold uppercase tracking-wider text-[#717A75]">
                  Tracking branch
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. main"
                  value={newProjBranch}
                  onChange={(e) => setNewProjBranch(e.target.value)}
                  className="w-full p-2.5 bg-[#FDFDFD] border border-[#EAE6DF] rounded focus:outline-none focus:border-emerald-950 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block font-mono font-bold uppercase tracking-wider text-[#717A75]">
                  Provider
                </label>
                <select
                  value={newProjProvider}
                  onChange={(e) => setNewProjProvider(e.target.value as ProviderType)}
                  className="w-full p-2.5 bg-[#FDFDFD] border border-[#EAE6DF] rounded focus:outline-none focus:border-emerald-950 font-sans cursor-pointer text-xs font-semibold"
                >
                  <option value="gitlab">GitLab (recommended)</option>
                  <option value="github">GitHub</option>
                  <option value="bitbucket">BitBucket Cloud Workspaces</option>
                  <option value="azure">Azure DevOps Pipelines Git</option>
                  <option value="gitea">Gitea On-Prem Server (Secure)</option>
                  <option value="gcp">Google Cloud Source Repositories</option>
                  <option value="aws">AWS CodeCommit Services</option>
                  <option value="custom_git">Custom Self-Hosted Git Root VCS</option>
                </select>
              </div>
            </div>

            {/* Optional snippet for users who want to attach a representative code sample */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <label className="block font-mono font-bold uppercase tracking-wider text-[#717A75]">
                  Source code snippet
                </label>
                <span className="text-[10px] text-[#868A81] font-mono">
                  Optional. Attach a representative snippet if you want the first audit to ground on source text.
                </span>
              </div>
              <textarea
                rows={7}
                value={newProjSnippet}
                onChange={(e) => setNewProjSnippet(e.target.value)}
                placeholder="Paste an optional representative source snippet here, or leave this blank."
                className="w-full p-3 font-mono text-[11px] bg-slate-900 text-slate-100 border border-slate-800 rounded focus:outline-none focus:border-emerald-500 leading-relaxed"
              />
            </div>

            <div className="flex gap-2 justify-end text-xs">
              <button
                type="button"
                onClick={() => setShowAdvancedForm(false)}
                className="px-4 py-2 border border-[#EAE6DF] text-[#4A5550] hover:bg-[#FAF8F5] rounded font-semibold transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-950 text-white rounded font-semibold hover:bg-emerald-900 transition-all cursor-pointer"
              >
                Submit Asset Registration
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter and Search controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#FAF8F5] p-4 border border-[#EAE6DF] rounded">
        {/* Pills selections */}
        <div className="flex flex-wrap gap-1.5 items-center">
          {(['all', 'github', 'gitlab', 'bitbucket', 'azure', 'gitea', 'gcp', 'aws', 'custom_git'] as const).map((type) => {
            const iconSlugs: Record<string, string> = {
              github: 'github',
              gitlab: 'gitlab',
              bitbucket: 'bitbucket',
              azure: 'azure-devops',
              gitea: 'gitea',
              gcp: 'google-cloud',
              aws: 'aws',
              custom_git: 'git'
            };
            const iconSlug = iconSlugs[type];
            return (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-2.5 py-1 text-[9.5px] uppercase tracking-wide font-mono font-bold rounded-sm border cursor-pointer flex items-center gap-1.5 transition-all ${
                  filterType === type
                    ? 'bg-emerald-950 border-emerald-950 text-white shadow-sm'
                    : 'bg-white border-[#EAE6DF] text-[#4A5550] hover:bg-[#FDFDFD]'
                }`}
              >
                {iconSlug && (
                  <ProviderIcon 
                    slug={iconSlug}
                    className="w-3.5 h-3.5 inline"
                  />
                )}
                <span>{type === 'custom_git' ? 'Custom VCS' : type === 'gcp' ? 'GCP Repos' : type}</span>
              </button>
            );
          })}
        </div>

        {/* Search input bar */}
        <div className="relative w-full sm:w-64 text-xs">
          <input
            type="text"
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full p-2 pl-8 border border-[#EAE6DF] bg-white rounded focus:outline-none focus:border-emerald-950 text-[#1F2937]"
          />
          <Search size={14} className="text-[#8A958F] absolute left-2.5 top-2.5" />
        </div>
      </div>

      {/* Projects Inventory Table Grid */}
      {safeProjects.length === 0 ? (
        <OsEmptyState
          icon={FolderGit2}
          title="No projects registered yet"
          description="Connect a repository to start continuous security audits and compliance tracking."
          action={
            <button
              type="button"
              onClick={() => setShowAdvancedForm(true)}
              className="cursor-pointer rounded bg-emerald-950 px-4 py-2 text-xs font-semibold text-[#FAF8F5] hover:bg-emerald-900"
            >
              Register first repository
            </button>
          }
        />
      ) : (
      <div className="border border-[#EAE6DF] bg-[#FAF8F5] rounded overflow-hidden">
        <table className="w-full text-left border-collapse font-sans text-xs">
          <thead>
            <tr className="border-b border-[#EAE6DF] bg-[#FAF8F5] font-mono text-[10px] text-[#8A958F] uppercase">
              <th className="p-4">Project name</th>
              <th className="p-4">Tracking Repository URL</th>
              <th className="p-4">Branch</th>
              <th className="p-4">Compliance Rating</th>
              <th className="p-4">Endpoints Map</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EAE6DF]/60 bg-white">
            {filteredProjects.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center p-8 text-[#5C6560] italic">
                  No registered repository assets matched of current filters.
                </td>
              </tr>
            ) : (
              filteredProjects.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/50 transition-all">
                  {/* Name and Platform host icons */}
                  <td className="p-4 font-semibold text-[#1C1D1B] font-display">
                    <div className="flex items-center gap-2">
                      <FolderGit2 size={16} className="text-[#5C6560]" />
                      <span>{p.name}</span>
                    </div>
                  </td>

                  {/* Repo URL with target tag */}
                  <td className="p-4 font-mono text-[#5C6560] max-w-xs truncate">
                    <ProviderBadge provider={p.provider} />
                    <span>{p.repoUrl}</span>
                  </td>

                  {/* Branch text */}
                  <td className="p-4 font-mono font-medium">
                    <div className="flex items-center gap-1">
                      <GitBranch size={11} className="text-zinc-400" />
                      <span>{p.branch}</span>
                    </div>
                  </td>

                  {/* Score & Badge status */}
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${
                        p.status === 'COMPLIANT' ? 'bg-emerald-600' : p.status === 'WARNING' ? 'bg-amber-500' : p.status === 'SCANNING' ? 'bg-indigo-500 animate-pulse' : 'bg-rose-600'
                      }`} />
                      
                      <span className="font-mono font-bold text-[#1C1D1B] text-[11px]">
                        {p.lastAuditScore !== null ? `${p.lastAuditScore}%` : 'N/A'}
                      </span>

                      <span className={`text-[9px] font-mono border px-1.5 py-0.2 rounded font-bold uppercase tracking-wider ${
                        p.status === 'COMPLIANT' 
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                          : p.status === 'WARNING' 
                            ? 'bg-amber-50 border-amber-200 text-amber-800'
                            : p.status === 'SCANNING'
                              ? 'bg-indigo-50 border-indigo-200 text-indigo-800 animate-pulse'
                              : 'bg-rose-50 border-rose-200 text-rose-800'
                      }`}>
                        {p.status}
                      </span>
                    </div>
                  </td>

                  {/* Infrastructure count */}
                  <td className="p-4 font-mono text-[11px] text-[#5C6560]">
                    <div className="space-y-0.5">
                      <span className="block font-bold text-zinc-800">
                        {p.infrastructureCount} infra resources
                      </span>
                      <span className="block text-[10px]">
                        {p.apiEndpointsCount} APIs ({p.unencryptedEndpointsCount} plain HTTP)
                      </span>
                    </div>
                  </td>

                  {/* Run audit triggers */}
                  <td className="p-4 text-right">
                    <button
                      onClick={() => onTriggerScan(p.id)}
                      disabled={p.status === 'SCANNING'}
                      className="p-1 px-3 border border-[#EAE6DF] hover:border-emerald-950 font-semibold text-[10px] rounded hover:bg-[#FAF8F5] transition-all inline-flex items-center gap-1 text-[#1C1D1B] font-sans disabled:opacity-50 cursor-pointer"
                    >
                      <Play size={10} className="fill-current text-current" />
                      <span>{p.status === 'SCANNING' ? 'SCANNING...' : 'RUN AUDIT'}</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}
