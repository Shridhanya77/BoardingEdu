import LoginForm from "@/components/LoginForm";
import { Suspense } from "react";

export const metadata = {
  title: "Log in | BoardingEdu",
  description: "Sign in to your BoardingEdu parent account to manage shortlists and enquiries.",
};

export default function LoginPage() {
  return (
    <Suspense fallback={<p className="account-loading">Loading login…</p>}>
      <LoginForm />
    </Suspense>
  );
}
