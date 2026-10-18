import { validationMessage } from './validation-messages.js';
import { z } from 'zod';
import { ApiError } from './errors.js';

export function parse<T extends z.ZodType>(schema: T, value: unknown, status = 422): z.output<T> {
  const result = schema.safeParse(value);
  if (!result.success) throw new ApiError(status, 'VALIDATION_ERROR', 'Please check the information you entered.',
    result.error.issues.map(issue => ({ field: issue.path.join('.'), code: issue.code, message: validationMessage(issue) })));
  return result.data;
}
export const id = z.number().int().positive().max(4294967295);
export const queryId = z.string().regex(/^[1-9]\d*$/).transform(Number).pipe(id);
export const dateOnly = z.string().regex(/^[1-9]\d{3}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, 'Must be a real calendar date in YYYY-MM-DD format');
export const toDate = (value: string) => new Date(`${value}T00:00:00.000Z`);
export const day = (date: Date) => date.toISOString().slice(0, 10);
export const pagination = {
  page: z.string().regex(/^[1-9]\d*$/).transform(Number).pipe(z.number().int().max(21474836)).default(1),
  pageSize: z.string().regex(/^[1-9]\d*$/).transform(Number).pipe(z.number().int().min(1).max(100)).default(25),
};
export const pageInfo = (page: number, pageSize: number, total: number) => ({ page, pageSize, total, totalPages: Math.ceil(total / pageSize) });
