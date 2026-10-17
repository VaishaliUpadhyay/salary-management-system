import type { Catalog, Currency, Master, Page, Single } from "./types";
export class ApiError extends Error {
  constructor(
    message: string,
    public status = 0,
    public code = "NETWORK_ERROR",
    public details: { field?: string; message: string }[] = [],
    public requestId?: string,
  ) {
    super(message);
  }
}
let csrf: string | undefined;
export function setCsrf(value?: string) {
  csrf = value;
}
export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, {
      method: options.method ?? "GET",
      credentials: "include",
      signal: options.signal ?? null,
      headers: {
        Accept: "application/json",
        ...(options.body !== undefined
          ? { "Content-Type": "application/json" }
          : {}),
        ...(options.method && csrf ? { "X-CSRF-Token": csrf } : {}),
      },
      body: options.body === undefined ? null : JSON.stringify(options.body),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new ApiError(
      options.method
        ? "Connection interrupted. Check whether your change was saved before trying again."
        : "Unable to connect. Check your connection and try again.",
    );
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    if (
      response.status === 401 &&
      path !== "/auth/login" &&
      path !== "/auth/session"
    )
      window.dispatchEvent(new Event("session-expired"));
    const error = payload?.error;
    throw new ApiError(
      error?.message ?? "The request could not be completed.",
      response.status,
      error?.code ?? "REQUEST_FAILED",
      error?.details ?? [],
      error?.requestId,
    );
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
async function allMasters(path: string, signal: AbortSignal) {
  const rows: Master[] = [];
  let page = 1;
  while (true) {
    const result = await api<Page<Master>>(
      `${path}?status=all&pageSize=100&page=${page}`,
      { signal },
    );
    rows.push(...result.data);
    if (page >= result.pagination.totalPages) return rows;
    page++;
  }
}
export async function getCatalog(signal: AbortSignal): Promise<Catalog> {
  const [countries, departments, designations, currencies] = await Promise.all([
    allMasters("/countries", signal),
    allMasters("/departments", signal),
    allMasters("/designations", signal),
    api<Single<Currency[]>>("/currencies", { signal }),
  ]);
  return { countries, departments, designations, currencies: currencies.data };
}
