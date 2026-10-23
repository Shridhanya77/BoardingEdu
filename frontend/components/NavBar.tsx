"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ChevronDown,
  LogOut,
  Menu,
  Search,
  X,
} from "lucide-react";
import { useAuth, dashboardPathForRole } from "@/lib/auth";
import type { UserRole } from "@/lib/api";
import CounsellingModal from "@/components/home/CounsellingModal";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

type HeaderLink = { href: string; label: string; active: boolean };

function headerLinks(role: UserRole | null, pathname: string): HeaderLink[] {
  const home = pathname === "/" || pathname === "";
  const guides = pathname.startsWith("/guides");
  const compare = pathname.startsWith("/compare");
  const explore = !home && !guides && !compare && !pathname.startsWith("/dashboard") && !pathname.startsWith("/login") && !pathname.startsWith("/signup") && !pathname.startsWith("/privacy") && !pathname.startsWith("/terms") && !pathname.startsWith("/counselling");
  const shared: HeaderLink[] = [
    { href: "/", label: "Home", active: home },
    { href: "/schools/", label: "Explore Schools", active: explore },
  ];
  if (!role || role === "PARENT") {
    return [
      ...shared,
      { href: "/guides/", label: "Guides", active: guides },
      { href: "/compare/", label: "Compare Schools", active: compare },
    ];
  }
  if (role === "SCHOOL_ADMIN") {
    return [
      ...shared,
      { href: "/dashboard/school/", label: "School dashboard", active: pathname.startsWith("/dashboard/school") },
    ];
  }
  return [
    ...shared,
    { href: "/dashboard/staff-admin/", label: "Staff dashboard", active: pathname.startsWith("/dashboard/staff-admin") },
    { href: "/dashboard/admin/", label: "Platform admin", active: pathname.startsWith("/dashboard/admin") },
  ];
}

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, status, logout } = useAuth();

  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [counsellingOpen, setCounsellingOpen] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const mobileMenuToggleRef = useRef<HTMLButtonElement>(null);
  const counsellingTriggerRef = useRef<HTMLButtonElement>(null);
  const closeCounselling = useCallback(() => {
    setCounsellingOpen(false);
    if (window.matchMedia("(max-width: 900px)").matches) {
      mobileMenuToggleRef.current?.focus();
    } else {
      counsellingTriggerRef.current?.focus();
    }
  }, []);

  // Close dropdown when user clicks outside or navigates
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);
  useEffect(() => {
    setMenuOpen(false);
    setMobileNavOpen(false);
  }, [pathname]);
  useEffect(() => {
    if (!mobileNavOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileNavOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileNavOpen]);

  const displayName = user
    ? `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.username
    : "";
  const role = user?.role ?? null;
  const links = headerLinks(role, pathname);
  const showCounselling = !role || role === "PARENT";
  const dashboardHref = user ? dashboardPathForRole(user.role) : "/";
  const onHomePage = pathname === "/" || pathname === "";
  useEffect(() => {
    if (!onHomePage) {
      setHasScrolled(false);
      return;
    }

    const updateScrollState = () => setHasScrolled(window.scrollY > 24);
    updateScrollState();
    window.addEventListener("scroll", updateScrollState, { passive: true });
    return () => window.removeEventListener("scroll", updateScrollState);
  }, [onHomePage]);

  return (
    <header
      className={`site-header site-header--sticky${onHomePage ? " site-header--hero" : ""}${hasScrolled ? " site-header--scrolled" : ""}`}
    >
      <Link className="brand" href="/" aria-label="BoardingEdu home">
        <Image
          className="brand__image"
          src="/BoardingEdu_LOGO.jpeg"
          alt="BoardingEdu"
          width={128}
          height={128}
        />
      </Link>

      <nav className="site-header__nav" aria-label="Primary">
        {links.map((item) => (
          <Link className={`site-header__link${item.active ? " is-active" : ""}`} href={item.href} key={item.href}>
            {item.label}
          </Link>
        ))}
        {showCounselling && (
          <button
            ref={counsellingTriggerRef}
            type="button"
            className="site-header__link site-header__counselling"
            onClick={() => setCounsellingOpen(true)}
          >
            Get counselling
          </button>
        )}
      </nav>

      <div className="site-header__actions">
        {status === "loading" ? (
          <span className="header-action header-action--muted" aria-busy>Loading…</span>
        ) : user ? (
          <div className="user-menu" ref={menuRef}>
            <button
              className="user-menu__trigger"
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
            >
              <span className="avatar" aria-hidden>
                {initials(displayName || user.username)}
              </span>
              <span className="user-menu__name">{displayName}</span>
              <span className="user-menu__role">{user.role_display}</span>
              <ChevronDown size={14} aria-hidden />
            </button>
            {menuOpen && (
              <div className="user-menu__dropdown" role="menu">
                <div className="user-menu__who">
                  <div className="avatar avatar--large" aria-hidden>
                    {initials(displayName || user.username)}
                  </div>
                  <div>
                    <strong>{displayName}</strong>
                    <span>{user.email}</span>
                  </div>
                </div>
                <div className="user-menu__links">
                  <Link href={dashboardHref} role="menuitem">
                    <Search size={14} /> {user.role_display} dashboard
                  </Link>
                  <div role="separator" className="sep" />
                  <button
                    type="button"
                    role="menuitem"
                    className="danger"
                    onClick={async () => {
                      await logout();
                      router.push("/");
                    }}
                  >
                    <LogOut size={14} /> Log out
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            <Link href="/login" className="header-login">
              Log in
            </Link>
            <Link href="/signup" className="header-action header-action--primary">
              Register <ArrowRight size={14} />
            </Link>
          </>
        )}
      </div>
      <button
        ref={mobileMenuToggleRef}
        className="mobile-menu-toggle"
        type="button"
        aria-label={mobileNavOpen ? "Close navigation menu" : "Open navigation menu"}
        aria-controls="mobile-primary-navigation"
        aria-expanded={mobileNavOpen}
        onClick={() => setMobileNavOpen((open) => !open)}
      >
        {mobileNavOpen ? <X size={22} aria-hidden /> : <Menu size={22} aria-hidden />}
      </button>
      {mobileNavOpen && (
        <>
          <button
            className="mobile-navigation__backdrop"
            type="button"
            aria-label="Close navigation menu"
            onClick={() => setMobileNavOpen(false)}
          />
          <nav
            className="mobile-navigation"
            id="mobile-primary-navigation"
            aria-label="Mobile primary"
          >
            {links.map((item) => (
              <Link
                className={`mobile-navigation__link${item.active ? " is-active" : ""}`}
                href={item.href}
                key={item.href}
                onClick={() => setMobileNavOpen(false)}
                aria-current={item.active ? "page" : undefined}
              >
                {item.label}
              </Link>
            ))}
            {showCounselling && (
              <button
                className="mobile-navigation__counselling"
                type="button"
                onClick={() => {
                  setMobileNavOpen(false);
                  setCounsellingOpen(true);
                }}
              >
                <Search size={16} aria-hidden /> Get counselling
              </button>
            )}
            {user ? (
              <>
              <Link href={dashboardHref} onClick={() => setMobileNavOpen(false)}>
                {user.role_display} dashboard
              </Link>
              <button
                className="mobile-navigation__logout"
                type="button"
                onClick={async () => {
                  await logout();
                  setMobileNavOpen(false);
                  router.push("/");
                }}
              >
                <LogOut size={16} aria-hidden /> Log out
              </button>
              </>
            ) : <>
              <Link href="/login" onClick={() => setMobileNavOpen(false)}>Log in</Link>
              <Link href="/signup" onClick={() => setMobileNavOpen(false)}>Register</Link>
            </>}
          </nav>
        </>
      )}
      {counsellingOpen && <CounsellingModal onClose={closeCounselling} />}
    </header>
  );
}
