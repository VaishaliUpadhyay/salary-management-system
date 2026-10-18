import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { ImportPage } from "../src/features/imports/ImportPage";
import {
  errorCsv,
  csvCell,
  CSV_HEADER,
  type ImportResult,
} from "../src/features/imports/report";
import { setCsrf } from "../src/lib/api";
const result: ImportResult = {
  totalRows: 3,
  counts: { created: 1, updated: 0, skipped: 1, rejected: 1 },
  rows: [
    { rowNumber: 2, employeeCode: "EMP1", outcome: "created", employeeId: 1 },
    { rowNumber: 3, employeeCode: "EMP2", outcome: "skipped", employeeId: 2 },
    {
      rowNumber: 4,
      employeeCode: "EMP3",
      outcome: "rejected",
      errors: [
        {
          field: "effective_date",
          code: "SALARY_BEFORE_HIRE_DATE",
          message: "Salary predates hire",
        },
      ],
    },
  ],
};
const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock
    .mockReset()
    .mockResolvedValue(
      new Response(JSON.stringify({ data: result }), {
        headers: { "Content-Type": "application/json" },
      }),
    );
  vi.stubGlobal("fetch", fetchMock);
  setCsrf("mock-csrf");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  setCsrf();
});
async function select(name = "data.csv", content = CSV_HEADER + "\n") {
  const user = userEvent.setup({ applyAccept: false });
  await user.upload(
    screen.getByLabelText("CSV file"),
    new File([content], name, { type: "text/csv" }),
  );
  return user;
}
describe("CSV import page", () => {
  it("provides the exact template and requires file selection", async () => {
    render(<ImportPage />);
    expect(screen.getByRole("button", { name: "Import CSV" })).toBeDisabled();
    expect(screen.getByText(CSV_HEADER)).toBeVisible();
  });
  it.each(["data.xlsx", "data.txt"])(
    "rejects unsupported file %s before upload",
    async (name) => {
      render(<ImportPage />);
      const user = await select(name);
      await user.click(screen.getByRole("button", { name: "Import CSV" }));
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Select a .csv",
      );
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );
  it("rejects empty and oversized files locally", async () => {
    render(<ImportPage />);
    const user = await select("data.csv", "");
    await user.click(screen.getByRole("button", { name: "Import CSV" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("empty");
    await select("data.csv", " ".repeat(5 * 1024 * 1024 + 1));
    await user.click(screen.getByRole("button", { name: "Import CSV" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("5 MiB");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("uploads multipart with credentials and CSRF; renders partial success and row errors", async () => {
    render(<ImportPage />);
    const user = await select();
    await user.click(screen.getByRole("button", { name: "Import CSV" }));
    expect(await screen.findByText(/Total rows: 3/)).toHaveTextContent(
      "Successfully imported: 1",
    );
    expect(screen.getByText(/salary effective date cannot be earlier/)).toBeVisible();
    const [, options] = fetchMock.mock.calls[0]!;
    expect(options.credentials).toBe("include");
    expect(options.body).toBeInstanceOf(FormData);
    expect(options.headers["X-CSRF-Token"]).toBe("mock-csrf");
    expect(options.headers["Content-Type"]).toBeUndefined();
  });
  it("shows success for a fully accepted upload", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            ...result,
            totalRows: 1,
            counts: { created: 1, updated: 0, skipped: 0, rejected: 0 },
            rows: result.rows.slice(0, 1),
          },
        }),
      ),
    );
    render(<ImportPage />);
    const user = await select();
    await user.click(screen.getByRole("button", { name: "Import CSV" }));
    expect(await screen.findByText(/Total rows: 1/)).toHaveTextContent(
      "Failed: 0",
    );
    expect(
      screen.getByRole("button", { name: "Download error report" }),
    ).toBeDisabled();
  });
  it("disables duplicate submissions while upload/processing is pending", async () => {
    fetchMock.mockImplementation(() => new Promise(() => {}));
    render(<ImportPage />);
    const user = await select();
    await user.click(screen.getByRole("button", { name: "Import CSV" }));
    expect(
      screen.getByRole("button", { name: "Uploading and processing…" }),
    ).toBeDisabled();
    expect(screen.getByLabelText("CSV file")).toBeDisabled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it.each([
    [403, "CSRF_REJECTED"],
    [413, "FILE_TOO_LARGE"],
    [400, "INVALID_CSV"],
  ])("shows HTTP %s file/security errors", async (status, code) => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code, message: code, details: [] } }),
        { status: Number(status) },
      ),
    );
    render(<ImportPage />);
    const user = await select();
    await user.click(screen.getByRole("button", { name: "Import CSV" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(code === "CSRF_REJECTED" ? "Refresh the page" : code === "FILE_TOO_LARGE" ? "5 MiB" : "CSV file could not be read");
  });
  it("signals session expiration on unauthorized import", async () => {
    const expired = vi.fn();
    window.addEventListener("session-expired", expired);
    try {
      fetchMock.mockResolvedValue(new Response("{}", { status: 401 }));
      render(<ImportPage />);
      const user = await select();
      await user.click(screen.getByRole("button", { name: "Import CSV" }));
      await waitFor(() => expect(expired).toHaveBeenCalledTimes(1));
    } finally {
      window.removeEventListener("session-expired", expired);
    }
  });
  it("reports uncertain network outcomes without automatic retry", async () => {
    fetchMock.mockRejectedValue(new TypeError("Network unavailable"));
    render(<ImportPage />);
    const user = await select();
    await user.click(screen.getByRole("button", { name: "Import CSV" }));
    expect(
      await screen.findByText(/Some rows may already be committed/),
    ).toBeVisible();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("retains known completed counts from a fatal 503", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: "IMPORT_INCOMPLETE",
            message: "Processing interrupted",
          },
          data: { ...result, totalRows: 5, processingIncomplete: true },
        }),
        { status: 503 },
      ),
    );
    render(<ImportPage />);
    const user = await select();
    await user.click(screen.getByRole("button", { name: "Import CSV" }));
    expect(await screen.findByText(/Unresolved: 2/)).toBeVisible();
  });
  it("downloads template and errors using Blob URLs", async () => {
    const created = vi.fn(() => "blob:mock");
    vi.stubGlobal(
      "URL",
      Object.assign(URL, {
        createObjectURL: created,
        revokeObjectURL: vi.fn(),
      }),
    );
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    render(<ImportPage />);
    await userEvent.click(
      screen.getByRole("button", { name: "Download CSV template" }),
    );
    const user = await select();
    await user.click(screen.getByRole("button", { name: "Import CSV" }));
    await user.click(
      await screen.findByRole("button", { name: "Download error report" }),
    );
    expect(created).toHaveBeenCalledTimes(2);
    expect(click).toHaveBeenCalledTimes(2);
  });
});
describe("safe CSV error download", () => {
  it.each(["=SUM(1,2)", "+cmd", "-cmd", "@cmd", " \t=cmd", "\r=cmd"])(
    "neutralizes formula %j",
    (value) => expect(csvCell(value)).toContain("'"),
  );
  it("escapes quotes and excludes names, salaries and uploaded content", () => {
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
    const csv = errorCsv(result);
    expect(csv).toContain("SALARY_BEFORE_HIRE_DATE");
    expect(csv).not.toContain("annual_base_salary");
    expect(csv).toContain('"4","EMP3"');
  });
});


