import React, { useState } from 'react';
import { premortemBrand } from '@/lib/premortem-os/branding';
import { authLinks } from '@/lib/auth-links';
import {
  GitBranch, 
  Settings, 
  Key, 
  Check, 
  X, 
  Cpu, 
  Lock, 
  Sliders, 
  AlertOctagon, 
  Fingerprint,
  Info,
  CreditCard,
  Coins,
  Bell,
  Zap,
  Building2,
  TrendingUp,
  Plus,
  Trash2,
  ExternalLink,
  ShieldCheck,
  FileText,
  Activity,
  CheckSquare,
  HelpCircle,
  Download,
  AlertTriangle,
  User,
  MoreVertical,
  RefreshCcw,
  RotateCw,
  Map,
  PlusCircle,
  LogOut
} from 'lucide-react';
import { ProviderConnectCards } from './provider-connect-cards';
import { ProviderIcon } from './ProviderIcon';
import { OsIconButton } from './os-icon-button';
import type { Project } from '@/lib/premortem-os/types';
import { DEFAULT_WORK_ITEM_ATTRIBUTE_CONFIG, type WorkItemAttributeConfig } from '@premortem/domain';
import { DEFAULT_VENDOR_ROUTING, type VendorRoutingTier } from '@/lib/premortem-os/vendor-pool';
import { useWorkspace } from '@/hooks/use-workspace';
import { useReconciliationEvents } from '@/hooks/use-os-console-data';

const getIconSlugByName = (name: string) => {
  const lowercase = name.toLowerCase();
  if (lowercase.includes('github')) return 'github';
  if (lowercase.includes('gitlab')) return 'gitlab';
  if (lowercase.includes('bitbucket')) return 'bitbucket';
  if (lowercase.includes('azure')) return 'azure-devops';
  if (lowercase.includes('gitea')) return 'gitea';
  if (lowercase.includes('google') || lowercase.includes('gcp') || lowercase.includes('cloud source')) return 'google-cloud';
  if (lowercase.includes('aws')) return 'aws';
  return 'git';
};

