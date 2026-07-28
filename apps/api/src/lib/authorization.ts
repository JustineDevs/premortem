import type { AppRole } from '@premortem/db';
export {
  BILLING_ROLES,
  ORG_ADMIN_ROLES,
  ORG_WRITE_ROLES,
  PROFILE_EDIT_ROLES
} from '@premortem/mcp';
import type { ApiActorContext } from './request-context.js';

export class ApiForbiddenError extends Error {
  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'ApiForbiddenError';
  }
}

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
