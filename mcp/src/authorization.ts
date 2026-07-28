import type { AppRole } from '@premortem/db';

export const ORG_WRITE_ROLES: AppRole[] = ['owner', 'admin', 'member'];
export const ORG_ADMIN_ROLES: AppRole[] = ['owner', 'admin'];
export const BILLING_ROLES: AppRole[] = ['owner', 'admin', 'billing'];
export const PROFILE_EDIT_ROLES: AppRole[] = ['owner', 'admin', 'member', 'billing'];
