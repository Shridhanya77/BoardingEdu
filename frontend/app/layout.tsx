import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BoardingEdu",
  description: "Discover trusted schools, compare what matters, and find the right fit for your family.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}