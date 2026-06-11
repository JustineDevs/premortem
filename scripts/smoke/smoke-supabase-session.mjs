#!/usr/bin/env node
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

  const adminHeaders = {
    Authorization: `Bearer ${serviceRoleKey}`,
    apikey: serviceRoleKey,
    'Content-Type': 'application/json'
  };

  const createResponse = await fetch(`${url}/auth/v1/admin/users`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      id: userId,
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: input.fullName ?? 'Smoke Stranger',
        user_name: input.username ?? email.split('@')[0]
      }
    })
  });

  if (!createResponse.ok && createResponse.status !== 422) {
    const payload = await createResponse.text();
    throw new Error(`Supabase admin create user failed (${createResponse.status}): ${payload}`);
  }

  if (createResponse.status === 422) {
    const updateResponse = await fetch(`${url}/auth/v1/admin/users/${userId}`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({
        password,
        email_confirm: true,
        user_metadata: {
          full_name: input.fullName ?? 'Smoke Stranger',
          user_name: input.username ?? email.split('@')[0]
        }
      })
    });

    if (!updateResponse.ok) {
      const payload = await updateResponse.text();
      throw new Error(`Supabase admin update user failed (${updateResponse.status}): ${payload}`);
    }
  }

  const signInResponse = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, password })
  });

  if (!signInResponse.ok) {
    const payload = await signInResponse.text();
    throw new Error(`Supabase password sign-in failed (${signInResponse.status}): ${payload}`);
  }

  const session = await signInResponse.json();
  const accessToken = session.access_token;
  if (!accessToken) {
    throw new Error('Supabase sign-in did not return access_token.');
  }

  return {
    accessToken,
    userId: session.user?.id ?? userId,
    email
  };
}

export async function deleteSupabaseSmokeUser(userId) {
  const { url, serviceRoleKey } = supabaseConfig();
  await fetch(`${url}/auth/v1/admin/users/${userId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey
    }
  });
}
