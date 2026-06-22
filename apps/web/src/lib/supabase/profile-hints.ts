import type { User, UserIdentity } from '@supabase/supabase-js';

import type { ProfileProvisionHints } from '@premortem/db';

function identityString(identity: UserIdentity, keys: string[]): string | null {
  const data = (identity as UserIdentity & { identity_data?: Record<string, unknown> }).identity_data;
  if (!data || typeof data !== 'object') return null;

  for (const key of keys) {
    const value = data[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

export function supabaseProfileHintsFromUser(user: Pick<User, 'email' | 'identities'>): ProfileProvisionHints {
  const providerIdentity = user.identities?.[0] ?? null;
  const identityHints = providerIdentity
    ? {
        fullName: identityString(providerIdentity, ['full_name', 'name', 'display_name']),
        username: identityString(providerIdentity, ['user_name', 'preferred_username', 'nickname', 'login'])
      }
    : {};

  return {
    email: user.email ?? null,
    ...identityHints,
    username:
      identityHints.username ??
      (user.email ? user.email.split('@')[0] ?? null : null)
  };
}
