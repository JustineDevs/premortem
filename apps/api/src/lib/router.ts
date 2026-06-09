import { handleAuditCreate, handleAuditList, handleAuditRead } from '../routes/audits';
import type { AppEnv, ExecutionContextLike } from './types';

export async function appRouter(request: Request, env: AppEnv = {}, _ctx?: ExecutionContextLike) {
  const url = new URL(request.url);

  if (url.pathname === '/api/audits' && request.method === 'POST') {
    return handleAuditCreate(request, env);
  }

  if (url.pathname === '/api/audits' && request.method === 'GET') {
    return handleAuditList(request);
  }

  const auditMatch = url.pathname.match(/^\/api\/audits\/([^/]+)$/);
  if (auditMatch && request.method === 'GET') {
    return handleAuditRead(auditMatch[1]!);
  }

  if (url.pathname === '/health') {
    return Response.json({ ok: true, service: 'premortem-api' });
  }

  return Response.json({ error: 'Not found' }, { status: 404 });
}
