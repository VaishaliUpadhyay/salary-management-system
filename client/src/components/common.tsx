import { cloneElement, isValidElement, type ReactNode, type ReactElement } from "react";
import { LoaderCircle, AlertCircle } from "lucide-react";
import { presentation } from "../lib/errors";
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
  inlineFields = [],
}: {
  error: unknown;
  retry?: () => void;
  inlineFields?: string[];
}) {
  const view = presentation(error);
  const fields = view.fields.filter(issue => !inlineFields.includes(issue.field) && issue.message !== view.title);
  if (view.fields.length > 0 && view.fields.every(issue => inlineFields.includes(issue.field))) return null;
  return (
    <div role="alert" className="error-box">
      <AlertCircle size={18} aria-hidden="true" />
      <div className="error-content">
        <strong>{view.title}</strong>
        {fields.length > 0 && (
          <ul>
            {fields.map((d, i) => (
              <li key={i}>
                {`${d.label}: `}
                {d.message}
              </li>
            ))}
          </ul>
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
  error,
  field,
}: {
  label: string;
  id: string;
  children: ReactNode;
  hint?: string;
  error?: unknown;
  field?: string;
}) {
  const control = isValidElement(children) ? children as ReactElement<{ name?: string; required?: boolean; 'aria-describedby'?: string | undefined; 'aria-invalid'?: boolean }> : null;
  const key = field ?? control?.props.name ?? id;
  const issues = presentation(error).fields.filter(issue => issue.field === key);
  const describedBy = [...new Set([...(control?.props['aria-describedby'] ?? '').split(' '), hint ? `${id}-hint` : '', issues.length ? `${id}-error` : ''].filter(Boolean))].join(' ');
  return (
    <div className="field">
      <div className="field-label"><label htmlFor={id}>{label}</label>{control?.props.required && <span className="muted" aria-hidden="true">Required</span>}</div>
      {control ? cloneElement(control, { 'aria-invalid': issues.length > 0, 'aria-describedby': describedBy || undefined }) : children}
      {issues.length > 0 && <small id={`${id}-error`} role="alert" className="field-error">{issues.map(issue => issue.message).join(' ')}</small>}
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
