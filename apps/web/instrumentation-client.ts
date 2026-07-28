import { initBotId } from 'botid/client/core';

import { botIdProtectRoutes } from '@/lib/botid-protect';

if (process.env.PREMORTEM_BOTID_ENABLED === '1') {
  initBotId({
    protect: botIdProtectRoutes
  });
}