describe('HR-friendly row presentation',()=>{
  it('shows labels and all messages without diagnostic codes, and preserves export diagnostics',async()=>{
    const data:ImportResult={totalRows:1,counts:{created:0,updated:0,skipped:0,rejected:1},rows:[{rowNumber:6,employeeCode:'EMP6',outcome:'rejected',errors:[{field:'hire_date',code:'INVALID_FIELD',message:'This date does not exist. Enter a valid calendar date.'},{field:'annual_base_salary',code:'INVALID_AMOUNT',message:'Enter a valid non-negative salary amount.'}]}]};
    fetchMock.mockResolvedValue(new Response(JSON.stringify({data})));render(<ImportPage/>);const user=await select();await user.click(screen.getByRole('button',{name:'Import CSV'}));
    expect(await screen.findByText(/Hire Date: Enter a valid hire date/)).toBeVisible();expect(screen.getByText(/Annual Base Salary: Enter a non-negative/)).toBeVisible();expect(screen.getByText('Not Imported')).toBeVisible();expect(screen.getByText('6',{selector:'td'})).toBeVisible();
    expect(screen.queryByText(/INVALID_FIELD|INVALID_AMOUNT/)).not.toBeInTheDocument();
    const csv=errorCsv(data);expect(csv).toContain('"6","EMP6","hire_date","Hire Date","INVALID_FIELD"');expect(csv).toContain('Annual Base Salary');expect(csv).toContain('Enter a valid hire date');
  });
});
