export function resolveSettingsAccess(workspaceRole: string) {
  const normalizedRole = workspaceRole.toLowerCase();
  const canManageOrganization = normalizedRole === 'owner' || normalizedRole === 'admin';
  const canAccessMemberSettings =
    normalizedRole === 'owner' ||
    normalizedRole === 'admin' ||
    normalizedRole === 'billing' ||
    normalizedRole === 'member';

  return {
    effectiveRole: normalizedRole,
    canManageOrganization,
    canAccessMemberSettings,
    canManageModelSettings: canManageOrganization
  };
}
