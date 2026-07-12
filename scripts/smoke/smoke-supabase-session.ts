#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

/**
 * Creates a Supabase auth user and returns a bearer access token for smoke BFF calls.
 * Requires SUPABASE_SERVICE_ROLE_KEY and public Supabase URL/anon key in env.
 */

function supabaseConfig() {
  const url = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(
    /\/$/,
    ''
  );
  const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceRoleKey) {
    throw new Error(
      'Supabase smoke session requires NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY.'
    );
  }
  return { url, anonKey, serviceRoleKey };
}

export async function createSupabaseSmokeSession(input) {
  const { url, anonKey, serviceRoleKey } = supabaseConfig();
  const email = input.email;
  const password = input.password;
  const userId = input.userId;
  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const createResult = await admin.auth.admin.createUser({
    id: userId,
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: input.fullName ?? 'Smoke Stranger',
      user_name: input.username ?? email.split('@')[0]
    }
  });

  if (createResult.error && createResult.error.status !== 422) {
    throw new Error(`Supabase admin create user failed: ${createResult.error.message}`);
  }

  if (createResult.error?.status === 422) {
    const updateResult = await admin.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
      user_metadata: {
        full_name: input.fullName ?? 'Smoke Stranger',
        user_name: input.username ?? email.split('@')[0]
      }
    });

    if (updateResult.error) {
      throw new Error(`Supabase admin update user failed: ${updateResult.error.message}`);
    }
  }

  const signInResult = await client.auth.signInWithPassword({ email, password });
  if (signInResult.error) {
    throw new Error(`Supabase password sign-in failed: ${signInResult.error.message}`);
  }

  const accessToken = signInResult.data.session?.access_token;
  if (!accessToken) {
    throw new Error('Supabase sign-in did not return access_token.');
  }

  return {
    accessToken,
    userId: signInResult.data.user?.id ?? userId,
    email
  };
}

export async function deleteSupabaseSmokeUser(userId) {
  const { url, serviceRoleKey } = supabaseConfig();
  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  await admin.auth.admin.deleteUser(userId);
}
