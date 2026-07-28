import { NextResponse, type NextRequest } from 'next/server';

import { getMcpUpstreamUrl } from '@/lib/runtime-config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type McpProbeRequest = Pick<NextRequest, 'method' | 'headers' | 'nextUrl'>;

function isLikelyMcpHealthProbe(request: McpProbeRequest) {
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

function buildUpstreamUrl(request: NextRequest) {
  const upstreamBase = new URL(getMcpUpstreamUrl());
  const relativePath = request.nextUrl.pathname.replace(/^\/mcp/, '');
  const upstreamPath = `${upstreamBase.pathname.replace(/\/$/, '')}${relativePath || ''}` || '/';
  return new URL(`${upstreamPath}${request.nextUrl.search}`, upstreamBase.origin);
}

async function proxyMcpRequest(request: NextRequest) {
  if (isLikelyMcpHealthProbe(request)) {
    const upstreamHealthUrl = new URL('/healthz', new URL(getMcpUpstreamUrl()).origin);
    const response = await fetch(upstreamHealthUrl, {
      method: 'GET',
      cache: 'no-store'
    });
    const payload = await response.text();
    return new Response(payload, {
      status: response.status,
      headers: response.headers
    });
  }

  const upstreamUrl = buildUpstreamUrl(request);
  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('content-length');
  headers.delete('connection');
  headers.delete('accept-encoding');
  headers.set('x-forwarded-host', request.headers.get('host') ?? request.nextUrl.host);
  headers.set('x-forwarded-proto', request.nextUrl.protocol.replace(/:$/, ''));

  const init: RequestInit & { duplex?: 'half' } = {
    method: request.method,
    headers,
    cache: 'no-store',
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body ?? null,
    duplex: request.method === 'GET' || request.method === 'HEAD' ? undefined : 'half'
  };

  const response = await fetch(upstreamUrl, init);
  const responseHeaders = new Headers(response.headers);
  const requestId = response.headers.get('x-request-id');
  if (requestId) {
    responseHeaders.set('x-request-id', requestId);
  }

  return new Response(response.body, {
    status: response.status,
    headers: responseHeaders
  });
}

export async function GET(request: NextRequest) {
  return proxyMcpRequest(request);
}

export async function HEAD(request: NextRequest) {
  return proxyMcpRequest(request);
}

export async function POST(request: NextRequest) {
  return proxyMcpRequest(request);
}

export async function PUT(request: NextRequest) {
  return proxyMcpRequest(request);
}

export async function PATCH(request: NextRequest) {
  return proxyMcpRequest(request);
}

export async function DELETE(request: NextRequest) {
  return proxyMcpRequest(request);
}

export async function OPTIONS(request: NextRequest) {
  return proxyMcpRequest(request);
}

export { isLikelyMcpHealthProbe };
