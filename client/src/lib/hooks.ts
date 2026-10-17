import { useEffect, useState, useSyncExternalStore } from "react";
import { api } from "./api";
export function useResource<T>(path: string, revision = 0) {
  const key = `${path}:${revision}`;
  const [state, setState] = useState<{
    key: string;
    data?: T;
    error?: unknown;
  }>({ key: "" });
  useEffect(() => {
    const controller = new AbortController();
    api<T>(path, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setState({ key, data });
      })
      .catch((error) => {
        if (!controller.signal.aborted) setState({ key, error });
      });
    return () => controller.abort();
  }, [path, key]);
  return state.key === key
    ? { ...state, loading: false }
    : { loading: true, data: undefined, error: undefined };
}
function subscribe(listener: () => void) {
  window.addEventListener("hashchange", listener);
  return () => window.removeEventListener("hashchange", listener);
}
export function useLocation() {
  return useSyncExternalStore(
    subscribe,
    () => window.location.hash.slice(1) || "/dashboard",
  );
}
export function navigate(path: string, replace = false) {
  if (replace) {
    window.history.replaceState(null, "", `#${path}`);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  } else window.location.hash = path;
}
export function queryString(
  values: Record<string, string | number | boolean | undefined>,
) {
  return new URLSearchParams(
    Object.entries(values)
      .filter(([, value]) => value !== undefined && value !== "")
      .map(([key, value]) => [key, String(value)]),
  ).toString();
}
