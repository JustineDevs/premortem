import './bootstrap-env.js';

import { startPremortemNodeServer } from './lib/node-server.js';

void startPremortemNodeServer({
  serviceName: 'premortem-local-api',
  healthService: 'premortem-local-api',
  seedLocalFixture: true,
  host: process.env.PREMORTEM_API_HOST ?? '127.0.0.1'
}).catch((error) => {
  console.error('local-api.startup-error', error);
  process.exitCode = 1;
});
