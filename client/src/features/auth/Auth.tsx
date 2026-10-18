import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
  type FormEvent,
} from "react";
import { api, ApiError, setCsrf } from "../../lib/api";
import type { Session, Single } from "../../lib/types";
import { Button } from "../../components/ui/button";
import { ErrorNotice, Field, Loading } from "../../components/common";
import { navigate } from "../../lib/hooks";
import { Landmark, ShieldCheck } from "lucide-react";
interface AuthState {
  session: Session | null;
  loading: boolean;
  expired: boolean;
  error: unknown;
  reload: () => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}
const Context = createContext<AuthState | null>(null);
export const useAuth = () => useContext(Context)!;
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null),
    [loading, setLoading] = useState(true),
    [expired, setExpired] = useState(false),
    [error, setError] = useState<unknown>(null),
    [version, setVersion] = useState(0);
  const accept = (value: Session | null) => {
    setCsrf(value?.csrfToken);
    setSession(value);
  };
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    api<Single<Session>>("/auth/session", { signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) accept(result.data);
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          accept(null);
          if (!(error instanceof ApiError && error.status === 401))
            setError(error);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [version]);
  useEffect(() => {
    const expire = () => {
      accept(null);
      setExpired(true);
    };
    window.addEventListener("session-expired", expire);
    const delay = session
      ? Math.max(0, new Date(session.expiresAt).getTime() - Date.now())
      : null;
    const timer =
      delay === null
        ? undefined
        : window.setTimeout(expire, Math.min(delay, 2147483647));
    return () => {
      window.removeEventListener("session-expired", expire);
      window.clearTimeout(timer);
    };
  }, [session]);
  return (
    <Context.Provider
      value={{
        session,
        loading,
        error,
        expired,
        reload: () => setVersion((v) => v + 1),
        login: async (email, password) => {
          const result = await api<Single<Session>>("/auth/login", {
            method: "POST",
            body: { email, password },
          });
          accept(result.data);
          setExpired(false);
        },
        logout: async () => {
          try {
            await api<void>("/auth/logout", { method: "POST", body: {} });
          } catch (error) {
            if (!(error instanceof ApiError && error.status === 401))
              throw error;
          }
          accept(null);
          setExpired(false);
          navigate("/login", true);
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function Login({ next }: { next: string }) {
  const auth = useAuth();
  const [error, setError] = useState<unknown>(null),
    [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setError(null);
    setBusy(true);
    try {
      await auth.login(
        String(values.get("email")).trim(),
        String(values.get("password")),
      );
      form.reset();
      navigate(next, true);
    } catch (error) {
      setError(error);
      (form.elements.namedItem("password") as HTMLInputElement).value = "";
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-shell">
      <section className="login-story">
        <div className="brand">
          <Landmark /> PeopleLedger
        </div>
        <span className="eyebrow">YOUR PEOPLE. A CLEARER PICTURE.</span>
        <h1>
          Compensation,
          <br />
          with confidence.
        </h1>
        <p>
          A thoughtful workspace to manage your people, preserve salary history
          and understand compensation across your organization.
        </p>
        <div className="login-note">
          <ShieldCheck /> Built for your HR team · Secure access
        </div>
      </section>
      <section className="login-panel">
        <div className="login-card">
          <span className="eyebrow">HR WORKSPACE</span>
          <h2>Welcome back</h2>
          <p className="muted">Sign in to your compensation workspace.</p>
          {auth.expired && (
            <p role="status" className="notice">
              Your session expired. Sign in again to continue.
            </p>
          )}
          <form onSubmit={submit} className="space-y-5">
            {error != null && <ErrorNotice error={error} inlineFields={["email", "password"]} />}
            <Field error={error} label="Email address" id="email">
              <input
                id="email"
                name="email"
                type="email"
                required
                maxLength={254}
                autoComplete="username"
                placeholder="you@company.com"
              />
            </Field>
            <Field error={error} label="Password" id="password">
              <input
                id="password"
                name="password"
                type="password"
                required
                maxLength={128}
                autoComplete="current-password"
              />
            </Field>
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? "Signing in…" : "Sign in"}
            </Button>
          </form>
          <p className="muted text-xs mt-6">
            Access is limited to the designated HR Manager. Contact your system
            administrator for account assistance.
          </p>
        </div>
      </section>
    </main>
  );
}
export function SessionGate({ children }: { children: ReactNode }) {
  const auth = useAuth();
  return auth.loading ? (
    <Loading label="Checking your session…" />
  ) : auth.error ? (
    <ErrorNotice error={auth.error} retry={auth.reload} />
  ) : (
    children
  );
}
