import { Suspense } from "react";
import EmailVerificationForm from "@/components/EmailVerificationForm";

export const metadata = {
  title: "Verify your email | BoardingEdu",
  description: "Verify your BoardingEdu email address to access your account.",
  robots: { index: false, follow: false },
};

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<p className="account-loading">Loading verification…</p>}>
      <EmailVerificationForm />
    </Suspense>
  );
}
