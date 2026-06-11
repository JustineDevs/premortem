import { PrismaClient } from '@prisma/client';

import { applySupabaseDatabaseEnv } from './supabase-database-url';

applySupabaseDatabaseEnv();

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['warn', 'error']
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
