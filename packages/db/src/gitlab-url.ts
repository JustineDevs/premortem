export function resolveGitLabApiBaseUrl(raw?: string | null): string {
  const value = raw?.trim() || 'https://gitlab.com';
  try {
    return new URL(value).origin;
  } catch {
    return 'https://gitlab.com';
  }
}

/** Reads GITLAB_EXTERNAL_PROJECT_ID or a group/project path embedded in GITLAB_BASE_URL. */
export function resolveGitLabExternalProjectIdFromEnv(): string | undefined {
  const configured = process.env.GITLAB_EXTERNAL_PROJECT_ID?.trim();
  if (configured) return configured;

  const raw = process.env.GITLAB_BASE_URL?.trim();
  if (!raw) return undefined;

  try {
    const path = new URL(raw).pathname.replace(/^\//, '').replace(/\/$/, '');
    if (path.includes('/')) return path;
  } catch {
    // ignore malformed URL
  }

  return undefined;
}
