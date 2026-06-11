/**
 * Smoke-only IDs when PREMORTEM_AUTH_DISABLED=1 (pnpm smoke:* / CI).
 * Real users use Supabase auth user.id as profileId and onboard via createPersonalWorkspaceForProfile.
 */
export const LOCAL_DEV_FIXTURE = {
  profileId: '7f9458c3-1b8d-4f4d-a6e4-9f2333b3d821',
  organizationId: 'd86ad1f2-c720-4f54-8584-9e953dd527cb',
  projectId: 'f28e9bd2-5673-45d2-a97f-55a0b174e751',
  email: 'smoke-runner@premortem.local',
  username: 'premortem-smoke',
  organizationSlug: 'jstn-studio-local',
  projectSlug: 'meta-architect'
} as const;
