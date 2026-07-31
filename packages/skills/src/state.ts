import type { SkillCoverageReport } from './coverage';
import type { GeneratedSkillDraft } from './generator';

export interface WorkspaceSkillState {
  generatedAt: string | null;
  auditRunId: string | null;
  registryVersion: number;
  coverageReport: SkillCoverageReport | null;
  drafts: GeneratedSkillDraft[];
  installedSkillIds: string[];
}

export function createEmptyWorkspaceSkillState(): WorkspaceSkillState {
  return {
    generatedAt: null,
    auditRunId: null,
    registryVersion: 0,
    coverageReport: null,
    drafts: [],
    installedSkillIds: []
  };
}

function normalizeDraft(value: unknown): GeneratedSkillDraft | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const id = typeof row.id === 'string' ? row.id : '';
  const category = typeof row.category === 'string' ? row.category : '';
  const title = typeof row.title === 'string' ? row.title : '';
  const summary = typeof row.summary === 'string' ? row.summary : '';
  const ownerAgentName = typeof row.ownerAgentName === 'string' ? row.ownerAgentName : '';
  const ownerAgentDescription =
    typeof row.ownerAgentDescription === 'string' ? row.ownerAgentDescription : '';
  const generatedAt = typeof row.generatedAt === 'string' ? row.generatedAt : '';
  const auditRunId = typeof row.auditRunId === 'string' ? row.auditRunId : '';
  const markdown = typeof row.markdown === 'string' ? row.markdown : '';
  const registryEntry = typeof row.registryEntry === 'string' ? row.registryEntry : '';

  if (!id || !category || !title || !summary || !ownerAgentName || !ownerAgentDescription || !generatedAt || !auditRunId || !markdown || !registryEntry) {
    return null;
  }

  return {
    id,
    category,
    title,
    summary,
    ownerAgentName,
    ownerAgentDescription,
    generatedAt,
    auditRunId,
    installed: row.installed === true,
    markdown,
    registryEntry,
    storageRef: typeof row.storageRef === 'string' ? row.storageRef : null
  };
}

export function readWorkspaceSkillState(metadata: unknown): WorkspaceSkillState {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return createEmptyWorkspaceSkillState();
  }

  const skills = (metadata as Record<string, unknown>).skills;
  if (!skills || typeof skills !== 'object' || Array.isArray(skills)) {
    return createEmptyWorkspaceSkillState();
  }

  const row = skills as Record<string, unknown>;
  const drafts = Array.isArray(row.drafts) ? row.drafts.map(normalizeDraft).filter((draft): draft is GeneratedSkillDraft => Boolean(draft)) : [];
  return {
    generatedAt: typeof row.generatedAt === 'string' ? row.generatedAt : null,
    auditRunId: typeof row.auditRunId === 'string' ? row.auditRunId : null,
    registryVersion: typeof row.registryVersion === 'number' ? row.registryVersion : 0,
  coverageReport:
      row.coverageReport && typeof row.coverageReport === 'object' && !Array.isArray(row.coverageReport)
        ? (row.coverageReport as SkillCoverageReport)
        : null,
    drafts,
    installedSkillIds: Array.isArray(row.installedSkillIds)
      ? row.installedSkillIds.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
      : []
  };
}

export function writeWorkspaceSkillState(state: WorkspaceSkillState) {
  return {
    generatedAt: state.generatedAt,
    auditRunId: state.auditRunId,
    registryVersion: state.registryVersion,
    coverageReport: state.coverageReport,
    drafts: state.drafts,
    installedSkillIds: Array.from(new Set(state.installedSkillIds.filter((entry) => entry.length > 0)))
  };
}

export function installWorkspaceSkill(state: WorkspaceSkillState, skillId: string): WorkspaceSkillState {
  const nextInstalled = Array.from(new Set([...state.installedSkillIds, skillId]));
  return {
    ...state,
    installedSkillIds: nextInstalled,
    drafts: state.drafts.map((draft) =>
      draft.id === skillId ? { ...draft, installed: true } : draft
    )
  };
}
