import { InputError, messages } from "../../lib/errors";
import { fieldLabel, outcomeLabel, rowErrorMessage } from "./report";
import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "../../lib/api";
import type { Single } from "../../lib/types";
import { Button } from "../../components/ui/button";
import { ErrorNotice, Field, Pagination } from "../../components/common";
import { CSV_HEADER, downloadCsv, errorCsv, type ImportResult } from "./report";
export function ImportPage() {
  const [file, setFile] = useState<File | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null),
    [result, setResult] = useState<ImportResult | null>(null),
    [uncertain, setUncertain] = useState(false),
    [page, setPage] = useState(1);
  useEffect(() => {
    if (!busy) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError(null);
    setResult(null);
    setUncertain(false);
    setPage(1);
    if (!file || !/\.csv$/i.test(file.name)) {
      setError(new InputError("file", "Select a .csv file."));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError(new InputError("file", messages.FILE_TOO_LARGE!));
      return;
    }
    if (!file.size) {
      setError(new InputError("file", "The selected file is empty. Add employee rows and select it again."));
      return;
    }
    setBusy(true);
    const body = new FormData();
    body.append("file", file);
    try {
      const response = await api<Single<ImportResult>>("/imports/employees", {
        method: "POST",
        body,
      });
      setResult(response.data);
    } catch (error) {
      setError(error);
      if (error instanceof ApiError) {
        if (error.partialData) setResult(error.partialData as ImportResult);
        if (error.status === 0 || error.status >= 500 || error.code === "INVALID_WRITE_RESPONSE") setUncertain(true);
      }
    } finally {
      setBusy(false);
    }
  }
  const rows = result?.rows ?? [],
    pages = Math.ceil(rows.length / 50);
  return (
    <>
      <header className="page-heading">
        <div>
          <span className="eyebrow">BULK EMPLOYEE & SALARY DATA</span>
          <h1>CSV Import</h1>
          <p className="muted">
            Validate every record. Preserve existing people and pay history.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() =>
            downloadCsv("employee-import-template.csv", CSV_HEADER + "\r\n")
          }
        >
          Download CSV template
        </Button>
      </header>
      <section className="panel">
        <h2>Prepare your file</h2>
        <p className="notice">
          UTF-8 .csv only · Maximum 5 MiB · 10,000 data rows · One row per
          employee. Header order may vary; all ten columns are required. Use
          existing country, department and designation codes. Do not include a
          status column.
        </p>
        <div
          className="table-scroll"
          tabIndex={0}
          aria-label="Required CSV columns"
        >
          <code>{CSV_HEADER}</code>
        </div>
        <p className="muted mt-4">
          New employees are created active with their initial salary. Existing
          master fields must match exactly after normalization. Identical
          salaries skip; a new effective date adds a revision. All duplicate
          employee codes in a file are rejected. Inactive employees cannot
          receive new revisions.
        </p>
        <form onSubmit={submit} className="space-y-5 mt-6">
          <Field
            error={error} field="file" label="CSV file"
            id="csv-file"
            hint="Quoted commas and newlines are supported. Dates: YYYY-MM-DD. Amounts: non-negative decimals with at most two decimal places."
          >
            <input
              id="csv-file"
              type="file"
              accept=".csv,text/csv"
              disabled={busy}
              aria-describedby="csv-file-hint"
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setResult(null);
                setError(null);
                setUncertain(false);
              }}
            />
          </Field>
          <Button type="submit" disabled={busy || !file}>
            {busy ? "Uploading and processing…" : "Import CSV"}
          </Button>
        </form>
        {busy && (
          <p role="status" className="notice">
            Uploading and processing rows. Large imports can take time. Keep
            this page open; do not submit the file again while processing.
          </p>
        )}
        {error != null && <ErrorNotice error={error} inlineFields={["file"]} />}
        {uncertain && (
          <p role="alert" className="notice">
            The outcome is incomplete or unknown. Some rows may already be
            committed; a network failure does not roll them back. Wait for
            processing to finish, check employee records, then deliberately
            reimport the same file. Unchanged records skip under the current
            master/status rules.
          </p>
        )}
        <p className="muted text-sm mt-4">
          Valid rows commit independently; rejected rows do not undo successful
          rows. Malformed files are rejected before any writes. Navigating away
          can lose the result report while processing continues.
        </p>
      </section>
      {result && (
        <section className="panel mt-6" aria-label="Import results">
          <h2>
            {result.processingIncomplete
              ? "Partial results — processing incomplete"
              : "Import results"}
          </h2>
          <p role="status" className="notice">
            Total rows: {result.totalRows} · Successfully imported:{" "}
            {result.counts.created + result.counts.updated} · Created:{" "}
            {result.counts.created} · Salary revisions: {result.counts.updated}{" "}
            · Skipped: {result.counts.skipped} · Failed:{" "}
            {result.counts.rejected}
            {result.processingIncomplete
              ? ` · Unresolved: ${result.totalRows - result.rows.length}`
              : ""}
          </p>
          <Button
            variant="outline"
            disabled={!result.rows.some((row) => row.errors?.length)}
            onClick={() => downloadCsv("import-errors.csv", errorCsv(result))}
          >
            Download error report
          </Button>
          <div
            className="table-scroll mt-4"
            tabIndex={0}
            aria-label="Row outcomes"
          >
            <table className="import-errors">
              <caption className="sr-only">
                Import record outcomes; header is row 1
              </caption>
              <thead>
                <tr>
                  <th scope="col">Row</th>
                  <th scope="col">Employee code</th>
                  <th scope="col">Outcome</th>
                  <th scope="col">Validation messages</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice((page - 1) * 50, page * 50).map((row) => (
                  <tr key={row.rowNumber}>
                    <td>{row.rowNumber}</td>
                    <td>{row.employeeCode || "Invalid code"}</td>
                    <td>{outcomeLabel(row.outcome)}</td>
                    <td>
                      {row.errors?.map((e, i) => (
                        <p key={i}>
                          {`${fieldLabel(e.field)}: `}
                          {rowErrorMessage(e)}
                        </p>
                      )) ?? "—"}
                      {row.retryable && <p>You can retry this row.</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            pages={pages}
            total={rows.length}
            change={setPage}
          />
        </section>
      )}
    </>
  );
}
