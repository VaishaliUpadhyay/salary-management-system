import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Users, Wallet, ArrowUpRight } from "lucide-react";
import type { Catalog, Report, Single } from "../../lib/types";
import { useResource, navigate, queryString } from "../../lib/hooks";
import { money, today, boundaryIssue } from "../../lib/format";
import { ErrorNotice, Loading, Empty, Field } from "../../components/common";
import { OrganizationFilters } from "../../components/OrganizationFilters";
import { Button } from "../../components/ui/button";
export function Dashboard({
  catalog,
  search,
}: {
  catalog: Catalog;
  search: string;
}) {
  const values = new URLSearchParams(search),
    currency = values.get("reportingCurrency") || "USD",
    group = values.get("groupBy") || "country";
  const [retry, setRetry] = useState(0);
  const [boundaryError, setBoundaryError] = useState<unknown>(null);
  const query = queryString({
    reportingCurrency: currency,
    reportingDate: values.get("reportingDate") || undefined,
    groupBy: group,
    countryId: values.get("countryId") || undefined,
    departmentId: values.get("departmentId") || undefined,
    designationId: values.get("designationId") || undefined,
    includeInactive: values.get("includeInactive") || "false",
    bucketBoundaries: values.get("bucketBoundaries") || undefined,
  });
  const result = useResource<Single<Report>>(
    `/analytics/compensation?${query}`,
    retry,
  );
  function change(key: string, value: string) {
    const params = new URLSearchParams(search);
    if (value) params.set(key, value);
    else params.delete(key);
    if (key === "departmentId") params.delete("designationId");
    navigate(`/dashboard?${params}`);
  }
  const report = result.data?.data;
  return (
    <>
      <header className="page-heading">
        <div>
          <span className="eyebrow">COMPENSATION OVERVIEW</span>
          <h1>People. Pay. Perspective.</h1>
          <p className="muted">
            A clear view of your workforce and annual base compensation.
          </p>
        </div>
        <span className="pill">
          <span className="dot" /> Current workforce
        </span>
      </header>
      <section className="panel filter-grid" aria-label="Analytics filters">
        <Field error={result.error} field="reportingCurrency" label="Reporting currency" id="reporting-currency">
          <select
            id="reporting-currency"
            value={currency}
            onChange={(e) => change("reportingCurrency", e.target.value)}
          >
            {catalog.currencies
              .filter((c) => c.isActive)
              .map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} · {c.name}
                </option>
              ))}
          </select>
        </Field>
        <Field error={result.error} field="reportingDate" label="FX reporting date" id="reporting-date">
          <input
            id="reporting-date"
            type="date"
            max={today()}
            min="1000-01-01"
            value={values.get("reportingDate") || today()}
            onChange={(e) => change("reportingDate", e.target.value)}
          />
        </Field>
        <OrganizationFilters
          error={result.error}
          catalog={catalog}
          values={values}
          change={change}
        />
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={values.get("includeInactive") === "true"}
            onChange={(e) =>
              change("includeInactive", String(e.target.checked))
            }
          />
          Include inactive employees
        </label>
        <form
          className="bucket-form"
          onSubmit={(e) => {
            e.preventDefault();
            const value = String(new FormData(e.currentTarget).get("buckets"));
            const issue = boundaryIssue(value);
            setBoundaryError(issue);
            if (!issue) change("bucketBoundaries", value);
          }}
        >
          <Field
            error={boundaryError ?? result.error}
            field="bucketBoundaries"
            label="Distribution boundaries"
            id="buckets"
            hint="Comma-separated amounts starting at 0; up to 20 increasing values."
          >
            <input
              key={values.get("bucketBoundaries")}
              id="buckets"
              name="buckets"
              defaultValue={
                values.get("bucketBoundaries") || "0,50000,100000,150000,200000"
              }
              aria-describedby="buckets-hint"
            />
          </Field>
          <Button variant="outline" type="submit">
            Apply boundaries
          </Button>
        </form>
        <Button variant="ghost" onClick={() => navigate("/dashboard")}>
          Reset filters
        </Button>
      </section>
      {result.loading ? (
        <Loading label="Calculating compensation…" />
      ) : result.error ? (
        <ErrorNotice
          error={result.error}
          inlineFields={["bucketBoundaries", "reportingCurrency", "reportingDate", "countryId", "departmentId", "designationId"]}
          retry={() => setRetry((r) => r + 1)}
        />
      ) : (
        report && (
          <>
            <div className="report-meta">
              <span>
                Salary as of <strong>{report.salaryAsOfDate} UTC</strong>
              </span>
              <span>
                FX reporting date <strong>{report.reportingDate}</strong> ·{" "}
                {report.reportingCurrency}
              </span>
            </div>
            <section className="metric-grid" aria-label="Compensation summary">
              {[
                [
                  report.includeInactive
                    ? "Eligible employees"
                    : "Active employees",
                  report.summary.employeeCount.toLocaleString(),
                  <Users size={19} />,
                ],
                [
                  "Annual base salary",
                  money(report.summary.annualBasePayTotal, currency),
                  <Wallet size={19} />,
                ],
                ["Average salary", money(report.summary.average, currency)],
                ["Median salary", money(report.summary.median, currency)],
                ["Minimum salary", money(report.summary.min, currency)],
                ["Maximum salary", money(report.summary.max, currency)],
              ].map(([label, value, icon]) => (
                <article className="panel metric" key={String(label)}>
                  <div className="metric-label">
                    {label}
                    {icon}
                  </div>
                  <strong>{value}</strong>
                  <span className="muted text-xs">
                    {label === "Active employees" ||
                    label === "Eligible employees"
                      ? "Includes future hires"
                      : "Annual base compensation"}
                  </span>
                </article>
              ))}
            </section>
            <p className="notice">
              <strong>{report.summary.salaryCount.toLocaleString()}</strong>{" "}
              employees included in salary calculations ·{" "}
              <strong>
                {report.summary.missingSalaryCount.toLocaleString()}
              </strong>{" "}
              without a currently effective salary. Future revisions are
              excluded.
            </p>
            {!report.summary.employeeCount && (
              <Empty>No employees match these filters.</Empty>
            )}
            <div className="analytics-grid">
              <section className="panel chart-panel">
                <h2>Salary distribution</h2>
                <p className="muted">
                  Employees by annual salary band · {currency}
                </p>
                {report.summary.salaryCount ? (
                  <div
                    className="chart"
                    role="img"
                    aria-label="Salary distribution bar chart; exact counts are listed below"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        accessibilityLayer
                        data={report.distribution.map((b) => ({
                          label: `${money(b.lowerInclusive, currency)}${b.upperExclusive ? ` – <${money(b.upperExclusive, currency)}` : "+"}`,
                          count: b.count,
                        }))}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="label" tick={false} />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Bar
                          isAnimationActive={false}
                          dataKey="count"
                          name="Employees"
                          fill="#227a70"
                          radius={[5, 5, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <Empty>No current salaries to display.</Empty>
                )}
                <div className="table-scroll">
                  <table>
                    <caption className="sr-only">
                      Exact salary distribution
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Salary band ({currency})</th>
                        <th scope="col">Employees</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.distribution.map((b) => (
                        <tr key={b.lowerInclusive}>
                          <td>
                            {money(b.lowerInclusive, currency)}{" "}
                            {b.upperExclusive
                              ? `to < ${money(b.upperExclusive, currency)}`
                              : "and above"}
                          </td>
                          <td>{b.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
              <section className="panel chart-panel">
                <h2>Compensation breakdown</h2>
                <p className="muted">
                  Explore current organizational assignments.
                </p>
                <div className="segmented" aria-label="Breakdown dimension">
                  {["country", "department", "designation"].map((g) => (
                    <Button
                      key={g}
                      variant={group === g ? "default" : "ghost"}
                      aria-pressed={group === g}
                      onClick={() => change("groupBy", g)}
                    >
                      {g[0]!.toUpperCase() + g.slice(1)}
                    </Button>
                  ))}
                </div>
                <div className="table-scroll">
                  <table>
                    <caption className="sr-only">
                      Salary breakdown by {group}
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">{group}</th>
                        <th scope="col">Employees / Salaries</th>
                        <th scope="col">Annual total</th>
                        <th scope="col">Average</th>
                        <th scope="col">Median</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.groups.map((g) => (
                        <tr key={g.id}>
                          <th scope="row">{g.name}</th>
                          <td>
                            {g.summary.employeeCount} / {g.summary.salaryCount}
                          </td>
                          <td>
                            {money(g.summary.annualBasePayTotal, currency)}
                          </td>
                          <td>{money(g.summary.average, currency)}</td>
                          <td>{money(g.summary.median, currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!report.groups.length && (
                  <Empty>No groups match these filters.</Empty>
                )}
                <a className="text-link" href="#/employees">
                  View employee directory <ArrowUpRight size={15} />
                </a>
              </section>
            </div>
            <section className="panel fx-panel">
              <h2>About these figures</h2>
              <p>
                Exchange rates are illustrative, not live market rates. The FX
                reporting date selects rates only; employee status, assignments
                and salaries reflect today. These totals are annual base pay,
                not payroll paid.
              </p>
              <details>
                <summary>View exchange-rate dates and sources</summary>
                {report.conversion.rates.length ? (
                  <ul>
                    {report.conversion.rates.map((r) => (
                      <li key={r.currencyCode}>
                        <strong>{r.currencyCode}</strong> · {r.unitsPerUsd} per
                        USD · {r.effectiveDate} ({r.ageDays} days before
                        reporting date) · {r.source}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>Same-currency values require no exchange rate.</p>
                )}
              </details>
            </section>
          </>
        )
      )}
    </>
  );
}
