import 'dotenv/config';
import { Prisma, PrismaClient } from '@prisma/client';
import { reportSql } from '../src/modules/analytics/repository.js';
import { analyticsQuery } from '../src/modules/analytics/schemas.js';
import { day, toDate } from '../src/lib/validation.js';
const db = new PrismaClient();
try {
  const today = toDate(day(new Date()));
  const rates = await db.$queryRaw<{ code: string; rate: Prisma.Decimal }[]>`SELECT r.currency_code code, r.units_per_usd rate FROM exchange_rates r JOIN (SELECT currency_code,MAX(effective_date) effective_date FROM exchange_rates WHERE effective_date<=${today} GROUP BY currency_code) l ON l.currency_code=r.currency_code AND l.effective_date=r.effective_date`;
  const rows = await db.$queryRaw(Prisma.sql`EXPLAIN ANALYZE ${reportSql(analyticsQuery.parse({ reportingCurrency: 'USD', groupBy: 'department' }), today, new Map(rates.map(r => [r.code, r.rate])))}`);
  console.log(JSON.stringify(rows, null, 2));
} finally { await db.$disconnect(); }
