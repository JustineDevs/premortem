import { LangfuseClient } from '@langfuse/client';

let client: LangfuseClient | null = null;

export interface ManagedPromptOptions {
  label?: string;
  type?: 'text' | 'chat';
  fallback?: string;
}

export function isLangfuseConfigured() {
  return Boolean(process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY);
}

export function getLangfuseClient() {
  if (!isLangfuseConfigured()) return null;
  if (client) return client;

  client = new LangfuseClient({
    publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
    secretKey: process.env.LANGFUSE_SECRET_KEY!,
    baseUrl: process.env.LANGFUSE_BASE_URL
  });

  return client;
}

export async function getManagedPrompt(name: string, options: ManagedPromptOptions = {}) {
  const langfuse = getLangfuseClient();
  if (!langfuse) return options.fallback ?? null;

  try {
    if (options.type === 'chat') {
      return await langfuse.prompt.get(name, {
        label: options.label,
        type: 'chat'
      });
    }

    return await langfuse.prompt.get(name, {
      label: options.label,
      type: 'text',
      fallback: options.fallback
    });
  } catch {
    return options.fallback ?? null;
  }
}

export async function createLangfuseScore(input: {
  traceId: string;
  name: string;
  value: number;
  comment?: string;
}) {
  const langfuse = getLangfuseClient();
  if (!langfuse) return;

  await langfuse.score.create(input);
}

export async function shutdownLangfuse() {
  if (!client) return;
  await client.shutdown();
  client = null;
}
