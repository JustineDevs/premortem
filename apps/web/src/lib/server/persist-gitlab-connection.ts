import { fetchGitLabProfile } from '@/lib/gitlab-oauth';
import { CanonicalEvents } from '@/lib/canonical/events';
import { getApiBaseUrl } from '@/lib/runtime-config';
import { trackServerEvent } from '@/lib/server/track-server-event';

import { actorHeaders, type RequestActorContext } from './request-context';

export async function persistGitLabConnection(input: {
  context: RequestActorContext;
  accessToken: string;
  refreshToken?: string | null;
  expiresInSeconds?: number;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const baseUrl = process.env.GITLAB_BASE_URL ?? 'https://gitlab.com';

  try {
    const profile = await fetchGitLabProfile(baseUrl, input.accessToken);
    const response = await fetch(`${getApiBaseUrl()}/api/workspace/integrations`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        ...actorHeaders(input.context)
      },
      body: JSON.stringify({
        provider: 'gitlab',
        externalAccountId: String(profile.id),
        externalAccountName: profile.username,
        accessToken: input.accessToken,
        refreshToken: input.refreshToken ?? undefined,
        expiresInSeconds: input.expiresInSeconds,
        accessScope: {
          summary: 'read_user, api, read_repository',
          profileName: profile.name,
          webUrl: profile.web_url
        }
      }),
      cache: 'no-store'
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const message =
        typeof payload.error === 'string' ? payload.error : `persist_failed:${response.status}`;
      return { ok: false, error: message };
    }

    trackServerEvent(input.context.profileId, CanonicalEvents.gitlabConnected, {
      provider: 'gitlab',
      externalAccountId: String(profile.id)
    });

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'oauth_failed'
    };
  }
}
