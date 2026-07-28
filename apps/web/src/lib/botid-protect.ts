export type BotIdProtectRoute = {
  path: string;
  method: string;
  advancedOptions?: {
    checkLevel?: 'deepAnalysis' | 'basic';
  };
};

export const botIdProtectRoutes = [
  { path: '/api/auth/*', method: 'GET' },
  { path: '/api/auth/*', method: 'POST' },
  { path: '/api/billing/*', method: 'POST' },
  { path: '/api/audits', method: 'POST' },
  { path: '/api/audits/run', method: 'POST' },
  { path: '/api/projects/public', method: 'POST' },
  { path: '/api/workspace/*', method: 'POST' },
  { path: '/api/workspace/*', method: 'PUT' },
  { path: '/api/workspace/*', method: 'PATCH' },
  { path: '/api/workspace/*', method: 'DELETE' },
  { path: '/api/issues/reconcile', method: 'POST' },
  { path: '/api/reconciliation', method: 'POST' }
] satisfies BotIdProtectRoute[];
