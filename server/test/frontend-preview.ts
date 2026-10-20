// Browser-test host only. No Prisma client, credentials, or database connection.
import type { PrismaClient } from '@prisma/client';
import { fileURLToPath } from 'node:url';
import { createApp } from '../src/app.js';
if (process.env.QA_PRODUCTION_UI !== '1') throw new Error('Browser test opt-in required');
createApp({
  db: {} as PrismaClient,
  origin: 'http://127.0.0.1:5174',
  production: true,
  frontendDirectory: fileURLToPath(new URL('../../client/dist/', import.meta.url)),
}).listen(5174, '127.0.0.1');
