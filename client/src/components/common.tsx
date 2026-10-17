import type { ReactNode } from "react";
import { LoaderCircle, AlertCircle } from "lucide-react";
import { ApiError } from "../lib/api";
import { Button } from "./ui/button";
export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div role="status" className="state">
      <LoaderCircle className="animate-spin" size={22} />
      {label}
    </div>
  );
}
export function ErrorNotice({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => void;
}) {
  const e = error instanceof Error ? error : new Error("Something went wrong.");
  const advice =
    e instanceof ApiError && e.code === "MISSING_EXCHANGE_RATES"
      ? "This report is unavailable because required exchange rates are missing. Choose another reporting date or currency."
      : e instanceof ApiError && e.code === "REPORT_NUMERIC_RANGE_EXCEEDED"
        ? "This report exceeds the supported numerical range. Narrow the filters or choose another currency."
        : null;
  return (
    <div role="alert" className="error-box">
      <AlertCircle size={20} />
      <div>
        <strong>{advice ?? e.message}</strong>
        {e instanceof ApiError && e.details.length > 0 && (
          <ul>
            {e.details.map((d, i) => (
              <li key={i}>
                {d.field ? `${d.field}: ` : ""}
                {d.message}
              </li>
            ))}
          </ul>
        )}
        {e instanceof ApiError && e.requestId && (
          <small>Reference: {e.requestId}</small>
        )}
        {retry && (
          <Button variant="outline" onClick={retry}>
            Try again
          </Button>
        )}
      </div>
    </div>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return <div className="state muted">{children}</div>;
}
export function Field({
  label,
  id,
  children,
  hint,
}: {
  label: string;
  id: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && (
        <small id={`${id}-hint`} className="muted">
          {hint}
        </small>
      )}
    </div>
  );
}
export function Pagination({
  page,
  pages,
  total,
  change,
}: {
  page: number;
  pages: number;
  total: number;
  change: (page: number) => void;
}) {
  return (
    <nav className="pagination" aria-label="Pagination">
      <span>
        {total.toLocaleString()} results · Page {page} of {Math.max(1, pages)}
      </span>
      <div className="flex gap-2">
        <Button
          variant="outline"
          disabled={page <= 1}
          onClick={() => change(page - 1)}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          disabled={page >= pages}
          onClick={() => change(page + 1)}
        >
          Next
        </Button>
      </div>
    </nav>
  );
}
