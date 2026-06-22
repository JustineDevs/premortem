import type { AppRole } from '@premortem/db';

import type { ApiActorContext } from './request-context';

export class ApiForbiddenError extends Error {
  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'ApiForbiddenError';
  }
}

export const ORG_WRITE_ROLES: AppRole[] = ['owner', 'admin', 'member'];
export const ORG_ADMIN_ROLES: AppRole[] = ['owner', 'admin'];
export const BILLING_ROLES: AppRole[] = ['owner', 'admin', 'billing'];
export const PROFILE_EDIT_ROLES: AppRole[] = ['owner', 'admin', 'member', 'billing'];

export function hasApiRole(context: Pick<ApiActorContext, 'role'>, allowedRoles: AppRole[]) {
  return allowedRoles.includes(context.role);
}

export function requireApiRole(
  context: Pick<ApiActorContext, 'role'>,
  allowedRoles: AppRole[],
  message = 'Forbidden'
) {
  if (!hasApiRole(context, allowedRoles)) {
    throw new ApiForbiddenError(message);
  }
}
