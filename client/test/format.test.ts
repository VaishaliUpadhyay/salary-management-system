import { describe, it, expect } from "vitest";
import { money, salaryError, validDate } from "../src/lib/format";
describe("exact display and form validation", () => {
  it("formats very large monetary values without Number conversion", () => {
    expect(money("9999999999999989999999990000000000000.01", "USD")).toBe(
      "USD 9,999,999,999,999,989,999,999,990,000,000,000,000.01",
    );
  });
  it.each(["-1", "1e6", "1.001", "10000000000000", ""])(
    "rejects invalid salary %s",
    (value) => {
      expect(salaryError(value, "2026-01-01", "2020-01-01")).not.toBeNull();
    },
  );
  it("accepts zero, hire-date equality and future dates", () => {
    expect(salaryError("0.00", "2027-01-01", "2027-01-01")).toBeNull();
  });
  it("rejects impossible calendar dates without timezone shifting", () => {
    expect(validDate("2026-02-30")).toBe(false);
    expect(validDate("2024-02-29")).toBe(true);
  });
});
