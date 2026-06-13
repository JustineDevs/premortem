import http, { type IncomingMessage } from 'node:http';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

import {
  DatabaseSessionService,
  InMemoryRunner,
  Runner,
  isFinalResponse,
  stringifyContent
} from '@google/adk';
import { scrubOutput, validateInput } from '@premortem/security';

import {
  buildPremortemRootAgent,
  resolveAgentBuilderCredentials,
  type AgentBuilderRuntimeConfig
} from './index';

export interface AgentBuilderRuntimeState {
  ready: boolean;
  reason?: string;
  config: AgentBuilderRuntimeConfig;
  runner?: Runner;
}

function toJsonResponse(statusCode: number, payload: unknown) {
  return new Response(JSON.stringify(payload, null, 2), {
    status: statusCode,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
}

async function readJsonBody(request: IncomingMessage) {
  if (request.method === 'GET' || request.method === 'HEAD') {
    return {};
  }

  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.from(chunk));
  }
  const text = Buffer.concat(chunks).toString('utf8');
  if (!text.trim()) return {};

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error('Request body must be valid JSON.');
  }
}

async function createAgentBuilderRuntime(): Promise<AgentBuilderRuntimeState> {
  const config = resolveAgentBuilderCredentials({});
  const apiKeyConfigured = Boolean(config.geminiApiKey?.trim());

  if (!apiKeyConfigured && !config.vertexai) {
    return {
      ready: false,
      reason: 'Set GEMINI_API_KEY or enable Vertex AI with GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION.',
      config
    };
  }

  try {
    const agent = buildPremortemRootAgent({
      gitlabBaseUrl: config.gitlabBaseUrl,
      gitlabToken: config.gitlabToken || undefined,
      model: config.model,
      geminiApiKey: config.geminiApiKey || undefined,
      vertexai: config.vertexai,
      project: config.project,
      location: config.location
    });

    let runner: Runner;
    if (config.sessionDatabaseUrl) {
      const sessionService = new DatabaseSessionService(config.sessionDatabaseUrl);
      await sessionService.init();
      runner = new Runner({
        appName: 'premortem_predictive_audit_agent',
        agent,
        sessionService
      });
    } else {
      runner = new InMemoryRunner({
        appName: 'premortem_predictive_audit_agent',
        agent
      });
    }

    return {
      ready: true,
      config,
      runner
    };
  } catch (error) {
    return {
      ready: false,
      reason: error instanceof Error ? error.message : String(error),
      config
    };
  }
}

async function runPrompt(runtime: AgentBuilderRuntimeState, body: Record<string, unknown>) {
  if (!runtime.runner) {
    throw new Error(runtime.reason ?? 'Agent runtime is not ready.');
  }

  const prompt = String(body.prompt ?? body.message ?? '').trim();
  if (!prompt) {
    throw new Error('prompt is required');
  }

  const guard = validateInput(prompt);
  if (!guard.passed) {
    return {
      blocked: true,
      reason: guard.violation ?? 'Input blocked by guardrail'
    };
  }

  const userId = String(body.userId ?? 'cloud-run-user');
  const sessionId = String(body.sessionId ?? randomUUID());
  const events = [];

  for await (const event of runtime.runner.runAsync({
    userId,
    sessionId,
    newMessage: {
      role: 'user',
      parts: [{ text: prompt }]
    } as never
  })) {
    events.push(event);
  }

  const finalEvent = [...events].reverse().find((event) => isFinalResponse(event));
  const finalResponse = finalEvent ? scrubOutput(stringifyContent(finalEvent)) : null;

  return {
    blocked: false,
    sessionId,
    eventCount: events.length,
    finalResponse,
    ready: runtime.ready,
    model: runtime.config.model,
    vertexai: runtime.config.vertexai
  };
}

export async function startAgentBuilderServer(port = Number(process.env.PORT ?? 8080)) {
  const runtime = await createAgentBuilderRuntime();

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

      if (req.method === 'GET' && url.pathname === '/healthz') {
        const status = runtime.ready ? 200 : 503;
        const payload = {
          ok: runtime.ready,
          reason: runtime.reason ?? null,
          runtime: {
            model: runtime.config.model,
            vertexai: runtime.config.vertexai,
            project: runtime.config.project ?? null,
            location: runtime.config.location ?? null,
            sessionDatabaseUrlConfigured: Boolean(runtime.config.sessionDatabaseUrl)
          }
        };
        res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(payload, null, 2));
        return;
      }

      if (req.method === 'POST' && url.pathname === '/run') {
        const body = (await readJsonBody(req)) as Record<
          string,
          unknown
        >;
        const result = await runPrompt(runtime, body);
        const status = result.blocked ? 400 : runtime.ready ? 200 : 503;
        res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(result, null, 2));
        return;
      }

      if (req.method === 'GET' && url.pathname === '/') {
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
        res.end(
          JSON.stringify(
            {
              name: 'premortem_predictive_audit_agent',
              ready: runtime.ready,
              routes: ['/healthz', '/run']
            },
            null,
            2
          )
        );
        return;
      }

      res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Not found' }, null, 2));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: message }, null, 2));
    }
  });

  await new Promise<void>((resolve) => {
    server.listen(port, resolve);
  });

  return { server, runtime };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  startAgentBuilderServer().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
