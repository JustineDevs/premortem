import { marketingLinks } from '@/lib/marketing-links';

export const premortemSteps = [
  {
    id: 'connect',
    title: '[1] Connect GitLab',
    lines: ['Authorize and select', 'a project.']
  },
  {
    id: 'run',
    title: '[2] Run Premortem',
    lines: ['Multi-lens audit across', 'code, CI, and configs.']
  },
  {
    id: 'review',
    title: '[3] Review Issues',
    lines: ['Approve structured', 'findings before sync.']
  }
] as const;

export const premortemFeatures = [
  '[ Multi lens analysis ]',
  '[ Structured issues ]',
  '[ Graph, context, Audit history ]'
] as const;

export type ScopeStatus = 'included' | 'scaffold' | 'soon';

export const ecosystemCards = [
  {
    id: 'google-cloud',
    name: 'Google Cloud',
    logo: 'googleCloud' as const,
    logoWidth: 137,
    logoHeight: 23,
    body: 'Gemini models and optional agent-builder mission hooks; audits execute in @premortem/orchestrator.',
    href: 'https://ai.google.dev/',
    linkLabel: 'Learn more'
  },
  {
    id: 'gemini',
    name: 'Gemini',
    logo: 'geminiWordmark' as const,
    logoWidth: 95,
    logoHeight: 23,
    icon: 'geminiIcon' as const,
    body: 'LLM powering risk analysis, issue synthesis, and structured output generation.',
    href: 'https://ai.google.dev/gemini-api/docs',
    linkLabel: 'Learn more'
  },
  {
    id: 'gitlab',
    name: 'GitLab',
    logo: 'gitlab' as const,
    logoWidth: 104,
    logoHeight: 23,
    body: 'Repository context, CI pipeline data, and structured issue creation via MCP and API.',
    href: 'https://docs.gitlab.com/user/gitlab_duo/model_context_protocol/',
    linkLabel: 'Learn more'
  },
  {
    id: 'github',
    name: 'GitHub',
    logo: 'github' as const,
    logoWidth: 107,
    logoHeight: 24,
    body: 'Platform expansion (coming soon).',
    href: 'https://docs.github.com/en',
    linkLabel: 'GitHub (soon)'
  }
] as const;

export const productMapTiles = [
  {
    title: 'Audit engine',
    description: 'Multi-agent orchestration across code, CI, and configuration with validated outputs.',
    href: marketingLinks.howItWorks
  },
  {
    title: 'Reviewer console',
    description: 'Inspect findings, approve issue candidates, and trace audit runs before publish.',
    href: marketingLinks.app
  },
  {
    title: 'GitLab sync',
    description: 'Publish and reconcile structured issues through GitLab MCP and REST integrations.',
    href: marketingLinks.docsIntegrationsGitlab
  }
] as const;
