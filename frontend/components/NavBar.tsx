"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ChevronDown,
  LogOut,
  Search,
} from "lucide-react";
import { useAuth } from "@/lib/auth";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, status, logout } = useAuth();

  const [menuOpen, setMenuOpen] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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
  useEffect(() => setMenuOpen(false), [pathname]);

  const displayName = user
    ? `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.username
    : "";

  const onSchoolsPage = pathname === "/" || pathname === "";
  const homeHref = (section: string) => (onSchoolsPage ? section : `/${section}`);

  useEffect(() => {
    if (!onSchoolsPage) {
      setHasScrolled(false);
      return;
    }

    const updateScrollState = () => setHasScrolled(window.scrollY > 24);
    updateScrollState();
    window.addEventListener("scroll", updateScrollState, { passive: true });
    return () => window.removeEventListener("scroll", updateScrollState);
  }, [onSchoolsPage]);

  return (
    <header
      className={`site-header site-header--sticky${onSchoolsPage ? " site-header--hero" : ""}${hasScrolled ? " site-header--scrolled" : ""}`}
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
        <Link className="site-header__link" href="/schools">Find Schools</Link>
        <Link className="site-header__link" href={homeHref("#how-it-works")}>How It Works</Link>
        <Link className="site-header__link" href={homeHref("#for-schools")}>For Schools</Link>
        <Link className="site-header__link" href={homeHref("#about")}>About Us</Link>
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
                  <Link href="/schools" role="menuitem">
                    <Search size={14} /> Browse schools
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
        <Link href="/schools" className="header-action header-action--find">
          <Search size={15} /> Find a School
        </Link>
      </div>
    </header>
  );
}
