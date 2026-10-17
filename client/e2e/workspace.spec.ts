import { test, expect } from "@playwright/test";
import {
  catalog,
  employee,
  page as paginated,
  report,
  session,
} from "../test/fixtures";
test.beforeEach(async ({ page }) => {
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url()),
      path = url.pathname.replace("/api/v1", "");
    let body: unknown;
    if (path === "/auth/session") body = { data: session };
    else if (path === "/currencies") body = { data: catalog.currencies };
    else if (path === "/analytics/compensation") body = { data: report };
    else if (path === "/employees") body = paginated([employee]);
    else if (path === "/employees/1") body = { data: employee };
    else if (path === "/employees/1/salary-records")
      body = paginated([
        { ...employee.currentSalary, classification: "current" },
        { ...employee.nextFutureSalary, classification: "future" },
      ]);
    else {
      const key = path.slice(1) as keyof typeof catalog;
      body =
        key in catalog
          ? paginated(catalog[key])
          : { error: { message: "Unexpected test request" } };
    }
    await route.fulfill({ json: body });
  });
});
for (const width of [1440, 768, 390, 320]) {
  test(`dashboard and directory fit ${width}px viewport`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/#/dashboard");
    await expect(
      page.getByRole("heading", { name: "People. Pay. Perspective." }),
    ).toBeVisible();
    await expect(page.locator(".recharts-surface").first()).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    if (width === 1440 || width === 390)
      await page.screenshot({
        path: `/tmp/m4-dashboard-${width}.png`,
        fullPage: true,
      });
    await page.getByRole("link", { name: "Employees", exact: true }).click();
    await expect(page.getByText("Maya Sharma")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });
}
test("dialog has labels, traps keyboard focus, closes on Escape and returns focus", async ({
  page,
}) => {
  await page.goto("/#/employees");
  const trigger = page.getByRole("button", { name: "Add employee" });
  await trigger.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Employee code")).toBeFocused();
  for (let i = 0; i < 18; i++) {
    await page.keyboard.press("Tab");
    expect(
      await dialog.evaluate((el) => el.contains(document.activeElement)),
    ).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
});
test("profile shows original currencies and append-only history at mobile width", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#/employees/1");
  await expect(
    page.getByRole("heading", { name: "USD 75,000.00" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "EUR 80,000.00" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Salary history" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
