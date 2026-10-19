import Link from "next/link";
import type { ReactNode } from "react";

export default function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <main className="legal-page">
      <nav className="school-breadcrumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span>/</span>
        <span aria-current="page">{title}</span>
      </nav>
      <h1>{title}</h1>
      <p className="legal-page__updated">Last updated {updated}</p>
      <div className="legal-page__body">{children}</div>
    </main>
  );
}
