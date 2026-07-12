import './bootstrap-env.js';

import { startPremortemNodeServer } from './lib/node-server.js';

void startPremortemNodeServer({
  serviceName: 'premortem-api',
  healthService: 'premortem-api',
  seedLocalFixture: false,
  host: process.env.PREMORTEM_API_HOST ?? '0.0.0.0'
}).catch((error) => {
  console.error('api.startup-error', error);
  process.exitCode = 1;
});
