import { useEffect, useState, lazy, Suspense } from "react";
import {
  Landmark,
  LayoutDashboard,
  Users,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import {
  AuthProvider,
  useAuth,
  Login,
  SessionGate,
} from "./features/auth/Auth";
import { getCatalog } from "./lib/api";
import { navigate, useLocation } from "./lib/hooks";
import type { Catalog } from "./lib/types";
import { Button } from "./components/ui/button";
import { ErrorNotice, Loading } from "./components/common";
import { Employees } from "./features/employees/Employees";
import { EmployeeDetail } from "./features/employees/EmployeeDetail";
const Dashboard = lazy(() =>
  import("./features/analytics/Dashboard").then((module) => ({
    default: module.Dashboard,
  })),
);
function Workspace({ route }: { route: string }) {
  const auth = useAuth();
  const [catalog, setCatalog] = useState<Catalog | null>(null),
    [error, setError] = useState<unknown>(null),
    [retry, setRetry] = useState(0),
    [logoutError, setLogoutError] = useState<unknown>(null),
    [leaving, setLeaving] = useState(false);
  const [path, search = ""] = route.split("?");
  useEffect(() => {
    const c = new AbortController();
    setError(null);
    getCatalog(c.signal)
      .then((result) => {
        if (!c.signal.aborted) setCatalog(result);
      })
      .catch((error) => {
        if (!c.signal.aborted) setError(error);
      });
    return () => c.abort();
  }, [retry]);
  useEffect(() => {
    document.getElementById("main-content")?.focus();
    document.title = `${path?.startsWith("/employees") ? "Employees" : "Compensation"} · PeopleLedger`;
  }, [path]);
  const detail = /^\/employees\/([1-9]\d*)$/.exec(path ?? "");
  return (
    <div className="app-shell">
      <a
        className="skip-link"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        Skip to main content
      </a>
      <aside className="sidebar">
        <a className="brand" href="#/dashboard">
          <Landmark size={26} />
          PeopleLedger
        </a>
        <span className="sidebar-label">HR WORKSPACE</span>
        <nav aria-label="Main navigation">
          <a
            href="#/dashboard"
            aria-current={path === "/dashboard" ? "page" : undefined}
          >
            <LayoutDashboard size={19} />
            Overview
          </a>
          <a
            href="#/employees"
            aria-current={path?.startsWith("/employees") ? "page" : undefined}
          >
            <Users size={19} />
            Employees
          </a>
        </nav>
        <div className="sidebar-note">
          <ShieldCheck size={20} />
          <p>
            A considered approach
            <br />
            to compensation.
          </p>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span className="muted">People & compensation</span>
          <div className="account">
            <span className="avatar">HR</span>
            <div>
              <strong>HR Manager</strong>
              <span>{auth.session?.user.email}</span>
            </div>
            <Button
              variant="ghost"
              disabled={leaving}
              onClick={async () => {
                setLeaving(true);
                setLogoutError(null);
                try {
                  await auth.logout();
                } catch (error) {
                  setLogoutError(error);
                } finally {
                  setLeaving(false);
                }
              }}
            >
              <LogOut size={17} />
              <span>{leaving ? "Signing out…" : "Sign out"}</span>
            </Button>
          </div>
        </header>
        <main id="main-content" tabIndex={-1} className="main-content">
          {logoutError != null && <ErrorNotice error={logoutError} />}{" "}
          {error ? (
            <ErrorNotice error={error} retry={() => setRetry((r) => r + 1)} />
          ) : !catalog ? (
            <Loading label="Loading workspace…" />
          ) : (
            <Suspense fallback={<Loading label="Loading dashboard…" />}>
              {path === "/dashboard" ? (
                <Dashboard catalog={catalog} search={search} />
              ) : path === "/employees" ? (
                <Employees catalog={catalog} search={search} />
              ) : detail ? (
                <EmployeeDetail
                  key={detail[1]}
                  id={detail[1]!}
                  catalog={catalog}
                  search={search}
                />
              ) : (
                <section className="panel">
                  <h1>Page not found</h1>
                  <a href="#/dashboard" className="text-link">
                    Return to overview
                  </a>
                </section>
              )}
            </Suspense>
          )}
        </main>
        <footer>
          PeopleLedger · Annual base compensation · Synthetic demonstration data
        </footer>
      </div>
    </div>
  );
}
function Router() {
  const auth = useAuth();
  const route = useLocation();
  const loginRoute = route.split("?")[0] === "/login";
  const requested =
    new URLSearchParams(route.split("?")[1]).get("next") || "/dashboard";
  const next = /^\/(dashboard|employees)([/?]|$)/.test(requested)
    ? requested
    : "/dashboard";
  useEffect(() => {
    if (auth.loading || auth.error) return;
    if (!auth.session && !loginRoute)
      navigate(`/login?next=${encodeURIComponent(route)}`, true);
    else if (auth.session && loginRoute) navigate(next, true);
  }, [auth.loading, auth.error, auth.session, loginRoute, next, route]);
  return (
    <SessionGate>
      {auth.session ? (
        <Workspace route={loginRoute ? next : route} />
      ) : (
        <Login next={next} />
      )}
    </SessionGate>
  );
}
export function App() {
  return (
    <AuthProvider>
      <Router />
    </AuthProvider>
  );
}
