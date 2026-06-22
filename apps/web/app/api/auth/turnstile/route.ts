import { NextResponse, type NextRequest } from 'next/server';

import { bffErrorResponse } from '@/lib/server/bff-errors';
import { verifyTurnstileToken } from '@/lib/server/turnstile';

async function readTurnstileToken(request: NextRequest): Promise<string | null> {
  const contentType = request.headers.get('content-type')?.toLowerCase() ?? '';

  if (
    contentType.includes('multipart/form-data') ||
    contentType.includes('application/x-www-form-urlencoded')
  ) {
    const formData = await request.formData().catch(() => null);
    if (formData) {
      const value = formData.get('cf-turnstile-response') ?? formData.get('turnstileToken');
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }
  }

  if (contentType.includes('application/json')) {
    const json = await request.json().catch(() => null);
    if (json && typeof json === 'object' && !Array.isArray(json)) {
      const record = json as Record<string, unknown>;
      const token = record.turnstileToken ?? record['cf-turnstile-response'];
      if (typeof token === 'string' && token.trim()) {
        return token.trim();
      }
    }
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const token = await readTurnstileToken(request);
    const validation = await verifyTurnstileToken(token ?? '', request);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          reason: validation.reason,
          errorCodes: validation.errorCodes ?? []
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return bffErrorResponse(error, 'Failed to verify Turnstile token');
  }
}
