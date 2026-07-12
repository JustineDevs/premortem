import { checkBotId } from 'botid/server';

function isLoopbackHost(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

export function shouldEnforceBotId(request?: Request) {
  if (process.env.NODE_ENV !== 'production') {
    return false;
  }

  if (!process.env.NEXT_PUBLIC_BOTID_SITE_KEY || !process.env.BOTID_SECRET_KEY) {
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
