import express from 'express';
import request from 'supertest';
import { Prisma } from '@prisma/client';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { errorHandler } from '../src/lib/errors.js';
import { parse } from '../src/lib/validation.js';
import { createEmployeeInput } from '../src/modules/employees/schemas.js';
import { analyticsQuery } from '../src/modules/analytics/schemas.js';

afterEach(() => vi.restoreAllMocks());
describe('safe API errors', () => {
  it('keeps validation fields/codes but replaces raw validator diagnostics', () => {
    try { parse(createEmployeeInput, { employeeCode: '!', name: '', email: 'bad', countryId: -1, designationId: -1, hireDate: 'bad', initialSalary: {amount:'bad', currencyCode:'!', effectiveDate:'bad'} }); throw new Error('Expected validation'); }
    catch(error) {
      expect(error).toMatchObject({ code:'VALIDATION_ERROR', message:'Please check the information you entered.' });
      const details = (error as { details: {field:string;code:string;message:string}[] }).details;
      expect(details.length).toBeGreaterThan(5);
      expect(details).toContainEqual(expect.objectContaining({field:'initialSalary.amount',code:'invalid_format',message:expect.stringContaining('non-negative salary')}));
      expect(JSON.stringify(details)).not.toMatch(/regex|pattern|Too small|Invalid string|Prisma/);
    }
  });
  it('explains invalid boundaries without changing acceptance rules', () => {
    expect(() => parse(analyticsQuery, {reportingCurrency:'USD',bucketBoundaries:'1,0'})).toThrow('Please check');
    try { parse(analyticsQuery, {reportingCurrency:'USD',bucketBoundaries:'1,0'}); } catch(error) {
      expect(error).toMatchObject({ details:[expect.objectContaining({field:'bucketBoundaries',code:'custom',message:expect.stringContaining('start at 0')})] });
    }
  });
  it.each([
    [new Error('SELECT secret password, salary FROM private_table'), 500, 'INTERNAL_ERROR'],
    [new Prisma.PrismaClientKnownRequestError('secret SQL', {code:'P2024',clientVersion:'6'}), 503, 'DATABASE_BUSY'],
    [new Prisma.PrismaClientKnownRequestError('secret SQL', {code:'P2002',clientVersion:'6',meta:{target:'employee_code'}}), 409, 'EMPLOYEE_CODE_EXISTS'],
  ])('sanitizes server failures and logs only safe correlation metadata', async (error, status, code) => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const app = express();
    app.use((req,_res,next)=>{ req.requestId='safe-request'; next(); });
    app.get('/',()=>{throw error;}); app.use(errorHandler);
    const result=await request(app).get('/');
    expect(result.status).toBe(status);
    expect(result.body.error).toMatchObject({code,requestId:'safe-request'});
    expect(JSON.stringify(result.body)).not.toMatch(/secret|SELECT|private_table|Prisma/);
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/secret|SELECT|private_table|salary/);
    if (status >= 500) expect(log).toHaveBeenCalledWith(expect.stringContaining('safe-request'));
  });
});
