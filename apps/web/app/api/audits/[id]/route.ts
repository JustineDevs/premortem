import { NextResponse } from 'next/server';
import { getAuditById } from '@/lib/premortem-os/store';

export async function GET(_request: Request, context: { params: { id: string } }) {
  const audit = getAuditById(context.params.id);

  if (!audit) {
    return NextResponse.json({ error: 'Audit not found' }, { status: 404 });
  }

  return NextResponse.json(audit);
}
