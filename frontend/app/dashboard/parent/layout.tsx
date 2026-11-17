import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Parent Dashboard | BoardingEdu",
  description:
    "Manage your school shortlist, enquiries, applications, and saved searches in your BoardingEdu parent dashboard.",
};

export default function ParentDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
