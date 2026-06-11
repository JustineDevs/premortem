export interface WorkspaceIntegration {
  id: string;
  name: string;
  provider: string;
  status: 'connected' | 'active_check' | 'disconnected';
  scope: string;
  lastSync: string | null;
  vcsOwner: string;
  projectCount?: number;
}

export interface WorkspaceBundle {
  profile: {
    id: string;
    email: string | null;
    username: string | null;
    fullName: string | null;
    avatarUrl: string | null;
    timezone: string;
    role: string;
  };
  organization: {
    id: string;
    name: string;
    slug: string;
    plan: string;
    billingEmail: string | null;
    websiteUrl: string | null;
    memberCount: number;
    projectCount: number;
  };
  integrations: WorkspaceIntegration[];
  policies: Array<{ id: string; name: string; description: string; active: boolean }>;
  notifications: {
    slackWebhook: string;
    slackChannel: string;
    isSlackConnected: boolean;
    alertEmails: string;
    alertSeverity: string;
  };
  llm: {
    selectedGeminiModel: string;
    maxTokens: number;
    temperature: number;
    customProviders: Array<{ name: string; host: string; model: string; active: boolean }>;
    vendorRouting: Array<{
      id: string;
      label: string;
      description: string;
      kind: 'managed' | 'custom' | 'auto_discover';
      providerRef: string;
      enabled: boolean;
    }>;
  };
  workItemAttributes: {
    autoApply: boolean;
    labelPrefix: string;
    includeSeverity: boolean;
    includeCategory: boolean;
    includePriority: boolean;
    includeAuditRef: boolean;
    includeConfidenceBand: boolean;
    gitlab: { ensureProjectLabels: boolean };
    github: { ensureRepositoryLabels: boolean };
  };
  billing: {
    plan: string;
    billingStatus: string | null;
    seats: number;
    auditQuotaMonthly: number;
    auditsUsedMonth: number;
    stripeConfigured: boolean;
    stripeTestMode: boolean;
    stripeBillingConfigured: boolean;
    canPublish: boolean;
    maxRepos: number;
    invoices: unknown[];
  };
  usage: {
    scans: { used: number; limit: number };
    repos: { used: number; limit: number };
    tokens: { used: number; limit: number };
    patches: { used: number; limit: number };
  };
  activity: Array<{ id: string; summary: string; actor: string; createdAt: string }>;
  runtime: {
    runningAudits: number;
    continuousAuditEnabled: boolean;
  };
}
