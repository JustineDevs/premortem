import { NextResponse } from 'next/server';
import type { ProviderType } from '@/lib/premortem-os/types';
import { addProject, getProjects } from '@/lib/premortem-os/store';

export async function GET() {
  return NextResponse.json(getProjects());
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    name?: string;
    provider?: ProviderType;
    repoUrl?: string;
    branch?: string;
    scanCodeSnippet?: string;
  };

  const { name, provider, repoUrl, branch, scanCodeSnippet } = body;

  if (!name || !repoUrl) {
    return NextResponse.json({ error: 'Name and Repo URL are required' }, { status: 400 });
  }

  const newProject = addProject({
    id: `proj-${Math.random().toString(36).substring(2, 9)}`,
    name,
    provider: provider || 'github',
    repoUrl,
    branch: branch || 'main',
    status: 'COMPLIANT',
    lastAuditScore: null,
    lastAuditDate: null,
    infrastructureCount: Math.floor(Math.random() * 15) + 3,
    apiEndpointsCount: Math.floor(Math.random() * 25) + 5,
    unencryptedEndpointsCount: 0,
    scanCodeSnippet:
      scanCodeSnippet ||
      `// Sample snippet of your repository code
export function calculateSecrets() {
  return "no-vulnerabilities";
}`
  });

  return NextResponse.json(newProject, { status: 201 });
}
