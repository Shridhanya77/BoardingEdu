import SignupForm from "@/components/SignupForm";

export const metadata = {
  title: "Create Parent Account | BoardingEdu",
  description: "Sign up for a free BoardingEdu parent account to shortlist schools and track admission enquiries.",
  robots: { index: false, follow: true },
};

export default function SignupPage() {
  return <SignupForm />;
}
