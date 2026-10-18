import { InputError, fieldGuidance, messages } from "./errors";
// Exact strings for money labels; Number is used only for bounded chart coordinates.
export function money(value: string | null | undefined, currency: string) {
  if (value == null) return "Not available";
  const [integer, fraction = ""] = value.split(".");
  return `${currency} ${integer!.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${fraction.padEnd(2, "0").slice(0, 2)}`;
}
export const today = () => new Date().toISOString().slice(0, 10);
export function validDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  return (
    /^[1-9]\d{3}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}
export function salaryIssue(amount: string, effectiveDate: string, hireDate: string) {
  if (!/^\d{1,13}(\.\d{1,2})?$/.test(amount)) return new InputError('amount', fieldGuidance.amount!);
  if (!validDate(effectiveDate)) return new InputError('effectiveDate', fieldGuidance.effectiveDate!);
  if (effectiveDate < hireDate) return new InputError('effectiveDate', messages.SALARY_BEFORE_HIRE_DATE!);
  return null;
}
export function salaryError(amount: string, effectiveDate: string, hireDate: string) {
  return salaryIssue(amount, effectiveDate, hireDate)?.guidance ?? null;
}
export function boundaryIssue(value: string) {
  const values = value.split(',');
  if (value.length > 1000 || values.length > 20 || !values.every(v => /^(0|[1-9]\d*)(\.\d{1,2})?$/.test(v))) return new InputError('bucketBoundaries', fieldGuidance.bucketBoundaries!);
  const cents = values.map(v => { const [whole, fraction = ''] = v.split('.'); return BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, '0')); });
  if (cents[0] !== 0n || cents.some((v, i) => i > 0 && v <= cents[i - 1]!)) return new InputError('bucketBoundaries', fieldGuidance.bucketBoundaries!);
  if (cents.some(v => v >= 10n ** 43n)) return new InputError('bucketBoundaries', messages.REPORT_NUMERIC_RANGE_EXCEEDED!);
  return null;
}
