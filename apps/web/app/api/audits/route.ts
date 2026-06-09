import { NextResponse } from 'next/server';
import { getAudits } from '@/lib/premortem-os/store';

export async function GET() {
  return NextResponse.json(getAudits());
}
