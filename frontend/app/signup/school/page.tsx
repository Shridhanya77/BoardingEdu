import SchoolSignupForm from "@/components/SchoolSignupForm";

export const metadata = {
  title: "Register Your School | BoardingEdu",
  description:
    "List your school on BoardingEdu. Register your school profile and login — our team verifies every school before the dashboard unlocks.",
  robots: { index: false, follow: true },
};

export default function SchoolSignupPage() {
  return <SchoolSignupForm />;
}