export function SettingsView({ projects: _projects }: { projects?: Project[] }) {
  const {
    workspace,
    isLoading,
    error,
    patchPolicies,
    patchRuntime,
    patchWorkItemAttributes,
    patchNotifications,
    patchLlm,
    patchProfile,
    patchOrganization,
    patchBillingPlan,
    startCheckout,
    reconcileIssues,
    syncIntegration
  } = useWorkspace();
  const reconciliationQuery = useReconciliationEvents();

  const [activeSubTab, setActiveSubTab] = useState<'profile' | 'organization' | 'integrations' | 'providers' | 'billing' | 'notifications'>('integrations');
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [authConfigured, setAuthConfigured] = useState<boolean | null>(null);

  const [profileDraft, setProfileDraft] = useState({ fullName: '', username: '', timezone: 'UTC' });
  const [organizationDraft, setOrganizationDraft] = useState({ name: '', billingEmail: '', websiteUrl: '' });
  const [selectedGeminiModel, setSelectedGeminiModel] = useState('gemini-3-flash-preview');
  const [maxTokens, setMaxTokens] = useState(8192);
  const [temperature, setTemperature] = useState(0.2);
  const [customProviders, setCustomProviders] = useState<
    Array<{ name: string; host: string; model: string; active: boolean }>
  >([]);
  const [vendorRouting, setVendorRouting] = useState<VendorRoutingTier[]>(
    DEFAULT_VENDOR_ROUTING.map((tier) => ({ ...tier }))
  );
  const [workItemAttributes, setWorkItemAttributes] = useState<WorkItemAttributeConfig>(
    DEFAULT_WORK_ITEM_ATTRIBUTE_CONFIG
  );
  const [newProvName, setNewProvName] = useState('');
  const [newProvHost, setNewProvHost] = useState('');
  const [newProvModel, setNewProvModel] = useState('');
  const [activeTier, setActiveTier] = useState<'free' | 'pro' | 'team' | 'enterprise'>('free');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [slackWebhook, setSlackWebhook] = useState('');
  const [slackChannel, setSlackChannel] = useState('');
  const [isSlackConnected, setIsSlackConnected] = useState(false);
  const [alertEmails, setAlertEmails] = useState('');
  const [alertSeverity, setAlertSeverity] = useState('HIGH');

  React.useEffect(() => {
    void fetch('/api/auth/status')
      .then((response) => response.json())
      .then((payload) => setAuthConfigured(Boolean(payload.configured)))
      .catch(() => setAuthConfigured(false));
  }, []);

  React.useEffect(() => {
    if (!workspace) return;
    setProfileDraft({
      fullName: workspace.profile.fullName ?? '',
      username: workspace.profile.username ?? '',
      timezone: workspace.profile.timezone
    });
    setOrganizationDraft({
      name: workspace.organization.name,
      billingEmail: workspace.organization.billingEmail ?? '',
      websiteUrl: workspace.organization.websiteUrl ?? ''
    });
    setSelectedGeminiModel(workspace.llm.selectedGeminiModel);
    setMaxTokens(workspace.llm.maxTokens);
    setTemperature(workspace.llm.temperature);
    setCustomProviders(workspace.llm.customProviders);
    setVendorRouting(
      workspace.llm.vendorRouting?.length
        ? workspace.llm.vendorRouting.map((tier) => ({ ...tier }))
        : DEFAULT_VENDOR_ROUTING.map((tier) => ({ ...tier }))
    );
    setWorkItemAttributes(workspace.workItemAttributes ?? DEFAULT_WORK_ITEM_ATTRIBUTE_CONFIG);
    setActiveTier(workspace.billing.plan as typeof activeTier);
    setSlackWebhook(workspace.notifications.slackWebhook);
    setSlackChannel(workspace.notifications.slackChannel);
    setIsSlackConnected(workspace.notifications.isSlackConnected);
    setAlertEmails(workspace.notifications.alertEmails);
    setAlertSeverity(workspace.notifications.alertSeverity);
  }, [workspace]);

  const integrations = workspace?.integrations ?? [];
  const policies = workspace?.policies ?? [];
  const usageStats = workspace?.usage ?? {
    scans: { used: 0, limit: 0 },
    tokens: { used: 0, limit: 0 },
    patches: { used: 0, limit: 0 }
  };
  const invoices = workspace?.billing.invoices ?? [];

  const showToast = (message: string) => {
    setSuccessToast(message);
    setTimeout(() => {
      setSuccessToast(null);
    }, 3050);
  };

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const notice = params.get('integration_notice');
    if (!notice) return;

    const messages: Record<string, string> = {
      gitlab_connected: 'GitLab connected successfully. Repository access is ready.',
      coming_soon: 'That provider connector is coming soon.',
      denied: 'Provider authorization was cancelled.',
      config: 'GitLab OAuth is not configured. Set GITLAB_CLIENT_ID and GITLAB_CLIENT_SECRET.',
      invalid_state: 'OAuth state mismatch. Please try connecting again.',
      oauth_failed: 'Provider OAuth failed. Check credentials and redirect URI.',
      persist_failed: 'Connected to GitLab but failed to save the connection.'
    };

    const detail = params.get('integration_detail');
    showToast(detail ? `${messages[notice] ?? 'Integration updated.'} (${detail})` : messages[notice] ?? 'Integration updated.');

    params.delete('integration_notice');
    params.delete('integration_detail');
    params.delete('integration_provider');
    const nextUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
    window.history.replaceState({}, '', nextUrl);
  }, []);

  const togglePolicy = async (id: string) => {
    const nextPolicies = policies.map((policy) =>
      policy.id === id ? { ...policy, active: !policy.active } : policy
    );
    try {
      await patchPolicies(nextPolicies);
      showToast('Continuous enforcement policy thresholds updated.');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save policy.');
    }
  };

  const handleAddCustomProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProvName || !newProvHost) {
      alert('Provide a valid name and host coordinate path.');
      return;
    }
    const nextProviders = [
      ...customProviders,
      {
        name: newProvName,
        host: newProvHost,
        model: newProvModel || 'custom-model',
        active: true
      }
    ];
    try {
      await patchLlm({
        selectedGeminiModel,
        maxTokens,
        temperature,
        customProviders: nextProviders
      });
      setNewProvName('');
      setNewProvHost('');
      setNewProvModel('');
      showToast(`Registered custom AI engine provider "${newProvName}" successfully.`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save provider.');
    }
  };

  const handleDeleteProvider = async (index: number) => {
    const item = customProviders[index];
    const nextProviders = customProviders.filter((_, idx) => idx !== index);
    try {
      await patchLlm({ customProviders: nextProviders });
      showToast(`Removed custom provider "${item.name}".`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to remove provider.');
    }
  };

  const triggerInvoiceDownload = (invoiceId: string) => {
    showToast(`Stripe billing portal required to download ${invoiceId}.`);
  };

  if (isLoading) {
    return (
      <div className="flex-1 p-8 text-center text-xs text-[#5C6560] italic">
        Loading workspace integrations and scopes from runtime…
      </div>
    );
  }

  if (error || !workspace) {
    return (
      <div className="flex-1 p-8 text-center text-xs text-rose-700">
        {error ?? 'Unable to load workspace settings.'}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 font-sans max-w-7xl mx-auto w-full space-y-8 animate-fadeIn" id="settings-view-hub">
      
      {/* Toast block banner */}
      {successToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-950 border border-emerald-800 text-[#FAF8F5] p-3 px-5 rounded-md text-xs flex items-center gap-2 shadow-xl font-mono uppercase tracking-wider">
          <CheckSquare size={14} className="text-emerald-400" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Main Settings Title banner */}
      <div className="border-b border-[#EAE6DF] pb-5">
        <span className="text-[9px] uppercase tracking-widest font-mono text-[#8A958F] block font-bold">
          System Administration Space
        </span>
        <h2 className="text-xl font-bold tracking-tight text-[#1E2522] font-display mt-0.5">
          Workspace Parameters
        </h2>
      </div>

      {/* Grid containing left sidebar and right tab detail panel */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
        
        {/* Left Sidebar Menu */}
        <div className="lg:col-span-1 space-y-5 bg-[#FAF8F5] border border-[#EAE6DF] p-5 rounded-lg">
          <div>
            <h3 className="text-sm font-bold tracking-tight text-[#1E2522] uppercase font-mono">Settings</h3>
            <p className="text-[10px] text-[#717A75] font-mono">WORKSPACE CONFIG</p>
          </div>
          
          <nav className="flex flex-row lg:flex-col overflow-x-auto lg:overflow-x-visible gap-1.5 pb-2 lg:pb-0 scrollbar-none">
            {[
              { id: 'profile', name: 'Profile', icon: User },
              { id: 'organization', name: 'Organization', icon: Building2 },
              { id: 'integrations', name: 'Providers', icon: Sliders },
              { id: 'providers', name: 'AI Model Config', icon: Cpu },
              { id: 'billing', name: 'Billing', icon: CreditCard },
              { id: 'notifications', name: 'Webhooks', icon: Bell }
            ].map((subTab) => {
              const IconComp = subTab.icon;
              const isSelected = activeSubTab === subTab.id;
              return (
                <button
                  key={subTab.id}
                  onClick={() => {
                    setActiveSubTab(subTab.id as typeof activeSubTab);
                  }}
                  className={`py-2 px-3 text-xs rounded transition-all cursor-pointer flex items-center gap-2.5 whitespace-nowrap outline-none border-0 ${
                    isSelected
                      ? 'bg-emerald-950 font-bold text-[#FAF8F5] shadow-sm'
                      : 'text-[#4A5550] hover:bg-[#FAF8F5] hover:text-[#1E2522]'
                  }`}
                >
                  <IconComp size={14} className={isSelected ? 'text-white' : 'text-[#717A75]'} />
                  <span>{subTab.name}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right Detail Content Panel */}
        <div className="lg:col-span-3 space-y-6">

          {/* ==================== TAB: PROFILE ==================== */}
          {activeSubTab === 'profile' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-[#FAF8F5] border border-[#EAE6DF] rounded-lg p-6 space-y-6">
                <div>
                  <h3 className="text-md font-bold text-[#1E2522] font-display mb-1">
                    User Profile Account
                  </h3>
                  <p className="text-xs text-[#717A75]">
                    Configure your administrative profile and private identity keys.
                  </p>
                </div>

                <div className="flex flex-col md:flex-row gap-6 items-start md:items-center p-4 bg-white border border-[#EAE6DF] rounded">
                  <div className="w-14 h-14 bg-emerald-950 text-white rounded-full flex items-center justify-center font-bold text-lg border border-emerald-900 shadow font-display">
                    {(workspace.profile.fullName ?? workspace.profile.email ?? '?').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono uppercase bg-slate-100 border px-1.5 py-0.2 rounded font-bold text-slate-800">
                      {workspace.profile.role}
                    </span>
                    <h4 className="text-md font-bold text-neutral-900 font-display">
                      {workspace.profile.email ?? workspace.profile.username ?? workspace.profile.id}
                    </h4>
                    <p className="text-[11px] text-[#717A75]">Profile loaded from Supabase session and Premortem runtime.</p>
                  </div>
                </div>

                <form
                  id="profile-settings-form"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    try {
                      await patchProfile(profileDraft);
                      showToast('Profile settings updated successfully.');
                    } catch (err) {
                      alert(err instanceof Error ? err.message : 'Failed to save profile.');
                    }
                  }}
                  className="space-y-4 text-xs"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block font-mono font-bold text-zinc-500 uppercase tracking-wider text-[9px]">Full Display Name</label>
                      <input
                        type="text"
                        value={profileDraft.fullName}
                        onChange={(e) => setProfileDraft((prev) => ({ ...prev, fullName: e.target.value }))}
                        className="w-full p-2.5 bg-white border border-[#EAE6DF] rounded text-xs text-zinc-900 font-medium"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block font-mono font-bold text-zinc-500 uppercase tracking-wider text-[9px]">Contact Email Address</label>
                      <input
                        type="email"
                        value={workspace.profile.email ?? ''}
                        disabled
                        className="w-full p-2.5 bg-zinc-50 border border-[#EAE6DF] rounded text-xs text-zinc-450 cursor-not-allowed font-medium font-mono"
                      />
                    </div>
                  </div>
                </form>

                <div className="pt-2 flex flex-wrap items-center gap-3">
                  <button type="submit" form="profile-settings-form" className="py-2 px-4 bg-emerald-950 font-bold text-white rounded hover:bg-emerald-900 transition-all cursor-pointer">
                    Save Profile Updates
                  </button>
                  <form action={authLinks.logout} method="POST">
                    <button
                      type="submit"
                      className="inline-flex items-center gap-2 py-2 px-4 bg-white border border-[#EAE6DF] font-bold text-[#1E2522] rounded hover:bg-zinc-50 transition-all cursor-pointer"
                    >
                      <LogOut size={14} aria-hidden="true" />
                      Log Out
                    </button>
                  </form>
                </div>
              </div>

              {/* Security Logs list */}
              <div className="p-6 bg-white border border-[#EAE6DF] rounded-lg space-y-4">
                <h4 className="text-xs font-mono uppercase font-bold tracking-wider text-[#1E2522]">Recent Security Access Trails</h4>
                <div className="font-mono text-[10px] space-y-2 text-[#717A75]">
                  {workspace.activity.length === 0 ? (
                    <p className="italic">No activity events recorded yet. Run an audit to populate trails.</p>
                  ) : (
                    workspace.activity.map((event) => (
                      <div key={event.id} className="flex justify-between border-b pb-1.5">
                        <span>{event.summary}</span>
                        <span className="text-zinc-500">{new Date(event.createdAt).toLocaleString()}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ==================== TAB: ORGANIZATION ==================== */}
          {activeSubTab === 'organization' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-[#FAF8F5] border border-[#EAE6DF] rounded-lg p-6 space-y-6">
                <div>
                  <h3 className="text-md font-bold text-[#1E2522] font-display mb-1 flex items-center gap-2">
                    <Building2 size={16} />
                    Organization Profile Settings
                  </h3>
                  <p className="text-xs text-[#717A75]">
                    Manage company identity, check regulatory compliances, and enable continuous policies gates.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
                  <div className="p-4 bg-white border border-[#EAE6DF] rounded space-y-1">
                    <span className="text-[9px] text-[#8A958F] font-bold block uppercase">Organization Name</span>
                    <span className="font-bold text-[#1E2522] text-sm font-sans block">{workspace.organization.name}</span>
                  </div>
                  <div className="p-4 bg-white border border-[#EAE6DF] rounded space-y-1">
                    <span className="text-[9px] text-[#8A958F] font-bold block uppercase">Subscription Tier</span>
                    <span className="font-bold text-emerald-800 text-sm font-sans block capitalize">{workspace.billing.plan}</span>
                  </div>
                  <div className="p-4 bg-white border border-[#EAE6DF] rounded space-y-1">
                    <span className="text-[9px] text-[#8A958F] font-bold block uppercase">Workspace Activity</span>
                    <span className="font-bold text-[#1E2522] text-sm font-sans block">
                      {workspace.runtime.runningAudits} running · {workspace.organization.projectCount} projects · {workspace.organization.memberCount} members
                    </span>
                  </div>
                </div>

                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    try {
                      await patchOrganization(organizationDraft);
                      showToast('Organization profile saved.');
                    } catch (err) {
                      alert(err instanceof Error ? err.message : 'Failed to save organization.');
                    }
                  }}
                  className="border border-[#EAE6DF] bg-white rounded-lg p-5 space-y-4 text-xs"
                >
                  <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-900 flex items-center gap-1.5">
                    <Building2 size={14} className="text-emerald-700" />
                    Organization Details
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block font-mono font-bold text-zinc-500 uppercase tracking-wider text-[9px]">Display Name</label>
                      <input
                        type="text"
                        value={organizationDraft.name}
                        onChange={(e) => setOrganizationDraft((prev) => ({ ...prev, name: e.target.value }))}
                        className="w-full p-2.5 bg-white border border-[#EAE6DF] rounded text-xs"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block font-mono font-bold text-zinc-500 uppercase tracking-wider text-[9px]">Billing Email</label>
                      <input
                        type="email"
                        value={organizationDraft.billingEmail}
                        onChange={(e) => setOrganizationDraft((prev) => ({ ...prev, billingEmail: e.target.value }))}
                        className="w-full p-2.5 bg-white border border-[#EAE6DF] rounded text-xs font-mono"
                      />
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                      <label className="block font-mono font-bold text-zinc-500 uppercase tracking-wider text-[9px]">Website URL</label>
                      <input
                        type="url"
                        value={organizationDraft.websiteUrl}
                        onChange={(e) => setOrganizationDraft((prev) => ({ ...prev, websiteUrl: e.target.value }))}
                        className="w-full p-2.5 bg-white border border-[#EAE6DF] rounded text-xs font-mono"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button type="submit" className="py-2 px-4 bg-emerald-950 font-bold text-white rounded hover:bg-emerald-900 transition-all cursor-pointer">
                      Save Organization
                    </button>
                  </div>
                </form>

                <div className="border border-[#EAE6DF] bg-white rounded-lg p-5">
                  <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-900 mb-4 flex items-center gap-1.5">
                    <ShieldCheck size={14} className="text-emerald-700" />
                    Enforcement Policies (from workspace)
                  </h4>
                  {policies.length === 0 ? (
                    <p className="text-xs text-[#717A75] italic">No policies configured yet.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      {policies.map((policy) => (
                        <div
                          key={policy.id}
                          className={`p-3 rounded flex items-center gap-2 border ${
                            policy.active
                              ? 'bg-emerald-50/50 border-emerald-200/50'
                              : 'bg-zinc-50 border-zinc-200 text-zinc-500'
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full ${policy.active ? 'bg-emerald-600' : 'bg-zinc-400'}`} />
                          <span className="font-bold font-display">{policy.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Policies lists inline for compact safety */}
              <div className="bg-[#FAF8F5] border border-[#EAE6DF] rounded-lg p-6">
                <h3 className="text-md font-bold text-[#1E2522] font-display mb-1 flex items-center gap-2">
                  <Lock size={16} />
                  Continuous Enforcement Policies
                </h3>
                <p className="text-xs text-[#717A75] mb-5">
                  Our model agents validate repository source code against these guidelines.
                </p>

                <div className="space-y-3.5">
                  {policies.map((p) => (
                    <div key={p.id} className="border border-[#EAE6DF] bg-white rounded p-4 flex items-start justify-between gap-4 text-xs">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-neutral-900 uppercase tracking-wide">
                            {p.name}
                          </h4>
                          <span className={`text-[8.5px] font-mono border px-1.5 py-0.2 select-none font-bold rounded ${
                            p.active ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-zinc-100 border-zinc-200 text-zinc-500'
                          }`}>
                            {p.active ? 'ACTIVE' : 'MUTED'}
                          </span>
                        </div>
                        <p className="text-[#5C6560] leading-relaxed select-text">
                          {p.description}
                        </p>
                      </div>

                      <button
                        onClick={() => togglePolicy(p.id)}
                        className={`w-10 h-6 shrink-0 rounded-full p-0.5 border cursor-pointer transition-all ${
                          p.active ? 'bg-emerald-950 border-emerald-950 flex justify-end' : 'bg-[#FAF8F5] border-[#EAE6DF] flex justify-start'
                        }`}
                      >
                        <div className="w-4.5 h-4.5 bg-white border border-[#EAD0D0]/20 rounded-full shadow-sm" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ==================== TAB: CONNECTED PROVIDERS ==================== */}
          {activeSubTab === 'integrations' && (
            <div className="space-y-6 animate-fadeIn">
              
              {/* Header block conforming exactly to the user request */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#EAE6DF] pb-5">
                <div className="space-y-1">
                  <h2 className="text-xl font-bold tracking-tight text-[#1E2522]">
                    Connected Providers
                  </h2>
                  <p className="text-xs text-[#5C6560] max-w-xl">
                    GitLab sign-in verifies identity. Repository access is a separate one-time OAuth grant for discovery, publish, and reconciliation.
                  </p>
                </div>
              </div>

              <ProviderConnectCards
                connectedProviders={integrations.map((item) => item.provider ?? item.name)}
                integrations={integrations}
              />

              <div className="bg-[#FAF8F5] border border-[#EAE6DF] rounded-lg p-6 space-y-4">
                <div>
                  <h3 className="text-md font-bold text-[#1E2522] font-display mb-1 flex items-center gap-2">
                    <Map size={16} />
                    Work item attributes automation
                  </h3>
                  <p className="text-xs text-[#717A75]">
                    When publishing approved findings, Premortem automatically creates provider labels and traceability metadata using each platform&apos;s official REST APIs (GitLab Labels + Issues, GitHub Labels + Issues).
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  {[
                    { key: 'autoApply', label: 'Auto-apply labels on publish' },
                    { key: 'includeSeverity', label: 'Severity label tier' },
                    { key: 'includeCategory', label: 'Category label tier' },
                    { key: 'includePriority', label: 'Priority label tier' },
                    { key: 'includeConfidenceBand', label: 'Confidence band label' },
                    { key: 'includeAuditRef', label: 'Audit traceability table in description' }
                  ].map((item) => (
                    <label key={item.key} className="flex items-center justify-between border border-[#EAE6DF] bg-white rounded p-3 cursor-pointer">
                      <span className="text-[#1E2522] font-medium">{item.label}</span>
                      <input
                        type="checkbox"
                        checked={workItemAttributes[item.key as keyof WorkItemAttributeConfig] as boolean}
                        onChange={(e) =>
                          setWorkItemAttributes((prev) => ({
                            ...prev,
                            [item.key]: e.target.checked
                          }))
                        }
                        className="accent-emerald-950"
                      />
                    </label>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <label className="space-y-1">
                    <span className="text-[10px] font-mono uppercase tracking-wide text-[#8A958F]">Label prefix</span>
                    <input
                      value={workItemAttributes.labelPrefix}
                      onChange={(e) =>
                        setWorkItemAttributes((prev) => ({ ...prev, labelPrefix: e.target.value }))
                      }
                      className="w-full p-2 bg-white border border-[#EAE6DF] rounded font-mono"
                    />
                  </label>
                  <label className="flex items-center justify-between border border-[#EAE6DF] bg-white rounded p-3 cursor-pointer">
                    <span className="text-[#1E2522] font-medium">Ensure GitLab project labels exist</span>
                    <input
                      type="checkbox"
                      checked={workItemAttributes.gitlab.ensureProjectLabels}
                      onChange={(e) =>
                        setWorkItemAttributes((prev) => ({
                          ...prev,
                          gitlab: { ...prev.gitlab, ensureProjectLabels: e.target.checked }
                        }))
                      }
                      className="accent-emerald-950"
                    />
                  </label>
                  <label className="flex items-center justify-between border border-[#EAE6DF] bg-white rounded p-3 cursor-pointer md:col-span-2">
                    <span className="text-[#1E2522] font-medium">Ensure GitHub repository labels exist</span>
                    <input
                      type="checkbox"
                      checked={workItemAttributes.github.ensureRepositoryLabels}
                      onChange={(e) =>
                        setWorkItemAttributes((prev) => ({
                          ...prev,
                          github: { ...prev.github, ensureRepositoryLabels: e.target.checked }
                        }))
                      }
                      className="accent-emerald-950"
                    />
                  </label>
                </div>

                <div className="flex justify-end border-t border-[#EAE6DF]/60 pt-4">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await patchWorkItemAttributes(workItemAttributes);
                        showToast('Work item attribute automation saved.');
                      } catch (err) {
                        alert(err instanceof Error ? err.message : 'Failed to save work item attributes.');
                      }
                    }}
                    className="py-2 px-5 bg-emerald-950 hover:bg-emerald-900 text-white font-bold rounded shadow transition-all cursor-pointer font-mono uppercase tracking-wide text-[10px]"
                  >
                    Save Work Item Rules
                  </button>
                </div>
              </div>

              {/* Runtime provider connections from database */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-neutral-500 uppercase font-semibold tracking-wider">
                    CONNECTED PROVIDERS
                  </span>
                  <div className="flex-1 h-px bg-[#EAE6DF]/60" />
                </div>

                {integrations.length === 0 ? (
                  <div className="border border-dashed border-[#CDC7BD] bg-[#FAF8F5]/30 rounded-md p-6 text-center text-xs text-[#5C6560]">
                    No active provider connections yet. Use Connect with OAuth above to authorize GitLab.
                  </div>
                ) : null}

              {/* Dynamic provider registry list */}
              {integrations.length > 0 && (
                <div className="bg-white border border-[#EAE6DF] rounded-lg p-5 space-y-4">
                  <div className="border-b pb-2">
                    <h4 className="text-xs font-mono font-bold uppercase text-[#1E2522] tracking-wide">Registered Pipeline Registry Connections</h4>
                    <p className="text-[11.5px] text-zinc-500 mt-0.5">Below are all active and inactive gateways registered under this pre-mortem vault configuration.</p>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {integrations.map((int) => {
                      const iconSlug = getIconSlugByName(int.name);
                      const lastSyncLabel = int.lastSync
                        ? new Date(int.lastSync).toLocaleString()
                        : 'Never synced';
                      return (
                        <div key={int.id} className="border border-[#EAE6DF]/70 bg-[#FAF8F5]/40 rounded p-3 flex justify-between items-center text-xs gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <ProviderIcon slug={iconSlug} className="w-4 h-4 shrink-0" />
                            <div className="min-w-0">
                              <span className="font-bold text-neutral-800 tracking-tight truncate block">{int.name}</span>
                              <span className="text-[9.5px] font-mono text-zinc-500 truncate block">{int.scope}</span>
                              <span className="text-[9px] font-mono text-zinc-400 truncate block">{int.vcsOwner} · {lastSyncLabel}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 font-mono text-[9px] shrink-0">
                            <span className={`px-1.5 py-0.5 rounded border uppercase font-bold ${
                              int.status === 'connected'
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                : int.status === 'active_check'
                                  ? 'bg-amber-50 border-amber-200 text-amber-800'
                                  : 'bg-rose-50 border-rose-200 text-rose-800'
                            }`}>
                              {int.status.replace('_', ' ')}
                            </span>
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await syncIntegration(int.id);
                                  showToast(`Synced ${int.name}.`);
                                } catch (err) {
                                  alert(err instanceof Error ? err.message : 'Sync failed.');
                                }
                              }}
                              className="px-2 py-1 border border-[#EAE6DF] rounded bg-white hover:bg-zinc-50 font-bold"
                            >
                              Sync
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              </div>

              <div className="bg-[#FAF8F5] border border-[#EAE6DF] rounded-lg p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-[#1E2522] font-display">Publish Reconciliation</h3>
                    <p className="text-xs text-[#717A75] mt-1">
                      Compare published GitLab issues against Premortem snapshots and record drift events.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={reconcileIssues.isPending}
                    onClick={() => {
                      reconcileIssues.mutate(undefined, {
                        onSuccess: (result) => {
                          showToast(
                            `Reconciled ${result.reconciledCount ?? 0} issues (${result.driftedCount ?? 0} drifted).`
                          );
                          void reconciliationQuery.refetch();
                        },
                        onError: (err) => alert(err instanceof Error ? err.message : 'Reconciliation failed.')
                      });
                    }}
                    className="px-4 py-2 bg-emerald-950 hover:bg-emerald-900 disabled:opacity-60 text-[#FAF8F5] font-bold text-xs rounded uppercase font-mono tracking-wider"
                  >
                    {reconcileIssues.isPending ? 'Reconciling…' : 'Run Reconciliation'}
                  </button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {(reconciliationQuery.data?.events ?? []).length === 0 ? (
                    <p className="text-xs text-zinc-500 font-mono">No reconciliation events yet.</p>
                  ) : (
                    reconciliationQuery.data?.events.map((event) => (
                      <div
                        key={event.id}
                        className="flex items-start justify-between gap-3 border border-[#EAE6DF] bg-white rounded p-3 text-xs"
                      >
                        <div>
                          <p className="font-semibold text-[#1E2522]">
                            {event.publishedIssue?.publishedTitle ?? 'Published issue'}
                          </p>
                          <p className="text-zinc-500 font-mono mt-0.5">
                            {event.status}
                            {event.driftFields?.length ? ` · drift: ${event.driftFields.join(', ')}` : ''}
                          </p>
                        </div>
                        {event.publishedIssue?.url ? (
                          <a
                            href={event.publishedIssue.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-emerald-900 font-mono uppercase text-[10px] shrink-0"
                          >
                            View
                          </a>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          )}

          {/* ==================== TAB 2: AI MODEL PROVIDERS ==================== */}
          {activeSubTab === 'providers' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
              
              {/* Left AI Configuration forms */}
              <div className="lg:col-span-2 space-y-6 text-xs">
                <div className="bg-[#FAF8F5] border border-[#EAE6DF] rounded p-6 space-y-6">
                  
                  <div>
                    <h3 className="text-md font-bold text-[#1E2522] font-display mb-1 flex items-center gap-2">
                      <Cpu size={16} />
                      Gemini Workspace Orchestrator
                    </h3>
                    <p className="text-xs text-[#717A75]">
                      Configure model parameters utilized by Premortem security analytical agents to parse data, construct traces, and propose GitLab issue descriptions.
                    </p>
                  </div>

                  {/* Primary model select */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="space-y-1.5">
                      <label className="block font-mono font-bold text-zinc-600 uppercase tracking-wider text-[9.5px]">
                        Primary Agent Model
                      </label>
                      <select
                        value={selectedGeminiModel}
                        onChange={(e) => setSelectedGeminiModel(e.target.value)}
                        className="w-full p-2.5 bg-white border border-[#EAE6DF] rounded text-xs text-zinc-905 text-zinc-900 focus:ring-1 focus:ring-emerald-950 focus:outline-none font-medium font-mono"
                      >
                        <option value="gemini-3-flash-preview">Gemini 3 Flash Preview (Default)</option>
                        <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                        <option value="gemini-2.5-pro">Gemini 2.5 Pro (Precision Trace)</option>
                        <option value="gemini-1.5-pro">Gemini 1.5 Pro (Deep Context)</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block font-mono font-bold text-zinc-600 uppercase tracking-wider text-[9.5px]">
                        Reasoning Temperature
                      </label>
                      <div className="flex items-center gap-3 bg-white border border-[#EAE6DF] p-2 rounded">
                        <input 
                          type="range" 
                          min="0.0" 
                          max="1.0" 
                          step="0.1" 
                          value={temperature}
                          onChange={(e) => setTemperature(parseFloat(e.target.value))}
                          className="w-full accent-emerald-950" 
                        />
                        <span className="font-mono font-bold text-zinc-800 w-8 text-right shrink-0">{temperature.toFixed(1)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Slider token depth */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <label className="font-mono font-bold text-zinc-605 text-zinc-600 uppercase tracking-wider text-[9px]">Max Context Token Limit Output</label>
                      <span className="font-mono font-bold text-emerald-900">{maxTokens.toLocaleString()} tokens</span>
                    </div>
                    <input 
                      type="range" 
                      min="1000" 
                      max="16384" 
                      step="500" 
                      value={maxTokens} 
                      onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                      className="w-full accent-emerald-950"
                    />
                    <div className="flex justify-between text-[9px] text-[#8A958F] font-mono leading-none">
                      <span>1,000 (Fastest response)</span>
                      <span>16,384 maximum context length</span>
                    </div>
                  </div>

                  <div className="bg-white border border-[#EAE6DF] rounded p-6 space-y-4">
                    <div>
                      <h3 className="text-md font-bold text-[#1E2522] font-display mb-1">
                        Model Vendor Priority Pool
                      </h3>
                      <p className="text-xs text-[#717A75]">
                        Route specialist and synthesis workloads through an ordered vendor pool. Premortem tries each enabled tier in sequence until a healthy endpoint responds.
                      </p>
                    </div>

                    <ol className="space-y-3">
                      {vendorRouting.map((tier, index) => (
                        <li
                          key={tier.id}
                          className="border border-[#EAE6DF] rounded p-4 bg-[#FAF8F5] flex flex-col md:flex-row md:items-center gap-4"
                        >
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <span className="shrink-0 w-6 h-6 rounded-full bg-emerald-950 text-white text-[10px] font-mono font-bold flex items-center justify-center">
                              {index + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="text-xs font-bold font-display text-[#1E2522]">{tier.label}</p>
                              <p className="text-[11px] text-[#5C6560] mt-1">{tier.description}</p>
                              {tier.kind === 'custom' ? (
                                <select
                                  value={tier.providerRef}
                                  onChange={(e) => {
                                    const next = vendorRouting.map((entry) =>
                                      entry.id === tier.id
                                        ? { ...entry, providerRef: e.target.value }
                                        : entry
                                    );
                                    setVendorRouting(next);
                                  }}
                                  className="mt-2 w-full max-w-xs p-2 text-[11px] bg-white border border-[#EAE6DF] rounded font-mono"
                                >
                                  <option value="">Select custom provider</option>
                                  {customProviders.map((provider) => (
                                    <option key={provider.name} value={provider.name}>
                                      {provider.name}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <p className="mt-2 text-[10px] font-mono uppercase tracking-wide text-[#8A958F]">
                                  Target · {tier.providerRef}
                                </p>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const next = vendorRouting.map((entry) =>
                                entry.id === tier.id ? { ...entry, enabled: !entry.enabled } : entry
                              );
                              setVendorRouting(next);
                            }}
                            className={`shrink-0 px-3 py-1.5 rounded text-[10px] font-mono font-bold uppercase tracking-wide border transition-colors cursor-pointer ${
                              tier.enabled
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                : 'bg-zinc-100 border-zinc-200 text-zinc-600'
                            }`}
                          >
                            {tier.enabled ? 'Enabled' : 'Disabled'}
                          </button>
                        </li>
                      ))}
                    </ol>

                    <div className="flex justify-end border-t border-[#EAE6DF]/60 pt-4">
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await patchLlm({ vendorRouting });
                            showToast('Vendor priority pool saved for this workspace.');
                          } catch (err) {
                            alert(err instanceof Error ? err.message : 'Failed to save vendor pool.');
                          }
                        }}
                        className="py-2 px-5 bg-emerald-950 hover:bg-emerald-900 text-white font-bold rounded shadow transition-all cursor-pointer font-mono uppercase tracking-wide text-[10px]"
                      >
                        Save Vendor Pool
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-end border-t border-[#EAE6DF]/60 pt-4">
                    <button
                      onClick={async () => {
                        try {
                          await patchLlm({ selectedGeminiModel, maxTokens, temperature, customProviders, vendorRouting });
                          showToast('Gemini model settings saved to organization runtime.');
                        } catch (err) {
                          alert(err instanceof Error ? err.message : 'Failed to save LLM settings.');
                        }
                      }}
                      className="py-2 px-5 bg-emerald-950 hover:bg-emerald-900 text-white font-bold rounded shadow transition-all cursor-pointer font-mono uppercase tracking-wide text-[10px]"
                    >
                      Save Primary Agent Configuration
                    </button>
                  </div>
                </div>

                {/* Custom LLM Providers list */}
                <div className="bg-[#FAF8F5] border border-[#EAE6DF] rounded p-6 space-y-6">
                  <div>
                    <h3 className="text-md font-bold text-[#1E2522] font-display mb-1">
                      Alternate / Hybrid Local Providers
                    </h3>
                    <p className="text-xs text-[#717A75]">
                      Register Ollama endpoints, local llama.cpp servers, or private private OpenAI model proxies to route offline trace parameters.
                    </p>
                  </div>

                  <form onSubmit={handleAddCustomProvider} className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wide">PROVIDER DESIGNATION</span>
                      <input 
                        type="text" 
                        required 
                        placeholder="e.g. Ollama Dev"
                        value={newProvName}
                        onChange={(e) => setNewProvName(e.target.value)}
                        className="w-full p-2 bg-white border border-[#EAE6DF] rounded font-medium focus:ring-1 focus:ring-emerald-950 focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wide">HOST COORDINATE HOST</span>
                      <input 
                        type="url" 
                        required 
                        placeholder="http://127.0.0.1:11434"
                        value={newProvHost}
                        onChange={(e) => setNewProvHost(e.target.value)}
                        className="w-full p-2 bg-white border border-[#EAE6DF] rounded font-medium focus:ring-1 focus:ring-emerald-950 focus:outline-none font-mono"
                      />
                    </div>
                    <div className="space-y-2 relative flex items-end">
                      <div className="space-y-1 flex-1">
                        <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wide">MODEL NAME</span>
                        <input 
                          type="text" 
                          placeholder="llama3:latest"
                          value={newProvModel}
                          onChange={(e) => setNewProvModel(e.target.value)}
                          className="w-full p-2 bg-white border border-[#EAE6DF] rounded font-medium focus:ring-1 focus:ring-emerald-950 focus:outline-none font-mono"
                        />
                      </div>
                      <button 
                        type="submit"
                        className="p-2.5 shrink-0 bg-emerald-950 hover:bg-emerald-900 border border-emerald-950 text-[#FAF8F5] rounded ml-1 transition-all flex items-center justify-center cursor-pointer"
                        title="Add local LLM provider"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </form>

                  {/* Listed Custom Providers */}
                  {customProviders.length === 0 ? (
                    <div className="p-4 bg-white border border-[#EAE6DF] rounded text-center text-zinc-500 font-mono text-[10.5px]">
                      No custom offline model servers registered yet.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {customProviders.map((prov, pIdx) => (
                        <div key={pIdx} className="border border-[#EAE6DF] bg-white rounded p-3 flex justify-between items-center text-[11px]">
                          <div className="flex items-center gap-2">
                            <span className="relative flex h-2 w-2">
                              {prov.active && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                              <span className={`relative inline-flex rounded-full h-2 w-2 ${prov.active ? "bg-emerald-505 bg-emerald-500" : "bg-zinc-400"}`}></span>
                            </span>
                            <div className="font-mono">
                              <span className="font-bold text-neutral-805 text-neutral-900 mr-2">{prov.name}</span>
                              <span className="text-[#717A75] text-[10.5px] uppercase">{prov.host} • model: {prov.model}</span>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                const updated = [...customProviders];
                                updated[pIdx].active = !updated[pIdx].active;
                                setCustomProviders(updated);
                                showToast(`Custom LLM provider status toggled.`);
                              }}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                prov.active ? 'bg-emerald-50 text-emerald-800' : 'bg-zinc-100 text-zinc-600'
                              }`}
                            >
                              {prov.active ? "DISCONNECT" : "RE-PING"}
                            </button>
                            <OsIconButton
                              label="Delete model entry"
                              onClick={() => handleDeleteProvider(pIdx)}
                              className="hover:text-red-700 text-[#8A958F] rounded"
                            >
                              <Trash2 size={13} />
                            </OsIconButton>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                </div>
              </div>

              {/* Right Column: AI Tokens Usage Security */}
              <div className="space-y-6">
                <div className="bg-[#FAF8F5] border border-[#EAE6DF] rounded p-6 space-y-4 text-xs">
                  <h4 className="text-md font-bold text-[#1E2522] font-display flex items-center gap-1.5">
                    <Zap size={14} className="text-amber-500" />
                    Offline Air-gapped Scopes
                  </h4>
                  <p className="text-[#5C6560] leading-relaxed select-text">
                    Registered custom LLM Providers run directly within client VPC environments. Premortem agent engines do not cache nor transit private parameters outside restricted scopes.
                  </p>

                  <div className="flex gap-2 rounded border border-zinc-200 bg-zinc-100 p-3 font-sans text-[#5C6560]">
                    <Info className="text-neutral-700 shrink-0 mt-0.5" size={14} />
                    <p className="text-[10.5px]">
                      Ensure local endpoints set appropriate CORS parameters (<code className="font-mono bg-zinc-200 px-1 font-semibold rounded text-zinc-800 text-[10px]">Access-Control-Allow-Origin</code>) to connect to the platform.
                    </p>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* ==================== TAB 3: BILLING ==================== */}
          {activeSubTab === 'billing' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
              
              {/* Left Billing Settings info */}
              <div className="lg:col-span-2 space-y-6 text-xs">
                
                {/* Active Plan tier card */}
                <div className="bg-[#FAF8F5] border border-[#EAE6DF] rounded p-6 space-y-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-md font-bold text-[#1E2522] font-display mb-1 flex items-center gap-2">
                        <CreditCard size={16} />
                        Subscription Allocation
                      </h3>
                      <p className="text-xs text-[#717A75]">
                        Current plan: <span className="font-semibold capitalize">{workspace.billing.plan}</span>
                        {workspace.billing.billingStatus ? ` (${workspace.billing.billingStatus})` : ''}.
                        {workspace.billing.stripeTestMode
                          ? ' Stripe test mode: plan tiers apply in-app without Checkout until you add a test business name in the Stripe dashboard.'
                          : workspace.billing.stripeConfigured
                            ? ' Stripe billing is configured.'
                            : workspace.billing.stripeBillingConfigured
                              ? ' Stripe keys are set; connect a customer to enable Checkout.'
                              : ' Stripe is not configured for this workspace.'}
                      </p>
                    </div>
                    
                    <span className="p-1 px-2.5 bg-emerald-950 text-[#FAF8F5] rounded font-mono font-bold text-[9px] uppercase tracking-wider shadow-sm select-none capitalize">
                      {activeTier} tier
                    </span>
                  </div>

                  {/* Switch cycles buttons */}
                  <div className="flex gap-2 p-1 bg-[#FAF8F5] border border-[#EAE6DF] rounded w-60 text-xs">
                    <button
                      type="button"
                      onClick={() => setBillingCycle('monthly')}
                      className={`flex-1 py-1.5 rounded font-semibold text-center cursor-pointer transition-all ${
                        billingCycle === 'monthly' ? 'bg-white shadow border border-[#EAE6DF] text-zinc-900 font-bold' : 'text-[#5C6560]'
                      }`}
                    >
                      Monthly Sync
                    </button>
                    <button
                      type="button"
                      onClick={() => setBillingCycle('yearly')}
                      className={`flex-1 py-1.5 rounded font-semibold text-center cursor-pointer transition-all ${
                        billingCycle === 'yearly' ? 'bg-white shadow border border-[#EAE6DF] text-zinc-900 font-bold' : 'text-[#5C6560]'
                      }`}
                    >
                      Yearly (Save 20%)
                    </button>
                  </div>

                  {/* Pricing models list */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    
                    {/* Tier A: Free */}
                    <div className={`p-4 rounded border flex flex-col justify-between space-y-3 bg-white ${
                      activeTier === 'free' ? 'border-emerald-950 bg-emerald-50/10' : 'border-[#EAE6DF]'
                    }`}>
                      <div className="space-y-1">
                        <span className="font-bold text-[#1E2522] block font-display">Developer Sandbox</span>
                        <span className="text-zinc-600 block font-mono text-[11px]">Free Tier</span>
                        <div className="text-lg font-bold text-neutral-900 pt-2 font-display">$0/mo</div>
                      </div>
                      <button
                        onClick={async () => {
                          try {
                            await patchBillingPlan('free');
                            showToast('Plan updated to Free tier.');
                          } catch (err) {
                            alert(err instanceof Error ? err.message : 'Failed to update plan.');
                          }
                        }}
                        className="w-full py-1.5 border border-zinc-300 rounded font-bold uppercase tracking-wide tracking-wider text-[9px] font-mono hover:bg-zinc-50 cursor-pointer text-zinc-700"
                      >
                        {activeTier === 'free' ? 'Currently Selected' : 'Downgrade'}
                      </button>
                    </div>

                    {/* Tier B: Pro */}
                    <div className={`p-4 rounded border flex flex-col justify-between space-y-3 bg-white ${
                      activeTier === 'pro' ? 'border-emerald-950 bg-emerald-50/10' : 'border-[#EAE6DF]'
                    }`}>
                      <div className="space-y-1">
                        <span className="font-bold text-[#1E2522] block font-display">Swarm Professional</span>
                        <span className="text-zinc-600 block font-mono text-[11px]">Up to 5 agents</span>
                        <div className="text-lg font-bold text-neutral-900 pt-2 font-display">
                          {billingCycle === 'monthly' ? '$49/mo' : '$39/mo'}
                        </div>
                        {billingCycle === 'yearly' ? (
                          <span className="text-[10px] text-[#717A75] font-mono">$468 billed yearly</span>
                        ) : null}
                      </div>
                      <button
                        onClick={async () => {
                          try {
                            if (workspace?.billing.stripeConfigured) {
                              await startCheckout('pro', billingCycle);
                            } else {
                              await patchBillingPlan('pro');
                              showToast(
                                workspace?.billing.stripeTestMode
                                  ? 'Pro tier applied (Stripe test mode, no Checkout).'
                                  : 'Plan updated to Pro tier.'
                              );
                            }
                          } catch (err) {
                            alert(err instanceof Error ? err.message : 'Failed to update plan.');
                          }
                        }}
                        className="w-full py-1.5 border border-zinc-300 rounded font-bold uppercase tracking-wide tracking-wider text-[9px] font-mono hover:bg-zinc-50 cursor-pointer text-zinc-700"
                      >
                        {activeTier === 'pro' ? 'Currently Selected' : 'Select Pro'}
                      </button>
                    </div>

                    {/* Tier C: Enterprise Swarm */}
                    <div className={`p-4 rounded border-2 flex flex-col justify-between space-y-3 bg-white ${
                      activeTier === 'enterprise' || activeTier === 'team' ? 'border-emerald-950 bg-emerald-50/10 shadow-sm' : 'border-[#EAE6DF]'
                    }`}>
                      <div className="space-y-1">
                        <span className="font-bold text-[#1E2522] block font-display">Enterprise Core</span>
                        <span className="text-emerald-800 block font-mono text-[11px] font-bold">Unlimited agents</span>
                        <div className="text-lg font-bold text-neutral-900 pt-2 font-display">
                          {billingCycle === 'monthly' ? '$249/mo' : '$199/mo'}
                        </div>
                        {billingCycle === 'yearly' ? (
                          <span className="text-[10px] text-[#717A75] font-mono">$2,388 billed yearly</span>
                        ) : null}
                      </div>
                      <button
                        onClick={async () => {
                          try {
                            if (workspace?.billing.stripeConfigured) {
                              await startCheckout('team', billingCycle);
                            } else {
                              await patchBillingPlan('team');
                              showToast(
                                workspace?.billing.stripeTestMode
                                  ? 'Team tier applied (Stripe test mode, no Checkout).'
                                  : 'Plan updated to Team tier.'
                              );
                            }
                          } catch (err) {
                            alert(err instanceof Error ? err.message : 'Failed to update plan.');
                          }
                        }}
                        className="w-full py-1.5 bg-emerald-950 text-[#FAF8F5] rounded font-bold uppercase tracking-wide tracking-wider text-[9px] font-mono hover:opacity-90 cursor-pointer"
                      >
                        {activeTier === 'enterprise' || activeTier === 'team' ? 'Current Active Tier' : 'Upgrade'}
                      </button>
                    </div>

                  </div>
                </div>

                {/* Billing History Invoice list */}
                <div className="bg-[#FAF8F5] border border-[#EAE6DF] rounded p-6 space-y-4">
                  <div className="flex justify-between items-center pb-2 border-b border-[#EAE6DF]/60">
                    <h3 className="text-sm font-bold text-[#1E2522] font-mono uppercase">Invoices Ledger History</h3>
                    <span className="text-[10px] text-[#717A75] font-mono">ALL TRANSACTIONS REGISTERED SUCCESSFULLY</span>
                  </div>

                  <div className="divide-y divide-[#EAE6DF]/60">
                    {invoices.length === 0 ? (
                      <p className="py-3 text-xs text-zinc-500 italic">
                        No Stripe invoices yet. Billing plan and usage are synced from the runtime database.
                      </p>
                    ) : (
                      (invoices as Array<{ id: string; date?: string; amount?: number; status?: string; method?: string }>).map((inv) => (
                      <div key={inv.id} className="py-3 flex justify-between items-center text-xs">
                        <div className="space-y-0.5">
                          <span className="font-bold text-neutral-900 font-mono tracking-wider">{inv.id}</span>
                          <div className="text-zinc-500 font-sans text-[11px]">{inv.date} • {inv.method}</div>
                        </div>
                        
                        <div className="flex items-center gap-4">
                          <span className="font-bold text-neutral-900 font-display">${(inv.amount ?? 0).toFixed(2)}</span>
                          <span className="px-1.5 py-0.2 bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold rounded font-mono text-[9px] text-center uppercase tracking-wide">
                            {inv.status}
                          </span>
                          <OsIconButton
                            label="Download PDF Invoice"
                            onClick={() => triggerInvoiceDownload(inv.id)}
                            className="text-[#8A958F] hover:text-[#1E2522] hover:bg-white rounded transition-all"
                          >
                            <Download size={14} />
                          </OsIconButton>
                        </div>
                      </div>
                    ))
                    )}
                  </div>
                </div>

              </div>

              {/* Right Column: Usage Telemetry */}
              <div className="space-y-6">
                <div className="bg-[#FAF8F5] border border-[#EAE6DF] rounded p-6 space-y-6 text-xs">
                  
                  <div>
                    <h4 className="text-sm font-bold text-[#1E2522] font-display flex items-center gap-1.5">
                      <TrendingUp size={14} className="text-emerald-800" />
                      Usage Quota Meter
                    </h4>
                    <p className="text-[11px] text-[#717A75] mt-1">
                      Resource limits allocation registered under the active Swarm billing cycle. Logs reset monthly.
                    </p>
                  </div>

                  {/* Meter Scans */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between font-mono text-[10px]">
                      <span className="font-bold text-neutral-800">Swarm Auditor Scans</span>
                      <span className="font-bold text-zinc-900">{usageStats.scans.used} / {usageStats.scans.limit} Runs</span>
                    </div>
                    <div className="w-full bg-zinc-200 h-2.5 rounded-full overflow-hidden">
                      <div className="bg-emerald-950 h-full" style={{ width: `${(usageStats.scans.used / usageStats.scans.limit) * 100}%` }} />
                    </div>
                  </div>

                  {/* Meter Tokens */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between font-mono text-[10px]">
                      <span className="font-bold text-neutral-800">Token Depth Dispatches</span>
                      <span className="font-bold text-zinc-900">{usageStats.tokens.used}M / {usageStats.tokens.limit}M Tokens</span>
                    </div>
                    <div className="w-full bg-zinc-200 h-2.5 rounded-full overflow-hidden">
                      <div className="bg-emerald-800 h-full" style={{ width: `${(usageStats.tokens.used / usageStats.tokens.limit) * 100}%` }} />
                    </div>
                  </div>

                  {/* Meter Patches proposed */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between font-mono text-[10px]">
                      <span className="font-bold text-neutral-800">AI Suggested Patches</span>
                      <span className="font-bold text-zinc-900">{usageStats.patches.used} / {usageStats.patches.limit} Modules</span>
                    </div>
                    <div className="w-full bg-zinc-200 h-2.5 rounded-full overflow-hidden">
                      <div className="bg-[#B91C1C] h-full" style={{ width: `${(usageStats.patches.used / usageStats.patches.limit) * 100}%` }} />
                    </div>
                  </div>

                  <div className="p-3 bg-white border border-[#EAE6DF] rounded text-[#717A75] select-text">
                    <span className="font-bold text-neutral-800 uppercase font-mono text-[9px] block mb-1">Billing Support</span>
                    <p className="text-[10.5px]">
                      Need a customized seat limit or private dedicated cloud hosting? Contact us at{' '}
                      <a
                        href={`mailto:${premortemBrand.supportEmail}`}
                        className="text-emerald-900 underline font-semibold"
                      >
                        {premortemBrand.supportEmail}
                      </a>
                      .
                    </p>
                  </div>

                </div>
              </div>

            </div>
          )}

          {/* ==================== TAB 4: WEBHOOKS & NOTIFICATIONS ==================== */}
          {activeSubTab === 'notifications' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
              
              {/* Left Notifications configurations */}
              <div className="lg:col-span-2 space-y-6 text-xs">
                
                <div className="bg-[#FAF8F5] border border-[#EAE6DF] rounded p-6 space-y-6">
                  <div>
                    <h3 className="text-md font-bold text-[#1E2522] font-display mb-1 flex items-center gap-1.5">
                      <Bell size={16} />
                      Integrations Webhooks & Notification Dispatch
                    </h3>
                    <p className="text-xs text-[#717A75]">
                      Propagate live threat detections details to security dispatch platforms, slack channels systems, or operational email lists.
                    </p>
                  </div>

                  {/* Slack integration details card */}
                  <div className="border border-[#EAE6DF] bg-white rounded p-4.5 space-y-4">
                    <div className="flex justify-between items-center pb-2 border-b">
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] font-bold text-[#1E2522]">Slack App Dispatch Gateway</span>
                        <span className={`w-2 h-2 rounded-full ${isSlackConnected ? 'bg-emerald-500' : 'bg-red-500'}`} />
                      </div>
                      
                      <button
                        type="button"
                        onClick={async () => {
                          const next = !isSlackConnected;
                          setIsSlackConnected(next);
                          try {
                            await patchNotifications({
                              slackWebhook,
                              slackChannel,
                              isSlackConnected: next,
                              alertEmails,
                              alertSeverity
                            });
                            showToast(`Slack notifications ${next ? 'enabled' : 'disabled'}.`);
                          } catch (err) {
                            setIsSlackConnected(!next);
                            alert(err instanceof Error ? err.message : 'Failed to update Slack status.');
                          }
                        }}
                        className={`px-2 py-0.5 border rounded uppercase font-bold text-[9px] font-mono cursor-pointer ${
                          isSlackConnected ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'
                        }`}
                      >
                        {isSlackConnected ? 'ACTIVE' : 'MUTED'}
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <span className="text-[9px] font-mono font-bold text-zinc-500 block">WEBHOOK ENDPOINT URL</span>
                        <input 
                          type="text" 
                          value={slackWebhook}
                          onChange={(e) => setSlackWebhook(e.target.value)}
                          className="w-full p-2 bg-white border border-[#EAE6DF] rounded font-mono text-[10.5px] text-zinc-700 focus:outline-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <span className="text-[9px] font-mono font-bold text-zinc-500 block">TARGET NOTIFICATION KERNEL CHANNEL</span>
                        <input 
                          type="text" 
                          value={slackChannel}
                          onChange={(e) => setSlackChannel(e.target.value)}
                          className="w-full p-2 bg-white border border-[#EAE6DF] rounded font-mono text-[10.5px] text-zinc-700 font-semibold focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        onClick={async () => {
                          try {
                            await patchNotifications({
                              slackWebhook,
                              slackChannel,
                              isSlackConnected,
                              alertEmails,
                              alertSeverity
                            });
                            showToast('Slack notification settings saved.');
                          } catch (err) {
                            alert(err instanceof Error ? err.message : 'Failed to save notifications.');
                          }
                        }}
                        className="py-1.5 px-3 border border-[#EAE6DF] bg-[#FAF8F5] text-zinc-800 text-xs font-semibold rounded hover:bg-[#FAF8F5]/80 transition-all cursor-pointer"
                      >
                        Update Webhook Parameters
                      </button>
                    </div>
                  </div>

                  {/* General Email Notifications */}
                  <div className="border border-[#EAE6DF] bg-white rounded p-4.5 space-y-4 text-xs">
                    <h4 className="font-bold text-neutral-900 font-display uppercase tracking-wide">
                      Automated Email Digest Coordinates
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      
                      <div className="space-y-1">
                        <span className="text-[9px] font-mono font-bold text-zinc-500 block">RECIPIENTS LIST (COMMA DELIMITED)</span>
                        <input 
                          type="email" 
                          value={alertEmails}
                          onChange={(e) => setAlertEmails(e.target.value)}
                          className="w-full p-2 bg-white border border-[#EAE6DF] rounded font-mono text-[10.5px] text-zinc-700 focus:outline-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <span className="text-[9px] font-mono font-bold text-zinc-500 block">SEVERITY REACTION THRESHOLD</span>
                        <select
                          value={alertSeverity}
                          onChange={(e) => {
                            setAlertSeverity(e.target.value);
                            showToast(`Min alert severity set to ${e.target.value}`);
                          }}
                          className="w-full p-2 bg-white border border-[#EAE6DF] rounded font-mono text-[10.5px] text-zinc-700 focus:outline-none"
                        >
                          <option value="CRITICAL">CRITICAL ONLY</option>
                          <option value="HIGH">HIGH AND CRITICAL (RECOMMENDED)</option>
                          <option value="MEDIUM">MEDIUM AND ABOVE</option>
                          <option value="ALL">ALL DETECTED FINDINGS</option>
                        </select>
                      </div>

                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        onClick={async () => {
                          try {
                            await patchNotifications({ alertEmails, alertSeverity, isSlackConnected, slackWebhook, slackChannel });
                            showToast('Alert email thresholds saved.');
                          } catch (err) {
                            alert(err instanceof Error ? err.message : 'Failed to save alert settings.');
                          }
                        }}
                        className="py-1.5 px-4 bg-emerald-950 text-white font-bold text-xs rounded hover:bg-emerald-900 transition-all cursor-pointer"
                      >
                        Save Email Alert Settings
                      </button>
                    </div>
                  </div>

                </div>
              </div>

              {/* Right Column: Webhook Security Guidelines */}
              <div className="space-y-6 text-xs">
                <div className="bg-[#FAF8F5] border border-[#EAE6DF] rounded p-6 space-y-4">
                  <h4 className="text-md font-bold text-[#1E2522] font-display">
                    Webhook Dispatch Security
                  </h4>
                  <p className="text-[#5C6560] leading-relaxed select-text">
                    All webhook alert payloads dispatched are cryptographically signed with your organization shared secret to permit incoming verification checks on client firewalls.
                  </p>

                  <div className="space-y-2 border border-[#EAE6DF] bg-white p-3 rounded font-mono text-[9px] select-text">
                    <div className="text-zinc-400 font-bold uppercase block pb-1">WORKSPACE SHA-256 SIGNATURE KEY:</div>
                    <div className="text-zinc-850 break-all cursor-pointer font-bold text-slate-805" title="Double click to copy raw signature key">
                      pm_sec_sig_72fa8d390a14bce09f6e5229efbc1721b0dc3a
                    </div>
                  </div>

                  <div className="p-3 bg-zinc-100 border border-zinc-200 text-[#717A75] rounded flex gap-2 font-sans">
                    <Info className="text-neutral-700 shrink-0 mt-0.5" size={14} />
                    <p className="text-[10.5px]">
                      Webhooks are throttled to maximum 5 dispatches per project scanner loop to bypass messaging threshold limits.
                    </p>
                  </div>
                </div>
              </div>

            </div>
          )}

        </div>

      </div>

    </div>
  );
}
