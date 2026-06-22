export const PREMORTEM_PRODUCT_NAME = 'Premortem';
/** Production host for Premortem public links. */
export const PREMORTEM_SITE_HOST = 'premortem.jstn.site';
export const PREMORTEM_API_HOST = 'api.jstn.site';
export const DEFAULT_PREMORTEM_SITE_URL = `https://${PREMORTEM_SITE_HOST}`;
export const DEFAULT_PREMORTEM_API_URL = `https://${PREMORTEM_API_HOST}`;
export const PREMORTEM_LOGO_MARK_PATH = '/logo/svg/premortem-mark.svg';
export const PREMORTEM_PUBLISH_ATTRIBUTION_LOGO_PATH = '/logo/svg/premortem_header(white).svg';

export function resolvePremortemSiteUrl(): string {
  return resolvePremortemPublishSiteUrl();
}

function isLocalDevSiteUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local');
  } catch {
    return false;
  }
}

/** Public site URL for outbound publish footers (GitLab/GitHub). Never localhost. */
export function resolvePremortemPublishSiteUrl(): string {
  const explicit =
    typeof process !== 'undefined' ? process.env.PREMORTEM_SITE_URL?.trim() : undefined;
  if (explicit) {
    return explicit.replace(/\/$/, '');
  }

  const fromApp =
    typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_APP_URL?.trim() : undefined;
  if (fromApp && !isLocalDevSiteUrl(fromApp)) {
    return fromApp.replace(/\/$/, '');
  }

  return DEFAULT_PREMORTEM_SITE_URL;
}

export function premortemLogoCdnUrl(siteUrl = resolvePremortemPublishSiteUrl()): string {
  return `${siteUrl}${PREMORTEM_LOGO_MARK_PATH}`;
}

export function premortemPublishAttributionLogoCdnUrl(
  siteUrl = resolvePremortemPublishSiteUrl()
): string {
  return `${siteUrl}${PREMORTEM_PUBLISH_ATTRIBUTION_LOGO_PATH}`;
}

export interface PremortemPublishAttributionOptions {
  siteUrl?: string;
  logoUrl?: string;
  productName?: string;
  logoWidth?: number;
}

/**
 * Markdown attribution for published findings: CDN header logo at a medium size and brand name link to the public site.
 */
export function renderPremortemPublishAttribution(
  options: PremortemPublishAttributionOptions = {}
): string {
  const siteUrl = options.siteUrl ?? resolvePremortemPublishSiteUrl();
  const logoUrl = options.logoUrl ?? premortemPublishAttributionLogoCdnUrl(siteUrl);
  const productName = options.productName ?? PREMORTEM_PRODUCT_NAME;
  const logoWidth = options.logoWidth ?? 120;

  return `_Automated by <a href="${siteUrl}"><img src="${logoUrl}" alt="${productName}" width="${logoWidth}" /></a> <a href="${siteUrl}">${productName}</a>. Labels organize audit findings for triage, filtering, and reconciliation._`;
}
