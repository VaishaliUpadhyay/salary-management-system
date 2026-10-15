import { Prisma, type PrismaClient } from '@prisma/client';
import { buildSeedData, EMPLOYEE_COUNT } from './seed-data.js';

export async function assertEmptyDatabase(tx: Prisma.TransactionClient) {
  const counts = await Promise.all([
    tx.department.count(), tx.designation.count(), tx.country.count(), tx.currency.count(),
    tx.employee.count(), tx.salaryRecord.count(), tx.exchangeRate.count(), tx.user.count(), tx.session.count(),
  ]);
  if (counts.some(count => count !== 0)) throw new Error('Seed refused: application tables must all be empty. No records were changed.');
}

function chunks<T>(items: T[], size = 500): T[][] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));
}

export async function seedDatabase(client: PrismaClient, email: string, passwordHash: string) {
  return client.$transaction(async tx => {
    await tx.$executeRaw`SET SESSION time_zone = '+00:00'`;
    // Serializes competing seed runs on this database. All work uses this connection.
    const [{ acquired } = {}] = await tx.$queryRaw<{ acquired: bigint | number | null }[]>`
      SELECT GET_LOCK(SHA2(CONCAT('salary-seed:', DATABASE()), 256), 0) AS acquired`;
    if (Number(acquired) !== 1) throw new Error('Seed refused: another seed run holds the database lock.');
    try {
      return await populateSeed(tx, email, passwordHash);
    } finally {
      await tx.$queryRaw`SELECT RELEASE_LOCK(SHA2(CONCAT('salary-seed:', DATABASE()), 256))`;
    }
  }, { timeout: 120_000, maxWait: 10_000, isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

// Transaction-owned helper also lets integration tests verify all rows then roll back.
export async function populateSeed(tx: Prisma.TransactionClient, email: string, passwordHash: string) {
  const data = buildSeedData();
  await assertEmptyDatabase(tx);
  await tx.department.createMany({ data: data.departments });
  await tx.designation.createMany({ data: data.designations });
  await tx.country.createMany({ data: data.countries });
  await tx.currency.createMany({ data: data.currencies });
  const user = await tx.user.create({ data: { email, passwordHash } });
  await tx.exchangeRate.createMany({ data: data.exchangeRates });
  for (const batch of chunks(data.employees)) await tx.employee.createMany({ data: batch });
  for (const batch of chunks(data.salaries)) {
    await tx.salaryRecord.createMany({ data: batch.map(row => ({ ...row, createdBy: user.id })) });
  }
  // All salaries are inserted while active; only then mark the synthetic inactive cohort.
  await tx.employee.updateMany({ where: { id: { in: data.inactiveIds } }, data: { isActive: false } });
  const employeeCount = await tx.employee.count();
  const salaryCount = await tx.salaryRecord.count();
  if (employeeCount !== EMPLOYEE_COUNT || salaryCount !== data.salaries.length) throw new Error('Seed verification failed; transaction will roll back.');
  return { employeeCount, salaryCount, inactiveCount: data.inactiveIds.length };
}
