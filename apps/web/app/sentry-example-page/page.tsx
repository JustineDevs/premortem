'use client';

import Link from 'next/link';
import { useState } from 'react';

import { getSentryDsn } from '@/lib/sentry/config';

export default function SentryExamplePage() {
  const [apiStatus, setApiStatus] = useState<string | null>(null);
  const dsnConfigured = Boolean(getSentryDsn());

  async function triggerApiError() {
    setApiStatus('Sending…');

    try {
      const response = await fetch('/api/sentry-example-api');
      const body = await response.text();
      setApiStatus(`${response.status}: ${body}`);
    } catch (error) {
      setApiStatus(error instanceof Error ? error.message : 'Request failed');
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-16">
      <div>
        <p className="text-sm text-neutral-500">Premortem · Sentry verification</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Test error monitoring</h1>
        <p className="mt-3 text-neutral-600">
          Trigger sample errors below, then confirm they appear in the{' '}
          <a
            className="underline"
            href="https://premortem.sentry.io/issues/?project=javascript-nextjs"
            rel="noreferrer"
            target="_blank"
          >
            javascript-nextjs
          </a>{' '}
          project.
        </p>
      </div>

      {!dsnConfigured ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Set <code className="font-mono">NEXT_PUBLIC_SENTRY_DSN</code> and{' '}
          <code className="font-mono">SENTRY_DSN</code> in the repo-root <code className="font-mono">.env.local</code>{' '}
          before testing.
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
          type="button"
          onClick={() => {
            throw new Error('Sentry Frontend Error');
          }}
        >
          Throw client error
        </button>

        <button
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium"
          type="button"
          onClick={() => void triggerApiError()}
        >
          Trigger API error
        </button>
      </div>

      {apiStatus ? <p className="text-sm text-neutral-600">API response: {apiStatus}</p> : null}

      <Link className="text-sm underline" href="/">
        Back to home
      </Link>
    </main>
  );
}
