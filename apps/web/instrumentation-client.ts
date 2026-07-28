import { initBotId } from 'botid/client/core';

import { botIdProtectRoutes } from '@/lib/botid-protect';

initBotId({
  protect: botIdProtectRoutes
});
