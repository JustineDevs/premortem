#!/usr/bin/env node
/**
 * Expose the local Next.js web app for Stripe webhooks via ngrok.
 *
 * Stripe webhook handler lives on the web BFF (not the API worker on :18787):
 *   POST {NGROK_URL}/api/stripe/webhook
 *   POST {NGROK_URL}/api/webhooks/stripe  (alias)
 *
 * Prerequisites:
 *   1. pnpm run dev  (web on PREMORTEM_WEB_PORT, default 13000)
 *   2. NGROK_AUTHTOKEN in .env.local (from https://dashboard.ngrok.com/get-started/your-authtoken)
 *   3. Optional NGROK_DOMAIN for a reserved subdomain (e.g. premortem-dev.ngrok-free.app)
 *
 * Stripe Dashboard → Developers → Webhooks → Add endpoint:
 *   URL: https://<your-ngrok-host>/api/stripe/webhook
 *   Events: checkout.session.completed, customer.subscription.*
 * Copy the signing secret into STRIPE_WEBHOOK_SECRET in .env.local
 *
 * For Checkout success redirects while testing through ngrok, set:
 *   NEXT_PUBLIC_APP_URL=https://<your-ngrok-host>
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadPremortemLocalEnv } from '../load-local-env.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
loadPremortemLocalEnv(repoRoot);

const webPort = process.env.PREMORTEM_WEB_PORT ?? '13000';
const ngrokDomain = process.env.NGROK_DOMAIN?.trim();
const authtoken = process.env.NGROK_AUTHTOKEN?.trim();

if (!authtoken) {
  console.error(
    [
      'Missing NGROK_AUTHTOKEN.',
      'Add to .env.local:',
      '  NGROK_AUTHTOKEN=your_token_from_ngrok_dashboard',
      '',
      'Optional reserved domain:',
      '  NGROK_DOMAIN=your-subdomain.ngrok-free.app',
      '',
      'Alternative (no ngrok): stripe listen --forward-to localhost:' +
        webPort +
        '/api/stripe/webhook'
    ].join('\n')
  );
  process.exit(1);
}

const args = ['http', webPort, '--authtoken', authtoken];
if (ngrokDomain) {
  args.push('--domain', ngrokDomain);
}

console.log(
  JSON.stringify(
    {
      service: 'premortem-ngrok-stripe',
      localWebPort: webPort,
      ngrokDomain: ngrokDomain ?? '(ephemeral: check ngrok TUI for URL)',
      webhookPaths: ['/api/stripe/webhook', '/api/webhooks/stripe'],
      hint: 'Set NEXT_PUBLIC_APP_URL to your ngrok https URL for Checkout return URLs'
    },
    null,
    2
  )
);

const ngrok = spawn('ngrok', args, {
  stdio: 'inherit',
  env: process.env
});

ngrok.on('exit', (code, signal) => {
  if (signal) {
    process.exitCode = 1;
    return;
  }
  process.exitCode = code ?? 0;
});

process.on('SIGINT', () => ngrok.kill('SIGINT'));
process.on('SIGTERM', () => ngrok.kill('SIGTERM'));
