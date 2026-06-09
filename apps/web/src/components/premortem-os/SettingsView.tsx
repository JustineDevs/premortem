import React, { useState } from 'react';
import { premortemBrand } from '@/lib/premortem-os/branding';
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
  PlusCircle
} from 'lucide-react';
import { ProviderIcon } from './ProviderIcon';
import { OsIconButton } from './os-icon-button';

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

export function SettingsView() {
  const [activeSubTab, setActiveSubTab] = useState<'profile' | 'organization' | 'integrations' | 'providers' | 'billing' | 'notifications'>('integrations');
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // 1. Integrations and Policies State
  const [integrations, setIntegrations] = useState([
    { name: 'GitHub Enterprise Host', status: 'connected', scope: 'repo, read:org, write:pull_requests', lastSync: '10 mins ago', vcsOwner: 'globalsys-org' },
    { name: 'GitLab Self-Managed Core', status: 'connected', scope: 'api, read_repository', lastSync: '15 mins ago', vcsOwner: 'Token expires in 3 days' },
    { name: 'BitBucket Cloud Services', status: 'active_check', scope: 'repository:read', lastSync: '1 hour ago', vcsOwner: 'globalsys-cloud' },
    { name: 'Azure DevOps Organizations', status: 'connected', scope: 'vso.code_read, vso.work_write', lastSync: '4 mins ago', vcsOwner: 'global-devops-core' },
    { name: 'Gitea Self-Hosted Core', status: 'disconnected', scope: 'api, read_repository', lastSync: 'Never', vcsOwner: 'unknown-scope' },
    { name: 'Google Cloud Source Repositories', status: 'connected', scope: 'devstorage.read_only, source.read_only', lastSync: '30 mins ago', vcsOwner: 'gcp-systems-prod' },
    { name: 'AWS Organizations Policy Scope', status: 'disconnected', scope: 'arn:aws:iam::policy/SecurityAudit', lastSync: 'Never', vcsOwner: '12 Accounts' }
  ]);

  const [policies, setPolicies] = useState([
    { id: 'pol-1', name: 'Strict Transport Isolation (SSL)', description: 'Reject any raw port 80 or unencrypted plaintext transit connections during live routing.', active: true },
    { id: 'pol-2', name: 'Reject environment fallback literals', description: 'Flag hardcoded access ids or keys fallback properties on module dependencies configuration.', active: true },
    { id: 'pol-3', name: 'Strict parameters SQL verification', description: 'Prevent raw queries string concatenations on database router configurations.', active: true },
    { id: 'pol-4', name: 'Mask sensitive prints logs targets', description: 'Inhibit standard console print buffers output on critical credentials transaction requests.', active: false }
  ]);

  // 2. AI Model Providers State
  const [selectedGeminiModel, setSelectedGeminiModel] = useState('gemini-2.5-flash');
  const [maxTokens, setMaxTokens] = useState(8192);
  const [temperature, setTemperature] = useState(0.2);
  const [customProviders, setCustomProviders] = useState([
    { name: 'Local Ollama Instance', host: 'http://localhost:11434', active: false, model: 'llama3:8b' }
  ]);
  const [newProvName, setNewProvName] = useState('');
  const [newProvHost, setNewProvHost] = useState('');
  const [newProvModel, setNewProvModel] = useState('');

  // 3. Billing & Allocation State
  const [activeTier, setActiveTier] = useState<'free' | 'pro' | 'swarm-enterprise'>('swarm-enterprise');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  // Resource usage telemetry
  const usageStats = {
    scans: { used: 542, limit: 1000 },
    tokens: { used: 12.8, limit: 50.0 }, // in Millions
    patches: { used: 14, limit: 50 }
  };

  const invoices = [
    { id: 'INV-2026-004', date: 'June 01, 2026', amount: 249.00, status: 'Paid', method: 'Visa ending 4242' },
    { id: 'INV-2026-003', date: 'May 01, 2026', amount: 249.00, status: 'Paid', method: 'Visa ending 4242' },
    { id: 'INV-2026-002', date: 'April 01, 2026', amount: 249.00, status: 'Paid', method: 'Visa ending 4242' },
    { id: 'INV-2026-001', date: 'March 01, 2026', amount: 49.00, status: 'Paid', method: 'Visa ending 4242' }
  ];

  // 4. Webhooks State
  const [slackWebhook, setSlackWebhook] = useState('https://hooks.slack.com/services/T000/B000/XXXXXX');
  const [slackChannel, setSlackChannel] = useState('#secops-audit-swarm');
  const [isSlackConnected, setIsSlackConnected] = useState(true);
  const [alertEmails, setAlertEmails] = useState('secops-alerts@globalsystems.org');
  const [alertSeverity, setAlertSeverity] = useState('HIGH');

  // Add Provider Trigger Mode
  const [showAddProviderForm, setShowAddProviderForm] = useState(false);
  const [newProviderName, setNewProviderName] = useState('');
  const [newProviderStatus, setNewProviderStatus] = useState<'connected' | 'active_check' | 'disconnected'>('connected');
  const [newProviderScope, setNewProviderScope] = useState('repo, read:org');
  const [newProviderUserScope, setNewProviderUserScope] = useState('globalsys-added');

  const showToast = (message: string) => {
    setSuccessToast(message);
    setTimeout(() => {
      setSuccessToast(null);
    }, 3050);
  };

  const togglePolicy = (id: string) => {
    setPolicies(policies.map(p => p.id === id ? { ...p, active: !p.active } : p));
    showToast('Continuous enforcement policy thresholds updated.');
  };

  const handleAddCustomProvider = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProvName || !newProvHost) {
      alert('Provide a valid name and host coordinate path.');
      return;
    }
    const newProv = {
      name: newProvName,
      host: newProvHost,
      model: newProvModel || 'custom-model',
      active: true
    };
    setCustomProviders([...customProviders, newProv]);
    setNewProvName('');
    setNewProvHost('');
    setNewProvModel('');
    showToast(`Registered custom AI engine provider "${newProv.name}" successfully.`);
  };

  const handleDeleteProvider = (index: number) => {
    const item = customProviders[index];
    setCustomProviders(customProviders.filter((_, idx) => idx !== index));
    showToast(`Removed custom provider "${item.name}".`);
  };

  const triggerInvoiceDownload = (invoiceId: string) => {
    showToast(`Generating secure PDF download stream for ${invoiceId}...`);
  };

  const handleRegisterGenericProvider = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProviderName) return;
    const item = {
      name: newProviderName,
      status: newProviderStatus,
      scope: newProviderScope,
      lastSync: '1 min ago',
      vcsOwner: newProviderUserScope || 'globalsys-org'
    };
    setIntegrations([item, ...integrations]);
    setNewProviderName('');
    setShowAddProviderForm(false);
    showToast(`Successfully registered new provider connection: "${item.name}"`);
  };

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
                    setActiveSubTab(subTab.id as any);
                    setShowAddProviderForm(false);
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
                    TG
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono uppercase bg-slate-100 border px-1.5 py-0.2 rounded font-bold text-slate-800">Workspace Administrator</span>
                    <h4 className="text-md font-bold text-neutral-900 font-display">operator@premortem.dev</h4>
                    <p className="text-[11px] text-[#717A75]">Access key credentials bounds secure sandboxes environments.</p>
                  </div>
                </div>

                <form onSubmit={(e) => { e.preventDefault(); showToast('Profile settings updated successfully.'); }} className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block font-mono font-bold text-zinc-500 uppercase tracking-wider text-[9px]">Full Display Name</label>
                      <input 
                        type="text" 
                        defaultValue="Trader G Admin"
                        className="w-full p-2.5 bg-white border border-[#EAE6DF] rounded text-xs text-zinc-900 font-medium"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block font-mono font-bold text-zinc-500 uppercase tracking-wider text-[9px]">Contact Email Address</label>
                      <input 
                        type="email" 
                        defaultValue="operator@premortem.dev"
                        disabled
                        className="w-full p-2.5 bg-zinc-50 border border-[#EAE6DF] rounded text-xs text-zinc-450 cursor-not-allowed font-medium font-mono"
                      />
                    </div>
                  </div>

                  <div className="pt-2">
                    <button type="submit" className="py-2 px-4 bg-emerald-950 font-bold text-white rounded hover:bg-emerald-900 transition-all cursor-pointer">
                      Save Profile Updates
                    </button>
                  </div>
                </form>
              </div>

              {/* Security Logs list */}
              <div className="p-6 bg-white border border-[#EAE6DF] rounded-lg space-y-4">
                <h4 className="text-xs font-mono uppercase font-bold tracking-wider text-[#1E2522]">Recent Security Access Trails</h4>
                <div className="font-mono text-[10px] space-y-2 text-[#717A75]">
                  <div className="flex justify-between border-b pb-1.5">
                    <span>Successful Token Refresh (GitLab Agent)</span>
                    <span className="text-zinc-500">Today 13:42:15</span>
                  </div>
                  <div className="flex justify-between border-b pb-1.5">
                    <span>Authorized IP Login (Cloud Container Ingress)</span>
                    <span className="text-zinc-500">Yesterday 18:24:09</span>
                  </div>
                  <div className="flex justify-between border-b pb-1.5">
                    <span>Full-scale Swarm Run Initiated (Pre-production)</span>
                    <span className="text-zinc-500 font-bold text-emerald-800">June 08, 11:32</span>
                  </div>
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
                    <span className="font-bold text-[#1E2522] text-sm font-sans block">Global Systems Corp</span>
                  </div>
                  <div className="p-4 bg-white border border-[#EAE6DF] rounded space-y-1">
                    <span className="text-[9px] text-[#8A958F] font-bold block uppercase">Swarm Subscription Tier</span>
                    <span className="font-bold text-emerald-800 text-sm font-sans block">Enterprise Tier (Unlimited)</span>
                  </div>
                  <div className="p-4 bg-white border border-[#EAE6DF] rounded space-y-1">
                    <span className="text-[9px] text-[#8A958F] font-bold block uppercase">Active Scanners</span>
                    <span className="font-bold text-[#1E2522] text-sm font-sans block">24 / 25 Auditors Active</span>
                  </div>
                </div>

                <div className="border border-[#EAE6DF] bg-white rounded-lg p-5">
                  <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-900 mb-4 flex items-center gap-1.5">
                    <ShieldCheck size={14} className="text-emerald-700" />
                    Regulatory Compliance Standards Guard
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="p-3 bg-emerald-50/50 border border-emerald-200/50 rounded flex items-center gap-2">
                      <span className="w-2 h-2 bg-emerald-600 rounded-full" />
                      <span className="font-bold text-emerald-950 font-display">SOC 2 Type II Gate</span>
                    </div>
                    <div className="p-3 bg-emerald-50/50 border border-emerald-200/50 rounded flex items-center gap-2">
                      <span className="w-2 h-2 bg-emerald-600 rounded-full" />
                      <span className="font-bold text-emerald-950 font-display">ISO-27001 Active</span>
                    </div>
                    <div className="p-3 bg-zinc-50 border border-zinc-200 rounded flex items-center gap-2 text-zinc-500">
                      <span className="w-2 h-2 bg-zinc-400 rounded-full" />
                      <span className="font-display">HIPAA Secure Gate</span>
                    </div>
                  </div>
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
                    Integrate external code repositories, issue trackers, and CI/CD pipelines to feed data into the audit evidence vault.
                  </p>
                </div>

                <button 
                  onClick={() => setShowAddProviderForm(!showAddProviderForm)}
                  className="py-1.5 px-4 bg-emerald-950 hover:bg-emerald-900 text-[#FAF8F5] font-bold text-xs rounded transition-all flex items-center justify-center gap-1.5 cursor-pointer uppercase font-mono tracking-wider"
                >
                  <Plus size={14} strokeWidth={2.5} />
                  <span>Add Provider</span>
                </button>
              </div>

              {/* Add Custom Provider Interactive Sliding form */}
              {showAddProviderForm && (
                <form onSubmit={handleRegisterGenericProvider} className="space-y-4 bg-[#FAF8F5] border-2 border-dashed border-emerald-950/20 p-5 rounded-lg animate-fadeIn text-xs">
                  <div className="flex justify-between items-center pb-2 border-b border-[#EAE6DF]">
                    <span className="font-mono font-bold text-emerald-900 uppercase">PROVISION VCS/INFRASTRUCTURE CONNECTOR</span>
                    <button type="button" onClick={() => setShowAddProviderForm(false)} className="text-[#8A958F] hover:text-[#1E2522]">
                      <X size={15} />
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block font-mono font-bold text-[#4A5550]">PROVIDER SERVICE NAME</label>
                      <input 
                        type="text" 
                        required
                        placeholder="e.g. GitLab Enterprise Cloud, AWS Core Production"
                        value={newProviderName}
                        onChange={(e) => setNewProviderName(e.target.value)}
                        className="w-full p-2.5 bg-white border border-[#EAE6DF] rounded focus:outline-none focus:border-emerald-950 text-neutral-900"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block font-mono font-bold text-[#4A5550]">WORKSPACE OR ORGANIZATION SCOPE</label>
                      <input 
                        type="text" 
                        placeholder="e.g. globalsys-org, accounts-12"
                        value={newProviderUserScope}
                        onChange={(e) => setNewProviderUserScope(e.target.value)}
                        className="w-full p-2.5 bg-white border border-[#EAE6DF] rounded focus:outline-none focus:border-emerald-950 text-neutral-900 font-mono"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block font-mono font-bold text-[#4A5550]">INITIAL STATUS GATE</label>
                      <select 
                        value={newProviderStatus}
                        onChange={(e: any) => setNewProviderStatus(e.target.value)}
                        className="w-full p-2.5 bg-white border border-[#EAE6DF] rounded text-neutral-950 focus:outline-none focus:border-emerald-950"
                      >
                        <option value="connected">Connected (Synchronized)</option>
                        <option value="active_check">Active Checking Connection</option>
                        <option value="disconnected">Staged (Inactive)</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="block font-mono font-bold text-[#4A5550]">SECURITY SCOPE STRING</label>
                      <input 
                        type="text" 
                        value={newProviderScope}
                        onChange={(e) => setNewProviderScope(e.target.value)}
                        className="w-full p-2.5 bg-white border border-[#EAE6DF] rounded text-neutral-900 font-mono"
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end gap-2">
                    <button 
                      type="button" 
                      onClick={() => setShowAddProviderForm(false)}
                      className="px-4 py-2 border border-[#EAE6DF] rounded bg-white text-zinc-700 font-bold hover:bg-zinc-50"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      className="px-4 py-2 bg-emerald-950 text-[#FAF8F5] rounded font-bold hover:bg-emerald-900"
                    >
                      Authorize Connection
                    </button>
                  </div>
                </form>
              )}

              {/* Category 1: SOURCE CONTROL */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-neutral-500 uppercase font-semibold select-none letter-spacing-wide tracking-wider">
                    &lt;&gt; SOURCE CONTROL
                  </span>
                  <div className="flex-1 h-px bg-[#EAE6DF]/60" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* Card 1: GitHub Enterprise */}
                  <div className="border border-[#EAE6DF] bg-white rounded-md shadow-sm overflow-hidden flex flex-col justify-between h-full hover:border-[#CDC7BD] transition-all">
                    <div className="p-4 flex items-start justify-between gap-4">
                      <div className="flex gap-3.5 items-center">
                        <div className="p-2.5 bg-[#FAF8F5] border border-[#EAE6DF] rounded">
                          <ProviderIcon slug="github" className="w-5 h-5 object-contain" />
                        </div>
                        <div className="space-y-0.5">
                          <h4 className="font-bold text-[#1E2522] text-sm tracking-tight leading-none">GitHub Enterprise</h4>
                          <div className="flex items-center gap-1.5 text-xs text-[#5C6560]">
                            <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full" />
                            <span className="text-[11px] font-medium text-slate-800">Connected: globalsys-org</span>
                          </div>
                        </div>
                      </div>
                      <OsIconButton
                        label="Provider options"
                        onClick={() => showToast("Showing GitHub credentials and scopes configuration bundle.")}
                        className="text-[#8A958F] hover:text-[#5C6560] hover:bg-[#FAF8F5] rounded"
                      >
                        <MoreVertical size={15} />
                      </OsIconButton>
                    </div>
                    <div className="bg-[#FAF8F5] border-t border-[#EAE6DF] px-4 py-2.5 flex justify-between items-center text-[11px]">
                      <span className="font-mono text-[#5C6560]">Analyzers Active: 24</span>
                      <button 
                        onClick={() => showToast("Live workspace trigger: Synchronization initialized with GitHub cluster...")}
                        className="text-emerald-950 font-bold hover:text-emerald-800 flex items-center gap-1.5 transition-all text-[10px] uppercase tracking-wider font-mono cursor-pointer"
                      >
                        <RefreshCcw size={11} className="animate-spin-slow" />
                        <span>Sync Now</span>
                      </button>
                    </div>
                  </div>

                  {/* Card 2: GitLab Self-Managed */}
                  <div className="border border-[#EAE6DF] bg-white rounded-md shadow-sm overflow-hidden flex flex-col justify-between h-full hover:border-[#CDC7BD] transition-all">
                    <div className="p-4 flex items-start justify-between gap-4">
                      <div className="flex gap-3.5 items-center">
                        <div className="p-2.5 bg-[#FAF8F5] border border-[#EAE6DF] rounded">
                          <ProviderIcon slug="gitlab" className="w-5 h-5 object-contain" />
                        </div>
                        <div className="space-y-0.5">
                          <h4 className="font-bold text-[#1E2522] text-sm tracking-tight leading-none">GitLab Self-Managed</h4>
                          <div className="flex items-center gap-1.5 text-xs">
                            <span className="w-1.5 h-1.5 bg-amber-505 bg-amber-500 rounded-full" />
                            <span className="text-[11px] text-amber-800 font-bold">Token expires in 3 days</span>
                          </div>
                        </div>
                      </div>
                      <OsIconButton
                        label="Provider options"
                        onClick={() => showToast("Showing GitLab connection auth parameters.")}
                        className="text-[#8A958F] hover:text-[#5C6560] hover:bg-[#FAF8F5] rounded"
                      >
                        <MoreVertical size={15} />
                      </OsIconButton>
                    </div>
                    <div className="bg-[#FAF8F5] border-t border-[#EAE6DF] px-4 py-2.5 flex justify-between items-center text-[11px]">
                      <span className="font-mono text-[#5C6560]">Risk Clusters: 3</span>
                      <button 
                        onClick={() => showToast("Initiated GitLab workspace token rotation phase secure logs...")}
                        className="text-[#B91C1C] font-bold hover:text-[#991B1B] flex items-center gap-1.5 transition-all text-[10px] uppercase tracking-wider font-mono cursor-pointer"
                      >
                        <RotateCw size={11} />
                        <span>Rotate Token</span>
                      </button>
                    </div>
                  </div>

                </div>
              </div>

              {/* Category 2: INFRASTRUCTURE */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-neutral-500 uppercase font-semibold select-none letter-spacing-wide tracking-wider">
                    ☁ INFRASTRUCTURE
                  </span>
                  <div className="flex-1 h-px bg-[#EAE6DF]/60" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* Card 1: AWS Organizations */}
                  <div className="border border-[#EAE6DF] bg-white rounded-md shadow-sm overflow-hidden flex flex-col justify-between h-full hover:border-[#CDC7BD] transition-all">
                    <div className="p-4 flex items-start justify-between gap-4">
                      <div className="flex gap-3.5 items-center">
                        <div className="p-2.5 bg-[#FAF8F5] border border-[#EAE6DF] rounded">
                          <ProviderIcon slug="aws" className="w-5 h-5 object-contain" />
                        </div>
                        <div className="space-y-0.5">
                          <h4 className="font-bold text-[#1E2522] text-sm tracking-tight leading-none">AWS Organizations</h4>
                          <div className="flex items-center gap-1.5 text-xs text-[#5C6560]">
                            <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full" />
                            <span className="text-[11px] font-medium text-slate-800">Connected: 12 Accounts</span>
                          </div>
                        </div>
                      </div>
                      <OsIconButton
                        label="Provider options"
                        onClick={() => showToast("Showing AWS IAM policy scope layout properties.")}
                        className="text-[#8A958F] hover:text-[#5C6560] hover:bg-[#FAF8F5] rounded"
                      >
                        <MoreVertical size={15} />
                      </OsIconButton>
                    </div>
                    <div className="bg-[#FAF8F5] border-t border-[#EAE6DF] px-4 py-2.5 flex justify-between items-center text-[11px]">
                      <span className="font-mono text-[#5C6560]">Issues Synced: 142</span>
                      <button 
                        onClick={() => showToast("Opening AWS Topology VPC threat vector mapping dashboard...")}
                        className="text-emerald-950 font-bold hover:text-emerald-800 flex items-center gap-1.5 transition-all text-[10px] uppercase tracking-wider font-mono cursor-pointer"
                      >
                        <Map size={11} />
                        <span>View Map</span>
                      </button>
                    </div>
                  </div>

                  {/* Card 2: Dotted placeholder - Add Infrastructure Provider */}
                  <div 
                    onClick={() => {
                      setNewProviderName('AWS Production Portal');
                      setNewProviderUserScope('AWS Accounts');
                      setNewProviderScope('arn:aws:iam::policy/SecurityAudit');
                      setShowAddProviderForm(true);
                      showToast("Pre-filled AWS configuration parameters in authorization template form above!");
                    }}
                    className="border border-dashed border-[#CDC7BD] bg-[#FAF8F5]/30 hover:bg-[#FAF8F5] rounded-md flex flex-col items-center justify-center p-6 text-center group cursor-pointer transition-all min-h-[110px]"
                  >
                    <PlusCircle size={24} className="text-[#8A958F] group-hover:text-emerald-950 transition-colors mb-2" />
                    <span className="font-bold text-[#1E2522] text-xs leading-none">Add Infrastructure Provider</span>
                    <span className="text-[10px] text-[#717A75] mt-1">Connect AWS, GCP, or Azure</span>
                  </div>

                </div>
              </div>

              {/* Dynamic Added / Remaining Providers from state */}
              {integrations.length > 0 && (
                <div className="bg-white border border-[#EAE6DF] rounded-lg p-5 space-y-4">
                  <div className="border-b pb-2">
                    <h4 className="text-xs font-mono font-bold uppercase text-[#1E2522] tracking-wide">Registered Pipeline Registry Connections</h4>
                    <p className="text-[11.5px] text-zinc-500 mt-0.5">Below are all active and inactive gateways registered under this pre-mortem vault configuration.</p>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {integrations.map((int, idx) => {
                      // skip if they are already rendered individually above
                      if (int.name.includes('GitHub Enterprise') || int.name.includes('GitLab Self-Managed') || int.name.includes('AWS Organizations')) {
                        // let's still render them here or show beautiful custom layout details
                      }
                      const iconSlug = getIconSlugByName(int.name);
                      return (
                        <div key={idx} className="border border-[#EAE6DF]/70 bg-[#FAF8F5]/40 rounded p-3 flex justify-between items-center text-xs">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <ProviderIcon slug={iconSlug} className="w-4 h-4 shrink-0" />
                            <div className="min-w-0">
                              <span className="font-bold text-neutral-800 tracking-tight truncate block">{int.name}</span>
                              <span className="text-[9.5px] font-mono text-zinc-500 truncate block">{int.scope}</span>
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
                            <OsIconButton
                              label="Delete Connection"
                              onClick={() => {
                                setIntegrations(integrations.filter((_, i) => i !== idx));
                                showToast(`Removed network integrations registry endpoint: "${int.name}"`);
                              }}
                              className="hover:text-[#B91C1C] text-zinc-400 rounded"
                            >
                              <Trash2 size={12} />
                            </OsIconButton>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

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
                      <label className="block font-mono font-bold text-zinc-650 uppercase tracking-wider text-[9.5px]">
                        Primary Agent Model
                      </label>
                      <select
                        value={selectedGeminiModel}
                        onChange={(e) => {
                          setSelectedGeminiModel(e.target.value);
                          showToast(`Main AI model swapped to ${e.target.value}`);
                        }}
                        className="w-full p-2.5 bg-white border border-[#EAE6DF] rounded text-xs text-zinc-905 text-zinc-900 focus:ring-1 focus:ring-emerald-950 focus:outline-none font-medium font-mono"
                      >
                        <option value="gemini-2.5-flash">Gemini 2.5 Flash (Default)</option>
                        <option value="gemini-2.5-pro">Gemini 2.5 Pro (Precision Trace)</option>
                        <option value="gemini-1.5-pro">Gemini 1.5 Pro (Deep Context)</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block font-mono font-bold text-zinc-650 uppercase tracking-wider text-[9.5px]">
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

                  <div className="flex justify-end border-t border-[#EAE6DF]/60 pt-4">
                    <button
                      onClick={() => showToast('Gemini active model token bounds saved successfully.')}
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
                                prov.active ? 'bg-emerald-50 text-emerald-800' : 'bg-zinc-100 text-zinc-650'
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

                  <div className="p-3 bg-zinc-150 bg-zinc-100 border border-zinc-200 text-[#717A75] rounded flex gap-2 font-sans">
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
                        You are currently subscribed to the enterprise workspace plan. Modify billing cycles or swap tiers.
                      </p>
                    </div>
                    
                    <span className="p-1 px-2.5 bg-emerald-950 text-[#FAF8F5] rounded font-mono font-bold text-[9px] uppercase tracking-wider shadow-sm select-none">
                      Active Enterprise Tier
                    </span>
                  </div>

                  {/* Switch cycles buttons */}
                  <div className="flex gap-2 p-1 bg-[#FAF8F5] border border-[#EAE6DF] rounded w-60 text-xs">
                    <button
                      onClick={() => { setBillingCycle('monthly'); showToast('Subscription billing frequency matched to monthly cycle.'); }}
                      className={`flex-1 py-1.5 rounded font-semibold text-center cursor-pointer transition-all ${
                        billingCycle === 'monthly' ? 'bg-white shadow border border-[#EAE6DF] text-zinc-900 font-bold' : 'text-[#5C6560]'
                      }`}
                    >
                      Monthly Sync
                    </button>
                    <button
                      onClick={() => { setBillingCycle('yearly'); showToast('Subscription billing frequency matched to yearly cycle with 20% discount.'); }}
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
                        onClick={() => { setActiveTier('free'); showToast('Requested subscription change to sandbox free tier.'); }}
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
                        <span className="text-zinc-650 block font-mono text-[11px]">Up to 5 agents</span>
                        <div className="text-lg font-bold text-neutral-900 pt-2 font-display">
                          {billingCycle === 'monthly' ? '$49/mo' : '$39/mo'}
                        </div>
                      </div>
                      <button
                        onClick={() => { setActiveTier('pro'); showToast('Successfully updated plan allocation to Swarm Professional.'); }}
                        className="w-full py-1.5 border border-zinc-300 rounded font-bold uppercase tracking-wide tracking-wider text-[9px] font-mono hover:bg-zinc-50 cursor-pointer text-zinc-700"
                      >
                        {activeTier === 'pro' ? 'Currently Selected' : 'Select Pro'}
                      </button>
                    </div>

                    {/* Tier C: Enterprise Swarm */}
                    <div className={`p-4 rounded border-2 flex flex-col justify-between space-y-3 bg-white ${
                      activeTier === 'swarm-enterprise' ? 'border-emerald-950 bg-emerald-50/10 shadow-sm' : 'border-[#EAE6DF]'
                    }`}>
                      <div className="space-y-1">
                        <span className="font-bold text-[#1E2522] block font-display">Enterprise Core</span>
                        <span className="text-emerald-800 block font-mono text-[11px] font-bold">Unlimited agents</span>
                        <div className="text-lg font-bold text-neutral-900 pt-2 font-display">
                          {billingCycle === 'monthly' ? '$249/mo' : '$199/mo'}
                        </div>
                      </div>
                      <button
                        onClick={() => { setActiveTier('swarm-enterprise'); showToast('Subscription locked on Swarm Enterprise Core.'); }}
                        className="w-full py-1.5 bg-emerald-950 text-[#FAF8F5] rounded font-bold uppercase tracking-wide tracking-wider text-[9px] font-mono hover:opacity-90 cursor-pointer"
                      >
                        {activeTier === 'swarm-enterprise' ? 'Current Active Tier' : 'Upgrade'}
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
                    {invoices.map((inv) => (
                      <div key={inv.id} className="py-3 flex justify-between items-center text-xs">
                        <div className="space-y-0.5">
                          <span className="font-bold text-neutral-900 font-mono tracking-wider">{inv.id}</span>
                          <div className="text-zinc-500 font-sans text-[11px]">{inv.date} • {inv.method}</div>
                        </div>
                        
                        <div className="flex items-center gap-4">
                          <span className="font-bold text-neutral-900 font-display">${inv.amount.toFixed(2)}</span>
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
                    ))}
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
                        onClick={() => {
                          setIsSlackConnected(!isSlackConnected);
                          showToast(`Slack notification channel connection state is now: ${!isSlackConnected ? 'ON' : 'OFF'}`);
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
                        onClick={() => showToast('Slack payload target parameters saved and matched.')}
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
                        onClick={() => showToast('Alert emails dispatch thresholds matched.')}
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
