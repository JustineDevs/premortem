export const integrationNoticeMessages: Record<string, string> = {
  gitlab_connected: 'GitLab connected successfully. Pick a repository to enable.',
  coming_soon: 'That provider connector is coming soon.',
  denied: 'GitLab authorization was cancelled.',
  config: 'GitLab OAuth is not configured. Set GITLAB_CLIENT_ID and GITLAB_CLIENT_SECRET.',
  invalid_state:
    'OAuth state mismatch. Open the app at the same URL as NEXT_PUBLIC_APP_URL and try again.',
  oauth_failed: 'GitLab OAuth failed. Check credentials and redirect URI.',
  persist_failed: 'Connected to GitLab but failed to save the connection.'
};

export function formatIntegrationNotice(notice: string, detail?: string | null): string {
  const base = integrationNoticeMessages[notice] ?? 'Integration updated.';
  return detail ? `${base} (${detail})` : base;
}
