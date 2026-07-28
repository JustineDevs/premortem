import { checkBotId } from 'botid/server';

function isLoopbackHost(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

export function isBotIdConfigured() {
  return process.env.NODE_ENV === 'production';
}

export function isBotIdEnabled() {
  return process.env.NODE_ENV === 'production';
}

export function shouldEnforceBotId(request?: Request) {
  if (!isBotIdEnabled()) {
    return false;
  }

  if (!request) {
    return true;
  }

  try {
    return !isLoopbackHost(new URL(request.url).hostname);
  } catch {
    return true;
  }
}

export async function verifyBotId(request?: Request) {
  if (!shouldEnforceBotId(request)) {
    return { isBot: false as const };
  }

  return checkBotId();
}
