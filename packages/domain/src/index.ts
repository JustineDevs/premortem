/**
 * Premortem domain semantics: single source of truth for cross-layer vocabulary.
 *
 * Persistence enums mirror Prisma schema values in packages/db/prisma/schema.prisma.
 * Runtime read models live in @premortem/orchestrator (AuditRunSnapshot).
 * Console projections map runtime → /app view models via console-projection.ts.
 */
export * from './fixtures';
export * from './audit-events';
export * from './audit-checkpoint';
export * from './review';
export * from './status';
export * from './severity';
export * from './console-projection';
export * from './work-item-attributes';
export * from './audit-lanes';
export * from './production-mode';
export * from './llm-defaults';
