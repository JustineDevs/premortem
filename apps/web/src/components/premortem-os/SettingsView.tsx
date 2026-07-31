'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from "next/link";
import { premortemBrand } from "@/lib/premortem-os/branding";
import { authLinks } from "@/lib/auth-links";
import { formatIntegrationNotice } from "@/lib/integration-notices";
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
  Map as MapIcon,
  PlusCircle,
  LogOut,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { ProviderConnectCards } from "./provider-connect-cards";
import { ProviderIcon } from "./ProviderIcon";
import { OsIconButton } from "./os-icon-button";
import { SkillsTab } from "./settings/skills-tab";
import type { Project } from "@/lib/premortem-os/types";
import type { StripeInvoiceSummary, WorkspaceBundle } from "@/hooks/workspace-types";
import {
  DEFAULT_GEMINI_MODEL,
  DEFAULT_QWEN_MODEL,
  SMOKE_GEMINI_MODEL,
  DEFAULT_WORK_ITEM_ATTRIBUTE_CONFIG,
  SUPPORTED_WORKSPACE_MODELS,
  type WorkItemAttributeConfig,
} from "@premortem/domain";
import {
  DEFAULT_VENDOR_ROUTING,
  type VendorRoutingTier,
} from "@/lib/premortem-os/vendor-pool";
import {
  ModelSelector,
  type ModelSelectorGroup,
  type ModelSelectorOption,
} from "./model-selector";
import { resolveSettingsAccess } from "./settings-access";
import { useWorkspace } from "@/hooks/use-workspace";
import { buildOsQueryKey, useReconciliationEvents, type OsQueryScope } from "@/hooks/use-os-console-data";
import { shouldRetryBffQuery } from "@/lib/bff-client";
import { browserSecurityFetch } from "@/lib/csrf";

