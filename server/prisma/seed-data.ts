// Pure deterministic fixtures: no database, clock, network or unseeded randomness.
export const SEED_DATE = "2026-10-15";
export const SEED_RANDOM = 20261015;
export const EMPLOYEE_COUNT = 10_000;
const date = (value: string) => new Date(`${value}T00:00:00.000Z`);

export const departments = [
  ["ENG", "Engineering"],
  ["PROD", "Product"],
  ["SALES", "Sales"],
  ["MKT", "Marketing"],
  ["FIN", "Finance"],
  ["HR", "Human Resources"],
  ["OPS", "Operations"],
  ["SUP", "Customer Support"],
].map(([code, name], index) => ({ id: index + 1, code: code!, name: name! }));

const roles = [
  ["Software Engineer", "Senior Software Engineer", "Engineering Manager"],
  ["Product Analyst", "Product Manager", "Product Director"],
  ["Sales Representative", "Account Executive", "Sales Manager"],
  ["Marketing Associate", "Marketing Specialist", "Marketing Manager"],
  ["Financial Analyst", "Senior Accountant", "Finance Manager"],
  ["HR Coordinator", "HR Specialist", "HR Manager"],
  ["Operations Associate", "Operations Analyst", "Operations Manager"],
  ["Support Associate", "Support Specialist", "Support Manager"],
];
export const designations = departments.flatMap((department, index) =>
  roles[index]!.map((name, level) => ({
    id: index * 3 + level + 1,
    departmentId: department.id,
    code: `${department.code}_${level + 1}`,
    name,
  })),
);

export const countries = [
  ["US", "United States"],
  ["IN", "India"],
  ["GB", "United Kingdom"],
  ["DE", "Germany"],
  ["CA", "Canada"],
  ["SG", "Singapore"],
].map(([code, name], index) => ({ id: index + 1, code: code!, name: name! }));

export const currencies = [
  ["USD", "US Dollar"],
  ["INR", "Indian Rupee"],
  ["GBP", "Pound Sterling"],
  ["EUR", "Euro"],
  ["CAD", "Canadian Dollar"],
  ["SGD", "Singapore Dollar"],
].map(([code, name]) => ({ code: code!, name: name! }));

// Illustrative synthetic snapshots, not market observations.
const rateSnapshots = [
  { day: "2024-01-01", rates: ["1", "82", "0.80", "0.92", "1.34", "1.35"] },
  { day: "2026-10-01", rates: ["1", "84", "0.78", "0.91", "1.36", "1.30"] },
];
export const exchangeRates = rateSnapshots.flatMap((snapshot) =>
  currencies.map((currency, index) => ({
    currencyCode: currency.code,
    effectiveDate: date(snapshot.day),
    unitsPerUsd: snapshot.rates[index]!,
    source: "Synthetic demo fixture v1 — illustrative, not live market rates",
  })),
);

const firstNames = [
  "Aarav",
  "Maya",
  "Olivia",
  "Liam",
  "Priya",
  "Noah",
  "Amelia",
  "Arjun",
  "Sofia",
  "Ethan",
  "Mei",
  "Daniel",
  "Hannah",
  "Lucas",
  "Aisha",
  "Leo",
];
const lastNames = [
  "Sharma",
  "Patel",
  "Smith",
  "Brown",
  "Wilson",
  "Lee",
  "Tan",
  "Meyer",
  "Schmidt",
  "Martin",
  "Taylor",
  "Kumar",
  "Singh",
  "Wong",
  "Clark",
  "Thomas",
];

function randomGenerator(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
function money(cents: bigint) {
  return `${cents / 100n}.${(cents % 100n).toString().padStart(2, "0")}`;
}
// Ratios in integer hundredths; no binary floating-point money arithmetic.
const localRates = [100n, 8400n, 78n, 91n, 136n, 130n];
const countryBaseUsd = [55000, 18000, 42000, 45000, 40000, 48000];

export function buildSeedData() {
  const random = randomGenerator(SEED_RANDOM);
  const employees = [];
  const salaries = [];
  const inactiveIds: number[] = [];
  for (let id = 1; id <= EMPLOYEE_COUNT; id++) {
    const countryIndex = Math.floor(random() * countries.length);
    const designationIndex = Math.floor(random() * designations.length);
    const futureHire = id % 100 === 0;
    const hireDate = futureHire
      ? date("2027-01-01")
      : date(
          `${2016 + Math.floor(random() * 8)}-${String(1 + Math.floor(random() * 12)).padStart(2, "0")}-01`,
        );
    employees.push({
      id,
      employeeCode: `EMP${String(id).padStart(5, "0")}`,
      name: `${firstNames[Math.floor(random() * firstNames.length)]} ${lastNames[Math.floor(random() * lastNames.length)]}`,
      email: `employee${String(id).padStart(5, "0")}@example.test`,
      countryId: countryIndex + 1,
      designationId: designationIndex + 1,
      hireDate,
      isActive: true,
    });
    if (id % 20 === 0 && !futureHire) inactiveIds.push(id);
    const currencyIndex =
      id % 11 === 0 ? (countryIndex + 1) % currencies.length : countryIndex;
    const currencyCode = currencies[currencyIndex]!.code;
    const usdUnits =
      countryBaseUsd[countryIndex]! +
      (designationIndex % 3) * 22000 +
      Math.floor(random() * 20000);
    const cents =
      id % 97 === 0 ? 0n : BigInt(usdUnits) * localRates[currencyIndex]!;
    const revision = (effectiveDate: Date, percent: bigint) => ({
      employeeId: id,
      amount: money((cents * percent + 50n) / 100n),
      currencyCode,
      effectiveDate,
    });
    if (futureHire) salaries.push(revision(hireDate, 100n));
    else {
      salaries.push(
        revision(hireDate, 80n),
        revision(date("2024-01-01"), 90n),
        revision(date("2026-01-01"), 100n),
      );
      if (id % 10 === 0) salaries.push(revision(date("2027-01-01"), 105n));
    }
  }
  return {
    departments,
    designations,
    countries,
    currencies,
    exchangeRates,
    employees,
    salaries,
    inactiveIds,
  };
}
