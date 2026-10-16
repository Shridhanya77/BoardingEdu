import Link from "next/link";

export default function AccountComingSoon({ action }: { action: "log in" | "sign up" }) {
  return (
    <main className="account-coming-soon">
      <Link className="account-coming-soon__back" href="/">← Back to BoardingEdu</Link>
      <span className="section-eyebrow">BOARDINGEDU ACCOUNT</span>
      <h1>Account access is coming soon.</h1>
      <p>
        {action === "sign up"
          ? "Parent registration is not available yet. We’re preparing account access for families."
          : "Parent login is not available yet. Please continue exploring the school directory."}
      </p>
      <Link className="header-action" href="/schools">Explore schools</Link>
    </main>
  );
}
