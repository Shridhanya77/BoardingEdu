import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "School Admin Dashboard | BoardingEdu",
  description:
    "Manage your school profile, admission enquiries, and parent engagement in your BoardingEdu school admin dashboard.",
};

export default function SchoolDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
