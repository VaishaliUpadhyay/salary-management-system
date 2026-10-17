import type { ReactNode } from "react";
import {
  render,
  screen,
  within,
  waitFor,
  fireEvent,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/App";
import { catalog, employee, page, report, session } from "./fixtures";
// Real charts are exercised in Chromium; layout is not available in jsdom.
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  BarChart: () => <div>Chart</div>,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  CartesianGrid: () => null,
}));
let authenticated: boolean, current: typeof employee;
let override: (url: URL, init: RequestInit) => Response | undefined;
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
const failure = (code: string, status = 422) =>
  json(
    { error: { code, message: code, details: [], requestId: "test-request" } },
    status,
  );
const handler = async (input: RequestInfo | URL, init: RequestInit = {}) => {
  const url = new URL(String(input), "http://localhost");
  const custom = override(url, init);
  if (custom) return custom;
  const path = url.pathname.replace("/api/v1", ""),
    method = init.method ?? "GET";
  if (path === "/auth/session")
    return authenticated
      ? json({ data: session })
      : failure("UNAUTHENTICATED", 401);
  if (path === "/auth/login") {
    authenticated = true;
    return json({ data: session });
  }
  if (path === "/auth/logout") {
    authenticated = false;
    return new Response(null, { status: 204 });
  }
  for (const key of ["countries", "departments", "designations"] as const)
    if (path === `/${key}`) return json(page(catalog[key]));
  if (path === "/currencies") return json({ data: catalog.currencies });
  if (path === "/analytics/compensation")
    return json({
      data: {
        ...report,
        reportingCurrency: url.searchParams.get("reportingCurrency"),
      },
    });
  if (path === "/employees" && method === "GET")
    return json(page([current], Number(url.searchParams.get("page") ?? 1), 26));
  if (path === "/employees" && method === "POST") {
    current = { ...current, ...JSON.parse(String(init.body)) };
    return json({ data: current }, 201);
  }
  if (path === "/employees/1/deactivate") {
    current = { ...current, isActive: false };
    return json({ data: current });
  }
  if (path === "/employees/1" && method === "PATCH") {
    current = { ...current, ...JSON.parse(String(init.body)) };
    return json({ data: current });
  }
  if (path === "/employees/1") return json({ data: current });
  if (path === "/employees/1/salary-records")
    return method === "POST"
      ? json({ data: { id: 3 } }, 201)
      : json(
          page([
            { ...current.currentSalary!, classification: "current" },
            { ...current.nextFutureSalary!, classification: "future" },
          ]),
        );
  return failure("NOT_FOUND", 404);
};
const fetchMock = vi.fn(handler);
beforeEach(() => {
  authenticated = true;
  current = structuredClone(employee);
  override = () => undefined;
  fetchMock.mockReset().mockImplementation(handler);
  vi.stubGlobal("fetch", fetchMock);
  window.history.replaceState(null, "", "#/employees");
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => vi.unstubAllGlobals());
async function openDirectory() {
  render(<App />);
  await screen.findByRole("heading", { name: "Employee directory" });
}
async function openDetail() {
  window.history.replaceState(null, "", "#/employees/1");
  render(<App />);
  await screen.findByRole("heading", { name: "Maya Sharma" });
}

describe("authentication and session UI", () => {
  it("redirects a protected page to login without rendering employee data", async () => {
    authenticated = false;
    render(<App />);
    expect(
      await screen.findByRole("heading", { name: "Welcome back" }),
    ).toBeVisible();
    await waitFor(() => expect(window.location.hash).toContain("/login?next="));
    expect(screen.queryByText("Maya Sharma")).not.toBeInTheDocument();
  });
  it("logs in with credentials, restores the requested route and stores no secrets", async () => {
    authenticated = false;
    render(<App />);
    const user = userEvent.setup();
    await screen.findByLabelText("Password");
    await user.type(screen.getByLabelText("Email address"), "hr@example.test");
    await user.type(screen.getByLabelText("Password"), "synthetic-password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(
      await screen.findByRole("heading", { name: "Employee directory" }),
    ).toBeVisible();
    expect(
      fetchMock.mock.calls.find(([url]) =>
        String(url).includes("/auth/login"),
      )?.[1],
    ).toMatchObject({ credentials: "include", method: "POST" });
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });
  it("shows login failures and clears the password", async () => {
    authenticated = false;
    override = (url) =>
      url.pathname.endsWith("/auth/login")
        ? failure("INVALID_CREDENTIALS", 401)
        : undefined;
    render(<App />);
    const user = userEvent.setup();
    await screen.findByLabelText("Password");
    await user.type(screen.getByLabelText("Email address"), "hr@example.test");
    await user.type(screen.getByLabelText("Password"), "incorrect");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "INVALID_CREDENTIALS",
    );
    expect(screen.getByLabelText("Password")).toHaveValue("");
  });
  it("restores session on refresh and sends CSRF on logout", async () => {
    await openDirectory();
    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await screen.findByRole("heading", { name: "Welcome back" });
    expect(
      fetchMock.mock.calls.find(([url]) =>
        String(url).includes("/auth/logout"),
      )?.[1],
    ).toMatchObject({
      headers: expect.objectContaining({ "X-CSRF-Token": session.csrfToken }),
      credentials: "include",
    });
  });
  it("clears protected data and explains session expiration after a 401", async () => {
    override = (url) =>
      url.pathname === "/api/v1/employees"
        ? failure("UNAUTHENTICATED", 401)
        : undefined;
    render(<App />);
    expect(
      await screen.findByText(
        "Your session expired. Sign in again to continue.",
      ),
    ).toBeVisible();
    expect(screen.queryByText("Maya Sharma")).not.toBeInTheDocument();
  });
  it("handles unavailable session service with a retry instead of false login", async () => {
    override = (url) =>
      url.pathname.endsWith("/auth/session")
        ? failure("DATABASE_UNAVAILABLE", 503)
        : undefined;
    render(<App />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "DATABASE_UNAVAILABLE",
    );
    expect(screen.getByRole("button", { name: "Try again" })).toBeVisible();
  });
});
describe("employee and salary flows", () => {
  it("lists employees and sends server-side search, filters and pagination", async () => {
    await openDirectory();
    await screen.findByText("Maya Sharma");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(window.location.hash).toContain("page=2"));
    await user.type(screen.getByLabelText("Search employees"), "Maya");
    await user.click(screen.getByRole("button", { name: "Search" }));
    await waitFor(() => expect(window.location.hash).toContain("q=Maya"));
    expect(window.location.hash).not.toContain("page=2");
    await user.selectOptions(screen.getByLabelText("Country"), "1");
    await user.selectOptions(
      screen.getByLabelText("Employee status"),
      "inactive",
    );
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([url]) =>
            String(url).includes("countryId=1") &&
            String(url).includes("status=inactive"),
        ),
      ).toBe(true),
    );
  });
  it("shows empty and backend error states", async () => {
    override = (url) =>
      url.pathname === "/api/v1/employees" ? json(page([])) : undefined;
    await openDirectory();
    expect(
      await screen.findByText("No employees match these filters."),
    ).toBeVisible();
  });
  it("shows loading while the employee query is pending", async () => {
    const original = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (input, init) =>
      String(input).startsWith("/api/v1/employees?")
        ? new Promise<Response>(() => {})
        : original(input, init),
    );
    await openDirectory();
    expect(await screen.findByText("Loading employees…")).toBeVisible();
    fetchMock.mockImplementation(original);
  });
  it("creates an employee and initial salary atomically through one API request", async () => {
    await openDirectory();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Add employee" }));
    const dialog = within(screen.getByRole("dialog"));
    await user.type(dialog.getByLabelText("Employee code"), "EMPNEW");
    await user.type(dialog.getByLabelText("Full name"), "New Employee");
    await user.type(dialog.getByLabelText("Email address"), "new@example.test");
    await user.selectOptions(dialog.getByLabelText("Country"), "1");
    await user.selectOptions(dialog.getByLabelText("Department"), "1");
    await user.selectOptions(dialog.getByLabelText("Designation"), "1");
    fireEvent.change(dialog.getByLabelText("Hire date"), {
      target: { value: "2024-01-01" },
    });
    await user.type(dialog.getByLabelText("Annual amount"), "12345.67");
    await user.selectOptions(dialog.getByLabelText("Salary currency"), "USD");
    fireEvent.change(dialog.getByLabelText("Effective date"), {
      target: { value: "2024-01-01" },
    });
    await user.click(dialog.getByRole("button", { name: "Create employee" }));
    expect(
      await screen.findByRole("heading", { name: "New Employee" }),
    ).toBeVisible();
    const call = fetchMock.mock.calls.find(
      ([url, options]) =>
        url === "/api/v1/employees" && options?.method === "POST",
    );
    expect(JSON.parse(String(call?.[1]?.body))).toMatchObject({
      initialSalary: {
        amount: "12345.67",
        currencyCode: "USD",
        effectiveDate: "2024-01-01",
      },
      designationId: 1,
    });
  });
  it("edits master information without sending salary or immutable code fields", async () => {
    await openDetail();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Edit profile" }));
    const dialog = within(screen.getByRole("dialog"));
    await user.clear(dialog.getByLabelText("Full name"));
    await user.type(dialog.getByLabelText("Full name"), "Maya Updated");
    await user.click(dialog.getByRole("button", { name: "Save changes" }));
    expect(
      await screen.findByRole("heading", { name: "Maya Updated" }),
    ).toBeVisible();
    const body = JSON.parse(
      String(
        fetchMock.mock.calls.find(([, o]) => o?.method === "PATCH")?.[1]?.body,
      ),
    );
    expect(body.employeeCode).toBeUndefined();
    expect(body.initialSalary).toBeUndefined();
  });
  it("requires confirmation before deactivation and preserves visible salary history", async () => {
    await openDetail();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Deactivate" }));
    expect(
      fetchMock.mock.calls.some(([u]) => String(u).endsWith("/deactivate")),
    ).toBe(false);
    await user.click(
      screen.getByRole("button", { name: "Confirm deactivation" }),
    );
    await screen.findByText(
      "Employee deactivated. Salary history has been preserved.",
    );
    expect(
      screen.getByRole("button", { name: "Add salary revision" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("heading", { name: "Salary history" }),
    ).toBeVisible();
  });
  it("shows current/future pay in original currencies and switches salary history scope", async () => {
    await openDetail();
    expect(
      screen.getByRole("heading", { name: "USD 75,000.00" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "EUR 80,000.00" }),
    ).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Future-dated" }));
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([u]) => String(u).includes("scope=future")),
      ).toBe(true),
    );
    expect(
      screen.queryByRole("button", { name: /delete|edit salary/i }),
    ).not.toBeInTheDocument();
  });
  it("rejects pre-hire revisions locally and accepts valid future revisions", async () => {
    await openDetail();
    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: "Add salary revision" }),
    );
    const dialog = within(screen.getByRole("dialog"));
    await user.type(dialog.getByLabelText("Annual amount"), "90000");
    fireEvent.change(dialog.getByLabelText("Effective date"), {
      target: { value: "2019-01-01" },
    });
    await user.click(
      dialog.getByRole("button", { name: "Save salary revision" }),
    );
    expect(await dialog.findByRole("alert")).toHaveTextContent(
      "earlier than the hire date",
    );
    fireEvent.change(dialog.getByLabelText("Effective date"), {
      target: { value: "2028-01-01" },
    });
    await user.click(
      dialog.getByRole("button", { name: "Save salary revision" }),
    );
    expect(
      await screen.findByText(
        "Salary revision added. Existing salary history is unchanged.",
      ),
    ).toBeVisible();
  });
  it("shows server salary conflicts without closing the dialog", async () => {
    override = (url, init) =>
      url.pathname.endsWith("/salary-records") && init.method === "POST"
        ? failure("SALARY_DATE_CONFLICT", 409)
        : undefined;
    await openDetail();
    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: "Add salary revision" }),
    );
    await user.type(screen.getByLabelText("Annual amount"), "100");
    await user.click(
      screen.getByRole("button", { name: "Save salary revision" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "SALARY_DATE_CONFLICT",
    );
    expect(screen.getByRole("dialog")).toBeVisible();
  });
});
describe("analytics UI", () => {
  it("renders actual API summary, coverage counts and FX metadata", async () => {
    window.history.replaceState(null, "", "#/dashboard");
    render(<App />);
    expect((await screen.findAllByText("USD 250.00")).length).toBeGreaterThan(
      0,
    );
    expect(
      screen.getByText(/without a currently effective salary/),
    ).toBeVisible();
    await userEvent.click(
      screen.getByText("View exchange-rate dates and sources"),
    );
    expect(screen.getByText(/Synthetic test rates/)).toBeVisible();
  });
  it("refetches when reporting currency or breakdown dimension changes", async () => {
    window.history.replaceState(null, "", "#/dashboard");
    render(<App />);
    await screen.findByLabelText("Reporting currency");
    await userEvent.selectOptions(
      screen.getByLabelText("Reporting currency"),
      "EUR",
    );
    await screen.findAllByText("EUR 250.00");
    await userEvent.click(screen.getByRole("button", { name: "Department" }));
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([u]) =>
            String(u).includes("reportingCurrency=EUR") &&
            String(u).includes("groupBy=department"),
        ),
      ).toBe(true),
    );
  });
  it.each(["MISSING_EXCHANGE_RATES", "REPORT_NUMERIC_RANGE_EXCEEDED"])(
    "handles %s without showing partial monetary totals",
    async (code) => {
      override = (url) =>
        url.pathname.includes("/analytics/") ? failure(code) : undefined;
      window.history.replaceState(null, "", "#/dashboard");
      render(<App />);
      expect(await screen.findByRole("alert")).toBeVisible();
      expect(screen.queryByText("USD 250.00")).not.toBeInTheDocument();
    },
  );
});

