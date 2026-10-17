import { useState, type FormEvent } from "react";
import type { Catalog, Employee, Page, Salary } from "../../lib/types";
import { api } from "../../lib/api";
import { useResource } from "../../lib/hooks";
import { money, salaryError, today } from "../../lib/format";
import { Button } from "../../components/ui/button";
import { Dialog } from "../../components/ui/dialog";
import {
  Empty,
  ErrorNotice,
  Field,
  Loading,
  Pagination,
} from "../../components/common";
export function SalaryHistory({
  employee,
  catalog,
  refresh,
}: {
  employee: Employee;
  catalog: Catalog;
  refresh: () => void;
}) {
  const [scope, setScope] = useState("all"),
    [page, setPage] = useState(1),
    [revision, setRevision] = useState(0),
    [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null),
    [success, setSuccess] = useState("");
  const result = useResource<Page<Salary>>(
    `/employees/${employee.id}/salary-records?scope=${scope}&page=${page}&pageSize=10`,
    revision,
  );
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const amount = String(values.get("amount")).trim(),
      effectiveDate = String(values.get("effectiveDate"));
    const invalid = salaryError(amount, effectiveDate, employee.hireDate);
    if (invalid) {
      setError(new Error(invalid));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api(`/employees/${employee.id}/salary-records`, {
        method: "POST",
        body: {
          amount,
          currencyCode: String(values.get("currencyCode")),
          effectiveDate,
        },
      });
      setOpen(false);
      setSuccess(
        "Salary revision added. Existing salary history is unchanged.",
      );
      setPage(1);
      setRevision((r) => r + 1);
      refresh();
    } catch (error) {
      setError(error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel salary-panel">
      <div className="section-heading">
        <div>
          <h2>Salary history</h2>
          <p className="muted">
            Original amounts and currencies · Annual base pay
          </p>
        </div>
        <Button
          disabled={!employee.isActive}
          onClick={() => {
            setError(null);
            setOpen(true);
          }}
        >
          Add salary revision
        </Button>
      </div>
      {!employee.isActive && (
        <p className="notice">
          This employee is inactive. Salary history is preserved; new revisions
          are unavailable.
        </p>
      )}
      {success && (
        <p role="status" className="success">
          {success}
        </p>
      )}
      <div className="segmented" aria-label="Salary history scope">
        {["all", "current", "historical", "future"].map((s) => (
          <Button
            key={s}
            variant={scope === s ? "default" : "ghost"}
            aria-pressed={scope === s}
            onClick={() => {
              setScope(s);
              setPage(1);
            }}
          >
            {s === "all"
              ? "All revisions"
              : s === "future"
                ? "Future-dated"
                : s[0]!.toUpperCase() + s.slice(1)}
          </Button>
        ))}
      </div>
      {result.loading ? (
        <Loading label="Loading salary history…" />
      ) : result.error ? (
        <ErrorNotice
          error={result.error}
          retry={() => setRevision((r) => r + 1)}
        />
      ) : (
        result.data && (
          <>
            <div className="table-scroll">
              <table>
                <caption className="sr-only">{scope} salary revisions</caption>
                <thead>
                  <tr>
                    <th scope="col">Effective date (UTC)</th>
                    <th scope="col">Annual salary</th>
                    <th scope="col">Classification</th>
                  </tr>
                </thead>
                <tbody>
                  {result.data.data.map((s) => (
                    <tr key={s.id}>
                      <td>{s.effectiveDate}</td>
                      <td>{money(s.amount, s.currencyCode)}</td>
                      <td>
                        <span className="pill">{s.classification}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!result.data.data.length && (
              <Empty>No {scope === "all" ? "" : scope} salary revisions.</Empty>
            )}
            <Pagination
              page={page}
              pages={result.data.pagination.totalPages}
              total={result.data.pagination.total}
              change={setPage}
            />
          </>
        )
      )}
      <Dialog
        open={open}
        onOpenChange={setOpen}
        busy={busy}
        title="Add salary revision"
        description="Salary revisions are permanent. Review the amount, currency and effective date before saving."
      >
        <form onSubmit={submit} className="space-y-5">
          {error != null && <ErrorNotice error={error} />}
          <Field label="Annual amount" id="revision-amount">
            <input
              id="revision-amount"
              name="amount"
              inputMode="decimal"
              required
              maxLength={16}
            />
          </Field>
          <Field label="Salary currency" id="revision-currency">
            <select
              id="revision-currency"
              name="currencyCode"
              defaultValue={employee.currentSalary?.currencyCode || ""}
              required
            >
              <option value="">Select currency</option>
              {catalog.currencies
                .filter((c) => c.isActive)
                .map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code}
                  </option>
                ))}
            </select>
          </Field>
          <Field
            label="Effective date"
            id="revision-date"
            hint={`On or after hire date ${employee.hireDate}. Future dates are allowed.`}
          >
            <input
              id="revision-date"
              name="effectiveDate"
              type="date"
              min="1000-01-01"
              max="9999-12-31"
              required
              defaultValue={
                today() < employee.hireDate ? employee.hireDate : today()
              }
              aria-describedby="revision-date-hint"
            />
          </Field>
          <div className="form-actions">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save salary revision"}
            </Button>
          </div>
        </form>
      </Dialog>
    </section>
  );
}
