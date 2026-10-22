"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  AlertCircle,
  Building2,
  GraduationCap,
  LayoutDashboard,
  Loader2,
  LogOut,
  ShieldCheck,
  Users,
} from "lucide-react";
import { apiErrorMessage, type UserRole } from "@/lib/api";
import { dashboardPathForRole, useAuth } from "@/lib/auth";

const ROLE_LABELS: Record<UserRole, string> = {
  PARENT: "Parent",
  SCHOOL_ADMIN: "School admin",
  STAFF_ADMIN: "Staff admin",
  SUPER_ADMIN: "Super admin",
};

const NAV_ITEMS: { href: string; label: string; Icon: typeof LayoutDashboard; roles: UserRole[] }[] = [
  { href: "/dashboard/parent/", label: "Parent dashboard", Icon: Users, roles: ["PARENT"] },
  { href: "/dashboard/school/", label: "School admin panel", Icon: Building2, roles: ["SCHOOL_ADMIN"] },
  { href: "/dashboard/staff-admin/", label: "Staff admin", Icon: ShieldCheck, roles: ["STAFF_ADMIN", "SUPER_ADMIN"] },
  { href: "/dashboard/admin/", label: "Platform admin", Icon: GraduationCap, roles: ["STAFF_ADMIN", "SUPER_ADMIN"] },
];

/** Fetches a role dashboard payload once auth is ready. */
export function useDashboardData<T>(loader: () => Promise<T>) {
  const { status } = useAuth();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    loader()
      .then((payload) => {
        if (!cancelled) setData(payload);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(apiErrorMessage(reason));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;
    return load();
  }, [status, load]);

  return { data, loading, error, reload: load };
}

export function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  accent?: "blue" | "orange" | "green";
}) {
  return (
    <article className={`dash-stat${accent ? ` dash-stat--${accent}` : ""}`}>
      <span className="dash-stat__label">{label}</span>
      <strong className="dash-stat__value">{value}</strong>
      {hint && <span className="dash-stat__hint">{hint}</span>}
    </article>
  );
}

export function DashboardPanel({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="dash-panel">
      <header className="dash-panel__head">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

export function DashboardState({
  loading,
  error,
  onRetry,
}: {
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
}) {
  if (loading) {
    return (
      <p className="dash-state" role="status">
        <Loader2 size={18} className="spin" aria-hidden /> Loading your dashboard…
      </p>
    );
  }
  if (error) {
    return (
      <p className="dash-state dash-state--error" role="alert">
        <AlertCircle size={18} aria-hidden /> {error}
        {onRetry && (
          <button type="button" onClick={onRetry}>
            Try again
          </button>
        )}
      </p>
    );
  }
  return null;
}

export function DashboardShell({
  roles,
  eyebrow,
  title,
  subtitle,
  children,
}: {
  roles?: UserRole[];
  eyebrow: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const { status, user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const checking = status === "idle" || status === "loading";

  useEffect(() => {
    if (status === "guest") {
      router.replace(`/login/?next=${encodeURIComponent(pathname ?? "/dashboard/")}`);
    }
  }, [status, router, pathname]);

  if (checking || (status === "authenticated" && !user)) {
    return (
      <main className="dash-page">
        <p className="dash-state" role="status">
          <Loader2 size={18} className="spin" aria-hidden /> Checking your session…
        </p>
      </main>
    );
  }

  if (!user) return null;

  const allowed = !roles || roles.includes(user.role);

  return (
    <main className="dash-page">
      <div className="dash-layout">
        <aside className="dash-sidebar">
          <div className="dash-sidebar__brand">
            <LayoutDashboard size={18} aria-hidden />
            <div>
              <strong>{user.first_name || user.username}</strong>
              <span>{ROLE_LABELS[user.role]}</span>
            </div>
          </div>

          <nav className="dash-sidebar__nav" aria-label="Dashboards">
            <Link
              className={`dash-sidebar__link${pathname === "/dashboard/" ? " is-active" : ""}`}
              href="/dashboard/"
            >
              <LayoutDashboard size={16} aria-hidden /> Overview
            </Link>
            {NAV_ITEMS.filter((item) => item.roles.includes(user.role)).map(({ href, label, Icon }) => (
              <Link
                className={`dash-sidebar__link${pathname === href ? " is-active" : ""}`}
                href={href}
                key={href}
              >
                <Icon size={16} aria-hidden /> {label}
              </Link>
            ))}
          </nav>

          <div className="dash-sidebar__actions">
            <Link className="dash-sidebar__link" href="/">
              View public site
            </Link>
            <button
              className="dash-sidebar__link dash-sidebar__link--button"
              type="button"
              onClick={() => {
                void logout().then(() => router.replace("/"));
              }}
            >
              <LogOut size={16} aria-hidden /> Sign out
            </button>
          </div>
        </aside>

        <div className="dash-main">
          <header className="dash-header">
            <div>
              <span className="section-eyebrow">{eyebrow}</span>
              <h1>{title}</h1>
              {subtitle && <p>{subtitle}</p>}
            </div>
          </header>

          {allowed ? (
            children
          ) : (
            <DashboardPanel title="Not available for your account">
              <p className="dash-empty">
                Your role ({ROLE_LABELS[user.role]}) does not have access to this
                dashboard.{" "}
                <Link href={dashboardPathForRole(user.role)}>
                  Go to your dashboard
                </Link>
                .
              </p>
            </DashboardPanel>
          )}
        </div>
      </div>
    </main>
  );
}

/** Shared empty-state row for dashboard tables. */
export function EmptyTableRow({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <tr>
      <td className="dash-empty" colSpan={colSpan}>
        {message}
      </td>
    </tr>
  );
}

export default DashboardShell;
