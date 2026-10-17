import type { Catalog } from "../lib/types";
import { Field } from "./common";
export function OrganizationFilters({
  catalog,
  values,
  change,
}: {
  catalog: Catalog;
  values: URLSearchParams;
  change: (key: string, value: string) => void;
}) {
  const fields = [
    { key: "countryId", label: "Country", rows: catalog.countries },
    { key: "departmentId", label: "Department", rows: catalog.departments },
    {
      key: "designationId",
      label: "Designation",
      rows: catalog.designations.filter(
        (d) =>
          !values.get("departmentId") ||
          String(d.departmentId) === values.get("departmentId"),
      ),
    },
  ];
  return (
    <>
      {fields.map(({ key, label, rows }) => (
        <Field key={key} label={label} id={`filter-${key}`}>
          <select
            id={`filter-${key}`}
            value={values.get(key) ?? ""}
            onChange={(event) => change(key, event.target.value)}
          >
            <option value="">All {label.toLowerCase()}s</option>
            {rows.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
                {!row.isActive ? " (retired)" : ""}
              </option>
            ))}
          </select>
        </Field>
      ))}
    </>
  );
}
