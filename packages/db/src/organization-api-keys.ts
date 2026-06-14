import { randomBytes, scryptSync } from 'node:crypto';

import type { OrganizationApiKey } from '@prisma/client';

import { prisma } from './client';

export interface OrganizationApiKeySummary {
  id: string;
  label: string;
  keyPrefix: string;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}

export interface OrganizationApiKeyVerification {
  organizationId: string;
  profileId: string;
  keyId: string;
  label: string;
}

function hashOrganizationApiKey(token: string) {
  return scryptSync(token, 'premortem-organization-api-key', 32).toString('hex');
}

function buildOrganizationApiKeyToken() {
  const prefix = randomBytes(4).toString('hex');
  const secret = randomBytes(24).toString('hex');
  const keyPrefix = `pmk_${prefix}`;
  const token = `${keyPrefix}_${secret}`;
  return { keyPrefix, token, keyHash: hashOrganizationApiKey(token) };
}

function summarizeOrganizationApiKey(key: OrganizationApiKey): OrganizationApiKeySummary {
  return {
    id: key.id,
    label: key.label,
    keyPrefix: key.keyPrefix,
    lastUsedAt: key.lastUsedAt,
    revokedAt: key.revokedAt,
    createdAt: key.createdAt
  };
}

export async function listOrganizationApiKeys(
  organizationId: string
): Promise<OrganizationApiKeySummary[]> {
  const keys = await prisma.organizationApiKey.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' }
  });
  return keys.map(summarizeOrganizationApiKey);
}

export async function createOrganizationApiKey(input: {
  organizationId: string;
  createdById: string;
  label: string;
}) {
  const { keyPrefix, token, keyHash } = buildOrganizationApiKeyToken();
  const key = await prisma.organizationApiKey.create({
    data: {
      organizationId: input.organizationId,
      createdById: input.createdById,
      label: input.label.trim(),
      keyPrefix,
      keyHash
    }
  });

  return {
    apiKey: token,
    key: summarizeOrganizationApiKey(key)
  };
}

export async function revokeOrganizationApiKey(input: {
  organizationId: string;
  keyId: string;
}) {
  const key = await prisma.organizationApiKey.updateMany({
    where: {
      id: input.keyId,
      organizationId: input.organizationId,
      revokedAt: null
    },
    data: { revokedAt: new Date() }
  });

  return key;
}

export async function verifyOrganizationApiKey(token: string): Promise<OrganizationApiKeyVerification | null> {
  const normalized = token.trim();
  if (!normalized) return null;

  const hash = hashOrganizationApiKey(normalized);
  const prefixMatch = normalized.match(/^(pmk_[a-f0-9]{8})_[a-f0-9]+$/i);
  const keyPrefix = prefixMatch?.[1];

  const keys = await prisma.organizationApiKey.findMany({
    where: {
      ...(keyPrefix ? { keyPrefix } : {}),
      revokedAt: null
    },
    include: {
      organization: true,
      createdBy: true
    }
  });

  const key = keys.find((entry) => entry.keyHash === hash);
  if (!key) return null;

  await prisma.organizationApiKey.update({
    where: { id: key.id },
    data: { lastUsedAt: new Date() }
  });

  return {
    organizationId: key.organizationId,
    profileId: key.createdById,
    keyId: key.id,
    label: key.label
  };
}
