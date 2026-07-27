import { handlePremortemMcpRequest } from '../lib/premortem-mcp.js';
import type { AppEnv } from '../lib/types.js';

export async function handleMcpRequest(request: Request, env: AppEnv = {}) {
  return handlePremortemMcpRequest(request, env);
}
