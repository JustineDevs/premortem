import {
  DEFAULT_PREMORTEM_SITE_URL,
  PREMORTEM_PRODUCT_NAME,
  PREMORTEM_SITE_HOST
} from '@premortem/domain';

export const premortemBrand = {
  productName: PREMORTEM_PRODUCT_NAME,
  domain: PREMORTEM_SITE_HOST,
  siteUrl: DEFAULT_PREMORTEM_SITE_URL,
  contactEmail: 'justinedevs@jstn.site',
  supportEmail: 'justinedevs@jstn.site',
  workspaceName: 'Premortem Workspace',
  consoleTitle: 'Reviewer Console',
  engineVersion: 'v0.1.0',
  loadingTitle: 'Loading Premortem',
  loadingDescription:
    'Connecting to your Premortem workspace, loading projects and audit history from the runtime API, and preparing reviewer surfaces.',
  errorTitle: 'Premortem unavailable',
  errorSupportLabel: 'Contact Premortem support'
} as const;
