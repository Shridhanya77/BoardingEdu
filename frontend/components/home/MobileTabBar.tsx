"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Headphones, Home, LayoutGrid, Search, UserRound } from "lucide-react";
import CounsellingModal from "@/components/home/CounsellingModal";
import { dashboardPathForRole, useAuth } from "@/lib/auth";
import { requestSearchPalette } from "@/lib/search-palette";

export default function MobileTabBar() {
  const pathname = usePathname() ?? "/";
  const { user, status } = useAuth();
  const [counsellingOpen, setCounsellingOpen] = useState(false);
  const hidden = pathname.startsWith("/dashboard");

  useEffect(() => {
    if (hidden || !pathname.startsWith("/") || window.location.hash !== "#hero-search") return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById("hero-search")?.scrollIntoView({ block: "center" });
      document.querySelector<HTMLInputElement>("#hero-search input")?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [hidden, pathname]);

  if (hidden) return null;

  const accountHref = status === "authenticated" && user
    ? dashboardPathForRole(user.role)
    : "/login/?next=%2Fdashboard%2Fparent%2F";
  const schoolsActive = pathname === "/india" || pathname.startsWith("/india/") || pathname.startsWith("/schools");
  const homeActive = pathname === "/";

  function openSearch() {
    requestSearchPalette();
  }

  return (
    <>
      <nav className="mobile-tabbar" aria-label="Primary mobile">
        <Link className={homeActive ? "is-active" : ""} href="/" aria-current={homeActive ? "page" : undefined}>
          <Home size={18} aria-hidden />
          Home
        </Link>
        <Link className={schoolsActive ? "is-active" : ""} href="/india/" aria-current={schoolsActive ? "page" : undefined}>
          <LayoutGrid size={18} aria-hidden />
          Schools
        </Link>
        <button type="button" onClick={openSearch} aria-haspopup="dialog">
          <Search size={18} aria-hidden />
          Search
        </button>
        <button type="button" onClick={() => setCounsellingOpen(true)}>
          <Headphones size={18} aria-hidden />
          Counselling
        </button>
        <Link href={accountHref}>
          <UserRound size={18} aria-hidden />
          Account
        </Link>
      </nav>
      {counsellingOpen && <CounsellingModal onClose={() => setCounsellingOpen(false)} />}
    </>
  );
}
