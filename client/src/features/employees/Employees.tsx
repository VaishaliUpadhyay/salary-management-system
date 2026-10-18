import { useState } from "react";
import { Plus, Search } from "lucide-react";
import type { Catalog, Employee, Page } from "../../lib/types";
import { navigate, queryString, useResource } from "../../lib/hooks";
import { money } from "../../lib/format";
import {
  Field,
  Empty,
  ErrorNotice,
  Loading,
  Pagination,
} from "../../components/common";
import { OrganizationFilters } from "../../components/OrganizationFilters";
import { Button } from "../../components/ui/button";
import { Dialog } from "../../components/ui/dialog";
import { EmployeeForm } from "./EmployeeForm";
export function Employees({
  catalog,
  search,
}: {
  catalog: Catalog;
  search: string;
}) {
  const [creating, setCreating] = useState(false),
    [retry, setRetry] = useState(0),
    [saving, setSaving] = useState(false);
  const values = new URLSearchParams(search);
  const query = queryString({
    q: values.get("q") || undefined,
    page: values.get("page") || "1",
    pageSize: values.get("pageSize") || "25",
    status: values.get("status") || "active",
    countryId: values.get("countryId") || undefined,
    departmentId: values.get("departmentId") || undefined,
    designationId: values.get("designationId") || undefined,
    sort: values.get("sort") || "employeeCode",
    order: values.get("order") || "asc",
  });
  const result = useResource<Page<Employee>>(`/employees?${query}`, retry);
  function change(key: string, value: string) {
    const params = new URLSearchParams(search);
    if (value) params.set(key, value);
    else params.delete(key);
    if (key !== "page") params.delete("page");
    if (key === "departmentId") params.delete("designationId");
    navigate(`/employees?${params}`);
  }
  const returnTo = encodeURIComponent(
    `/employees${search ? `?${search}` : ""}`,
  );
  return (
    <>
      <header className="page-heading">
        <div>
          <span className="eyebrow">YOUR WORKFORCE</span>
          <h1>Employee directory</h1>
          <p className="muted">
            Manage your people and their compensation, in one place.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus size={17} />
          Add employee
        </Button>
      </header>
      <section className="panel filter-grid" aria-label="Employee filters">
        <form
          className="search-field"
          onSubmit={(e) => {
            e.preventDefault();
            change("q", String(new FormData(e.currentTarget).get("q")).trim());
          }}
        >
          <Field error={result.error} label="Search employees" id="search">
            <input
              id="search"
              name="q"
              key={values.get("q")}
              defaultValue={values.get("q") ?? ""}
              maxLength={100}
              placeholder="Search by name, code or email"
            />
          </Field>
          <Button variant="outline" type="submit" aria-label="Search">
            <Search size={18} />
          </Button>
        </form>
        <OrganizationFilters
          error={result.error}
          catalog={catalog}
          values={values}
          change={change}
        />
        <Field error={result.error} label="Employee status" id="status">
          <select
            id="status"
            value={values.get("status") || "active"}
            onChange={(e) => change("status", e.target.value)}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="all">All employees</option>
          </select>
        </Field>
        <Field error={result.error} label="Sort by" id="sort">
          <select
            id="sort"
            value={values.get("sort") || "employeeCode"}
            onChange={(e) => change("sort", e.target.value)}
          >
            <option value="employeeCode">Employee code</option>
            <option value="name">Name</option>
            <option value="hireDate">Hire date</option>
          </select>
        </Field>
        <Button variant="ghost" onClick={() => navigate("/employees")}>
          Reset filters
        </Button>
      </section>
      <section className="panel directory-panel">
        {result.loading ? (
          <Loading label="Loading employees…" />
        ) : result.error ? (
          <ErrorNotice
            error={result.error}
            inlineFields={["q", "status", "sort", "countryId", "departmentId", "designationId"]}
            retry={() => setRetry((r) => r + 1)}
          />
        ) : (
          result.data && (
            <>
              <div className="table-scroll">
                <table>
                  <caption className="sr-only">
                    Employee directory, current salaries as of{" "}
                    {result.data.salaryAsOfDate}
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Employee</th>
                      <th scope="col">Department / designation</th>
                      <th scope="col">Country</th>
                      <th scope="col">Annual salary</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.data.data.map((e) => (
                      <tr key={e.id}>
                        <td>
                          <a
                            href={`#/employees/${e.id}?return=${returnTo}`}
                            className="employee-link"
                          >
                            {e.name}
                          </a>
                          <span className="cell-sub">
                            {e.employeeCode} · {e.email}
                          </span>
                        </td>
                        <td>
                          {e.designation.department.name}
                          <span className="cell-sub">{e.designation.name}</span>
                        </td>
                        <td>{e.country.name}</td>
                        <td>
                          {e.currentSalary ? (
                            money(
                              e.currentSalary.amount,
                              e.currentSalary.currencyCode,
                            )
                          ) : (
                            <span className="muted">No current salary</span>
                          )}
                        </td>
                        <td>
                          <span
                            className={`pill ${e.isActive ? "active" : "inactive"}`}
                          >
                            {e.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!result.data.data.length && (
                <Empty>No employees match these filters.</Empty>
              )}
              <Pagination
                page={result.data.pagination.page}
                pages={result.data.pagination.totalPages}
                total={result.data.pagination.total}
                change={(page) => change("page", String(page))}
              />
              <p className="muted text-xs px-6 pb-4">
                Original currencies shown. Salaries are current as of{" "}
                {result.data.salaryAsOfDate} UTC.
              </p>
            </>
          )
        )}
      </section>
      <Dialog
        busy={saving}
        open={creating}
        onOpenChange={setCreating}
        title="Add an employee"
        description="Create a profile and its initial salary record."
      >
        <EmployeeForm
          onBusy={setSaving}
          catalog={catalog}
          saved={(e) => {
            setCreating(false);
            navigate(`/employees/${e.id}?created=true&return=${returnTo}`);
          }}
          cancel={() => setCreating(false)}
        />
      </Dialog>
    </>
  );
}
