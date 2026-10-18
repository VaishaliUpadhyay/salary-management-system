import type { z } from 'zod';

const labels: Record<string,string> = {
  employee_code:'Employee ID', name:'Name', email:'Email Address', country_code:'Country',
  department_code:'Department', designation_code:'Designation', hire_date:'Hire Date',
  annual_base_salary:'Annual Base Salary', currency_code:'Currency', effective_date:'Salary Effective Date',
};
const fieldMessages: Record<string,string> = {
  employee_code:'Enter an employee ID of 1–50 letters, numbers, hyphens or underscores.',
  name:'Enter a name between 1 and 150 characters.',
  email:'Enter a valid email address (e.g., employee@example.com), no longer than 254 characters.',
  country_code:'Enter a two-letter country code available in the system (e.g., US).',
  department_code:'Enter a valid department code available in the system.',
  designation_code:'Enter a valid designation code for the specified department.',
  hire_date:'Enter a valid hire date in YYYY-MM-DD format (e.g., 2026-10-18).',
  effective_date:'Enter a valid salary effective date in YYYY-MM-DD format (e.g., 2026-10-18).',
  annual_base_salary:'Enter a valid salary amount (e.g., 50000.00). Use no negative amounts, at most 13 digits before the decimal point and up to 2 decimal places.',
  currency_code:'Enter a three-letter currency code available in the system (e.g., USD).',
};
export function fieldIssues(issues: readonly z.core.$ZodIssue[], values: Record<string,string>) {
  const fields = [...new Set(issues.map(issue=>String(issue.path[0] ?? '')))];
  return fields.map(field=>({
    field, code:field==='annual_base_salary'?'INVALID_AMOUNT':'INVALID_FIELD',
    message: !values[field]?.trim() ? `${labels[field] ?? 'This field'} is required. Please provide a value.`
      : (field==='hire_date' || field==='effective_date') && !issues.some(issue=>issue.path[0]===field && issue.code==='invalid_format')
        ? 'This date does not exist or is outside the supported range. Enter a valid calendar date in YYYY-MM-DD format.'
        : fieldMessages[field] ?? 'Check this value and use the format shown in the CSV template.',
  }));
}
export const referenceMessages: Record<string,string> = {
  country_code:'This country is not recognized. Use a country code available in the system.',
  department_code:'This department is not recognized. Use a department code available in the system.',
  designation_code:'This designation is not recognized. Use a designation code for the specified department.',
  currency_code:'This currency is not supported. Use a currency available in the system.',
};
export const domainMessages: Record<string,string> = {
  SALARY_DATE_CONFLICT:'A different salary already exists for this employee and date. Check the amount, currency and effective date; existing salary history cannot be overwritten.',
  EMPLOYEE_INACTIVE:'This employee is inactive. New salary revisions cannot be imported; existing history is preserved.',
  SALARY_BEFORE_HIRE_DATE:'The salary effective date is before the hire date. Use a date on or after the employee’s hire date.',
  UNSUPPORTED_CURRENCY:'This currency is no longer active. Use an active currency available in the system for a new salary.',
  INACTIVE_REFERENCE:'New employees require an active country, department and designation. Check these codes in the system.',
};
