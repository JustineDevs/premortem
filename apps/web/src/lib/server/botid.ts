import { checkBotId } from 'botid/server';

function isLoopbackHost(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

export function getBotIdEnabledFlag() {
  return process.env.PREMORTEM_BOTID_ENABLED === '1';
}

export function isBotIdConfigured() {
  return getBotIdEnabledFlag();
}

export function isBotIdEnabled() {
  return getBotIdEnabledFlag();
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
