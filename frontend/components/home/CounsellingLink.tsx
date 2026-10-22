"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  counsellingScrollStorageKey,
  scrollToCounselling,
} from "@/lib/counselling-navigation";

export default function CounsellingLink({
  children,
  className,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();

  function handleClick() {
    onClick?.();
    if (pathname === "/counselling" || pathname === "/counselling/") {
      scrollToCounselling();
      return;
    }
    window.sessionStorage.setItem(counsellingScrollStorageKey, "true");
    router.push("/counselling/");
  }

  return (
    <Link className={className} href="/counselling/" onClick={handleClick}>
      {children}
    </Link>
  );
}
