import { handlePremortemMcpRequest } from '../lib/premortem-mcp';
import type { AppEnv } from '../lib/types';

export async function handleMcpRequest(request: Request, env: AppEnv = {}) {
  return handlePremortemMcpRequest(request, env);
}
