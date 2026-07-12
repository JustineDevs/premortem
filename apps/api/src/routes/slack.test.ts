import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';

import { handleSlackEventsPost } from './slack';

function signSlackPayload(secret: string, timestamp: string, rawBody: string) {
  const digest = crypto.createHmac('sha256', secret).update(`v0:${timestamp}:${rawBody}`).digest('hex');
  return `v0=${digest}`;
}

function withSlackSigningSecret(secret: string, run: () => Promise<void> | void) {
  const previous = process.env.SLACK_SIGNING_SECRET;
  process.env.SLACK_SIGNING_SECRET = secret;

  return Promise.resolve(run()).finally(() => {
    if (typeof previous === 'string') {
      process.env.SLACK_SIGNING_SECRET = previous;
      return;
    }
    delete process.env.SLACK_SIGNING_SECRET;
  });
}

test('handleSlackEventsPost returns the Slack verification challenge', async () => {
  await withSlackSigningSecret('test-signing-secret', async () => {
    const rawBody = JSON.stringify({
      type: 'url_verification',
      challenge: 'challenge-token'
    });
    const timestamp = `${Math.floor(Date.now() / 1000)}`;
    const request = new Request('http://localhost/api/slack/events', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-slack-signature': signSlackPayload('test-signing-secret', timestamp, rawBody),
        'x-slack-request-timestamp': timestamp
      },
      body: rawBody
    });

    const response = await handleSlackEventsPost(request);
    assert.equal(response.status, 200);
    assert.equal(await response.text(), '{"challenge":"challenge-token"}');
  });
});

test('handleSlackEventsPost rejects invalid Slack signatures', async () => {
  await withSlackSigningSecret('test-signing-secret', async () => {
    const rawBody = JSON.stringify({
      type: 'url_verification',
      challenge: 'challenge-token'
    });
    const timestamp = `${Math.floor(Date.now() / 1000)}`;
    const request = new Request('http://localhost/api/slack/events', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-slack-signature': 'v0=invalid',
        'x-slack-request-timestamp': timestamp
      },
      body: rawBody
    });

    const response = await handleSlackEventsPost(request);
    assert.equal(response.status, 401);
  });
});