type NotificationInboxItem = {
  id: string;
  organizationId: string;
  projectId: string | null;
  kind: string;
  title: string;
  body: string | null;
  url: string | null;
  readAt: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

type ProjectAutomationDraft = {
  autoRunOnPush: boolean;
  autoPublishApprovedIssues: boolean;
  auditDefaultBranchOnly: boolean;
  enabledAgents: string;
  severityThreshold: "low" | "medium" | "high" | "critical";
  labelsTemplate: string;
  ignorePaths: string;
  notificationSettings: string;
};

type SettingsSubTabId =
  | "profile"
  | "organization"
  | "integrations"
  | "providers"
  | "skills"
  | "billing"
  | "notifications";

const getIconSlugByName = (name: string) => {
  const lowercase = name.toLowerCase();
  if (lowercase.includes("github")) return "github";
  if (lowercase.includes("gitlab")) return "gitlab";
  if (lowercase.includes("bitbucket")) return "bitbucket";
  if (lowercase.includes("azure")) return "azure-devops";
  if (lowercase.includes("gitea")) return "gitea";
  if (
    lowercase.includes("google") ||
    lowercase.includes("gcp") ||
    lowercase.includes("cloud source")
  )
    return "google-cloud";
  if (lowercase.includes("aws")) return "aws";
  return "git";
};

function workspaceModelLabel(model: string) {
  switch (model) {
    case DEFAULT_GEMINI_MODEL:
      return "Gemini 2.5 Flash";
    case SMOKE_GEMINI_MODEL:
      return "Gemini 2.5 Flash-Lite";
    case "gemini-2.5-flash":
      return "Gemini 2.5 Flash";
    case "gemini-2.5-pro":
      return "Gemini 2.5 Pro (Precision Trace)";
    case DEFAULT_QWEN_MODEL:
      return "Qwen Plus";
    case "qwen-max":
      return "Qwen Max";
    case "qwen3-coder-next":
      return "Qwen3 Coder Next";
    default:
      return `${model} (Legacy)`;
  }
}

function workspaceCloudModelDescription(model: string) {
  switch (model) {
    case DEFAULT_GEMINI_MODEL:
      return "Managed cloud model for general audit workloads.";
    case SMOKE_GEMINI_MODEL:
      return "Low-cost Gemini variant for lightweight scans.";
    case "gemini-2.5-flash":
      return "Fast managed Gemini variant for routine scans.";
    case "gemini-2.5-pro":
      return "Higher precision managed Gemini variant.";
    case DEFAULT_QWEN_MODEL:
      return "Managed Qwen variant for hybrid routing.";
    case "qwen-max":
      return "Higher capability Qwen route.";
    case "qwen3-coder-next":
      return "Code-centric Qwen route for technical traces.";
    default:
      return "Managed cloud route.";
  }
}

function buildManagedRoutingFromState(
  current: VendorRoutingTier[],
  providerRef = current.find((tier) => tier.kind === "custom")?.providerRef ?? "",
) {
  return DEFAULT_VENDOR_ROUTING.map((tier) => {
    if (tier.kind === "managed") {
      return { ...tier, enabled: true };
    }

    if (tier.kind === "custom") {
      return { ...tier, enabled: false, providerRef };
    }

    return { ...tier, enabled: true };
  });
}

function buildLocalRoutingFromState(current: VendorRoutingTier[], providerRef: string) {
  return DEFAULT_VENDOR_ROUTING.map((tier) => {
    if (tier.kind === "managed") {
      return { ...tier, enabled: true };
    }

    if (tier.kind === "custom") {
      return { ...tier, enabled: true, providerRef };
    }

    return { ...tier, enabled: true };
  });
}

function buildProjectSettingsDraft(project: Project | null): ProjectAutomationDraft {
  const settings = project?.projectSettings;
  return {
    autoRunOnPush: settings?.autoRunOnPush ?? false,
    autoPublishApprovedIssues: settings?.autoPublishApprovedIssues ?? false,
    auditDefaultBranchOnly: settings?.auditDefaultBranchOnly ?? true,
    enabledAgents: Array.isArray(settings?.enabledAgents)
      ? settings.enabledAgents.join(", ")
      : "",
    severityThreshold: settings?.severityThreshold ?? "medium",
    labelsTemplate: Array.isArray(settings?.labelsTemplate)
      ? settings.labelsTemplate.join(", ")
      : "",
    ignorePaths: Array.isArray(settings?.ignorePaths)
      ? settings.ignorePaths.join(", ")
      : "",
    notificationSettings: JSON.stringify(
      settings?.notificationSettings ?? {},
      null,
      2,
    ),
  };
}

function buildProjectSettingsSyncKey(project: Project | null) {
  const settings = project?.projectSettings;
  if (!project || !settings) {
    return project ? `${project.id}|empty` : '';
  }

  return [
    project.id,
    settings.autoRunOnPush ? '1' : '0',
    settings.autoPublishApprovedIssues ? '1' : '0',
    settings.auditDefaultBranchOnly ? '1' : '0',
    settings.enabledAgents.join(','),
    settings.severityThreshold,
    settings.labelsTemplate.join(','),
    settings.ignorePaths.join(','),
    JSON.stringify(settings.notificationSettings ?? {})
  ].join('|');
}

export function SettingsView({
  projects,
  queryScope = null,
  activeSubTab: activeSubTabProp,
  onActiveSubTabChange,
}: {
  projects?: Project[];
  queryScope?: OsQueryScope;
  activeSubTab?: SettingsSubTabId;
  onActiveSubTabChange?: (subTab: SettingsSubTabId) => void;
}) {
  const safeProjects = Array.isArray(projects) ? projects : [];
  const queryClient = useQueryClient();
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
    createApiKey,
    revokeApiKey,
    installSkill,
    startCheckout,
    startBillingPortal,
    cancelSubscription,
    reconcileIssues,
    syncIntegration,
    createSlackConnectSession,
    syncSlackConnection,
  } = useWorkspace();
  const reconciliationQuery = useReconciliationEvents({
    enabled: Boolean(workspace),
    organizationId: workspace?.organization.id ?? null
  });
  const workspaceRole = (workspace?.profile.role ?? "member").toLowerCase();
  const {
    canManageOrganization,
    canAccessMemberSettings,
    canManageModelSettings,
  } = resolveSettingsAccess(workspaceRole);

  const [localActiveSubTab, setLocalActiveSubTab] = useState<SettingsSubTabId>("profile");
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const [profileDraft, setProfileDraft] = useState({
    fullName: workspace?.profile.fullName ?? "",
    username: workspace?.profile.username ?? "",
    timezone: workspace?.profile.timezone ?? "UTC",
  });
  const [organizationDraft, setOrganizationDraft] = useState({
    name: workspace?.organization.name ?? "",
    billingEmail: workspace?.organization.billingEmail ?? "",
    websiteUrl: workspace?.organization.websiteUrl ?? "",
  });
  const [selectedGeminiModel, setSelectedGeminiModel] =
    useState(workspace?.llm.selectedGeminiModel ?? DEFAULT_GEMINI_MODEL);
  const [maxTokens, setMaxTokens] = useState(workspace?.llm.maxTokens ?? 8192);
  const [temperature, setTemperature] = useState(workspace?.llm.temperature ?? 0.2);
  const [customProviders, setCustomProviders] = useState<
    Array<{ name: string; host: string; model: string; active: boolean }>
  >(workspace?.llm.customProviders ?? []);
  const [vendorRouting, setVendorRouting] = useState<VendorRoutingTier[]>(
    () =>
      workspace?.llm.vendorRouting?.length
        ? workspace.llm.vendorRouting.map((tier) => ({ ...tier }))
        : DEFAULT_VENDOR_ROUTING.map((tier) => ({ ...tier })),
  );
  const [workItemAttributes, setWorkItemAttributes] =
    useState<WorkItemAttributeConfig>(
      workspace?.workItemAttributes ?? DEFAULT_WORK_ITEM_ATTRIBUTE_CONFIG,
    );
  const [newProvName, setNewProvName] = useState("");
  const [newProvHost, setNewProvHost] = useState("");
  const [newProvModel, setNewProvModel] = useState("");
  const [newApiKeyLabel, setNewApiKeyLabel] = useState("");
  const [createdApiKeySecret, setCreatedApiKeySecret] = useState<string | null>(
    null,
  );
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">(
    "monthly",
  );
  const [slackWebhook, setSlackWebhook] = useState("");
  const [slackChannel, setSlackChannel] = useState("");
  const [isSlackConnected, setIsSlackConnected] = useState(
    workspace?.notifications.isSlackConnected ?? false,
  );
  const [alertEmails, setAlertEmails] = useState(workspace?.notifications.alertEmails ?? "");
  const [alertSeverity, setAlertSeverity] = useState(
    workspace?.notifications.alertSeverity ?? "HIGH",
  );
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const projectSettingsSyncKeyRef = useRef("");
  const [projectSettingsDraft, setProjectSettingsDraft] =
    useState<ProjectAutomationDraft>({
      autoRunOnPush: false,
      autoPublishApprovedIssues: false,
      auditDefaultBranchOnly: true,
      enabledAgents: "",
      severityThreshold: "medium",
      labelsTemplate: "",
      ignorePaths: "",
      notificationSettings: "{}",
    });
  const activeSubTabPreview = activeSubTabProp ?? localActiveSubTab;

  const effectiveSelectedProjectId =
    selectedProjectId && safeProjects.some((project) => project.id === selectedProjectId)
      ? selectedProjectId
      : safeProjects[0]?.id ?? "";
  const activeTier = (workspace?.billing.plan ?? "free") as
    | "free"
    | "pro"
    | "team"
    | "scale"
    | "enterprise";
  const tierDisplayLabel =
    activeTier === "free"
      ? "Free"
      : activeTier === "pro"
        ? "Starter"
        : activeTier === "team"
          ? "Growth"
          : activeTier === "scale"
            ? "Scale"
          : "Enterprise";
  const roleDisplayLabel = workspaceRole
    ? workspaceRole.charAt(0).toUpperCase() + workspaceRole.slice(1)
    : "Member";
  const publishQuota = workspace?.billing.publishQuotaMonthly ?? null;
  const publishesUsed = workspace?.billing.publishesUsedMonth ?? 0;
  const publishesRemaining =
    publishQuota === null ? null : Math.max(publishQuota - publishesUsed, 0);
  const publishAllowanceLabel =
    publishQuota === null
      ? "Unlimited publish"
      : `${publishesUsed}/${publishQuota} publishes used`;
  const publishRemainingLabel =
    publishQuota === null
      ? "Unlimited remaining this month"
      : `${publishesRemaining} remaining this month`;
  const retentionLabel =
    workspace?.billing.supportLevel === "dedicated"
      ? "Custom retention"
      : `${workspace?.billing.historyRetentionDays ?? 0}-day audit history`;
  const supportLabel =
    workspace?.billing.supportLevel === "community"
      ? "community support"
      : workspace?.billing.supportLevel === "email"
        ? "email support"
        : workspace?.billing.supportLevel === "priority"
          ? "priority support"
          : "dedicated support";
  const billingCancellationDate = workspace?.billing.currentPeriodEnd
    ? new Date(workspace.billing.currentPeriodEnd)
    : null;
  const isSubscriptionCanceling = workspace?.billing.billingStatus === "canceling";
  const isFreeTier = activeTier === "free";
  const availableSubTabs = useMemo(
    (): Array<{ id: SettingsSubTabId; name: string; icon: LucideIcon }> => [
      { id: "profile" as SettingsSubTabId, name: "Profile", icon: User },
      ...(canAccessMemberSettings
        ? [
            { id: "billing" as SettingsSubTabId, name: "Billing", icon: CreditCard },
            { id: "providers" as SettingsSubTabId, name: "AI Models", icon: Cpu },
          ]
        : []),
      ...(canManageOrganization
        ? [
            { id: "organization" as SettingsSubTabId, name: "Organization", icon: Building2 },
            { id: "integrations" as SettingsSubTabId, name: "Integrations", icon: Sliders },
            { id: "skills" as SettingsSubTabId, name: "Skills", icon: Sparkles },
            { id: "notifications" as SettingsSubTabId, name: "Notifications", icon: Bell }
          ]
        : [])
    ],
    [canAccessMemberSettings, canManageOrganization]
  );
  const availableSubTabIds = useMemo(() => availableSubTabs.map((subTab) => subTab.id), [availableSubTabs]);

  const {
    data: notificationInbox = [],
    isLoading: notificationInboxLoading,
    refetch: reloadNotifications
  } = useQuery({
    queryKey: buildOsQueryKey(queryScope, 'notification-inbox', workspace?.organization.id ?? 'none'),
    enabled: Boolean(workspace) && activeSubTabPreview === 'notifications',
    staleTime: 30_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: shouldRetryBffQuery,
    queryFn: async () => {
      const response = await browserSecurityFetch('/api/workspace/notifications?limit=25');
      if (!response.ok) {
        throw new Error('Failed to load notifications.');
      }
      const payload: { notifications?: NotificationInboxItem[] } = await response.json();
      return payload.notifications ?? [];
    }
  });

  const integrations = workspace?.integrations ?? [];
  const policies = workspace?.policies ?? [];
  const apiKeys = workspace?.apiKeys ?? [];
  const usageStats = workspace?.usage ?? {
    scans: { used: 0, limit: 0 },
    tokens: { used: 0, limit: 0 },
    patches: { used: 0, limit: 0 },
  };
  const invoices = workspace?.billing.invoices ?? [];
  const slackConnectionId = workspace?.notifications.slackNangoConnectionId ?? "";
  const slackProviderKey = workspace?.notifications.slackNangoProviderKey ?? "";
  const slackNangoConnected = Boolean(slackConnectionId && slackProviderKey);
  const activeLocalProviderName = useMemo(() => {
    const tier = vendorRouting.find(
      (entry) =>
        entry.kind === "custom" &&
        entry.enabled &&
        entry.providerRef.trim() &&
        customProviders.some(
          (provider) => provider.name === entry.providerRef && provider.active,
        ),
    );
    return tier?.providerRef.trim() ?? "";
  }, [customProviders, vendorRouting]);
  const isLocalRouteActive = Boolean(activeLocalProviderName);
  const modelSelectorGroups = useMemo<ModelSelectorGroup[]>(
    () => [
      {
        id: "managed-cloud",
        label: "Cloud models",
        description:
          "Managed models are always available. Select one when you want cloud execution.",
        options: Array.from(
          new Map(
            [...SUPPORTED_WORKSPACE_MODELS, selectedGeminiModel].map((model) => [
              model,
              {
                kind: "cloud" as const,
                value: model,
                label: workspaceModelLabel(model),
                description: workspaceCloudModelDescription(model),
                iconSlug: "cloud",
                badge: model === selectedGeminiModel
                  ? isLocalRouteActive
                    ? "Available"
                    : "Active"
                  : undefined,
              } satisfies ModelSelectorOption,
            ]),
          ).values(),
        ),
      },
      {
        id: "local-providers",
        label: "Local providers",
        description:
          "Saved local or hybrid providers can be selected directly and remain available alongside cloud models.",
        options: customProviders.map(
          (provider, index) =>
            ({
              kind: "local" as const,
              value: provider.name,
              label: provider.name,
              description: provider.active
                ? `${provider.host} • ${provider.model}`
                : `${provider.host} • ${provider.model} • inactive`,
              iconSlug: /github|gitlab|bitbucket|azure|gitea|google|gcp|aws/i.test(provider.name)
                ? getIconSlugByName(provider.name)
                : undefined,
              badge: provider.active
                ? activeLocalProviderName === provider.name
                  ? "Active"
                  : index === 0
                    ? "Available"
                    : undefined
                : "Inactive",
              disabled: !provider.active,
            }) satisfies ModelSelectorOption,
        ),
      },
    ],
    [activeLocalProviderName, customProviders, isLocalRouteActive, selectedGeminiModel],
  );
  const selectedModelSelectorKey = activeLocalProviderName
    ? `local:${activeLocalProviderName}`
    : `cloud:${selectedGeminiModel}`;
  const modelSettingsLockMessage = canManageModelSettings
    ? undefined
    : 'Members can view the workspace model router but the admin-managed default stays locked.';

  const showToast = useCallback((message: string) => {
    setSuccessToast(message);
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = setTimeout(() => {
      setSuccessToast(null);
    }, 3050);
  }, []);

  const persistLlmSettings = useCallback(
    async (nextLlm: Partial<WorkspaceBundle['llm']>, successMessage: string) => {
      await patchLlm({
        selectedGeminiModel,
        maxTokens,
        temperature,
        customProviders,
        vendorRouting,
        ...nextLlm,
      });
      showToast(successMessage);
    },
    [
      customProviders,
      maxTokens,
      patchLlm,
      selectedGeminiModel,
      showToast,
      temperature,
      vendorRouting,
    ],
  );

  useEffect(
    () => () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    },
    []
  );

  const selectedProject =
    projects?.find((project) => project.id === effectiveSelectedProjectId) ?? null;
  const projectSettingsSyncKey = useMemo(
    () => buildProjectSettingsSyncKey(selectedProject),
    [selectedProject]
  );

  // Rehydrate only when the active workspace identity changes.
  // Refetches for the same org/profile should not clobber in-progress settings edits.
  const workspaceSyncKey = workspace
    ? [workspace.profile.id, workspace.organization.id].join('|')
    : '';

  useEffect(() => {
    if (!workspace) return;

    setProfileDraft({
      fullName: workspace.profile.fullName ?? "",
      username: workspace.profile.username ?? "",
      timezone: workspace.profile.timezone ?? "UTC",
    });
    setOrganizationDraft({
      name: workspace.organization.name ?? "",
      billingEmail: workspace.organization.billingEmail ?? "",
      websiteUrl: workspace.organization.websiteUrl ?? "",
    });
    setSelectedGeminiModel(workspace.llm.selectedGeminiModel ?? DEFAULT_GEMINI_MODEL);
    setMaxTokens(workspace.llm.maxTokens ?? 8192);
    setTemperature(workspace.llm.temperature ?? 0.2);
    setCustomProviders(workspace.llm.customProviders ?? []);
    setVendorRouting(
      workspace.llm.vendorRouting?.length
        ? workspace.llm.vendorRouting.map((tier) => ({ ...tier }))
        : DEFAULT_VENDOR_ROUTING.map((tier) => ({ ...tier })),
    );
    setWorkItemAttributes(workspace.workItemAttributes ?? DEFAULT_WORK_ITEM_ATTRIBUTE_CONFIG);
    setIsSlackConnected(workspace.notifications.isSlackConnected ?? false);
    setAlertEmails(workspace.notifications.alertEmails ?? "");
    setAlertSeverity(workspace.notifications.alertSeverity ?? "HIGH");
  }, [workspaceSyncKey]);

  useEffect(() => {
    if (projectSettingsSyncKeyRef.current === projectSettingsSyncKey) {
      return;
    }

    projectSettingsSyncKeyRef.current = projectSettingsSyncKey;
    setProjectSettingsDraft(buildProjectSettingsDraft(selectedProject));
  }, [projectSettingsSyncKey]);

  useEffect(() => {
    const nextProjectId =
      selectedProjectId && safeProjects.some((project) => project.id === selectedProjectId)
        ? selectedProjectId
        : safeProjects[0]?.id ?? "";

    if (nextProjectId !== selectedProjectId) {
      setSelectedProjectId(nextProjectId);
    }
  }, [safeProjects, selectedProjectId]);

  const activeSubTab = useMemo<SettingsSubTabId>(() => {
    const candidate = activeSubTabProp ?? localActiveSubTab;
    return availableSubTabIds.includes(candidate) ? candidate : availableSubTabIds[0] ?? "profile";
  }, [activeSubTabProp, availableSubTabIds, localActiveSubTab]);

  const setActiveSubTab = useCallback(
    (subTab: SettingsSubTabId) => {
      if (onActiveSubTabChange) {
        onActiveSubTabChange(subTab);
        return;
      }
      setLocalActiveSubTab(subTab);
    },
    [onActiveSubTabChange]
  );

  const saveSelectedProjectSettings = async () => {
    if (!selectedProject) {
      showToast("Select a project first.");
      return;
    }

    let parsedNotificationSettings: Record<string, unknown> = {};
    try {
      parsedNotificationSettings =
        projectSettingsDraft.notificationSettings.trim()
          ? (JSON.parse(projectSettingsDraft.notificationSettings) as Record<
              string,
              unknown
            >)
          : {};
    } catch {
      showToast("Notification settings must be valid JSON.");
      return;
    }

    try {
      const response = await browserSecurityFetch(
        `/api/projects/${selectedProject.id}/settings`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            autoRunOnPush: projectSettingsDraft.autoRunOnPush,
            autoPublishApprovedIssues:
              projectSettingsDraft.autoPublishApprovedIssues,
            auditDefaultBranchOnly: projectSettingsDraft.auditDefaultBranchOnly,
            enabledAgents: projectSettingsDraft.enabledAgents
              .split(",")
              .flatMap((value) => {
                const trimmed = value.trim();
                return trimmed ? [trimmed] : [];
              }),
            severityThreshold: projectSettingsDraft.severityThreshold,
            labelsTemplate: projectSettingsDraft.labelsTemplate
              .split(",")
              .flatMap((value) => {
                const trimmed = value.trim();
                return trimmed ? [trimmed] : [];
              }),
            ignorePaths: projectSettingsDraft.ignorePaths
              .split(",")
              .flatMap((value) => {
                const trimmed = value.trim();
                return trimmed ? [trimmed] : [];
              }),
            notificationSettings: parsedNotificationSettings,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(await response.text());
      }

      void queryClient.invalidateQueries({ queryKey: buildOsQueryKey(queryScope, 'workspace') });
      void queryClient.invalidateQueries({ queryKey: buildOsQueryKey(queryScope, 'projects') });
      showToast(`Saved automation settings for ${selectedProject.name}.`);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to save project settings.",
      );
    }
  };

  const markNotificationsRead = async (notificationIds?: string[]) => {
    try {
      const response = await browserSecurityFetch("/api/workspace/notifications/read", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ notificationIds }),
      });
      if (!response.ok) {
        throw new Error("Failed to mark notifications read.");
      }
      await reloadNotifications();
      showToast("Notification inbox updated.");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to update notifications.",
      );
    }
  };

  const handleModelSelection = useCallback(
    async (option: ModelSelectorOption) => {
      if (!canManageModelSettings) {
        showToast('Workspace model settings are locked for member access.');
        return;
      }
      const nextSelectedGeminiModel =
        option.kind === 'cloud' ? option.value : selectedGeminiModel;
      const nextVendorRouting =
        option.kind === 'cloud'
          ? buildManagedRoutingFromState(vendorRouting)
          : buildLocalRoutingFromState(vendorRouting, option.value);

      setSelectedGeminiModel(nextSelectedGeminiModel);
      setVendorRouting(nextVendorRouting);

      try {
        await persistLlmSettings(
          {
            selectedGeminiModel: nextSelectedGeminiModel,
            vendorRouting: nextVendorRouting,
          },
          option.kind === 'cloud'
            ? `Saved managed model ${workspaceModelLabel(option.value)}.`
            : `Saved local provider ${option.label}.`,
        );
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : 'Failed to save model selection.',
        );
      }
    },
    [
      canManageModelSettings,
      persistLlmSettings,
      selectedGeminiModel,
      showToast,
      vendorRouting,
    ],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const notice = params.get("integration_notice");
    if (!notice) return;

    const detail = params.get("integration_detail");
    showToast(formatIntegrationNotice(notice, detail));

    params.delete("integration_notice");
    params.delete("integration_detail");
    params.delete("integration_provider");
    const nextUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
    window.history.replaceState({}, "", nextUrl);
  }, [showToast]);

  const togglePolicy = async (id: string) => {
    const nextPolicies = policies.map((policy) =>
      policy.id === id ? { ...policy, active: !policy.active } : policy,
    );
    try {
      await patchPolicies(nextPolicies);
      showToast("Continuous enforcement policy thresholds updated.");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to save policy.");
    }
  };

  const handleAddCustomProvider = async (e: FormEvent) => {
    e.preventDefault();
    if (!canManageModelSettings) {
      showToast('Workspace model settings are locked for member access.');
      return;
    }
    const providerName = newProvName.trim();
    const providerHost = newProvHost.trim();
    const providerModel = newProvModel.trim() || 'custom-model';
    if (!providerName || !providerHost) {
      showToast("Provide a valid provider name and base URL.");
      return;
    }
    const nextProviders = [
      ...customProviders,
      {
        name: providerName,
        host: providerHost,
        model: providerModel,
        active: true,
      },
    ];
    const nextVendorRouting = buildLocalRoutingFromState(vendorRouting, providerName);
    try {
      await patchLlm({
        selectedGeminiModel,
        maxTokens,
        temperature,
        customProviders: nextProviders,
        vendorRouting: nextVendorRouting,
      });
      setCustomProviders(nextProviders);
      setVendorRouting(nextVendorRouting);
      setNewProvName("");
      setNewProvHost("");
      setNewProvModel("");
      showToast(`Registered and activated custom provider "${providerName}".`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to save provider.");
    }
  };

  const handleDeleteProvider = async (index: number) => {
    if (!canManageModelSettings) {
      showToast('Workspace model settings are locked for member access.');
      return;
    }
    const item = customProviders[index];
    const nextProviders = customProviders.filter((_, idx) => idx !== index);
    const nextVendorRouting =
      nextProviders.some((provider) => provider.active)
        ? buildLocalRoutingFromState(
            vendorRouting,
            nextProviders.find((provider) => provider.active)?.name ?? '',
          )
        : buildManagedRoutingFromState(vendorRouting, '');
    try {
      await patchLlm({
        customProviders: nextProviders,
        vendorRouting: nextVendorRouting,
      });
      setCustomProviders(nextProviders);
      setVendorRouting(nextVendorRouting);
      showToast(`Removed custom provider "${item.name}".`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to remove provider.");
    }
  };

  const handleCreateApiKey = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    const label = newApiKeyLabel.trim();
    if (!label) {
      showToast("Provide a label for the API key.");
      return;
    }

    try {
      const result = await createApiKey(label);
      setCreatedApiKeySecret(result.apiKey.apiKey);
      setNewApiKeyLabel("");
      showToast(`Created API key ${result.apiKey.key.label}.`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to create API key.");
    }
  };

  const handleRevokeApiKey = async (keyId: string, label: string) => {
    try {
      await revokeApiKey(keyId);
      showToast(`Revoked API key ${label}.`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to revoke API key.");
    }
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
        {error ?? "Unable to load workspace settings."}
      </div>
    );
  }

  return (
    <div
      className="flex-1 overflow-y-auto p-6 md:p-8 font-sans max-w-7xl mx-auto w-full space-y-8 animate-fadeIn"
      id="settings-view-hub"
    >
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
          Workspace Settings
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
            <h3 className="text-sm font-bold tracking-tight text-[#1E2522] uppercase font-mono">
              Settings
            </h3>
            <p className="text-[10px] text-[#717A75] font-mono">
              WORKSPACE CONFIG
            </p>
          </div>

          <nav className="flex flex-row lg:flex-col overflow-x-auto lg:overflow-x-visible gap-1.5 pb-2 lg:pb-0 scrollbar-none">
            {availableSubTabs.map((subTab) => {
              const IconComp = subTab.icon;
              const isSelected = activeSubTab === subTab.id;
              return (
                <button
                  key={subTab.id}
                  type="button"
                  onClick={() => {
                    setActiveSubTab(subTab.id as typeof activeSubTab);
                  }}
                  className={`py-2 px-3 text-xs rounded transition-all cursor-pointer flex items-center gap-2.5 whitespace-nowrap outline-none border-0 ${
                    isSelected
                      ? "bg-emerald-950 font-bold text-[#FAF8F5] shadow-sm"
                      : "text-[#4A5550] hover:bg-[#FAF8F5] hover:text-[#1E2522]"
                  }`}
                >
                  <IconComp
                    size={14}
                    className={isSelected ? "text-white" : "text-[#717A75]"}
                  />
                  <span>{subTab.name}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right Detail Content Panel */}
        <div className="lg:col-span-3 space-y-6">
          {/* ==================== TAB: PROFILE ==================== */}
          {activeSubTab === "profile" && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-[#FAF8F5] border border-[#EAE6DF] rounded-lg p-6 space-y-6">
                <div>
                  <h3 className="text-md font-bold text-[#1E2522] font-display mb-1">
                    User Profile Account
                  </h3>
                  <p className="text-xs text-[#717A75]">
                    Configure your workspace profile and private identity
                    keys.
                  </p>
                </div>

                <div className="flex flex-col md:flex-row gap-6 items-start md:items-center p-4 bg-white border border-[#EAE6DF] rounded">
                  <div className="w-14 h-14 bg-emerald-950 text-white rounded-full flex items-center justify-center font-bold text-lg border border-emerald-900 shadow font-display">
                    {(
                      workspace.profile.fullName ??
                      workspace.profile.email ??
                      "?"
                    )
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono uppercase bg-slate-100 border px-1.5 py-0.2 rounded font-bold text-slate-800">
                      Workspace role: {workspace.profile.role}
                    </span>
                    <h4 className="text-md font-bold text-neutral-900 font-display">
                      {workspace.profile.email ??
                        workspace.profile.username ??
                        workspace.profile.id}
                    </h4>
                    <p className="text-[11px] text-[#717A75]">
                      Profile loaded from Supabase session and Premortem runtime.
                      Paid plans can elevate the subscription owner to admin access.
                    </p>
                  </div>
                </div>

                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label
                        htmlFor="profile-full-name"
                        className="block font-mono font-bold text-zinc-500 uppercase tracking-wider text-[9px]"
                      >
                        Full Display Name
                      </label>
                      <input
                        id="profile-full-name"
                        type="text"
                        value={profileDraft.fullName}
                        onChange={(e) =>
                          setProfileDraft((prev) => ({
                            ...prev,
                            fullName: e.target.value,
                          }))
                        }
                        className="w-full p-2.5 bg-white border border-[#EAE6DF] rounded text-xs text-zinc-900 font-medium"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label
                        htmlFor="profile-email"
                        className="block font-mono font-bold text-zinc-500 uppercase tracking-wider text-[9px]"
                      >
                        Contact Email Address
                      </label>
                      <input
                        id="profile-email"
                        type="email"
                        value={workspace.profile.email ?? ""}
                        disabled
                        readOnly
                        className="w-full p-2.5 bg-zinc-50 border border-[#EAE6DF] rounded text-xs text-zinc-450 cursor-not-allowed font-medium font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await patchProfile(profileDraft);
                        showToast("Profile settings updated successfully.");
                      } catch (err) {
                        showToast(
                          err instanceof Error
                            ? err.message
                            : "Failed to save profile.",
                        );
                      }
                    }}
                    className="py-2 px-4 bg-emerald-950 font-bold text-white rounded hover:bg-emerald-900 transition-all cursor-pointer"
                  >
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
                <h4 className="text-xs font-mono uppercase font-bold tracking-wider text-[#1E2522]">
                  Recent Security Access Trails
                </h4>
                <div className="font-mono text-[10px] space-y-2 text-[#717A75]">
                  {workspace.activity.length === 0 ? (
                    <p className="italic">
                      No activity events recorded yet. Run an audit to populate
                      trails.
                    </p>
                  ) : (
                    workspace.activity.map((event) => (
                      <div
                        key={event.id}
                        className="flex justify-between border-b pb-1.5"
                      >
                        <span>{event.summary}</span>
                        <span className="text-zinc-500">
                          {new Date(event.createdAt).toLocaleString()}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ==================== TAB: ORGANIZATION ==================== */}
          {activeSubTab === "organization" && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-[#FAF8F5] border border-[#EAE6DF] rounded-lg p-6 space-y-6">
                <div>
                  <h3 className="text-md font-bold text-[#1E2522] font-display mb-1 flex items-center gap-2">
                    <Building2 size={16} />
                    Organization Profile Settings
                  </h3>
                  <p className="text-xs text-[#717A75]">
                    Manage company identity, check regulatory compliances, and
                    enable continuous policies gates.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
                  <div className="p-4 bg-white border border-[#EAE6DF] rounded space-y-1">
                    <span className="text-[9px] text-[#8A958F] font-bold block uppercase">
                      Organization Name
                    </span>
                    <span className="font-bold text-[#1E2522] text-sm font-sans block">
                      {workspace.organization.name}
                    </span>
                  </div>
                  <div className="p-4 bg-white border border-[#EAE6DF] rounded space-y-1">
                    <span className="text-[9px] text-[#8A958F] font-bold block uppercase">
                      Subscription Tier
                    </span>
                      <span className="font-bold text-emerald-800 text-sm font-sans block">
                      {tierDisplayLabel}
                    </span>
                  </div>
                  <div className="p-4 bg-white border border-[#EAE6DF] rounded space-y-1">
                    <span className="text-[9px] text-[#8A958F] font-bold block uppercase">
                      Workspace Activity
                    </span>
                    <span className="font-bold text-[#1E2522] text-sm font-sans block">
                      {workspace.runtime.runningAudits} running ·{" "}
                      {workspace.organization.projectCount} projects ·{" "}
                      {workspace.organization.memberCount} members
                    </span>
                  </div>
                </div>

                <div className="border border-[#EAE6DF] bg-white rounded-lg p-5 space-y-4 text-xs">
                  <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-900 flex items-center gap-1.5">
                    <Building2 size={14} className="text-emerald-700" />
                    Organization Details
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label
                        htmlFor="organization-display-name"
                        className="block font-mono font-bold text-zinc-500 uppercase tracking-wider text-[9px]"
                      >
                        Display Name
                      </label>
                      <input
                        id="organization-display-name"
                        type="text"
                        value={organizationDraft.name}
                        onChange={(e) =>
                          setOrganizationDraft((prev) => ({
                            ...prev,
                            name: e.target.value,
                          }))
                        }
                        className="w-full p-2.5 bg-white border border-[#EAE6DF] rounded text-xs"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label
                        htmlFor="organization-billing-email"
                        className="block font-mono font-bold text-zinc-500 uppercase tracking-wider text-[9px]"
                      >
                        Billing Email
                      </label>
                      <input
                        id="organization-billing-email"
                        type="email"
                        value={organizationDraft.billingEmail}
                        onChange={(e) =>
                          setOrganizationDraft((prev) => ({
                            ...prev,
                            billingEmail: e.target.value,
                          }))
                        }
                        className="w-full p-2.5 bg-white border border-[#EAE6DF] rounded text-xs font-mono"
                      />
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                      <label
                        htmlFor="organization-website-url"
                        className="block font-mono font-bold text-zinc-500 uppercase tracking-wider text-[9px]"
                      >
                        Website URL
                      </label>
                      <input
                        id="organization-website-url"
                        type="url"
                        value={organizationDraft.websiteUrl}
                        onChange={(e) =>
                          setOrganizationDraft((prev) => ({
                            ...prev,
                            websiteUrl: e.target.value,
                          }))
                        }
                        className="w-full p-2.5 bg-white border border-[#EAE6DF] rounded text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>
                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await patchOrganization(organizationDraft);
                        showToast("Organization profile saved.");
                      } catch (err) {
                        showToast(
                          err instanceof Error
                            ? err.message
                            : "Failed to save organization.",
                        );
                      }
                    }}
                    className="py-2 px-4 bg-emerald-950 font-bold text-white rounded hover:bg-emerald-900 transition-all cursor-pointer"
                  >
                    Save Organization Changes
                  </button>
                </div>

                <div className="border border-[#EAE6DF] bg-white rounded-lg p-5 space-y-4">
                  <div className="flex flex-col gap-1">
                    <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-900 flex items-center gap-1.5">
                      <Zap size={14} className="text-emerald-700" />
                      Project automation settings
                    </h4>
                    <p className="text-xs text-[#717A75]">
                      Configure default audit behavior, allowlisted agents,
                      ignored paths, and notification defaults per project.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="space-y-1.5">
                      <span className="block font-mono font-bold text-zinc-500 uppercase tracking-wider text-[9px]">
                        Project
                      </span>
                      <select
                        value={effectiveSelectedProjectId}
                        onChange={(event) =>
                          setSelectedProjectId(event.target.value)
                        }
                        className="w-full p-2.5 bg-white border border-[#EAE6DF] rounded text-xs font-medium"
                      >
                        {projects?.length ? (
                          safeProjects.map((project) => (
                            <option key={project.id} value={project.id}>
                              {project.name}
                            </option>
                          ))
                        ) : (
                          <option value="">No projects connected</option>
                        )}
                      </select>
                    </label>
                    <div className="p-3 bg-[#FAF8F5] border border-[#EAE6DF] rounded text-xs text-[#717A75]">
                      {selectedProject ? (
                        <>
                          <p className="font-bold text-[#1E2522]">
                            {selectedProject.name}
                          </p>
                          <p className="mt-1">
                            {selectedProject.projectSettings
                              ? "Loaded project-specific defaults from the workspace."
                              : "This project uses workspace defaults until saved."}
                          </p>
                        </>
                      ) : (
                        <p>Select a project to edit its automation policy.</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      {
                        key: "autoRunOnPush",
                        label: "Auto run on push",
                        description:
                          "Launch audits automatically when the tracked branch updates.",
                      },
                      {
                        key: "autoPublishApprovedIssues",
                        label: "Auto publish approved issues",
                        description:
                          "Push approved findings back to GitLab without a manual publish step.",
                      },
                      {
                        key: "auditDefaultBranchOnly",
                        label: "Audit default branch only",
                        description:
                          "Keep automated runs scoped to the canonical branch.",
                      },
                    ].map((item) => (
                      <label
                        key={item.key}
                        className="flex items-start justify-between gap-3 border border-[#EAE6DF] bg-[#FAF8F5] rounded p-3 cursor-pointer"
                      >
                        <div className="space-y-0.5">
                          <span className="text-[#1E2522] font-medium block">
                            {item.label}
                          </span>
                          <span className="text-[11px] text-[#717A75]">
                            {item.description}
                          </span>
                        </div>
                        <input
                          type="checkbox"
                          checked={
                            projectSettingsDraft[
                              item.key as keyof ProjectAutomationDraft
                            ] as boolean
                          }
                          onChange={(event) =>
                            setProjectSettingsDraft((prev) => ({
                              ...prev,
                              [item.key]: event.target.checked,
                            }))
                          }
                          className="accent-emerald-950 mt-1"
                        />
                      </label>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 gap-4 text-xs lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)]">
                    <label className="space-y-1.5">
                      <span className="block font-mono font-bold text-zinc-500 uppercase tracking-wider text-[9px]">
                        Enabled agents, comma separated
                      </span>
                      <textarea
                        value={projectSettingsDraft.enabledAgents}
                        onChange={(event) =>
                          setProjectSettingsDraft((prev) => ({
                            ...prev,
                            enabledAgents: event.target.value,
                          }))
                        }
                        rows={3}
                        className="w-full p-2.5 bg-white border border-[#EAE6DF] rounded text-xs font-mono"
                      />
                    </label>
                    <label className="space-y-1.5">
                      <span className="block font-mono font-bold text-zinc-500 uppercase tracking-wider text-[9px]">
                        Severity threshold
                      </span>
                      <select
                        value={projectSettingsDraft.severityThreshold}
                        onChange={(event) =>
                          setProjectSettingsDraft((prev) => ({
                            ...prev,
                            severityThreshold: event.target
                              .value as ProjectAutomationDraft["severityThreshold"],
                          }))
                        }
                        className="w-full p-2.5 bg-white border border-[#EAE6DF] rounded text-xs font-medium"
                      >
                        <option value="low">Low and above</option>
                        <option value="medium">Medium and above</option>
                        <option value="high">High and critical</option>
                        <option value="critical">Critical only</option>
                      </select>
                    </label>
                    <label className="space-y-1.5">
                      <span className="block font-mono font-bold text-zinc-500 uppercase tracking-wider text-[9px]">
                        Labels template, comma separated
                      </span>
                      <textarea
                        value={projectSettingsDraft.labelsTemplate}
                        onChange={(event) =>
                          setProjectSettingsDraft((prev) => ({
                            ...prev,
                            labelsTemplate: event.target.value,
                          }))
                        }
                        rows={3}
                        className="w-full p-2.5 bg-white border border-[#EAE6DF] rounded text-xs font-mono"
                      />
                    </label>
                    <label className="space-y-1.5">
                      <span className="block font-mono font-bold text-zinc-500 uppercase tracking-wider text-[9px]">
                        Ignore paths, comma separated
                      </span>
                      <textarea
                        value={projectSettingsDraft.ignorePaths}
                        onChange={(event) =>
                          setProjectSettingsDraft((prev) => ({
                            ...prev,
                            ignorePaths: event.target.value,
                          }))
                        }
                        rows={3}
                        className="w-full p-2.5 bg-white border border-[#EAE6DF] rounded text-xs font-mono"
                      />
                    </label>
                    <label className="space-y-1.5 md:col-span-2">
                      <span className="block font-mono font-bold text-zinc-500 uppercase tracking-wider text-[9px]">
                        Notification settings JSON
                      </span>
                      <textarea
                        value={projectSettingsDraft.notificationSettings}
                        onChange={(event) =>
                          setProjectSettingsDraft((prev) => ({
                            ...prev,
                            notificationSettings: event.target.value,
                          }))
                        }
                        rows={5}
                        className="w-full p-2.5 bg-white border border-[#EAE6DF] rounded text-xs font-mono"
                      />
                    </label>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => void saveSelectedProjectSettings()}
                      disabled={!selectedProject}
                      className="py-2 px-4 bg-emerald-950 font-bold text-white rounded hover:bg-emerald-900 transition-all cursor-pointer disabled:cursor-not-allowed disabled:bg-zinc-300"
                    >
                      Save Project Automation
                    </button>
                  </div>
                </div>

                <div className="border border-[#EAE6DF] bg-white rounded-lg p-5">
                  <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-900 mb-4 flex items-center gap-1.5">
                    <ShieldCheck size={14} className="text-emerald-700" />
                    Enforcement Policies (from workspace)
                  </h4>
                  {policies.length === 0 ? (
                    <p className="text-xs text-[#717A75] italic">
                      No policies configured yet.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      {policies.map((policy) => (
                        <div
                          key={policy.id}
                          className={`p-3 rounded flex items-center gap-2 border ${
                            policy.active
                              ? "bg-emerald-50/50 border-emerald-200/50"
                              : "bg-zinc-50 border-zinc-200 text-zinc-500"
                          }`}
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${policy.active ? "bg-emerald-600" : "bg-zinc-400"}`}
                          />
                          <span className="font-bold font-display">
                            {policy.name}
                          </span>
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
                  Our model agents validate repository source code against these
                  guidelines.
                </p>

                <div className="space-y-3.5">
                  {policies.map((p) => (
                    <div
                      key={p.id}
                      className="border border-[#EAE6DF] bg-white rounded p-4 flex items-start justify-between gap-4 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-neutral-900 uppercase tracking-wide">
                            {p.name}
                          </h4>
                          <span
                            className={`text-[8.5px] font-mono border px-1.5 py-0.2 select-none font-bold rounded ${
                              p.active
                                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                                : "bg-zinc-100 border-zinc-200 text-zinc-500"
                            }`}
                          >
                            {p.active ? "ACTIVE" : "MUTED"}
                          </span>
                        </div>
                        <p className="text-[#5C6560] leading-relaxed select-text">
                          {p.description}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => togglePolicy(p.id)}
                        aria-label={`${p.active ? "Disable" : "Enable"} policy ${p.name}`}
                        className={`w-10 h-6 shrink-0 rounded-full p-0.5 border cursor-pointer transition-all ${
                          p.active
                            ? "bg-emerald-950 border-emerald-950 flex justify-end"
                            : "bg-[#FAF8F5] border-[#EAE6DF] flex justify-start"
                        }`}
                      >
                        <div className="w-4.5 h-4.5 bg-white border border-[#EAD0D0]/20 rounded-full shadow-sm" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-[#FAF8F5] border border-[#EAE6DF] rounded-lg p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h3 className="text-md font-bold text-[#1E2522] font-display mb-1 flex items-center gap-2">
                      <Key size={16} />
                      Programmatic Access Keys
                    </h3>
                    <p className="text-xs text-[#717A75]">
                      Use scoped API keys for server-to-server access, workspace
                      exports, and automation.
                    </p>
                  </div>
                  <Link
                    href="/api/workspace/activity/export?format=csv"
                    download
                    className="inline-flex items-center gap-2 py-2 px-4 bg-white border border-[#EAE6DF] font-bold text-[#1E2522] rounded hover:bg-zinc-50 transition-all cursor-pointer text-xs"
                  >
                    <Download size={14} />
                    Export Activity CSV
                  </Link>
                </div>

                {createdApiKeySecret ? (
                  <div className="border border-emerald-200 bg-emerald-50 rounded p-4 space-y-2">
                    <p className="text-xs font-bold text-emerald-900 uppercase tracking-wide">
                      Copy this API key now. It is shown only once.
                    </p>
                    <code className="block text-[11px] font-mono break-all text-emerald-950">
                      {createdApiKeySecret}
                    </code>
                  </div>
                ) : null}

                <form
                  onSubmit={handleCreateApiKey}
                  className="flex flex-col md:flex-row gap-3"
                >
                  <label htmlFor="new-api-key-label" className="sr-only">
                    API key label
                  </label>
                  <input
                    id="new-api-key-label"
                    type="text"
                    value={newApiKeyLabel}
                    onChange={(event) => setNewApiKeyLabel(event.target.value)}
                    placeholder="e.g. Finance export job"
                    className="flex-1 p-2.5 bg-white border border-[#EAE6DF] rounded text-xs font-mono"
                  />
                  <button
                    type="submit"
                    className="py-2 px-4 bg-emerald-950 font-bold text-white rounded hover:bg-emerald-900 transition-all cursor-pointer text-xs uppercase tracking-wide"
                  >
                    Create API Key
                  </button>
                </form>

                <div className="space-y-2">
                  {apiKeys.length === 0 ? (
                    <p className="text-xs text-[#717A75] italic">
                      No API keys issued yet.
                    </p>
                  ) : (
                    apiKeys.map((key) => (
                      <div
                        key={key.id}
                        className="border border-[#EAE6DF] bg-white rounded p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-xs"
                      >
                        <div className="space-y-0.5">
                          <p className="font-bold text-[#1E2522]">
                            {key.label}
                          </p>
                          <p className="text-[11px] font-mono text-[#717A75]">
                            {key.keyPrefix}
                            {key.lastUsedAt
                              ? ` · last used ${new Date(key.lastUsedAt).toLocaleString()}`
                              : " · never used"}
                            {key.revokedAt
                              ? ` · revoked ${new Date(key.revokedAt).toLocaleString()}`
                              : ""}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={Boolean(key.revokedAt)}
                          onClick={() =>
                            void handleRevokeApiKey(key.id, key.label)
                          }
                          className={`py-1.5 px-3 rounded border font-bold uppercase tracking-wide text-[10px] ${
                            key.revokedAt
                              ? "border-zinc-200 bg-zinc-50 text-zinc-400 cursor-not-allowed"
                              : "border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100 cursor-pointer"
                          }`}
                        >
                          {key.revokedAt ? "Revoked" : "Revoke"}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ==================== TAB: CONNECTED PROVIDERS ==================== */}
          {activeSubTab === "integrations" && (
            <div className="space-y-6 animate-fadeIn">
              {/* Header block conforming exactly to the user request */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#EAE6DF] pb-5">
                <div className="space-y-1">
                  <h2 className="text-xl font-bold tracking-tight text-[#1E2522]">
                    Connected Providers
                  </h2>
                  <p className="text-xs text-[#5C6560] max-w-xl">
                    GitLab sign-in verifies identity. Repository access is a
                    separate one-time OAuth grant for discovery, publish, and
                    reconciliation.
                  </p>
                </div>
              </div>

              <ProviderConnectCards
                integrations={integrations}
              />

              <div className="bg-[#FAF8F5] border border-[#EAE6DF] rounded-lg p-6 space-y-4">
                <div>
                  <h3 className="text-md font-bold text-[#1E2522] font-display mb-1 flex items-center gap-2">
                    <MapIcon size={16} />
                    Work item attributes automation
                  </h3>
                  <p className="text-xs text-[#717A75]">
                    When publishing approved findings, Premortem automatically
                    creates provider labels and traceability metadata using each
                    platform&apos;s official REST APIs (GitLab Labels + Issues,
                    GitHub Labels + Issues).
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  {[
                    { key: "autoApply", label: "Auto-apply labels on publish" },
                    { key: "includeSeverity", label: "Severity label tier" },
                    { key: "includeCategory", label: "Category label tier" },
                    { key: "includePriority", label: "Priority label tier" },
                    {
                      key: "includeConfidenceBand",
                      label: "Confidence band label",
                    },
                    {
                      key: "includeAuditRef",
                      label: "Audit traceability table in description",
                    },
                  ].map((item) => (
                    <label
                      key={item.key}
                      className="flex items-center justify-between border border-[#EAE6DF] bg-white rounded p-3 cursor-pointer"
                    >
                      <span className="text-[#1E2522] font-medium">
                        {item.label}
                      </span>
                      <input
                        type="checkbox"
                        checked={
                          workItemAttributes[
                            item.key as keyof WorkItemAttributeConfig
                          ] as boolean
                        }
                        onChange={(e) =>
                          setWorkItemAttributes((prev) => ({
                            ...prev,
                            [item.key]: e.target.checked,
                          }))
                        }
                        className="accent-emerald-950"
                      />
                    </label>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <label className="space-y-1">
                    <span className="text-[10px] font-mono uppercase tracking-wide text-[#8A958F]">
                      Label prefix
                    </span>
                    <input
                      value={workItemAttributes.labelPrefix}
                      onChange={(e) =>
                        setWorkItemAttributes((prev) => ({
                          ...prev,
                          labelPrefix: e.target.value,
                        }))
                      }
                      className="w-full p-2 bg-white border border-[#EAE6DF] rounded font-mono"
                    />
                  </label>
                  <label className="flex items-center justify-between border border-[#EAE6DF] bg-white rounded p-3 cursor-pointer">
                    <span className="text-[#1E2522] font-medium">
                      Ensure GitLab project labels exist
                    </span>
                    <input
                      type="checkbox"
                      checked={workItemAttributes.gitlab.ensureProjectLabels}
                      onChange={(e) =>
                        setWorkItemAttributes((prev) => ({
                          ...prev,
                          gitlab: {
                            ...prev.gitlab,
                            ensureProjectLabels: e.target.checked,
                          },
                        }))
                      }
                      className="accent-emerald-950"
                    />
                  </label>
                  <label className="flex items-center justify-between border border-[#EAE6DF] bg-white rounded p-3 cursor-pointer md:col-span-2">
                    <span className="text-[#1E2522] font-medium">
                      Ensure GitHub repository labels exist
                    </span>
                    <input
                      type="checkbox"
                      checked={workItemAttributes.github.ensureRepositoryLabels}
                      onChange={(e) =>
                        setWorkItemAttributes((prev) => ({
                          ...prev,
                          github: {
                            ...prev.github,
                            ensureRepositoryLabels: e.target.checked,
                          },
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
                        showToast("Work item attribute automation saved.");
                      } catch (err) {
                        showToast(
                          err instanceof Error
                            ? err.message
                            : "Failed to save work item attributes.",
                        );
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
                    No active provider connections yet. Use Connect with OAuth
                    above to authorize GitLab.
                  </div>
                ) : null}

                {/* Dynamic provider registry list */}
                {integrations.length > 0 && (
                  <div className="bg-white border border-[#EAE6DF] rounded-lg p-5 space-y-4">
                    <div className="border-b pb-2">
                      <h4 className="text-xs font-mono font-bold uppercase text-[#1E2522] tracking-wide">
                        Registered Pipeline Registry Connections
                      </h4>
                      <p className="text-[11.5px] text-zinc-500 mt-0.5">
                        Below are all active and inactive gateways registered
                        under this pre-mortem vault configuration.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {integrations.map((int) => {
                        const iconSlug = getIconSlugByName(int.name);
                        const lastSyncLabel = int.lastSync
                          ? new Date(int.lastSync).toLocaleString()
                          : "Never synced";
                        return (
                          <div
                            key={int.id}
                            className="border border-[#EAE6DF]/70 bg-[#FAF8F5]/40 rounded p-3 flex justify-between items-center text-xs gap-3"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <ProviderIcon
                                slug={iconSlug}
                                className="w-4 h-4 shrink-0"
                              />
                              <div className="min-w-0">
                                <span className="font-bold text-neutral-800 tracking-tight truncate block">
                                  {int.name}
                                </span>
                                <span className="text-[9.5px] font-mono text-zinc-500 truncate block">
                                  {int.scope}
                                </span>
                                <span className="text-[9px] font-mono text-zinc-400 truncate block">
                                  {int.vcsOwner} · {lastSyncLabel}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 font-mono text-[9px] shrink-0">
                              <span
                                className={`px-1.5 py-0.5 rounded border uppercase font-bold ${
                                  int.status === "connected"
                                    ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                                    : int.status === "active_check"
                                      ? "bg-amber-50 border-amber-200 text-amber-800"
                                      : "bg-rose-50 border-rose-200 text-rose-800"
                                }`}
                              >
                                {int.status.replace("_", " ")}
                              </span>
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    await syncIntegration(int.id);
                                    showToast(`Synced ${int.name}.`);
                                  } catch (err) {
                                    showToast(
                                      err instanceof Error
                                        ? err.message
                                        : "Sync failed.",
                                    );
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
                    <h3 className="text-sm font-bold text-[#1E2522] font-display">
                      Publish Reconciliation
                    </h3>
                    <p className="text-xs text-[#717A75] mt-1">
                      GitLab Issue webhooks sync closes and edits automatically.
                      While /app is open, Premortem also polls every 5 minutes.
                      Use Run Reconciliation for an immediate sweep.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={reconcileIssues.isPending}
                    onClick={() => {
                      reconcileIssues.mutate(undefined, {
                        onSuccess: (result) => {
                          showToast(
                            `Reconciled ${result.reconciledCount ?? 0} issues (${result.driftedCount ?? 0} drifted).`,
                          );
                        },
                        onError: (err) =>
                          showToast(
                            err instanceof Error
                              ? err.message
                              : "Reconciliation failed.",
                          ),
                      });
                    }}
                    className="px-4 py-2 bg-emerald-950 hover:bg-emerald-900 disabled:opacity-60 text-[#FAF8F5] font-bold text-xs rounded uppercase font-mono tracking-wider"
                  >
                    {reconcileIssues.isPending
                      ? "Reconciling…"
                      : "Run Reconciliation"}
                  </button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {(reconciliationQuery.data?.events ?? []).length === 0 ? (
                    <p className="text-xs text-zinc-500 font-mono">
                      No reconciliation events yet.
                    </p>
                  ) : (
                    reconciliationQuery.data?.events.map((event) => (
                      <div
                        key={event.id}
                        className="flex items-start justify-between gap-3 border border-[#EAE6DF] bg-white rounded p-3 text-xs"
                      >
                        <div>
                          <p className="font-semibold text-[#1E2522]">
                            {event.publishedIssue?.publishedTitle ??
                              "Published issue"}
                          </p>
                          <p className="text-zinc-500 font-mono mt-0.5">
                            {event.status}
                            {event.driftFields?.length
                              ? ` · drift: ${event.driftFields.join(", ")}`
                              : ""}
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
          {activeSubTab === "providers" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
              {/* Left AI Configuration forms */}
              <div className="lg:col-span-2 space-y-6 text-xs">
                <div className="bg-[#FAF8F5] border border-[#EAE6DF] rounded p-6 space-y-6">
                  <div>
                    <h3 className="text-md font-bold text-[#1E2522] font-display mb-1 flex items-center gap-2">
                      <Cpu size={16} />
                      Workspace Model Router
                    </h3>
                    <p className="text-xs text-[#717A75]">
                      Configure the workspace model, vendor routing tiers, and
                      local providers used by Premortem agents to parse data,
                      construct traces, and prepare issue bodies.
                    </p>
                  </div>

                  {/* Workspace model select */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="space-y-1.5">
                      <div className="block font-mono font-bold text-zinc-600 uppercase tracking-wider text-[9.5px]">
                        Workspace Model
                      </div>
                      <ModelSelector
                        id="primary-workspace-model"
                        groups={modelSelectorGroups}
                        selectedKey={selectedModelSelectorKey}
                        triggerLabel="Active route"
                        triggerDescription="Choose a managed model or local provider"
                        triggerHelper={modelSettingsLockMessage}
                        onSelect={(option) => {
                          void handleModelSelection(option);
                        }}
                        disabled={!canManageModelSettings}
                        className="h-full"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label
                        htmlFor="reasoning-temperature"
                        className="block font-mono font-bold text-zinc-600 uppercase tracking-wider text-[9.5px]"
                      >
                        Reasoning Temperature
                      </label>
                      <div className="flex h-[72px] items-center gap-3 rounded border border-[#EAE6DF] bg-white px-3 py-2.5">
                        <input
                          id="reasoning-temperature"
                          type="range"
                          min="0.0"
                          max="1.0"
                          step="0.1"
                          value={temperature}
                          disabled={!canManageModelSettings}
                          onChange={(e) =>
                            setTemperature(parseFloat(e.target.value))
                          }
                          className="w-full accent-emerald-950"
                        />
                        <span className="font-mono font-bold text-zinc-800 w-8 text-right shrink-0">
                          {temperature.toFixed(1)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Slider token depth */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <label
                        htmlFor="max-context-tokens"
                        className="font-mono font-bold text-zinc-605 text-zinc-600 uppercase tracking-wider text-[9px]"
                      >
                        Max Context Token Limit Output
                      </label>
                      <span className="font-mono font-bold text-emerald-900">
                        {maxTokens.toLocaleString()} tokens
                      </span>
                    </div>
                    <input
                      id="max-context-tokens"
                      type="range"
                      min="1000"
                      max="16384"
                      step="500"
                      value={maxTokens}
                      disabled={!canManageModelSettings}
                      onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                      className="w-full accent-emerald-950"
                    />
                    <div className="flex justify-between text-[9px] text-[#8A958F] font-mono leading-none">
                      <span>1,000 (Fastest response)</span>
                      <span>16,384 maximum context length</span>
                    </div>
                  </div>

                  <div className="bg-white border border-[#EAE6DF] rounded p-5 space-y-4">
                    <div className="space-y-1">
                      <h3 className="text-md font-bold text-[#1E2522] font-display">
                        Model Vendor Priority Pool
                      </h3>
                      <p className="text-xs leading-relaxed text-[#717A75]">
                        Audits and synthesis calls try each enabled provider
                        tier in order. The selected managed model and any active
                        local provider remain available for quota relief or
                        provider outages.
                      </p>
                    </div>

                    <ol className="space-y-3">
                      {vendorRouting.map((tier, index) => (
                        <li
                          key={tier.id}
                          className="border border-[#EAE6DF] rounded p-4 bg-[#FAF8F5] flex flex-col gap-4 md:flex-row md:items-start md:justify-between"
                        >
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <span className="shrink-0 w-6 h-6 rounded-full bg-emerald-950 text-white text-[10px] font-mono font-bold flex items-center justify-center">
                              {index + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="text-xs font-bold font-display text-[#1E2522]">
                                {tier.label}
                              </p>
                              <p className="text-[11px] text-[#5C6560] mt-1">
                                {tier.description}
                              </p>
                              {tier.kind === "custom" ? (
                                <select
                                  aria-label={`Select saved provider for ${tier.label}`}
                                  value={tier.providerRef}
                                  disabled={!canManageModelSettings}
                                  onChange={(e) => {
                                    const next = vendorRouting.map((entry) =>
                                      entry.id === tier.id
                                        ? {
                                            ...entry,
                                            providerRef: e.target.value,
                                          }
                                        : entry,
                                    );
                                    setVendorRouting(next);
                                  }}
                                  className="mt-2 w-full max-w-xs p-2 text-[11px] bg-white border border-[#EAE6DF] rounded font-mono"
                                >
                                  <option value="">
                                    Select saved provider
                                  </option>
                                  {customProviders.map((provider) => (
                                    <option
                                      key={provider.name}
                                      value={provider.name}
                                    >
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
                            disabled={!canManageModelSettings}
                            onClick={() => {
                              const next = vendorRouting.map((entry) =>
                                entry.id === tier.id
                                  ? { ...entry, enabled: !entry.enabled }
                                  : entry,
                              );
                              setVendorRouting(next);
                            }}
                            className={`shrink-0 min-w-[96px] px-3 py-1.5 rounded text-[10px] font-mono font-bold uppercase tracking-wide border transition-colors cursor-pointer md:self-start ${
                              tier.enabled
                                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                                : "bg-zinc-100 border-zinc-200 text-zinc-600"
                            }`}
                          >
                            {tier.enabled ? "Enabled" : "Disabled"}
                          </button>
                        </li>
                      ))}
                    </ol>

                    <div className="flex justify-end border-t border-[#EAE6DF]/60 pt-4">
                      <button
                        type="button"
                        disabled={!canManageModelSettings}
                        onClick={async () => {
                          try {
                            await persistLlmSettings(
                              { customProviders, vendorRouting },
                              'Vendor priority pool saved for this workspace.',
                            );
                          } catch (err) {
                            showToast(
                              err instanceof Error
                                ? err.message
                                : "Failed to save vendor pool.",
                            );
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
                      type="button"
                      disabled={!canManageModelSettings}
                      onClick={async () => {
                        try {
                          await persistLlmSettings(
                            {
                              selectedGeminiModel,
                              maxTokens,
                              temperature,
                              customProviders,
                              vendorRouting,
                            },
                            'Model routing settings saved to organization runtime.',
                          );
                        } catch (err) {
                          showToast(
                            err instanceof Error
                              ? err.message
                              : "Failed to save LLM settings.",
                          );
                        }
                      }}
                      className="py-2 px-5 bg-emerald-950 hover:bg-emerald-900 text-white font-bold rounded shadow transition-all cursor-pointer font-mono uppercase tracking-wide text-[10px]"
                    >
                      Save Runtime Routing
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
                      Register OpenAI-compatible local endpoints or private
                      model proxies. Active providers can be selected directly
                      and stay available beside managed models.
                    </p>
                  </div>

                  <form
                    onSubmit={handleAddCustomProvider}
                    className="grid grid-cols-1 md:grid-cols-3 gap-3"
                  >
                    <div className="space-y-1">
                      <label
                        htmlFor="custom-provider-name"
                        className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wide"
                      >
                        PROVIDER DESIGNATION
                      </label>
                      <input
                        id="custom-provider-name"
                        type="text"
                        required
                        placeholder="e.g. Ollama Dev"
                        value={newProvName}
                        disabled={!canManageModelSettings}
                        onChange={(e) => setNewProvName(e.target.value)}
                        className="w-full p-2 bg-white border border-[#EAE6DF] rounded font-medium focus:ring-1 focus:ring-emerald-950 focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label
                        htmlFor="custom-provider-base-url"
                        className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wide"
                      >
                        BASE URL
                      </label>
                      <input
                        id="custom-provider-base-url"
                        type="url"
                        required
                        placeholder="http://127.0.0.1:11434"
                        value={newProvHost}
                        disabled={!canManageModelSettings}
                        onChange={(e) => setNewProvHost(e.target.value)}
                        className="w-full p-2 bg-white border border-[#EAE6DF] rounded font-medium focus:ring-1 focus:ring-emerald-950 focus:outline-none font-mono"
                      />
                    </div>
                    <div className="space-y-2 relative flex items-end">
                      <div className="space-y-1 flex-1">
                        <label
                          htmlFor="custom-provider-model"
                          className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wide"
                        >
                          MODEL
                        </label>
                        <input
                          id="custom-provider-model"
                          type="text"
                          placeholder="llama3:latest"
                          value={newProvModel}
                          disabled={!canManageModelSettings}
                          onChange={(e) => setNewProvModel(e.target.value)}
                          className="w-full p-2 bg-white border border-[#EAE6DF] rounded font-medium focus:ring-1 focus:ring-emerald-950 focus:outline-none font-mono"
                        />
                      </div>
                      <button
                        type="submit"
                        aria-label="Add local provider"
                        disabled={!canManageModelSettings}
                        className="p-2.5 shrink-0 bg-emerald-950 hover:bg-emerald-900 border border-emerald-950 text-[#FAF8F5] rounded ml-1 transition-all flex items-center justify-center cursor-pointer"
                        title="Add local provider"
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
                        <div
                          key={`${prov.name}-${prov.host}-${prov.model}`}
                          className="border border-[#EAE6DF] bg-white rounded p-3 flex justify-between items-center text-[11px]"
                        >
                          <div className="flex items-center gap-2">
                            <span className="relative flex h-2 w-2">
                              {prov.active && (
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              )}
                              <span
                                className={`relative inline-flex rounded-full h-2 w-2 ${prov.active ? "bg-emerald-505 bg-emerald-500" : "bg-zinc-400"}`}
                              ></span>
                            </span>
                            <div className="font-mono">
                              <span className="font-bold text-neutral-805 text-neutral-900 mr-2">
                                {prov.name}
                              </span>
                              <span className="text-[#717A75] text-[10.5px] uppercase">
                                {prov.host} • model: {prov.model}
                              </span>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled={!canManageModelSettings}
                              onClick={async () => {
                                const updated = [...customProviders];
                                updated[pIdx].active = !updated[pIdx].active;
                                const nextActiveProvider = updated.find((provider) => provider.active);
                                const nextVendorRouting = nextActiveProvider
                                  ? buildLocalRoutingFromState(vendorRouting, nextActiveProvider.name)
                                  : buildManagedRoutingFromState(vendorRouting, '');
                                try {
                                  await persistLlmSettings(
                                    {
                                      selectedGeminiModel,
                                      maxTokens,
                                      temperature,
                                      customProviders: updated,
                                      vendorRouting: nextVendorRouting,
                                    },
                                    updated[pIdx].active
                                      ? `Custom LLM provider re-connected and is available as a local route.`
                                      : `Custom LLM provider disconnected. Managed cloud route is now active.`,
                                  );
                                  setCustomProviders(updated);
                                  setVendorRouting(nextVendorRouting);
                              } catch (err) {
                                  showToast(
                                    err instanceof Error
                                      ? err.message
                                      : "Failed to update provider status.",
                                  );
                                }
                              }}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                prov.active
                                  ? "bg-emerald-50 text-emerald-800"
                                  : "bg-zinc-100 text-zinc-600"
                              }`}
                            >
                              {prov.active ? "DISCONNECT" : "RE-PING"}
                            </button>
                            <OsIconButton
                              label="Delete model entry"
                              disabled={!canManageModelSettings}
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
                    Registered custom LLM Providers run directly within client
                    VPC environments. Premortem agent engines do not cache nor
                    transit private parameters outside restricted scopes.
                  </p>

                  <div className="flex gap-2 rounded border border-zinc-200 bg-zinc-100 p-3 font-sans text-[#5C6560]">
                    <Info
                      className="text-neutral-700 shrink-0 mt-0.5"
                      size={14}
                    />
                    <p className="text-[10.5px]">
                      Ensure local endpoints set appropriate CORS parameters (
                      <code className="font-mono bg-zinc-200 px-1 font-semibold rounded text-zinc-800 text-[10px]">
                        Access-Control-Allow-Origin
                      </code>
                      ) to connect to the platform.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ==================== TAB 2.5: SKILLS MARKETPLACE ==================== */}
          {activeSubTab === "skills" && (
            <SkillsTab
              skills={workspace.skills}
              canManageOrganization={canManageOrganization}
              onInstallSkill={async (skillId) => {
                await installSkill.mutateAsync(skillId);
                showToast("Installed skill draft and refreshed the workspace skill catalog.");
              }}
            />
          )}

          {/* ==================== TAB 3: BILLING ==================== */}
          {activeSubTab === "billing" && (
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
                        Subscription tier: <span className="font-semibold">{tierDisplayLabel}</span>
                        {workspace.billing.billingStatus ? ` (${workspace.billing.billingStatus})` : ''}. Workspace role:
                        {' '}
                        <span className="font-semibold">{roleDisplayLabel}</span>.
                      </p>
                    </div>
                  </div>

                  {/* Switch cycles buttons */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex gap-2 p-1 bg-[#FAF8F5] border border-[#EAE6DF] rounded w-60 text-xs">
                      <button
                        type="button"
                        onClick={() => setBillingCycle("monthly")}
                        className={`flex-1 py-1.5 rounded font-semibold text-center cursor-pointer transition-all ${
                          billingCycle === "monthly"
                            ? "bg-white shadow border border-[#EAE6DF] text-zinc-900 font-bold"
                            : "text-[#5C6560]"
                        }`}
                      >
                        Monthly Sync
                      </button>
                      <button
                        type="button"
                        onClick={() => setBillingCycle("yearly")}
                        className={`flex-1 py-1.5 rounded font-semibold text-center cursor-pointer transition-all ${
                          billingCycle === "yearly"
                            ? "bg-white shadow border border-[#EAE6DF] text-zinc-900 font-bold"
                            : "text-[#5C6560]"
                        }`}
                      >
                        Yearly (Save 20%)
                      </button>
                    </div>

                    <span className="p-1 px-2.5 bg-emerald-950 text-[#FAF8F5] rounded font-mono font-bold text-[9px] uppercase tracking-wider shadow-sm select-none capitalize">
                      {tierDisplayLabel} tier
                    </span>
                  </div>

                  {/* Pricing models list */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Tier A: Free */}
                    <div
                      className={`p-4 rounded border flex flex-col justify-between space-y-3 bg-white ${
                        activeTier === "free"
                          ? "border-emerald-950 bg-emerald-50/10"
                          : "border-[#EAE6DF]"
                      }`}
                    >
                      <div className="space-y-1">
                        <span className="font-bold text-[#1E2522] block font-display">
                          Evaluation
                        </span>
                        <span className="text-zinc-600 block font-mono text-[11px]">
                          Free Tier
                        </span>
                        <div className="text-lg font-bold text-neutral-900 pt-2 font-display">
                          $0/mo
                        </div>
                        <p className="text-[10px] leading-relaxed text-[#717A75] font-mono">
                          1 repo, 10 audits, 3 publishes / month, 30-day history.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await patchBillingPlan("free");
                            showToast("Plan updated to Free tier.");
                          } catch (err) {
                            showToast(
                              err instanceof Error
                                ? err.message
                                : "Failed to update plan.",
                            );
                          }
                        }}
                        className="w-full py-1.5 border border-zinc-300 rounded font-bold uppercase tracking-wide tracking-wider text-[9px] font-mono hover:bg-zinc-50 cursor-pointer text-zinc-700"
                      >
                        {activeTier === "free"
                          ? "Currently Selected"
                          : "Downgrade"}
                      </button>
                    </div>

                    {/* Tier B: Starter */}
                    <div
                      className={`p-4 rounded border flex flex-col justify-between space-y-3 bg-white ${
                        activeTier === "pro"
                          ? "border-emerald-950 bg-emerald-50/10"
                          : "border-[#EAE6DF]"
                      }`}
                    >
                      <div className="space-y-1">
                        <span className="font-bold text-[#1E2522] block font-display">
                          Starter
                        </span>
                        <span className="text-zinc-600 block font-mono text-[11px]">
                          Unlimited publish
                        </span>
                        <div className="text-lg font-bold text-neutral-900 pt-2 font-display">
                          {billingCycle === "monthly" ? "$49/mo" : "$39/mo"}
                        </div>
                        <p className="text-[10px] leading-relaxed text-[#717A75] font-mono">
                          10 repos, 100 audits, SARIF export, 90-day history.
                        </p>
                        {billingCycle === "yearly" ? (
                          <span className="text-[10px] text-[#717A75] font-mono">
                            $468 billed yearly
                          </span>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await startCheckout("pro", billingCycle);
                          } catch (err) {
                            showToast(
                              err instanceof Error
                                ? err.message
                                : "Failed to update plan.",
                            );
                          }
                        }}
                        className="w-full py-1.5 border border-zinc-300 rounded font-bold uppercase tracking-wide tracking-wider text-[9px] font-mono hover:bg-zinc-50 cursor-pointer text-zinc-700"
                      >
                        {activeTier === "pro"
                          ? "Currently Selected"
                          : "Select Pro"}
                      </button>
                    </div>

                    {/* Tier C: Growth */}
                    <div
                      className={`p-4 rounded border-2 flex flex-col justify-between space-y-3 bg-white ${
                        activeTier === "enterprise" || activeTier === "team"
                          ? "border-emerald-950 bg-emerald-50/10 shadow-sm"
                          : "border-[#EAE6DF]"
                      }`}
                    >
                      <div className="space-y-1">
                        <span className="font-bold text-[#1E2522] block font-display">
                          Growth
                        </span>
                        <span className="text-emerald-800 block font-mono text-[11px] font-bold">
                          Graphiti memory
                        </span>
                        <div className="text-lg font-bold text-neutral-900 pt-2 font-display">
                          {billingCycle === "monthly" ? "$149/mo" : "$119/mo"}
                        </div>
                        <p className="text-[10px] leading-relaxed text-[#717A75] font-mono">
                          30 repos, 300 audits, webhooks, memory, 1-year history.
                        </p>
                        {billingCycle === "yearly" ? (
                          <span className="text-[10px] text-[#717A75] font-mono">
                            $1,428 billed yearly
                          </span>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await startCheckout("team", billingCycle);
                          } catch (err) {
                            showToast(
                              err instanceof Error
                                ? err.message
                                : "Failed to update plan.",
                            );
                          }
                        }}
                        className="w-full py-1.5 bg-emerald-950 text-[#FAF8F5] rounded font-bold uppercase tracking-wide tracking-wider text-[9px] font-mono hover:opacity-90 cursor-pointer"
                      >
                        {activeTier === "enterprise" || activeTier === "team"
                          ? "Current Active Tier"
                          : "Upgrade"}
                      </button>
                    </div>

                    {/* Tier D: Scale */}
                    <div
                      className={`p-4 rounded border-2 flex flex-col justify-between space-y-3 bg-white ${
                        activeTier === "scale"
                          ? "border-emerald-950 bg-emerald-50/10 shadow-sm"
                          : "border-[#EAE6DF]"
                      }`}
                    >
                      <div className="space-y-1">
                        <span className="font-bold text-[#1E2522] block font-display">
                          Scale
                        </span>
                        <span className="text-emerald-800 block font-mono text-[11px] font-bold">
                          Priority support
                        </span>
                        <div className="text-lg font-bold text-neutral-900 pt-2 font-display">
                          {billingCycle === "monthly" ? "$299/mo" : "$239/mo"}
                        </div>
                        <p className="text-[10px] leading-relaxed text-[#717A75] font-mono">
                          100 repos, 1,000 audits, priority support, skill marketplace.
                        </p>
                        {billingCycle === "yearly" ? (
                          <span className="text-[10px] text-[#717A75] font-mono">
                            $2,868 billed yearly
                          </span>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await startCheckout("scale", billingCycle);
                          } catch (err) {
                            showToast(
                              err instanceof Error
                                ? err.message
                                : "Failed to update plan.",
                            );
                          }
                        }}
                        className="w-full py-1.5 bg-emerald-950 text-[#FAF8F5] rounded font-bold uppercase tracking-wide tracking-wider text-[9px] font-mono hover:opacity-90 cursor-pointer"
                      >
                        {activeTier === "scale"
                          ? "Current Active Tier"
                          : "Upgrade to Scale"}
                      </button>
                    </div>
                  </div>
                </div>

                  <div className="rounded border border-[#EAE6DF] bg-white p-4 space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <h4 className="text-sm font-bold text-[#1E2522] font-display">
                          Subscription cancellation
                        </h4>
                        <p className="text-[11px] text-[#717A75] leading-relaxed">
                          {isFreeTier
                            ? "No paid subscription is attached to this workspace."
                            : isSubscriptionCanceling && billingCancellationDate
                              ? `Cancellation is already scheduled for ${billingCancellationDate.toLocaleString()}.`
                              : "Choose when the paid subscription should end. Scheduled cancellation keeps access active until the current period closes."}
                        </p>
                      </div>
                      {isSubscriptionCanceling ? (
                        <span className="rounded bg-amber-50 border border-amber-200 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-amber-900">
                          Canceling
                        </span>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={isFreeTier || cancelSubscription.isPending}
                        onClick={async () => {
                          try {
                            const result = await cancelSubscription.mutateAsync({
                              mode: "period_end",
                              reason: "Requested from billing settings"
                            });
                            showToast(
                              result.currentPeriodEnd
                                ? `Subscription scheduled to cancel on ${new Date(result.currentPeriodEnd).toLocaleDateString()}.`
                                : "Subscription scheduled to cancel at period end.",
                            );
                          } catch (err) {
                            showToast(
                              err instanceof Error
                                ? err.message
                                : "Failed to schedule subscription cancellation.",
                            );
                          }
                        }}
                        className="px-3 py-2 rounded border border-zinc-300 bg-white text-[10px] font-mono font-bold uppercase tracking-wide text-[#1E2522] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-50"
                      >
                        Cancel at period end
                      </button>

                      <button
                        type="button"
                        disabled={isFreeTier || cancelSubscription.isPending}
                        onClick={async () => {
                          const confirmCancel = window.confirm(
                            "Cancel now and refund the unused portion of the latest paid invoice?",
                          );
                          if (!confirmCancel) return;

                          try {
                            const result = await cancelSubscription.mutateAsync({
                              mode: "immediate",
                              refund: true,
                              reason: "Requested from billing settings"
                            });
                            showToast(
                              result.refundStatus === "refunded" && typeof result.refundedAmount === "number"
                                ? `Subscription canceled and refunded ${(result.refundedAmount / 100).toFixed(2)}.`
                                : result.refundStatus === "failed"
                                  ? "Subscription canceled, but the refund needs manual review."
                                  : "Subscription canceled and moved to Free tier.",
                            );
                          } catch (err) {
                            showToast(
                              err instanceof Error
                                ? err.message
                                : "Failed to cancel subscription.",
                            );
                          }
                        }}
                        className="px-3 py-2 rounded border border-red-300 bg-red-50 text-[10px] font-mono font-bold uppercase tracking-wide text-red-800 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-red-100"
                      >
                        Cancel now, refund unused time
                      </button>
                    </div>
                  </div>

                {/* Billing History Invoice list */}
                <div className="bg-[#FAF8F5] border border-[#EAE6DF] rounded p-6 space-y-4">
                  <div className="flex justify-between items-center pb-2 border-b border-[#EAE6DF]/60">
                    <h3 className="text-sm font-bold text-[#1E2522] font-mono uppercase">
                      Invoices Ledger History
                    </h3>
                    <span className="text-[10px] text-[#717A75] font-mono">
                      STRIPE LEDGER · {invoices.length} RECENT INVOICE{invoices.length === 1 ? '' : 'S'}
                    </span>
                  </div>

                  <div className="divide-y divide-[#EAE6DF]/60">
                    {invoices.length === 0 ? (
                      <div className="py-3 space-y-2">
                        <p className="text-xs text-zinc-600">
                          No Stripe invoices have synced for this customer yet. The ledger below is sourced from the live Stripe customer once a checkout, renewal, or invoice event exists.
                        </p>
                        <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-[#8A958F]">
                          Source: Stripe invoice API
                        </p>
                      </div>
                    ) : (
                      (invoices as StripeInvoiceSummary[]).map((inv) => (
                        <div
                          key={inv.id}
                          className="py-3 flex justify-between items-center text-xs"
                        >
                          <div className="space-y-0.5">
                            <span className="font-bold text-neutral-900 font-mono tracking-wider">
                              {inv.id}
                            </span>
                            <div className="text-zinc-500 font-sans text-[11px]">
                              {inv.date} • {inv.method}
                            </div>
                          </div>

                          <div className="flex items-center gap-4">
                            <span className="font-bold text-neutral-900 font-display">
                              ${(inv.amount ?? 0).toFixed(2)}
                            </span>
                            <span className="px-1.5 py-0.2 bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold rounded font-mono text-[9px] text-center uppercase tracking-wide">
                              {inv.status}
                            </span>
                            {inv.hostedInvoiceUrl ? (
                              <a
                                href={inv.hostedInvoiceUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[10px] font-mono text-emerald-900 underline"
                              >
                                Open invoice
                              </a>
                            ) : inv.invoicePdfUrl ? (
                              <a
                                href={inv.invoicePdfUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[10px] font-mono text-emerald-900 underline"
                              >
                                Open PDF
                              </a>
                            ) : null}
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
                      Resource limits allocation registered under the active
                      Swarm billing cycle. Logs reset monthly.
                    </p>
                  </div>

                  <div className="grid gap-3 rounded border border-[#EAE6DF] bg-white p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-[#8A958F]">
                        Current publish allowance
                      </span>
                      <span className="text-[11px] font-semibold text-[#1E2522]">
                        {publishAllowanceLabel}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-[#8A958F]">
                        Remaining this month
                      </span>
                      <span className="text-[11px] font-semibold text-[#1E2522]">
                        {publishRemainingLabel}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-[#8A958F]">
                        Retention status
                      </span>
                      <span className="text-[11px] font-semibold text-[#1E2522]">
                        {retentionLabel}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-[#8A958F]">
                        Support level
                      </span>
                      <span className="text-[11px] font-semibold text-[#1E2522]">
                        {supportLabel}
                      </span>
                    </div>
                  </div>

                  {/* Meter Scans */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between font-mono text-[10px]">
                      <span className="font-bold text-neutral-800">
                        Swarm Auditor Scans
                      </span>
                      <span className="font-bold text-zinc-900">
                        {usageStats.scans.used} / {usageStats.scans.limit} Runs
                      </span>
                    </div>
                    <div className="w-full bg-zinc-200 h-2.5 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-950 h-full"
                        style={{
                          width: `${(usageStats.scans.used / usageStats.scans.limit) * 100}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Meter Tokens */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between font-mono text-[10px]">
                      <span className="font-bold text-neutral-800">
                        Token Depth Dispatches
                      </span>
                      <span className="font-bold text-zinc-900">
                        {usageStats.tokens.used}M / {usageStats.tokens.limit}M
                        Tokens
                      </span>
                    </div>
                    <div className="w-full bg-zinc-200 h-2.5 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-800 h-full"
                        style={{
                          width: `${(usageStats.tokens.used / usageStats.tokens.limit) * 100}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Meter Patches proposed */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between font-mono text-[10px]">
                      <span className="font-bold text-neutral-800">
                        AI Suggested Patches
                      </span>
                      <span className="font-bold text-zinc-900">
                        {usageStats.patches.used} / {usageStats.patches.limit}{" "}
                        Modules
                      </span>
                    </div>
                    <div className="w-full bg-zinc-200 h-2.5 rounded-full overflow-hidden">
                      <div
                        className="bg-[#B91C1C] h-full"
                        style={{
                          width: `${(usageStats.patches.used / usageStats.patches.limit) * 100}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="p-3 bg-white border border-[#EAE6DF] rounded text-[#717A75] select-text">
                    <span className="font-bold text-neutral-800 uppercase font-mono text-[9px] block mb-1">
                      Billing Support
                    </span>
                    <p className="text-[10.5px]">
                      Need a customized seat limit or private dedicated cloud
                      hosting? Contact us at{" "}
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

                <div className="rounded border border-[#EAE6DF] bg-white p-4 space-y-3">
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-[#1E2522] font-display">
                      Billing portal
                    </h4>
                    <p className="text-[11px] text-[#717A75] leading-relaxed">
                      Open the customer billing portal to manage invoices, payment method, and subscription changes.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await startBillingPortal();
                      } catch (err) {
                        showToast(
                          err instanceof Error
                            ? err.message
                            : "Failed to open billing portal.",
                        );
                      }
                    }}
                    className="w-full px-3 py-2 rounded border border-[#EAE6DF] bg-[#FAF8F5] hover:bg-zinc-50 text-[10px] font-mono font-bold uppercase tracking-wide text-[#1E2522]"
                  >
                    Open Billing Portal
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ==================== TAB 4: WEBHOOKS & NOTIFICATIONS ==================== */}
          {activeSubTab === "notifications" && (
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
                      Propagate live threat detections details to security
                      dispatch platforms, slack channels systems, or operational
                      email lists.
                    </p>
                  </div>

                  <div className="border border-[#EAE6DF] bg-white rounded p-4.5 space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h4 className="font-bold text-neutral-900 font-display uppercase tracking-wide">
                          Notification inbox
                        </h4>
                        <p className="text-[11px] text-[#717A75]">
                          Workspace notifications are persisted and can be
                          marked read from the console.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void reloadNotifications()}
                        className="py-1.5 px-3 border border-[#EAE6DF] bg-[#FAF8F5] text-zinc-800 text-xs font-semibold rounded hover:bg-[#FAF8F5]/80 transition-all cursor-pointer"
                      >
                        Refresh
                      </button>
                    </div>

                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                      {notificationInboxLoading ? (
                        <p className="text-xs text-[#717A75] italic">
                          Loading notifications...
                        </p>
                      ) : notificationInbox.length === 0 ? (
                        <p className="text-xs text-[#717A75] italic">
                          No notifications yet.
                        </p>
                      ) : (
                        notificationInbox.map((notification) => (
                          <div
                            key={notification.id}
                            className={`border rounded p-3 space-y-2 ${
                              notification.readAt
                                ? "bg-white border-[#EAE6DF]"
                                : "bg-emerald-50/40 border-emerald-200"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-[9px] font-mono font-bold uppercase tracking-wide text-zinc-500">
                                    {notification.kind.replace(/_/g, " ")}
                                  </span>
                                  {!notification.readAt ? (
                                    <span className="text-[9px] font-mono font-bold uppercase tracking-wide text-emerald-700">
                                      New
                                    </span>
                                  ) : null}
                                </div>
                                <p className="font-bold text-[#1E2522]">
                                  {notification.title}
                                </p>
                                {notification.body ? (
                                  <p className="text-[11px] text-[#717A75] leading-relaxed">
                                    {notification.body}
                                  </p>
                                ) : null}
                              </div>
                              {!notification.readAt ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    void markNotificationsRead([
                                      notification.id,
                                    ])
                                  }
                                  className="py-1 px-2 border border-emerald-200 bg-emerald-50 text-emerald-800 text-[10px] font-bold uppercase tracking-wide rounded cursor-pointer"
                                >
                                  Mark read
                                </button>
                              ) : null}
                            </div>
                            <div className="flex items-center justify-between gap-3 text-[10px] font-mono text-[#8A958F]">
                              <span>
                                {new Date(
                                  notification.createdAt,
                                ).toLocaleString()}
                              </span>
                              {notification.url ? (
                                <a
                                  href={notification.url}
                                  className="text-emerald-900 underline font-bold"
                                >
                                  Open link
                                </a>
                              ) : null}
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() =>
                          void markNotificationsRead(
                            notificationInbox.reduce<string[]>((ids, notification) => {
                              if (!notification.readAt) ids.push(notification.id);
                              return ids;
                            }, [])
                          )
                        }
                        disabled={notificationInbox.every(
                          (notification) => notification.readAt,
                        )}
                        className="py-1.5 px-3 border border-[#EAE6DF] bg-[#FAF8F5] text-zinc-800 text-xs font-semibold rounded hover:bg-[#FAF8F5]/80 transition-all cursor-pointer disabled:cursor-not-allowed disabled:text-zinc-400"
                      >
                        Mark all read
                      </button>
                    </div>
                  </div>

                  {/* Slack integration details card */}
                  <div className="border border-[#EAE6DF] bg-white rounded p-4.5 space-y-4">
                    <div className="flex justify-between items-center pb-2 border-b">
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] font-bold text-[#1E2522]">
                          Slack App Dispatch Gateway
                        </span>
                        <span
                          className={`w-2 h-2 rounded-full ${slackNangoConnected && isSlackConnected ? "bg-emerald-500" : isSlackConnected ? "bg-amber-500" : "bg-red-500"}`}
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const session = await createSlackConnectSession();
                              if (session.connectLink) {
                                window.open(session.connectLink, '_blank', 'noopener,noreferrer');
                              }
                              showToast(
                                'Complete Slack authorization in the Nango tab, then sync the connection.'
                              );
                            } catch (err) {
                              showToast(
                                err instanceof Error
                                  ? err.message
                                  : 'Failed to create Slack connect session.'
                              );
                            }
                          }}
                          className="px-2 py-0.5 border rounded uppercase font-bold text-[9px] font-mono cursor-pointer bg-slate-50 text-slate-800"
                        >
                          {slackNangoConnected ? 'Reconnect via Nango' : 'Connect via Nango'}
                        </button>

                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await syncSlackConnection();
                              showToast('Slack Nango connection synced.');
                            } catch (err) {
                              showToast(
                                err instanceof Error
                                  ? err.message
                                  : 'Failed to sync Slack connection.'
                              );
                            }
                          }}
                          className="px-2 py-0.5 border rounded uppercase font-bold text-[9px] font-mono cursor-pointer bg-emerald-50 text-emerald-800"
                        >
                          Sync Nango
                        </button>

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
                                alertSeverity,
                              });
                              showToast(
                                `Slack notifications ${next ? "enabled" : "disabled"}.`,
                              );
                            } catch (err) {
                              setIsSlackConnected(!next);
                              showToast(
                                err instanceof Error
                                  ? err.message
                                  : "Failed to update Slack status.",
                              );
                            }
                          }}
                          className={`px-2 py-0.5 border rounded uppercase font-bold text-[9px] font-mono cursor-pointer ${
                            isSlackConnected
                              ? "bg-emerald-50 text-emerald-800"
                              : "bg-rose-50 text-rose-800"
                          }`}
                        >
                          {isSlackConnected ? "ACTIVE" : "MUTED"}
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono text-zinc-600">
                      <span>
                        Nango: {slackNangoConnected ? 'linked' : 'not linked'}
                      </span>
                      {slackConnectionId ? (
                        <span className="px-2 py-0.5 rounded bg-[#FAF8F5] border border-[#EAE6DF]">
                          {slackProviderKey || 'slack'} • {slackConnectionId.slice(0, 8)}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-[#FAF8F5] border border-[#EAE6DF]">
                          Slack sandbox: sandbox-premortem.enterprise.slack.com
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label
                          htmlFor="slack-webhook-endpoint"
                          className="text-[9px] font-mono font-bold text-zinc-500 block"
                        >
                          WEBHOOK ENDPOINT URL
                        </label>
                        <input
                          id="slack-webhook-endpoint"
                          type="text"
                          value={slackWebhook}
                          onChange={(e) => setSlackWebhook(e.target.value)}
                          placeholder="https://hooks.slack.com/services/..."
                          aria-label="Webhook endpoint URL"
                          className="w-full p-2 bg-white border border-[#EAE6DF] rounded font-mono text-[10.5px] text-zinc-700 focus:outline-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <label
                          htmlFor="slack-channel"
                          className="text-[9px] font-mono font-bold text-zinc-500 block"
                        >
                          TARGET NOTIFICATION KERNEL CHANNEL
                        </label>
                        <input
                          id="slack-channel"
                          type="text"
                          value={slackChannel}
                          onChange={(e) => setSlackChannel(e.target.value)}
                          placeholder="#security-alerts"
                          aria-label="Target notification channel"
                          className="w-full p-2 bg-white border border-[#EAE6DF] rounded font-mono text-[10.5px] text-zinc-700 font-semibold focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await patchNotifications({
                              slackWebhook,
                              slackChannel,
                              isSlackConnected,
                              alertEmails,
                              alertSeverity,
                            });
                            showToast("Slack notification settings saved.");
                          } catch (err) {
                            showToast(
                              err instanceof Error
                                ? err.message
                                : "Failed to save notifications.",
                            );
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
                        <label
                          htmlFor="alert-emails"
                          className="text-[9px] font-mono font-bold text-zinc-500 block"
                        >
                          RECIPIENTS LIST (COMMA DELIMITED)
                        </label>
                        <input
                          id="alert-emails"
                          type="email"
                          value={alertEmails}
                          onChange={(e) => setAlertEmails(e.target.value)}
                          placeholder="alerts@example.com, secops@example.com"
                          aria-label="Alert email recipients"
                          className="w-full p-2 bg-white border border-[#EAE6DF] rounded font-mono text-[10.5px] text-zinc-700 focus:outline-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <label
                          htmlFor="alert-severity"
                          className="text-[9px] font-mono font-bold text-zinc-500 block"
                        >
                          SEVERITY REACTION THRESHOLD
                        </label>
                        <select
                          id="alert-severity"
                          value={alertSeverity}
                          onChange={(e) => {
                            setAlertSeverity(e.target.value);
                            showToast(
                              `Min alert severity set to ${e.target.value}`,
                            );
                          }}
                          aria-label="Alert severity threshold"
                          className="w-full p-2 bg-white border border-[#EAE6DF] rounded font-mono text-[10.5px] text-zinc-700 focus:outline-none"
                        >
                          <option value="CRITICAL">CRITICAL ONLY</option>
                          <option value="HIGH">
                            HIGH AND CRITICAL (RECOMMENDED)
                          </option>
                          <option value="MEDIUM">MEDIUM AND ABOVE</option>
                          <option value="ALL">ALL DETECTED FINDINGS</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await patchNotifications({
                              alertEmails,
                              alertSeverity,
                              isSlackConnected,
                              slackWebhook,
                              slackChannel,
                            });
                            showToast("Alert email thresholds saved.");
                          } catch (err) {
                            showToast(
                              err instanceof Error
                                ? err.message
                                : "Failed to save alert settings.",
                            );
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
                    All webhook alert payloads dispatched are cryptographically
                    signed with your organization shared secret to permit
                    incoming verification checks on client firewalls.
                  </p>

                  <div className="space-y-2 border border-[#EAE6DF] bg-white p-3 rounded font-mono text-[9px] select-text">
                    <div className="text-zinc-400 font-bold uppercase block pb-1">
                      WORKSPACE SHA-256 SIGNATURE KEY:
                    </div>
                    <div
                      className="text-zinc-850 break-all cursor-pointer font-bold text-slate-805"
                      title="Double click to copy raw signature key"
                    >
                      pm_sec_sig_72fa8d390a14bce09f6e5229efbc1721b0dc3a
                    </div>
                  </div>

                  <div className="p-3 bg-zinc-100 border border-zinc-200 text-[#717A75] rounded flex gap-2 font-sans">
                    <Info
                      className="text-neutral-700 shrink-0 mt-0.5"
                      size={14}
                    />
                    <p className="text-[10.5px]">
                      Webhooks are throttled to maximum 5 dispatches per project
                      scanner loop to bypass messaging threshold limits.
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
