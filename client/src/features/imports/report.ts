import { messages, fieldGuidance, lookup } from "../../lib/errors";
export const FIELD_LABELS: Record<string,string> = {
  employee_code:'Employee ID', name:'Name', email:'Email Address', country_code:'Country',
  department_code:'Department', designation_code:'Designation', hire_date:'Hire Date',
  annual_base_salary:'Annual Base Salary', currency_code:'Currency', effective_date:'Salary Effective Date',
};
export const fieldLabel = (field?:string) => field ? lookup(FIELD_LABELS, field) ?? 'Other Field' : 'Record';
export const outcomeLabel = (outcome:ImportResult['rows'][number]['outcome']) => ({created:'Employee Created',updated:'Salary Revision Added',skipped:'Skipped — Unchanged',rejected:'Not Imported'})[outcome];
export interface ImportResult {
  totalRows: number;
  counts: {
    created: number;
    updated: number;
    skipped: number;
    rejected: number;
  };
  rows: {
    rowNumber: number;
    employeeCode: string;
    outcome: "created" | "updated" | "skipped" | "rejected";
    employeeId?: number;
    errors?: { field?: string; code: string; message: string }[];
    retryable?: boolean;
  }[];
  processingIncomplete?: boolean;
}
export const CSV_HEADER =
  "employee_code,name,email,country_code,department_code,designation_code,hire_date,annual_base_salary,currency_code,effective_date";
// Quote every field and neutralize formula prefixes, including whitespace/control prefixes.
export function csvCell(value: unknown) {
  let text = String(value ?? "");
  // eslint-disable-next-line no-control-regex -- leading control bytes must not hide spreadsheet formulas.
  if (/^[\s\u0000-\u001f]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text))
    text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}
export function errorCsv(result: ImportResult) {
  const lines = [
    ["row_number", "employee_code", "field", "field_label", "code", "message", "retryable"],
  ];
  for (const row of result.rows)
    for (const error of row.errors ?? [])
      lines.push([
        String(row.rowNumber),
        row.employeeCode,
        error.field ?? "",
        fieldLabel(error.field),
        error.code,
        rowErrorMessage(error),
        String(row.retryable ?? false),
      ]);
  return (
    "\ufeff" +
    lines.map((line) => line.map(csvCell).join(",")).join("\r\n") +
    "\r\n"
  );
}
export function downloadCsv(name: string, text: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const csvFields: Record<string, string> = { employee_code: 'employeeCode', name: 'name', email: 'email', hire_date: 'hireDate', effective_date: 'effectiveDate', annual_base_salary: 'amount' };
const csvGuidance: Record<string, string> = {
  country_code: 'Enter a two-letter country code available in the system.',
  department_code: 'Enter an available department code.',
  designation_code: 'Enter an available designation code belonging to the specified department.',
  currency_code: 'Enter a supported three-letter currency code.',
};
const rowMessages: Record<string, string> = {
  DUPLICATE_EMPLOYEE_CODE: 'This employee ID appears more than once in the file. Keep one row per employee; all duplicate rows were rejected.',
  EMPLOYEE_MASTER_MISMATCH: 'This value does not match the existing employee profile. Check your CSV or edit the profile before importing; import does not overwrite profile information.',
  DEPARTMENT_MISMATCH: 'This designation does not belong to the specified department. Use a matching pair of codes.',
  INACTIVE_REFERENCE: 'New employees require an active country, department and designation. Check these codes in the system.',
  ROW_RETRYABLE: 'This row could not be saved because another change was in progress. Review the employee and retry this row.',
};
export function rowErrorMessage(error: { code: string; field?: string }) {
  if (error.code === 'INVALID_FIELD' || error.code === 'INVALID_AMOUNT') return lookup(fieldGuidance, lookup(csvFields, error.field ?? '') ?? '') ?? lookup(csvGuidance, error.field ?? '') ?? 'Provide a valid value using the CSV template.';
  if (error.code === 'UNKNOWN_REFERENCE') return lookup(csvGuidance, error.field ?? '') ?? messages.UNKNOWN_REFERENCE!;
  return lookup(rowMessages, error.code) ?? lookup(messages, error.code) ?? 'This row could not be imported. Review its values and try again.';
}
