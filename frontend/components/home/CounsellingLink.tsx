"use client";

import type { MouseEvent, ReactNode } from "react";
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

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    onClick?.();
    if (pathname === "/") {
      window.history.replaceState(
        window.history.state,
        "",
        `${window.location.pathname}${window.location.search}`,
      );
      scrollToCounselling();
      return;
    }
    window.sessionStorage.setItem(counsellingScrollStorageKey, "true");
    router.push("/", { scroll: false });
  }

  return (
    <Link className={className} href="/" onClick={handleClick}>
      {children}
    </Link>
  );
}
