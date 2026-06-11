import { NextResponse } from 'next/server';

import { fetchRuntimeProjects } from '@/lib/premortem-api/client';
import { mapRuntimeProject } from '@/lib/premortem-api/map-runtime-to-console';
import { actorHeaders, resolveRequestActorContext } from '@/lib/server/request-context';
import { proxyPremortemApiOrUnauthorized } from '@/lib/server/proxy-api';

export async function GET() {
  try {
    const context = await resolveRequestActorContext();
    const headers = actorHeaders(context);
    const projects = await fetchRuntimeProjects(headers);
    return NextResponse.json(projects.map((project) => mapRuntimeProject(project as Record<string, unknown>)));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load projects' },
      { status: error instanceof Error && error.message === 'Unauthorized' ? 401 : 502 }
    );
  }
}

export async function POST(request: Request) {
  const body = await request.json();
  const response = await proxyPremortemApiOrUnauthorized(
    '/api/projects',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    },
    request
  );

  if (response.status >= 400) {
    return response;
  }

  const payload = await response.json();
  return NextResponse.json(mapRuntimeProject(payload as Record<string, unknown>));
}
