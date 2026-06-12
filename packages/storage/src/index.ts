import { createClient } from '@supabase/supabase-js';

const DEFAULT_BUCKET = 'premortem-artifacts';

function getStorageClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return null;
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

export function isSupabaseStorageConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL) &&
    Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export interface UploadArtifactInput {
  organizationId: string;
  projectId: string;
  auditRunId: string;
  kind: 'graph' | 'evidence';
  payload: unknown;
  contentType?: string;
}

export async function uploadArtifact(input: UploadArtifactInput): Promise<string | null> {
  const client = getStorageClient();
  if (!client) return null;

  const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? DEFAULT_BUCKET;
  const path = `${input.organizationId}/${input.projectId}/${input.auditRunId}/${input.kind}.json`;
  const body = JSON.stringify(input.payload);

  const { error } = await client.storage.from(bucket).upload(path, body, {
    contentType: input.contentType ?? 'application/json',
    upsert: true
  });

  if (error) {
    if (error.message.includes('Bucket not found')) {
      return null;
    }
    throw new Error(`Supabase Storage upload failed: ${error.message}`);
  }

  return `supabase://${bucket}/${path}`;
}

export async function downloadArtifact(storageRef: string): Promise<unknown | null> {
  if (!storageRef.startsWith('supabase://')) return null;

  const client = getStorageClient();
  if (!client) return null;

  const withoutScheme = storageRef.slice('supabase://'.length);
  const slashIndex = withoutScheme.indexOf('/');
  if (slashIndex === -1) return null;

  const bucket = withoutScheme.slice(0, slashIndex);
  const path = withoutScheme.slice(slashIndex + 1);

  const { data, error } = await client.storage.from(bucket).download(path);
  if (error || !data) {
    throw new Error(`Supabase Storage download failed: ${error?.message ?? 'missing object'}`);
  }

  const text = await data.text();
  return JSON.parse(text) as unknown;
}
