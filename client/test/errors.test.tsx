import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorNotice, Field } from '../src/components/common';
import { ApiError, api } from '../src/lib/api';
import { presentation, fallbackMessage } from '../src/lib/errors';
import { boundaryIssue } from '../src/lib/format';
import { Dashboard } from '../src/features/analytics/Dashboard';
import { catalog, report } from './fixtures';
import { rowErrorMessage } from '../src/features/imports/report';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
describe('safe structured error presentation', () => {
  it.each([
    ['INVALID_CREDENTIALS', 'Invalid email or password'],
    ['UNAUTHENTICATED', 'sign in again'],
    ['LOGIN_RATE_LIMITED', 'wait before trying again'],
    ['ORIGIN_REJECTED', 'refresh the page'],
    ['CSRF_REJECTED', 'Refresh the page'],
    ['EMPLOYEE_CODE_EXISTS', 'already in use'],
    ['SALARY_DATE_CONFLICT', 'already exists for this effective date'],
    ['SALARY_BEFORE_HIRE_DATE', 'on or after the hire date'],
    ['HIRE_DATE_CONFLICTS_WITH_SALARY', 'earliest salary revision'],
    ['EMPLOYEE_INACTIVE', 'history is preserved'],
    ['UNKNOWN_FILTER', 'Reset the filters'],
    ['MISSING_EXCHANGE_RATES', 'required exchange rates are missing'],
    ['UNSUPPORTED_CURRENCY', 'supported, active currency'],
    ['FUTURE_REPORTING_DATE', 'today or an earlier date'],
    ['REPORT_NUMERIC_RANGE_EXCEEDED', 'supported numerical range'],
    ['DATABASE_UNAVAILABLE', 'temporarily unavailable'],
    ['IMPORT_INCOMPLETE', 'Completed rows remain saved'],
  ])('maps %s without exposing backend text', (code, expected) => {
    render(<ErrorNotice error={new ApiError('Prisma SQL secret regex ^[0-9]$', 422, code, [{ field: 'internal_table_id', message: 'private detail' }])} />);
    expect(screen.getByRole('alert')).toHaveTextContent(expected);
    expect(screen.getByRole('alert')).not.toHaveTextContent(/Prisma|SQL|regex|internal_table_id|private detail/);
  });
  it('handles unknown backend errors and arbitrary exceptions safely', () => {
    for (const error of [new ApiError('SELECT password FROM users', 500, 'NEW_ERROR'), new ApiError('secret', 500, '__proto__'), new Error('secret stack'), null]) expect(presentation(error).title).toBe(fallbackMessage);
  });
  it('distinguishes permission errors from security verification', () => {
    expect(presentation(new ApiError('private', 403, 'NEW_PERMISSION')).title).toContain('unavailable for your account');
  });
  it('renders multiple field errors with readable labels and accessible input guidance', () => {
    const error = new ApiError('Request validation failed', 422, 'VALIDATION_ERROR', [
      { field: 'email', code: 'invalid_format', message: 'regex private' },
      { field: 'initialSalary.amount', code: 'invalid_format', message: 'Prisma secret' },
      { field: 'bucketBoundaries', code: 'custom', message: 'internal boundary' },
    ]);
    render(<><ErrorNotice error={error} /><Field label="Salary" id="salary" error={error}><input name="amount" id="salary" /></Field></>);
    expect(screen.getAllByRole('alert')[0]).toHaveTextContent('Email address: Enter a valid email');
    expect(screen.getAllByRole('alert')[0]).toHaveTextContent('Salary ranges: Salary ranges must start at 0');
    expect(screen.getByLabelText('Salary')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Salary')).toHaveAccessibleDescription(/non-negative salary/);
    expect(screen.queryByText(/Prisma|regex private|Request validation failed|bucketBoundaries/)).not.toBeInTheDocument();
  });
  it('never renders references or troubleshooting controls but retains transport diagnostics', () => {
    const error = new ApiError('secret', 500, 'INTERNAL_ERROR', [], 'debug-reference');
    render(<ErrorNotice error={error} />);
    expect(screen.queryByText(/Technical reference|Troubleshooting|debug-reference|INTERNAL_ERROR/)).not.toBeInTheDocument();
    expect(document.querySelector('details')).toBeNull();
    expect(screen.getByRole('alert')).toHaveTextContent(fallbackMessage);
    expect(error.requestId).toBe('debug-reference');
    expect(error.code).toBe('INTERNAL_ERROR');
  });
  it('renders mapped form errors only beneath inputs, without a duplicate summary', () => {
    const error = new ApiError('private',422,'VALIDATION_ERROR',[
      {field:'email',message:'private'}, {field:'initialSalary.amount',message:'private'},
    ]);
    render(<><ErrorNotice error={error} inlineFields={['email','amount']} />
      <Field label="Email" id="email" error={error}><input id="email" name="email" /></Field>
      <Field label="Salary" id="amount" error={error}><input id="amount" name="amount" /></Field></>);
    expect(screen.getAllByRole('alert')).toHaveLength(2);
    expect(document.querySelector('.error-box')).toBeNull();
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription(/valid email/);
    expect(screen.getAllByText(/Enter a valid email/)).toHaveLength(1);
    expect(screen.getByLabelText('Salary')).toHaveAccessibleDescription(/non-negative salary/);
  });
  it('does not repeat a domain message in both the title and details', () => {
    render(<ErrorNotice error={new ApiError('private',409,'SALARY_DATE_CONFLICT')} />);
    expect(screen.getAllByText(/A salary revision already exists/)).toHaveLength(1);
  });
  it('provides safe CSV row guidance independently of backend message text', () => {
    expect(rowErrorMessage({code:'UNKNOWN_REFERENCE',field:'designation_code'})).toContain('specified department');
    expect(rowErrorMessage({code:'UNKNOWN_PRIVATE_ERROR'})).toContain('Review its values');
  });
});
describe('transport failures', () => {
  it('distinguishes failed reads from uncertain writes without automatic retries', async () => {
    const fetch = vi.fn().mockRejectedValue(new TypeError('private connection address'));
    vi.stubGlobal('fetch', fetch);
    await expect(api('/employees')).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    await expect(api('/employees', { method: 'POST', body: {} })).rejects.toMatchObject({ code: 'NETWORK_WRITE_ERROR' });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('handles malformed response details and keeps a header reference', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 'VALIDATION_ERROR', details: [null, 'secret', {field: 12}, {field:'email',message:'secret'}] } }), { status: 422, headers: {'x-request-id': 'header-id'} })));
    try { await api('/employees'); throw new Error('Expected failure'); } catch(error) {
      expect(presentation(error).fields).toHaveLength(1);
      expect(presentation(error).requestId).toBe('header-id');
    }
  });
  it('warns about uncertain writes when a success response is unreadable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<private>', {status:200})));
    await expect(api('/employees', {method:'POST',body:{}})).rejects.toMatchObject({code:'INVALID_WRITE_RESPONSE'});
  });
  it('handles invalid JSON on a successful response without exposing syntax diagnostics', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<private proxy HTML>', {status:200})));
    await expect(api('/employees')).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
});
describe('salary range input', () => {
  it.each(['', '1,2', '0,2,1', '0,1,1', '0,-1', '0,1.234', '0,1e3', '0, 1', Array.from({length:21},(_,i)=>i).join(',')])('rejects %j locally', value => expect(boundaryIssue(value)).not.toBeNull());
  it('compares values above Number precision exactly', () => {
    expect(boundaryIssue('0,9007199254740992.01,9007199254740992.02')).toBeNull();
    expect(boundaryIssue('0,9007199254740992.02,9007199254740992.01')).not.toBeNull();
  });
  it('blocks invalid submission without changing filters or sending another request', async () => {
    const fetch = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({data:report}))));
    vi.stubGlobal('fetch', fetch);
    render(<Dashboard catalog={catalog} search="" />);
    const user = userEvent.setup();
    await screen.findByText(/People. Pay. Perspective./);
    const input = screen.getByLabelText('Distribution boundaries');
    await user.clear(input); await user.type(input, '0,100,50');
    await user.click(screen.getByRole('button', {name:'Apply boundaries'}));
    expect(screen.getByRole('alert')).toHaveTextContent('Salary ranges must start at 0');
    expect(input).toHaveAccessibleDescription(/greater than the previous/);
    expect(input).toHaveAttribute('aria-invalid','true');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
