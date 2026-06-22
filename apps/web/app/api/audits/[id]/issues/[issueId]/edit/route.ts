import { NextResponse } from 'next/server';

import { editRuntimeIssue } from '@/lib/premortem-api/client';
import { bffErrorResponse } from '@/lib/server/bff-errors';
import { actorHeaders, resolveRequestActorContext } from '@/lib/server/request-context';
import { readJsonRecord, readOptionalString } from '@/lib/server/request-body';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; issueId: string }> }
) {
  const { id, issueId } = await params;
  const body = (await readJsonRecord(request)) ?? {};

  const fields = {
    title: readOptionalString(body, 'title'),
    whyItMatters: readOptionalString(body, 'whyItMatters'),
    recommendedActionSummary: readOptionalString(body, 'recommendedActionSummary') ?? readOptionalString(body, 'description'),
    notes: readOptionalString(body, 'notes')
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
    return bffErrorResponse(error, 'Edit failed');
  }
}
