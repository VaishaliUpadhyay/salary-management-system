import { Prisma, type PrismaClient } from '@prisma/client';

export async function verifyRuntimePermissions(db: PrismaClient) {
  // EXPLAIN checks the statement's privileges without modifying any row.
  for (const sql of [
    'EXPLAIN UPDATE salary_records SET amount = amount WHERE 1 = 0',
    'EXPLAIN DELETE FROM salary_records WHERE 1 = 0',
  ]) {
    let denied = false;
    try { await db.$queryRawUnsafe(sql); } catch (error) {
      denied = error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2010' && String(error.meta?.code) === '1142';
      if (!denied) throw new Error('Unable to verify runtime salary permissions', { cause: error });
    }
    if (!denied) throw new Error('Unsafe DATABASE_URL: runtime must not UPDATE or DELETE salary history');
  }
}
