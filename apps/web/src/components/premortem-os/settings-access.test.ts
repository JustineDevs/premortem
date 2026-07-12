import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveSettingsAccess } from './settings-access';

test('member can access billing and AI models only', () => {
  const access = resolveSettingsAccess('member');
  assert.equal(access.canManageOrganization, false);
  assert.equal(access.canAccessMemberSettings, true);
});

test('admin can access all workspace settings', () => {
  const access = resolveSettingsAccess('admin');
  assert.equal(access.canManageOrganization, true);
  assert.equal(access.canAccessMemberSettings, true);
});

test('paid member remains a member and cannot manage organization settings', () => {
  const access = resolveSettingsAccess('member');
  assert.equal(access.effectiveRole, 'member');
  assert.equal(access.canManageOrganization, false);
  assert.equal(access.canAccessMemberSettings, true);
  assert.equal(access.canManageModelSettings, false);
});
