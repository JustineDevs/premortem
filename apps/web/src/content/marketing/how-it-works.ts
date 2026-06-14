import { assets } from '@/components/landing/assets';
import { marketingLinks } from '@/lib/marketing-links';

export const howItWorksPage = {
  title: 'How it works',
  description: 'Three steps from repository connection to review-ready structured issues.',
  stepDetails: [
    {
      id: 'connect',
      heading: '[1] Connect GitLab',
      body:
        'Authorize Premortem and select the project you want to audit. Repository context, CI data, and issue APIs are wired through GitLab MCP and REST integrations.',
      links: [
        { label: 'GitLab MCP docs', href: marketingLinks.docsIntegrationsGitlab, external: true },
        { label: 'Integration guide', href: marketingLinks.docsIntegrationsGitlab, external: false }
      ]
    },
    {
      id: 'run',
      heading: '[2] Run Premortem',
      body:
        'A multi-lens audit runs across code, CI, and configs. Specialist agents produce validated findings that are clustered, deduplicated, and synthesized into structured issue candidates.',
      links: [{ label: 'Architecture overview', href: marketingLinks.docsArchitecture, external: false }]
    },
    {
      id: 'review',
      heading: '[3] Review issues',
      body:
        'Approve structured findings in the reviewer console before sync. Publish and reconciliation workflows keep GitLab issues aligned with audit output.',
      links: [
        { label: 'Open reviewer console', href: '/app', external: false },
        { label: 'Product flows', href: marketingLinks.docsProductFlows, external: false }
      ]
    }
  ],
  developerCallout: {
    title: 'Local development',
    body: 'Run pnpm run dev to sync Prisma, start the API runtime, and launch the web app. Use pnpm run smoke:local to verify health, landing, app console, and audit detail routes.',
    href: marketingLinks.docsGettingStarted
  },
  screenshot: {
    src: assets.consoleAuditsPreview,
    alt: 'Premortem reviewer console: Audits and Tracing with structured issue review'
  },
  audioBrief: {
    src: '/media/ai-swarms-predict-code-breaks-before-deployment.m4a',
    title: 'AI swarms predict code breaks before deployment',
    description:
      'A short overview of how Premortem runs multi-lens agent swarms across your repository before merge, surfaces structured findings, and keeps review in your workflow.',
    durationLabel: 'M4A · playable in browser'
  }
} as const;