describe("recovery and empty states", () => {
  it("recovers from employee API errors through explicit retry", async () => {
    override = (url) =>
      url.pathname === "/api/v1/employees"
        ? failure("DATABASE_UNAVAILABLE", 503)
        : undefined;
    await openDirectory();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "DATABASE_UNAVAILABLE",
    );
    override = () => undefined;
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Maya Sharma")).toBeVisible();
  });
  it("shows a network error without retrying a mutation automatically", async () => {
    await openDetail();
    const original = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (input, init) => {
      if (init?.method === "POST") throw new TypeError("Network interrupted");
      return original(input, init);
    });
    await userEvent.click(screen.getByRole("button", { name: "Deactivate" }));
    await userEvent.click(
      screen.getByRole("button", { name: "Confirm deactivation" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Check whether your change was saved",
    );
    expect(
      fetchMock.mock.calls.filter(([, init]) => init?.method === "POST"),
    ).toHaveLength(1);
  });
  it("keeps salary history available for an already inactive employee", async () => {
    current.isActive = false;
    await openDetail();
    expect(
      screen.getByRole("button", { name: "Add salary revision" }),
    ).toBeDisabled();
    expect(
      await screen.findByText("current", { selector: "span" }),
    ).toBeVisible();
  });
  it("shows empty analytics without inventing monetary averages", async () => {
    override = (url) =>
      url.pathname.includes("/analytics/")
        ? json({
            data: {
              ...report,
              summary: {
                employeeCount: 0,
                salaryCount: 0,
                missingSalaryCount: 0,
                annualBasePayTotal: "0.00",
                average: null,
                median: null,
                min: null,
                max: null,
              },
              groups: [],
              distribution: [],
            },
          })
        : undefined;
    window.history.replaceState(null, "", "#/dashboard");
    render(<App />);
    expect(
      await screen.findByText("No current salaries to display."),
    ).toBeVisible();
    expect(screen.getAllByText("Not available")).toHaveLength(4);
  });
  it("preserves employee search and page when returning from details", async () => {
    window.history.replaceState(null, "", "#/employees?q=Maya&page=2");
    render(<App />);
    await userEvent.click(await screen.findByText("Maya Sharma"));
    await userEvent.click(
      await screen.findByRole("link", { name: "← Back to employees" }),
    );
    await waitFor(() =>
      expect(window.location.hash).toBe("#/employees?q=Maya&page=2"),
    );
  });
});
