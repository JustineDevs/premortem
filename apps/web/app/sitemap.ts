import type { MetadataRoute } from 'next';

import { marketingLinks } from '@/lib/marketing-links';

const siteUrl = new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://premortem.jstn.site');

const publicRoutes = [
  marketingLinks.home,
  marketingLinks.products,
  marketingLinks.solutions,
  marketingLinks.howItWorks,
  marketingLinks.docs,
  marketingLinks.docsGettingStarted,
  marketingLinks.docsTutorialFirstAudit,
  marketingLinks.docsTutorialPublishGitlab,
  marketingLinks.docsGuidesConnectGitlab,
  marketingLinks.docsGuidesRunAudit,
  marketingLinks.docsGuidesReviewPublish,
  marketingLinks.docsGuidesDeployProduction,
  marketingLinks.docsGuidesWorkflowCanvas,
  marketingLinks.docsGuidesAuditHistory,
  marketingLinks.docsGuidesAiPlayground,
  marketingLinks.docsGuidesWorkspaceSettings,
  marketingLinks.docsGuidesAuthSessions,
  marketingLinks.docsReferenceApi,
  marketingLinks.docsReferenceEnvironment,
  marketingLinks.docsReferenceBilling,
  marketingLinks.docsReferenceNeo4j,
  marketingLinks.docsReferenceObservability,
  marketingLinks.docsConceptsSecurity,
  marketingLinks.docsConceptsAuditModel,
  marketingLinks.docsConceptsDataFlow,
  marketingLinks.docsProductFlows,
  marketingLinks.docsArchitecture,
  marketingLinks.docsIntegrationsGitlab,
  marketingLinks.docsTroubleshooting,
  marketingLinks.docsFaq,
  marketingLinks.docsReleases,
  marketingLinks.signup,
  marketingLinks.login,
  marketingLinks.privacy,
  marketingLinks.terms
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return publicRoutes.map((pathname) => ({
    url: new URL(pathname, siteUrl).toString(),
    lastModified
  }));
}
