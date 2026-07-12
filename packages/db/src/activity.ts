import { prisma } from './client';

export async function archiveProjectsOverLimit(organizationId: string, maxRepos: number) {
  const projectsToArchive = await prisma.project.findMany({
    where: { organizationId, status: 'active' },
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
    skip: maxRepos,
    select: { id: true }
  });

  if (projectsToArchive.length === 0) {
    return { archivedCount: 0 };
  }

  await prisma.project.updateMany({
    where: { id: { in: projectsToArchive.map((project) => project.id) } },
    data: { status: 'archived' }
  });

  return { archivedCount: projectsToArchive.length };
}

export async function recordActivityEvent(input: {
  organizationId: string;
  actorId?: string;
  eventType: string;
  objectType: string;
  summary: string;
  projectId?: string;
  objectId?: string;
}) {
  return prisma.activityEvent.create({
    data: {
      organizationId: input.organizationId,
      actorId: input.actorId,
      eventType: input.eventType,
      objectType: input.objectType,
      summary: input.summary,
      projectId: input.projectId,
      objectId: input.objectId
    }
  });
}
