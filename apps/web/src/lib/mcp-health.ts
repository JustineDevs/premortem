import type { NextRequest } from 'next/server';

type McpProbeRequest = Pick<NextRequest, 'method' | 'headers' | 'nextUrl'>;

export function isLikelyMcpHealthProbe(request: McpProbeRequest) {
  const method = request.method.toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') return false;

  const pathname = request.nextUrl.pathname.replace(/\/$/, '');
  if (pathname !== '/mcp' && pathname !== '/mcp/healthz') return false;

  if (pathname === '/mcp/healthz') return true;

  const accept = request.headers.get('accept') ?? '';
  const mcpSpecificHeaders = ['mcp-session-id', 'last-event-id', 'x-mcp-session-id'];
  if (accept.includes('text/event-stream')) return false;
  if (mcpSpecificHeaders.some((header) => request.headers.has(header))) return false;

  return true;
}
