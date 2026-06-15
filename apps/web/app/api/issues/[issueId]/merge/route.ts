import { NextResponse } from 'next/server';

import { mergeRuntimeIssue } from '@/lib/premortem-api/client';
import { bffRateLimitKey, bffRateLimitResponse, checkBffRateLimit } from '@/lib/server/bff-rate-limit';
import { actorHeaders, resolveRequestActorContext } from '@/lib/server/request-context';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ issueId: string }> }
) {
  const { issueId } = await params;
  const path = `/api/issues/${issueId}/merge`;
  if (!checkBffRateLimit(bffRateLimitKey(request, path))) {
    return bffRateLimitResponse();
  }

  try {
    const context = await resolveRequestActorContext();
    const body = (await request.json()) as {
      mergedIntoIssueCandidateId?: string;
      notes?: string;
    };
    const payload = await mergeRuntimeIssue(
      issueId,
      {
        mergedIntoIssueCandidateId: body.mergedIntoIssueCandidateId ?? '',
        notes: body.notes
      },
      actorHeaders(context)
    );
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Merge failed' },
      { status: 502 }
    );
  }
}
