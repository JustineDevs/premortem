'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';

import { PostHogProvider } from './posthog-provider';
import { shouldRetryBffQuery } from '@/lib/bff-client';

export function OsProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            gcTime: 5 * 60 * 1000,
            retry: shouldRetryBffQuery
          }
        }
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <PostHogProvider>{children}</PostHogProvider>
    </QueryClientProvider>
  );
}
