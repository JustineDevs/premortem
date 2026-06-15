import { NextResponse } from 'next/server';

import { editRuntimeIssue } from '@/lib/premortem-api/client';
import { actorHeaders, resolveRequestActorContext } from '@/lib/server/request-context';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; issueId: string }> }
) {
  const { id, issueId } = await params;
  const body = (await request.json()) as {
    title?: string;
    whyItMatters?: string;
    recommendedActionSummary?: string;
    description?: string;
    notes?: string;
  };

  const fields = {
    title: body.title,
    whyItMatters: body.whyItMatters,
    recommendedActionSummary: body.recommendedActionSummary ?? body.description,
    notes: body.notes
  };

  const hasFields = Object.values(fields).some((value) => typeof value === 'string' && value.length > 0);
  if (!hasFields) {
    return NextResponse.json({ error: 'At least one field is required' }, { status: 400 });
  }

  try {
    const context = await resolveRequestActorContext(request);
    await editRuntimeIssue(issueId, fields, actorHeaders(context));
    return NextResponse.json({
      success: true,
      auditId: id,
      issueId
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Edit failed' },
      { status: 502 }
    );
  }
}
