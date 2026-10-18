import { ApiError } from './api';

export const lookup = (values: Record<string, string>, key: string) => Object.hasOwn(values, key) ? values[key] : undefined;

export const fallbackMessage = "We couldn't complete your request. Please try again.";
export const fieldLabels: Record<string, string> = {
  employeeCode: 'Employee code', name: 'Full name', email: 'Email address', password: 'Password',
  countryId: 'Country', departmentId: 'Department', designationId: 'Designation', hireDate: 'Hire date',
  amount: 'Annual salary', currencyCode: 'Salary currency', effectiveDate: 'Effective date',
  reportingCurrency: 'Reporting currency', reportingDate: 'FX reporting date', bucketBoundaries: 'Salary ranges',
  includeInactive: 'Employee status', status: 'Employee status', groupBy: 'Breakdown', q: 'Name search',
  page: 'Page', pageSize: 'Results per page', scope: 'Salary history', sort: 'Sort field', order: 'Sort order',
  file: 'CSV file', initialSalary: 'Initial salary', id: 'Employee',
};
export const fieldGuidance: Record<string, string> = {
  employeeCode: 'Enter an employee code of 1–50 letters, numbers, hyphens or underscores.',
  name: 'Enter a name between 1 and 150 characters.',
  email: 'Enter a valid email address, no longer than 254 characters.',
  password: 'Enter your password (up to 128 characters).',
  countryId: 'Choose an available country.', departmentId: 'Choose an available department.',
  designationId: 'Choose an available designation belonging to the selected department.',
  hireDate: 'Enter a valid hire date in YYYY-MM-DD format.',
  effectiveDate: 'Enter a valid effective date in YYYY-MM-DD format.',
  amount: 'Enter a non-negative salary with at most 13 digits before the decimal point and two decimal places.',
  currencyCode: 'Choose a supported, active salary currency.', reportingCurrency: 'Choose a supported, active reporting currency.',
  reportingDate: 'Enter a valid FX reporting date on or before today (UTC).',
  bucketBoundaries: 'Salary ranges must start at 0, and each subsequent value must be greater than the previous one. Use 1–20 comma-separated non-negative amounts with at most two decimal places.',
  includeInactive: 'Choose whether to include inactive employees.', status: 'Choose active, inactive or all employees.',
  groupBy: 'Choose country, department or designation for the breakdown.', q: 'Enter a name search of 1–100 characters.',
  page: 'Choose a valid page of results.', pageSize: 'Choose between 1 and 100 results per page.',
  scope: 'Choose all, current, historical or future salary revisions.', sort: 'Choose employee code, name or hire date for sorting.',
  order: 'Choose ascending or descending order.', file: 'Select a non-empty UTF-8 .csv file no larger than 5 MiB.',
};
export const messages: Record<string, string> = {
  VALIDATION_ERROR: 'Please check the information you entered.',
  INVALID_CREDENTIALS: 'Invalid email or password. Please try again.',
  UNAUTHENTICATED: 'Please sign in again to continue. Your session may have expired.',
  LOGIN_RATE_LIMITED: 'Too many sign-in attempts. Please wait before trying again.',
  ORIGIN_REJECTED: "We couldn't complete your request. Please refresh the page and try again. If this continues, check that you opened the correct application address.",
  CSRF_REJECTED: 'Your security verification could not be completed. Refresh the page and try again.',
  EMPLOYEE_NOT_FOUND: 'This employee is no longer available. Return to the employee list and refresh it.',
  NOT_FOUND: 'The requested information is not available. Refresh the page or return to the employee list.',
  EMPLOYEE_CODE_EXISTS: 'This employee code is already in use. Choose a different code or open the existing employee.',
  UNIQUE_CONFLICT: 'A matching record already exists. Refresh and check the existing information before trying again.',
  REFERENCE_CONFLICT: 'The selected value is no longer available. Refresh and choose another option.',
  UNKNOWN_REFERENCE: 'The selected value is not available. Please choose another option.',
  INVALID_REFERENCE: 'One or more selected values are unavailable. Check the highlighted fields.',
  UNKNOWN_FILTER: 'One or more filters are unavailable. Reset the filters or choose another option.',
  INVALID_COUNTRY: 'Choose an active country available in the system.',
  INVALID_DESIGNATION: 'Choose an active designation in an active department.',
  UNSUPPORTED_CURRENCY: 'This currency is unavailable. Choose a supported, active currency.',
  EMPLOYEE_INACTIVE: 'This employee is inactive. New salary revisions cannot be added; existing salary history is preserved.',
  SALARY_DATE_CONFLICT: 'A salary revision already exists for this effective date. Review salary history and choose a different date; existing records cannot be overwritten.',
  SALARY_BEFORE_HIRE_DATE: 'The salary effective date cannot be earlier than the hire date. Use a date on or after the hire date.',
  HIRE_DATE_CONFLICTS_WITH_SALARY: 'The hire date would invalidate existing salary history. Choose a date on or before the earliest salary revision.',
  INVALID_AMOUNT: fieldGuidance.amount!,
  FUTURE_REPORTING_DATE: 'The FX reporting date cannot be in the future. Choose today or an earlier date (UTC).',
  MISSING_EXCHANGE_RATES: 'This report is unavailable because required exchange rates are missing. Choose a date with available rates or ask the administrator to check rate coverage.',
  REPORT_NUMERIC_RANGE_EXCEEDED: 'This report exceeds the supported numerical range. Narrow the filters, reduce large salary boundaries or choose another reporting currency.',
  REPORT_CONFIGURATION_ERROR: 'Reporting is temporarily unavailable. Please try again later; contact the administrator if it continues.',
  DATABASE_BUSY: 'The service is busy. Check whether your change was saved before trying again.',
  DATABASE_UNAVAILABLE: 'The service is temporarily unavailable. Please try again later.',
  INVALID_JSON: "The request could not be read. Refresh the page and try again.",
  BODY_TOO_LARGE: 'Too much information was submitted. Reduce the request size and try again.',
  UNSUPPORTED_MEDIA_TYPE: 'The request format is not supported. Refresh the page and try again.',
  FILE_TOO_LARGE: 'The file is too large. Choose a CSV file no larger than 5 MiB.',
  TOO_MANY_ROWS: 'The file has too many rows. Split it into files of no more than 10,000 data rows.',
  UNSUPPORTED_FILE: 'This file type is not supported. Save your data as a UTF-8 .csv file and select it again.',
  INVALID_MULTIPART: 'The upload could not be read. Select your CSV file again and retry.',
  INVALID_CSV: 'The CSV file could not be read. Check its UTF-8 encoding, quoted fields and column counts, then upload it again.',
  INVALID_HEADERS: 'The CSV headers do not match the template. Include all ten required columns exactly once and remove extra columns.',
  EMPTY_CSV: 'The CSV file has no employee rows. Add at least one row below the required headers.',
  UPLOAD_INTERRUPTED: 'The upload was interrupted. Check your connection, select the file again and retry.',
  FILE_REQUIRED: 'Select a CSV file to import.',
  IMPORT_INCOMPLETE: 'Import processing was interrupted. Completed rows remain saved. Review the partial results before reimporting the same file.',
  NETWORK_ERROR: 'Unable to connect. Check your connection and try again.',
  NETWORK_WRITE_ERROR: 'Connection interrupted. Check whether your change was saved before trying again.',
  INVALID_RESPONSE: fallbackMessage,
  INVALID_WRITE_RESPONSE: 'The response could not be read. Check whether your change was saved before trying again.',
};
const domainFields: Record<string, string> = {
  EMPLOYEE_CODE_EXISTS: 'employeeCode', INVALID_COUNTRY: 'countryId', INVALID_DESIGNATION: 'designationId',
  SALARY_DATE_CONFLICT: 'effectiveDate', SALARY_BEFORE_HIRE_DATE: 'effectiveDate',
  HIRE_DATE_CONFLICTS_WITH_SALARY: 'hireDate', FUTURE_REPORTING_DATE: 'reportingDate', INVALID_AMOUNT: 'amount',
};
export class InputError extends Error {
  constructor(public field: string, public guidance: string) { super('Please check the information you entered.'); }
}
export function presentation(error: unknown) {
  if (error instanceof InputError) return { title: error.message, fields: [{ field: error.field, label: lookup(fieldLabels, error.field) ?? 'Information', message: error.guidance }], requestId: undefined };
  if (!(error instanceof ApiError)) return { title: fallbackMessage, fields: [], requestId: undefined };
  const title = lookup(messages, error.code) ?? (error.status === 403 ? 'This action is unavailable for your account.' : error.status === 401 ? messages.UNAUTHENTICATED! : error.status === 429 ? 'Too many requests. Please wait before trying again.' : fallbackMessage);
  // Only validation/reference details are field guidance. FX metadata and internal diagnostics are not form errors.
  const details = ['VALIDATION_ERROR', 'UNKNOWN_FILTER', 'INVALID_REFERENCE'].includes(error.code) ? error.details : [];
  const fields = details.map(d => {
    const field = d.field?.split('.').at(-1) ?? '';
    return { field, label: lookup(fieldLabels, field) ?? 'Information', message: d.code === 'unrecognized_keys' ? 'Remove unsupported fields and try again.' : lookup(fieldGuidance, field) ?? 'Check this value and try again.' };
  });
  const field = lookup(domainFields, error.code);
  if (field) fields.push({ field, label: lookup(fieldLabels, field)!, message: title });
  return { title, fields: fields.filter((f, i) => fields.findIndex(other => other.field === f.field && other.message === f.message) === i), requestId: error.requestId };
}
