'use client';

import posthog from 'posthog-js';
import { useEffect, useState } from 'react';

export function useCanonicalFeatureFlag(flag: string, defaultValue = false) {
  const [enabled, setEnabled] = useState(defaultValue);

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY || typeof window === 'undefined') return;

    const sync = () => {
      setEnabled(posthog.isFeatureEnabled(flag) ?? defaultValue);
    };

    sync();
    const unsubscribe = posthog.onFeatureFlags(sync);
    return unsubscribe;
  }, [flag, defaultValue]);

  return enabled;
}
