import type { Metadata } from 'next';

const dedupe = (items: readonly string[]) => Array.from(new Set(items));

export const canonicalSiteKeywords = dedupe([
  'Premortem',
  'Premortem AI',
  'Premortem audit',
  'Premortem review',
  'pre mortem',
  'predictive repository audits',
  'predictive repository intelligence',
  'predictive audits',
  'predictive code review',
  'repo audit',
  'repository review',
  'repository audit',
  'repository audit tool',
  'repository audit platform',
  'repository intelligence',
  'repository risk prediction',
  'code risk prediction',
  'code audit',
  'code review automation',
  'code intelligence platform',
  'software delivery risk',
  'change risk analysis',
  'change intelligence',
  'engineering intelligence',
  'developer workflow intelligence',
  'developer productivity',
  'AI code analysis',
  'AI repository analysis',
  'AI code review',
  'AI-assisted review',
  'agentic code review',
  'swarm analysis',
  'specialist swarm',
  'multi-lens audit',
  'multi-agent audit orchestration',
  'parallel specialist agents',
  'specialist agents',
  'issue synthesis',
  'finding clustering',
  'dedupe clustering',
  'review-ready findings',
  'structured findings',
  'issue candidates',
  'human review gate',
  'human-in-the-loop',
  'reviewer-first',
  'continuous audit',
  'scheduled audits',
  'webhook audits',
  'workflow canvas',
  'audit traceability',
  'auditability chain',
  'repository review workflow',
  'pre-merge audit',
  'pre merge audit',
  'pre-release risk',
  'release readiness',
  'release risk',
  'CI risk',
  'pipeline risk',
  'CI/CD risk',
  'deployment risk',
  'dependency risk',
  'supply chain risk',
  'security risk',
  'security review automation',
  'performance risk',
  'topology risk',
  'ownership risk',
  'bus factor risk',
  'bus factor analysis',
  'codebase analysis',
  'source code audit',
  'software audit platform',
  'repository scanning',
  'audit automation',
  'audit orchestration',
  'GitLab-first',
  'GitLab audit automation',
  'GitLab code review',
  'GitLab repository audit',
  'GitLab issue publish',
  'GitLab reconcile',
  'GitLab issue synthesis',
  'review and publish',
  'reconciliation',
  'repo intelligence platform',
  'software risk platform',
  'software risk review',
  'source control review',
  'repository health',
  'repository risk analysis',
  'repository prediction',
  'risk detection',
  'risk prediction'
] as const);

export const canonicalLandingKeywords = dedupe([
  'predictive repository intelligence',
  'predictive repository audits',
  'repository audit platform',
  'repository risk prediction',
  'issue synthesis',
  'swarm analysis',
  'specialist swarm',
  'workflow canvas',
  'continuous audit',
  'review-ready findings',
  'GitLab-first',
  'GitLab audit automation'
] as const);

export const canonicalProductKeywords = dedupe([
  'product',
  'products',
  'repository audit platform',
  'audit orchestration',
  'structured findings',
  'dedupe clustering',
  'review-ready issue candidates',
  'GitLab issue publish',
  'GitLab reconcile',
  'publish and reconcile',
  'plan limits',
  'pricing',
  'feature map',
  'multi-lens audits',
  'workflow canvas trace',
  'parallel specialist swarm',
  'reviewer console'
] as const);

export const canonicalSolutionKeywords = dedupe([
  'solutions',
  'team workflows',
  'platform engineering',
  'security review',
  'release safety',
  'pre-merge risk discovery',
  'reviewer trust',
  'audit to issue workflow',
  'structured issue delivery',
  'repository intelligence for teams',
  'GitLab workflow automation',
  'reviewer console'
] as const);

export const canonicalWorkflowKeywords = dedupe([
  'how it works',
  'workflow',
  'connect GitLab',
  'run an audit',
  'predictive audit pipeline',
  'graph ingest',
  'specialist swarm execution',
  'review findings',
  'publish GitLab issues',
  'reconciliation',
  'workflow canvas',
  'audit steps',
  'human approval',
  'release workflow'
] as const);

export const canonicalDocsKeywords = dedupe([
  'documentation',
  'tutorials',
  'tutorial',
  'guides',
  'how-to',
  'how to',
  'reference',
  'explanations',
  'troubleshooting',
  'getting started',
  'first audit',
  'local setup',
  'connect GitLab',
  'run an audit',
  'review and publish',
  'deploy to production',
  'workflow canvas',
  'audit history',
  'AI code playground',
  'workspace settings',
  'auth sessions',
  'GitLab integration',
  'GitLab OAuth',
  'GitLab webhook',
  'API routes',
  'environment variables',
  'billing and plan limits',
  'Neo4j graph store',
  'observability',
  'security and trust boundaries',
  'architecture overview',
  'product flows',
  'release notes',
  'FAQ',
  'support',
  'common questions',
  'privacy policy',
  'terms of service',
  'audit model',
  'data flow',
  'continuous audit',
  'reconciliation',
  'publish to GitLab',
  'reviewer console',
  'runtime guides',
  'queue workers',
  'Cloudflare Workers',
  'Supabase Auth',
  'auth troubleshooting',
  'integration troubleshooting'
] as const);

export const canonicalSupportKeywords = dedupe([
  'login',
  'log in',
  'sign up',
  'create account',
  'password reset',
  'forgot password',
  'GitLab sign in',
  'account access',
  'Supabase auth',
  'reviewer console',
  'workspace access',
  'session expired',
  'integration reconnect',
  'auth callback',
  'recover account'
] as const);

export const canonicalLegalKeywords = dedupe([
  'privacy policy',
  'terms of service',
  'data retention',
  'data deletion',
  'software licensing',
  'MIT License',
  'compliance',
  'retention requirements',
  'connected integrations'
] as const);

export function buildSeoMetadata(input: {
  title: string;
  description: string;
  canonical: string;
  keywords?: readonly string[];
  noIndex?: boolean;
  includeCanonicalSiteKeywords?: boolean;
}): Metadata {
  const siteKeywords = input.includeCanonicalSiteKeywords === false ? [] : canonicalSiteKeywords;

  return {
    title: input.title,
    description: input.description,
    keywords: dedupe([...siteKeywords, ...(input.keywords ?? [])]),
    alternates: {
      canonical: input.canonical
    },
    robots: input.noIndex
      ? {
          index: false,
          follow: false
        }
      : undefined
  };
}
