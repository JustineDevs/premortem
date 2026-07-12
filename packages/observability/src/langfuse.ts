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
  if (client) return client;

  if (!isLangfuseConfigured()) {
    throw new Error(
      'Langfuse is required. Set LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY before loading the app.'
    );
  }

  client = new LangfuseClient({
    publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
    secretKey: process.env.LANGFUSE_SECRET_KEY!,
    baseUrl: process.env.LANGFUSE_BASE_URL
  });

  return client;
}

export async function getManagedPrompt(name: string, options: ManagedPromptOptions = {}) {
  const langfuse = getLangfuseClient();

  const label = options.label ?? process.env.LANGFUSE_PROMPT_LABEL?.trim() ?? 'production';
  if (!label) {
    throw new Error(
      'Langfuse prompt sync requires LANGFUSE_PROMPT_LABEL or an explicit label option.'
    );
  }

  if (options.type === 'chat') {
    return langfuse.prompt.get(name, {
      label,
      type: 'chat'
    });
  }

  return langfuse.prompt.get(name, {
    label,
    type: 'text'
  });
}

export async function createLangfuseScore(input: {
  traceId: string;
  name: string;
  value: number;
  comment?: string;
}) {
  const langfuse = getLangfuseClient();
  await langfuse.score.create(input);
}

export async function shutdownLangfuse() {
  if (!client) return;
  await client.shutdown();
  client = null;
}

export async function probeLangfuseDelivery(input?: {
  traceId?: string;
  name?: string;
  value?: number;
  comment?: string;
}) {
  const langfuse = getLangfuseClient();
  langfuse.score.create({
    traceId: input?.traceId ?? `premortem-smoke-${Date.now().toString(36)}`,
    name: input?.name ?? 'premortem.observability_smoke',
    value: input?.value ?? 1,
    comment: input?.comment ?? 'Premortem smoke verification'
  });
  await langfuse.score.flush();
  await shutdownLangfuse();
}
