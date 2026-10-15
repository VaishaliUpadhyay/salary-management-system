import { PrismaClient } from '@prisma/client';

// Use the restricted runtime account, never the migration/seed account.
export const prisma = new PrismaClient();
