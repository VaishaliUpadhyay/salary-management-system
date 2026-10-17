import { useState, type FormEvent } from "react";
import type { Catalog, Employee, Single } from "../../lib/types";
import { api } from "../../lib/api";
import { salaryError, validDate } from "../../lib/format";
import { Button } from "../../components/ui/button";
import { Field, ErrorNotice } from "../../components/common";
export function EmployeeForm({
  catalog,
  employee,
  saved,
  cancel,
  onBusy,
}: {
  catalog: Catalog;
  employee?: Employee;
  saved: (employee: Employee) => void;
  cancel: () => void;
  onBusy: (busy: boolean) => void;
}) {
  const [department, setDepartment] = useState(
    String(employee?.designation.department.id ?? ""),
  );
  const [designation, setDesignation] = useState(
    String(employee?.designation.id ?? ""),
  );
  const [error, setError] = useState<unknown>(null),
    [busy, setBusy] = useState(false);
  const departments = catalog.departments.filter(
    (d) => d.isActive || d.id === employee?.designation.department.id,
  );
  const designations = catalog.designations.filter(
    (d) =>
      String(d.departmentId) === department &&
      (d.id === employee?.designation.id ||
        (d.isActive &&
          catalog.departments.some(
            (p) => p.id === d.departmentId && p.isActive,
          ))),
  );
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const get = (key: string) => String(data.get(key) ?? "").trim();
    setError(null);
    const hireDate = get("hireDate");
    if (!validDate(hireDate)) {
      setError(new Error("Enter a valid hire date."));
      return;
    }
    if (!employee) {
      const invalid = salaryError(
        get("amount"),
        get("effectiveDate"),
        hireDate,
      );
      if (invalid) {
        setError(new Error(invalid));
        return;
      }
    }
    const body = {
      name: get("name"),
      email: get("email"),
      countryId: Number(get("countryId")),
      designationId: Number(designation),
      hireDate,
      ...(!employee
        ? {
            employeeCode: get("employeeCode").toUpperCase(),
            initialSalary: {
              amount: get("amount"),
              currencyCode: get("currencyCode"),
              effectiveDate: get("effectiveDate"),
            },
          }
        : {}),
    };
    setBusy(true);
    onBusy(true);
    try {
      const result = await api<Single<Employee>>(
        employee ? `/employees/${employee.id}` : "/employees",
        { method: employee ? "PATCH" : "POST", body },
      );
      saved(result.data);
    } catch (error) {
      setError(error);
    } finally {
      setBusy(false);
      onBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="space-y-5">
      {error != null && <ErrorNotice error={error} />}
      <div className="form-grid">
        {!employee && (
          <Field label="Employee code" id="employeeCode">
            <input
              id="employeeCode"
              name="employeeCode"
              required
              maxLength={50}
              pattern="[A-Za-z0-9_-]+"
              placeholder="EMP10003"
            />
          </Field>
        )}
        <Field label="Full name" id="name">
          <input
            id="name"
            name="name"
            required
            maxLength={150}
            defaultValue={employee?.name}
            autoComplete="name"
          />
        </Field>
        <Field label="Email address" id="employee-email">
          <input
            id="employee-email"
            name="email"
            type="email"
            required
            maxLength={254}
            defaultValue={employee?.email}
            autoComplete="email"
          />
        </Field>
        <Field label="Country" id="countryId">
          <select
            id="countryId"
            name="countryId"
            required
            defaultValue={employee?.country.id ?? ""}
          >
            <option value="">Select country</option>
            {catalog.countries
              .filter((c) => c.isActive || c.id === employee?.country.id)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {!c.isActive ? " (retired)" : ""}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Department" id="departmentId">
          <select
            id="departmentId"
            value={department}
            required
            onChange={(e) => {
              setDepartment(e.target.value);
              setDesignation("");
            }}
          >
            <option value="">Select department</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
                {!d.isActive ? " (retired)" : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Designation" id="designationId">
          <select
            id="designationId"
            required
            value={designation}
            onChange={(e) => setDesignation(e.target.value)}
          >
            <option value="">Select designation</option>
            {designations.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
                {!d.isActive ? " (retired)" : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Hire date" id="hireDate">
          <input
            id="hireDate"
            name="hireDate"
            type="date"
            min="1000-01-01"
            max="9999-12-31"
            required
            defaultValue={employee?.hireDate}
          />
        </Field>
      </div>
      {!employee && (
        <fieldset>
          <legend>Initial annual base salary</legend>
          <div className="form-grid">
            <Field label="Annual amount" id="amount">
              <input
                id="amount"
                name="amount"
                inputMode="decimal"
                required
                maxLength={16}
                placeholder="75000.00"
              />
            </Field>
            <Field label="Salary currency" id="currencyCode">
              <select
                id="currencyCode"
                name="currencyCode"
                required
                defaultValue=""
              >
                <option value="">Select currency</option>
                {catalog.currencies
                  .filter((c) => c.isActive)
                  .map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} · {c.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Effective date" id="effectiveDate">
              <input
                id="effectiveDate"
                name="effectiveDate"
                type="date"
                min="1000-01-01"
                max="9999-12-31"
                required
              />
            </Field>
          </div>
          <p className="muted text-sm mt-3">
            The employee and initial salary are saved together. Future hire
            dates are supported.
          </p>
        </fieldset>
      )}
      {employee && (
        <p className="muted text-sm">
          Employee code is permanent. Hire-date changes cannot invalidate
          existing salary history.
        </p>
      )}
      <div className="form-actions">
        <Button variant="outline" onClick={cancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : employee ? "Save changes" : "Create employee"}
        </Button>
      </div>
    </form>
  );
}
