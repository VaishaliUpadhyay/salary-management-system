import { Prisma } from '@prisma/client';
import type { ErrorRequestHandler } from 'express';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string,
    public details: { field?: string; code: string; message: string }[] = []) { super(message); }
}

export const errorHandler: ErrorRequestHandler = (error: unknown, req, res, _next) => {
  void _next; // Express identifies error middleware by its four arguments.
  let failure = error instanceof ApiError ? error : undefined;
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const target = String(error.meta?.target ?? '');
    if (error.code === 'P2002') {
      const salary = target.includes('effective_date') || target.includes('effectiveDate');
      const employee = target.includes('employee_code') || target.includes('employeeCode');
      failure = new ApiError(409, salary ? 'SALARY_DATE_CONFLICT' : employee ? 'EMPLOYEE_CODE_EXISTS' : 'UNIQUE_CONFLICT', 'A record with this unique key already exists');
    } else if (error.code === 'P2003') failure = new ApiError(409, 'REFERENCE_CONFLICT', 'A referenced record is unavailable');
    else if (error.code === 'P2025') failure = new ApiError(404, 'NOT_FOUND', 'Record not found');
    else if (['P2024', 'P2034', 'P2028'].includes(error.code)) failure = new ApiError(503, 'DATABASE_BUSY', 'Database temporarily unavailable; retry the request');
  }
  if (error instanceof Prisma.PrismaClientInitializationError) failure = new ApiError(503, 'DATABASE_UNAVAILABLE', 'Database temporarily unavailable');
  if (typeof error === 'object' && error !== null && 'type' in error) {
    if (error.type === 'entity.parse.failed') failure = new ApiError(400, 'INVALID_JSON', 'Malformed JSON body');
    if (error.type === 'entity.too.large') failure = new ApiError(413, 'BODY_TOO_LARGE', 'Request body exceeds 64 KiB');
  }
  failure ??= new ApiError(500, 'INTERNAL_ERROR', "We couldn't complete your request. Please try again.");
  if (failure.status === 503) res.setHeader('Retry-After', '1');
  if (failure.status >= 500) console.error(JSON.stringify({
    event: 'api_failure', requestId: req.requestId, status: failure.status,
    route: typeof req.route?.path === 'string' ? req.route.path : 'unmatched',
    method: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT', 'HEAD', 'OPTIONS'].includes(req.method) ? req.method : 'other',
    code: failure.code,
    category: error instanceof Prisma.PrismaClientKnownRequestError ? 'database_request'
      : error instanceof Prisma.PrismaClientInitializationError ? 'database_connection' : 'application',
    ...(error instanceof Prisma.PrismaClientKnownRequestError && /^P\d{4}$/.test(error.code) ? { databaseCode: error.code } : {}),
  }));
  // Never serialize/log the original error: Prisma errors can contain salary inputs.
  res.status(failure.status).json({ error: { code: failure.code, message: failure.message, details: failure.details, requestId: req.requestId } });
};
