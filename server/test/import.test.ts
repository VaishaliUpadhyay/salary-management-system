import { describe, it, expect } from "vitest";
import {
  parseCsv,
  HEADERS,
  MAX_BYTES,
  MAX_ROWS,
  rowSchema,
} from "../src/modules/imports/csv.js";
const header = HEADERS.join(",");
const row =
  "EMP1,Maya,maya@example.test,US,ENG,DEV,2020-01-01,123.45,USD,2024-01-01";
describe("CSV preflight", () => {
  it("supports BOM, reordered headers, CRLF, escaped quotes, commas and embedded newlines", () => {
    const text =
      "\ufeff" +
      header +
      "\r\n" +
      row.replace("Maya", '"Maya, ""M""\nTest"') +
      "\r\n" +
      row.replace("EMP1", "EMP2");
    const parsed = parseCsv(Buffer.from(text));
    expect(parsed.map((r) => r.rowNumber)).toEqual([2, 3]);
    expect(parsed[0]!.values.name).toBe('Maya, "M"\nTest');
    const reverse =
      header.split(",").reverse().join(",") +
      "\n" +
      row.split(",").reverse().join(",");
    expect(parseCsv(Buffer.from(reverse))[0]!.values.employee_code).toBe(
      "EMP1",
    );
  });
  it.each([
    "",
    header,
    header + "\n",
    header.replace("name,", ""),
    header.replace("name", "status"),
    header.replace("name", "email"),
  ])("rejects empty or invalid headers before writes: %s", (text) => {
    expect(() => parseCsv(Buffer.from(text))).toThrow();
  });
  it.each([
    '"unclosed',
    'EMP2,ab"cd,a,b,c,d,e,f,g,h',
    'EMP2,"quoted"x,a,b,c,d,e,f,g,h',
    "EMP2,short",
  ])("rejects malformed records: %s", (bad) => {
    expect(() =>
      parseCsv(Buffer.from(header + "\n" + row + "\n" + bad)),
    ).toThrow();
  });
  it("rejects invalid UTF-8 and binary NUL", () => {
    expect(() => parseCsv(Buffer.from([0xc3, 0x28]))).toThrow("UTF-8");
    expect(() => parseCsv(Buffer.from(header + "\n\0"))).toThrow("unreadable characters");
  });
  it("retains blank records as row validation failures", () => {
    const rows = parseCsv(Buffer.from(header + "\n\n" + row));
    expect(rows).toHaveLength(2);
    expect(rowSchema.safeParse(rows[0]!.values).success).toBe(false);
  });
  it("marks all duplicate normalized identifiers, even invalid rows", () => {
    const rows = parseCsv(
      Buffer.from(
        header +
          "\n" +
          row +
          "\n" +
          row.replace("EMP1", " emp1 ").replace("123.45", "invalid"),
      ),
    );
    expect(rows.map((r) => r.duplicate)).toEqual([true, true]);
  });
  it("accepts exactly 5 MiB and rejects the next byte", () => {
    const base = header + "\n" + row;
    const text = base.replace(
      "Maya",
      "Maya" + " ".repeat(MAX_BYTES - Buffer.byteLength(base)),
    );
    expect(parseCsv(Buffer.from(text))).toHaveLength(1);
    expect(() => parseCsv(Buffer.from(text + " "))).toThrow("5 MiB");
  });
  it("accepts 10,000 records and rejects 10,001", () => {
    const text =
      header +
      "\n" +
      Array.from({ length: MAX_ROWS }, (_, i) =>
        row.replace("EMP1", `EMP${i}`),
      ).join("\n");
    expect(parseCsv(Buffer.from(text))).toHaveLength(MAX_ROWS);
    expect(() => parseCsv(Buffer.from(text + "\n" + row))).toThrow("10,000");
  });
  it.each(["-1", "1.001", "10000000000000", "1e3", "NaN", ""])(
    "rejects invalid salary %s",
    (amount) => {
      const input = parseCsv(Buffer.from(header + "\n" + row))[0]!.values;
      expect(
        rowSchema.safeParse({ ...input, annual_base_salary: amount }).success,
      ).toBe(false);
    },
  );
});
