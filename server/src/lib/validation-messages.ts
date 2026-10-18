import type { z } from 'zod';

// Explicit schema-field guidance; never interpolate user input or Zod's raw message.
const guidance: Record<string, string> = {
  employeeCode: 'Enter an employee code of 1–50 letters, numbers, hyphens or underscores.',
  name: 'Enter a name between 1 and 150 characters.',
  email: 'Enter a valid email address, no longer than 254 characters.',
  password: 'Enter your password, no longer than 128 characters.',
  amount: 'Enter a non-negative salary with at most 13 digits before the decimal point and two decimal places.',
  currencyCode: 'Choose a supported three-letter currency code.',
  hireDate: 'Enter a real hire date in YYYY-MM-DD format.',
  effectiveDate: 'Enter a real effective date in YYYY-MM-DD format.',
  reportingDate: 'Enter a real reporting date in YYYY-MM-DD format.',
  reportingCurrency: 'Choose a supported three-letter reporting currency.',
  bucketBoundaries: 'Salary ranges must start at 0, and each subsequent value must be greater than the previous one. Use 1–20 comma-separated non-negative amounts with at most two decimal places.',
  countryId: 'Choose an available country.', departmentId: 'Choose an available department.', designationId: 'Choose an available designation.',
  page: 'Choose a valid page.', pageSize: 'Choose between 1 and 100 results per page.',
  q: 'Enter a name search of 1–100 characters.', status: 'Choose active, inactive or all employees.',
  includeInactive: 'Choose whether to include inactive employees.', groupBy: 'Choose a supported breakdown.',
  scope: 'Choose all, current, historical or future salary revisions.', sort: 'Choose a supported sort field.', order: 'Choose ascending or descending order.',
};
export function validationMessage(issue: z.core.$ZodIssue) {
  if (issue.code === 'unrecognized_keys') return 'Remove unsupported fields and try again.';
  return guidance[String(issue.path.at(-1) ?? '')] ?? 'Check the submitted information and provide the required values.';
}
