import * as Sentry from '@sentry/nextjs';

import { getBaseSentryOptions } from './src/lib/sentry/config';

Sentry.init(getBaseSentryOptions());

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
