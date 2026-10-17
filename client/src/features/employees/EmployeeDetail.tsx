import { useState } from "react";
import type { Catalog, Employee, Single } from "../../lib/types";
import { api } from "../../lib/api";
import { useResource } from "../../lib/hooks";
import { money } from "../../lib/format";
import { Button } from "../../components/ui/button";
import { Dialog } from "../../components/ui/dialog";
import { ErrorNotice, Loading } from "../../components/common";
import { EmployeeForm } from "./EmployeeForm";
import { SalaryHistory } from "../salaries/SalaryHistory";
export function EmployeeDetail({
  id,
  catalog,
  search,
}: {
  id: string;
  catalog: Catalog;
  search: string;
}) {
  const [revision, setRevision] = useState(0),
    [editing, setEditing] = useState(false),
    [saving, setSaving] = useState(false),
    [deactivating, setDeactivating] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null),
    [success, setSuccess] = useState(
      new URLSearchParams(search).get("created")
        ? "Employee created successfully."
        : "",
    );
  const result = useResource<Single<Employee>>(`/employees/${id}`, revision);
  const employee = result.data?.data;
  // Keep the existing detail mounted during refresh, but never across employee navigation.
  const [savedEmployee, setSavedEmployee] = useState<Employee | null>(null);
  const current =
    employee ?? (savedEmployee?.id === Number(id) ? savedEmployee : null);
  const back = new URLSearchParams(search).get("return");
  const returnTo =
    back?.startsWith("/employees?") || back === "/employees"
      ? back
      : "/employees";
  if (result.error)
    return (
      <ErrorNotice
        error={result.error}
        retry={() => setRevision((r) => r + 1)}
      />
    );
  if (!current) return <Loading label="Loading employee…" />;
  const refresh = () => {
    setSavedEmployee(current);
    setRevision((r) => r + 1);
  };
  async function deactivate() {
    setBusy(true);
    setError(null);
    try {
      const response = await api<Single<Employee>>(
        `/employees/${id}/deactivate`,
        { method: "POST", body: {} },
      );
      setSavedEmployee(response.data);
      setDeactivating(false);
      setSuccess("Employee deactivated. Salary history has been preserved.");
      setRevision((r) => r + 1);
    } catch (error) {
      setError(error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <a className="text-link" href={`#${returnTo}`}>
        ← Back to employees
      </a>
      <header className="page-heading">
        <div>
          <span className="eyebrow">{current.employeeCode}</span>
          <h1>{current.name}</h1>
          <p className="muted">
            {current.designation.name} · {current.designation.department.name}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setEditing(true)}>
            Edit profile
          </Button>
          <Button
            variant="destructive"
            disabled={!current.isActive}
            onClick={() => {
              setError(null);
              setDeactivating(true);
            }}
          >
            Deactivate
          </Button>
        </div>
      </header>
      {success && (
        <p role="status" className="success">
          {success}
        </p>
      )}
      <section className="panel profile-grid">
        <div>
          <span className="muted">Email</span>
          <p>{current.email}</p>
        </div>
        <div>
          <span className="muted">Country</span>
          <p>{current.country.name}</p>
        </div>
        <div>
          <span className="muted">Hire date</span>
          <p>{current.hireDate}</p>
        </div>
        <div>
          <span className="muted">Status</span>
          <p>
            <span
              className={`pill ${current.isActive ? "active" : "inactive"}`}
            >
              {current.isActive ? "Active" : "Inactive"}
            </span>
          </p>
        </div>
      </section>
      <div className="salary-summary">
        <article className="panel">
          <span className="eyebrow">CURRENT ANNUAL SALARY</span>
          <h2>
            {current.currentSalary
              ? money(
                  current.currentSalary.amount,
                  current.currentSalary.currencyCode,
                )
              : "No current salary"}
          </h2>
          <p className="muted">
            {current.currentSalary
              ? `Effective ${current.currentSalary.effectiveDate}`
              : "No revision is effective yet."}
          </p>
        </article>
        <article className="panel">
          <span className="eyebrow">NEXT FUTURE REVISION</span>
          <h2>
            {current.nextFutureSalary
              ? money(
                  current.nextFutureSalary.amount,
                  current.nextFutureSalary.currencyCode,
                )
              : "Nothing scheduled"}
          </h2>
          <p className="muted">
            {current.nextFutureSalary
              ? `Effective ${current.nextFutureSalary.effectiveDate}`
              : "Future revisions appear separately from current pay."}
          </p>
        </article>
      </div>
      <SalaryHistory employee={current} catalog={catalog} refresh={refresh} />
      <Dialog
        busy={saving}
        open={editing}
        onOpenChange={setEditing}
        title="Edit employee profile"
        description="Update master information. Existing salary records remain unchanged."
      >
        <EmployeeForm
          onBusy={setSaving}
          employee={current}
          catalog={catalog}
          cancel={() => setEditing(false)}
          saved={(e) => {
            setSavedEmployee(e);
            setEditing(false);
            setSuccess("Employee profile updated.");
            setRevision((r) => r + 1);
          }}
        />
      </Dialog>
      <Dialog
        open={deactivating}
        onOpenChange={setDeactivating}
        busy={busy}
        title="Deactivate this employee?"
        description={`${current.name} will be excluded from active-workforce analytics. Their profile and salary history will remain available. There is no reactivation workflow in this MVP.`}
      >
        {error != null && <ErrorNotice error={error} />}
        <div className="form-actions">
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => setDeactivating(false)}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={busy}
            onClick={() => void deactivate()}
          >
            {busy ? "Deactivating…" : "Confirm deactivation"}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
