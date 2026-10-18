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

for (const width of [1440, 390, 320]) {
  test(`CSV upload and error download fit ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route("**/api/v1/imports/employees", (route) =>
      route.fulfill({
        json: {
          data: {
            totalRows: 2,
            counts: { created: 1, updated: 0, skipped: 0, rejected: 1 },
            rows: [
              { rowNumber: 2, employeeCode: "DEMO1", outcome: "created" },
              {
                rowNumber: 3,
                employeeCode: "DEMO2",
                outcome: "rejected",
                errors: [
                  {
                    field: "effective_date",
                    code: "SALARY_BEFORE_HIRE_DATE",
                    message: "Salary must be on or after hire date",
                  },
                ],
              },
            ],
          },
        },
      }),
    );
    await page.goto("/#/imports");
    await expect(
      page.getByRole("heading", { name: "CSV Import" }),
    ).toBeVisible();
    await page
      .getByLabel("CSV file")
      .setInputFiles({
        name: "synthetic.csv",
        mimeType: "text/csv",
        buffer: Buffer.from("synthetic mocked upload"),
      });
    await page.getByRole("button", { name: "Import CSV", exact: true }).click();
    await expect(page.getByText(/Successfully imported: 1/)).toBeVisible();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download error report" }).click();
    expect((await download).suggestedFilename()).toBe("import-errors.csv");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.evaluate(() => window.scrollTo(0, 0));
    if (width === 390)
      await page.screenshot({
        path: "/tmp/m5-import-mobile.png",
        fullPage: true,
      });
  });
}


for (const width of [375, 768, 1440]) {
  test(`login errors stay concise at ${width}px`, async ({page}) => {
    await page.setViewportSize({width,height:1000});
    const error={code:'INVALID_CREDENTIALS',message:'private technical message',requestId:'5990c84f-d981-46cc-a8cf-746ee2961384',details:[]};
    await page.route('**/api/v1/auth/session',r=>r.fulfill({status:401,json:{error:{...error,code:'UNAUTHENTICATED'}}}));
    await page.route('**/api/v1/auth/login',r=>r.fulfill({status:401,json:{error}}));
    await page.goto('/#/login');
    await page.getByLabel('Email address').fill('hr@example.test');
    await page.getByLabel('Password').fill('invalid-test-password');
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(page.getByRole('alert')).toHaveText('Invalid email or password. Please try again.');
    await expect(page.locator('details')).toHaveCount(0);
    await expect(page.getByText(/5990c84f|Troubleshooting|Technical reference|INVALID_CREDENTIALS/)).toHaveCount(0);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const alert=await page.getByRole('alert').boundingBox();
    const input=await page.getByLabel('Email address').boundingBox();
    expect(alert!.y+alert!.height).toBeLessThanOrEqual(input!.y);
    await page.screenshot({path:`/tmp/m6-errors-login-${width}.png`,fullPage:true});
  });
  test(`form, report and CSV errors fit at ${width}px`, async ({page}) => {
    await page.setViewportSize({width,height:1100});
    const failure=(code:string,details:object[]=[])=>({error:{code,message:'private technical message',requestId:'hidden-diagnostic-id',details}});
    async function check(name:string) {
      await expect(page.getByText(/hidden-diagnostic-id|Troubleshooting details|Technical reference|private technical message/)).toHaveCount(0);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      expect(await page.locator('.field-error').evaluateAll(errors=>errors.every(error=>{
        const input=error.parentElement!.querySelector('input,select')!.getBoundingClientRect();
        const rect=error.getBoundingClientRect();
        return rect.top>=input.bottom && rect.right<=error.parentElement!.getBoundingClientRect().right+1;
      }))).toBe(true);
      await page.screenshot({path:`/tmp/m6-errors-${name}-${width}.png`,fullPage:true});
    }
    await page.goto('/#/dashboard');
    await page.getByLabel('Distribution boundaries').fill('0,100,50');
    await page.getByRole('button',{name:'Apply boundaries'}).click();
    await expect(page.getByRole('alert')).toHaveCount(1);
    await expect(page.getByLabel('Distribution boundaries')).toHaveAccessibleDescription(/greater than the previous/);
    await expect(page.locator('.recharts-surface').first()).toBeVisible();
    await check('ranges');
    await page.route('**/api/v1/analytics/compensation?*',r=>r.fulfill({status:422,json:failure('MISSING_EXCHANGE_RATES')}));
    await page.reload();
    await expect(page.getByRole('alert')).toContainText('required exchange rates are missing');
    await check('fx');
    await page.route('**/api/v1/employees?*',r=>r.fulfill({status:503,json:failure('DATABASE_UNAVAILABLE')}));
    await page.goto('/#/employees');
    await expect(page.getByRole('alert')).toContainText('temporarily unavailable');
    await check('directory');
    await page.unroute('**/api/v1/employees?*');
    await page.reload();
    await page.route('**/api/v1/employees',r=>r.fulfill({status:422,json:failure('VALIDATION_ERROR',[{field:'email',code:'invalid_format',message:'private'},{field:'initialSalary.amount',code:'invalid_format',message:'private'}])}));
    await page.getByRole('button',{name:'Add employee'}).click();
    const dialog=page.getByRole('dialog');
    await dialog.getByLabel('Employee code').fill('TEST-CODE');
    await dialog.getByLabel('Full name').fill('Test Employee');
    await dialog.getByLabel('Email address').fill('test@example.test');
    await dialog.getByLabel('Country',{exact:true}).selectOption('1');
    await dialog.getByLabel('Department',{exact:true}).selectOption('1');
    await dialog.getByLabel('Designation',{exact:true}).selectOption('1');
    await dialog.getByLabel('Hire date').fill('2020-01-01');
    await dialog.getByLabel('Annual amount').fill('100');
    await dialog.getByLabel('Salary currency').selectOption('USD');
    await dialog.getByLabel('Effective date').fill('2020-01-01');
    await dialog.getByRole('button',{name:'Create employee'}).click();
    await expect(dialog.getByRole('alert')).toHaveCount(2);
    await expect(dialog.locator('.error-box')).toHaveCount(0);
    await expect(dialog.getByLabel('Email address')).toHaveAttribute('aria-invalid','true');
    await check('create');
    await dialog.getByRole('button',{name:'Cancel'}).click();
    await page.goto('/#/employees/1');
    await page.route('**/api/v1/employees/1',async r=>r.request().method()==='PATCH'?r.fulfill({status:422,json:failure('HIRE_DATE_CONFLICTS_WITH_SALARY')}):r.fallback());
    await page.getByRole('button',{name:'Edit profile'}).click();
    await dialog.getByRole('button',{name:'Save changes'}).click();
    await expect(dialog.getByRole('alert')).toHaveCount(1);
    await expect(dialog.getByLabel('Hire date')).toHaveAccessibleDescription(/earliest salary revision/);
    await check('edit');
    await dialog.getByRole('button',{name:'Cancel'}).click();
    await page.route('**/api/v1/employees/1/salary-records',r=>r.fulfill({status:409,json:failure('SALARY_DATE_CONFLICT')}));
    await page.getByRole('button',{name:'Add salary revision'}).click();
    await dialog.getByLabel('Annual amount').fill('100');
    await dialog.getByRole('button',{name:'Save salary revision'}).click();
    await expect(dialog.getByRole('alert')).toHaveCount(1);
    await expect(dialog.getByLabel('Effective date')).toHaveAccessibleDescription(/already exists/);
    await check('salary');
    await dialog.getByRole('button',{name:'Cancel'}).click();
    await page.route('**/api/v1/employees/1/salary-records?*',r=>r.fulfill({status:500,json:failure('INTERNAL_ERROR')}));
    await page.reload();
    await expect(page.getByRole('alert')).toContainText("We couldn't complete your request");
    await check('history');
    await page.route('**/api/v1/employees/1',r=>r.fulfill({status:500,json:failure('INTERNAL_ERROR')}));
    await page.reload();
    await expect(page.getByRole('alert')).toContainText("We couldn't complete your request");
    await check('detail');
    await page.route('**/api/v1/imports/employees',r=>r.fulfill({json:{data:{totalRows:1,counts:{created:0,updated:0,skipped:0,rejected:1},rows:[{rowNumber:2,employeeCode:'TEST_CODE_'.repeat(5),outcome:'rejected',errors:[{field:'email',code:'EMPLOYEE_MASTER_MISMATCH',message:'private technical message'},{field:'effective_date',code:'SALARY_DATE_CONFLICT',message:'private technical message'}]}]}}}));
    await page.goto('/#/imports');
    await page.getByLabel('CSV file').setInputFiles({name:'test.csv',mimeType:'text/csv',buffer:Buffer.from('mocked upload')});
    await page.getByRole('button',{name:'Import CSV',exact:true}).click();
    await expect(page.getByText(/Email Address: This value does not match/)).toBeVisible();
    await expect(page.getByRole('button',{name:'Download error report'})).toBeEnabled();
    await check('csv');
  });
}
