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
export function salaryError(
  amount: string,
  effectiveDate: string,
  hireDate: string,
) {
  if (!/^\d{1,13}(\.\d{1,2})?$/.test(amount))
    return "Enter a non-negative amount with up to 13 integer digits and 2 decimal places.";
  if (!validDate(effectiveDate)) return "Enter a valid effective date.";
  if (effectiveDate < hireDate)
    return "Salary effective date cannot be earlier than the hire date.";
  return null;
}
