import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveEffectiveWorkspaceRole } from './workspace';

test('paid workspace owner is elevated to admin access', () => {
  const role = resolveEffectiveWorkspaceRole({
    organization: {
      plan: 'pro',
      createdById: 'profile-123'
    },
    membershipRole: 'member',
    profileId: 'profile-123'
  });

  assert.equal(role, 'admin');
});

test('paid workspace billing contact is elevated to admin access', () => {
  const role = resolveEffectiveWorkspaceRole({
    organization: {
      plan: 'team',
      createdById: 'profile-123'
    },
    membershipRole: 'billing',
    profileId: 'profile-123'
  });

  assert.equal(role, 'admin');
});

test('paid scale workspace member is elevated to admin access', () => {
  const role = resolveEffectiveWorkspaceRole({
    organization: {
      plan: 'scale',
      createdById: 'profile-123'
    },
    membershipRole: 'member',
    profileId: 'profile-456'
  });

  assert.equal(role, 'admin');
});

test('paid workspace member is elevated to admin access', () => {
  const role = resolveEffectiveWorkspaceRole({
    organization: {
      plan: 'pro',
      createdById: 'profile-123'
    },
    membershipRole: 'member',
    profileId: 'profile-456'
  });

  assert.equal(role, 'admin');
});
