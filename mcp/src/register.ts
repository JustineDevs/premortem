import { z } from 'zod';
import type { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import type { MCPServer } from 'mcp-use/server';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { error, text } from 'mcp-use/server';
import type { PremortemMcpRuntimeEnv } from './types.js';
import {
  getPremortemAudit,
  getPremortemBillingStatus,
  getPremortemWhoami,
  getPremortemWorkspaceSummary,
  listPremortemAudits,
  listPremortemProjects,
  resolveMcpActorFromSupabaseContext,
  resolveSdkActorFromAuthInfo,
  submitPremortemAudit
} from './context.js';

type SdkAuthExtra = { authInfo?: { extra?: Record<string, unknown> } };

type ToolDefinition = {
  name: string;
  title: string;
  description: string;
  schema?: z.ZodTypeAny;
  annotations?: ToolAnnotations;
  run: (
    input: unknown,
    actor:
      | Awaited<ReturnType<typeof resolveSdkActorFromAuthInfo>>
      | Awaited<ReturnType<typeof resolveMcpActorFromSupabaseContext>>,
    env: PremortemMcpRuntimeEnv
  ) => Promise<ReturnType<typeof text> | ReturnType<typeof error>>;
};

const ProjectsListInput = z.object({
  take: z.number().int().min(1).max(100).optional(),
  cursor: z.string().min(1).optional()
});

const AuditsListInput = z.object({
  limit: z.number().int().min(1).max(50).optional()
});

const AuditGetInput = z.object({
  auditRunId: z.string().min(1),
  includeGraphPayload: z.boolean().optional(),
  includeEvidenceSnippets: z.boolean().optional()
});

const BillingStatusInput = z.object({});

const AuditSubmitInput = z.object({
  projectId: z.string().min(1),
  branch: z.string().min(1),
  commitSha: z.string().min(1).optional(),
  scanCodeSnippet: z.string().min(1).optional()
});

function parseToolInput<T>(schema: z.ZodTypeAny | undefined, input: unknown): T {
  if (!schema) return (input ?? {}) as T;
  return schema.parse(input) as T;
}

const toolDefinitions: ToolDefinition[] = [
  {
    name: 'premortem_whoami',
    title: 'Who am I',
    description: 'Return the authenticated actor, effective workspace role, and available MCP scopes.',
    run: async (_input, actor) => text(JSON.stringify(await getPremortemWhoami(actor), null, 2))
  },
  {
    name: 'premortem_workspace_summary',
    title: 'Workspace summary',
    description: 'Return a safe, org-scoped summary of workspace settings, runtime, and billing state.',
    run: async (_input, actor) => text(JSON.stringify(await getPremortemWorkspaceSummary(actor), null, 2))
  },
  {
    name: 'premortem_projects_list',
    title: 'Projects list',
    description: 'List connected projects for the current organization with cursor pagination.',
    schema: ProjectsListInput,
    run: async (input, actor) =>
      text(JSON.stringify(await listPremortemProjects(actor, parseToolInput<z.infer<typeof ProjectsListInput>>(ProjectsListInput, input)), null, 2))
  },
  {
    name: 'premortem_audits_list',
    title: 'Recent audits',
    description: 'List the most recent audit runs for the current organization.',
    schema: AuditsListInput,
    run: async (input, actor) =>
      text(JSON.stringify(await listPremortemAudits(actor, parseToolInput<z.infer<typeof AuditsListInput>>(AuditsListInput, input)), null, 2))
  },
  {
    name: 'premortem_audit_get',
    title: 'Audit details',
    description: 'Return a detailed audit snapshot including findings, events, graph metadata, and evidence.',
    schema: AuditGetInput,
    run: async (input, actor) => {
      try {
        const result = await getPremortemAudit(actor, parseToolInput<z.infer<typeof AuditGetInput>>(AuditGetInput, input));
        return text(JSON.stringify(result, null, 2));
      } catch (caughtError) {
        const parsed = (() => {
          try {
            return parseToolInput<z.infer<typeof AuditGetInput>>(AuditGetInput, input);
          } catch {
            return null;
          }
        })();
        return error(
          JSON.stringify(
            {
              ok: false,
              error: caughtError instanceof Error ? caughtError.message : String(caughtError),
              auditRunId: parsed?.auditRunId ?? null
            },
            null,
            2
          )
        );
      }
    }
  },
  {
    name: 'premortem_billing_status',
    title: 'Billing status',
    description: 'Return the current billing and quota status for the organization.',
    schema: BillingStatusInput,
    run: async (_input, actor) => text(JSON.stringify(await getPremortemBillingStatus(actor), null, 2))
  },
  {
    name: 'premortem_audit_submit',
    title: 'Submit audit',
    description: 'Submit a real audit job for a project branch. Requires write privileges and quota.',
    schema: AuditSubmitInput,
    annotations: {
      destructiveHint: false,
      idempotentHint: false,
      readOnlyHint: false,
      openWorldHint: false
    },
    run: async (input, actor, env) =>
      text(JSON.stringify(await submitPremortemAudit(env, actor, parseToolInput<z.infer<typeof AuditSubmitInput>>(AuditSubmitInput, input)), null, 2))
  }
];

export function registerPremortemToolsOnSdkServer(server: McpServer, env: PremortemMcpRuntimeEnv = {}) {
  for (const tool of toolDefinitions) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.schema,
        annotations: tool.annotations
      },
      async (input: unknown, extra: SdkAuthExtra) => {
        const actor = await resolveSdkActorFromAuthInfo(extra);
        return tool.run(input, actor, env);
      }
    );
  }
}

export function registerPremortemToolsOnMcpUseServer(server: MCPServer, env: PremortemMcpRuntimeEnv = {}) {
  for (const tool of toolDefinitions) {
    server.tool(
      {
        name: tool.name,
        title: tool.title,
        description: tool.description,
        schema: tool.schema,
        annotations: tool.annotations
      },
      async (input: unknown, ctx) => {
        const actor = await resolveMcpActorFromSupabaseContext(ctx);
        return tool.run(input, actor, env);
      }
    );
  }
}
