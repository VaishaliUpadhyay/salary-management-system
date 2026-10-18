import type { Catalog, Currency, Master, Page, Single } from "./types";
export class ApiError extends Error {
  constructor(
    message: string,
    public status = 0,
    public code = "NETWORK_ERROR",
    public details: { field?: string; code?: string; message: string }[] = [],
    public requestId?: string,
    public partialData?: unknown,
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
        ...(options.body !== undefined && !(options.body instanceof FormData)
          ? { "Content-Type": "application/json" }
          : {}),
        ...(options.method && csrf ? { "X-CSRF-Token": csrf } : {}),
      },
      body:
        options.body instanceof FormData
          ? options.body
          : options.body === undefined
            ? null
            : JSON.stringify(options.body),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new ApiError(
      options.method
        ? "Connection interrupted. Check whether your change was saved before trying again."
        : "Unable to connect. Check your connection and try again.",
      0, options.method ? "NETWORK_WRITE_ERROR" : "NETWORK_ERROR",
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
      typeof error?.code === "string" ? error.code : "REQUEST_FAILED",
      Array.isArray(error?.details) ? error.details.filter((d: unknown) => d && typeof d === "object" && ("field" in d ? typeof d.field === "string" : true)) : [],
      typeof error?.requestId === "string" ? error.requestId : response.headers.get("x-request-id") ?? undefined,
      payload?.data,
    );
  }
  if (response.status === 204) return undefined as T;
  try { return await response.json() as T; }
  catch { throw new ApiError("Invalid response", response.status, options.method ? "INVALID_WRITE_RESPONSE" : "INVALID_RESPONSE", [], response.headers.get("x-request-id") ?? undefined); }
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
