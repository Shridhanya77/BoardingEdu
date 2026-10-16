import type { Metadata } from "next";
import "./globals.css";
import NavBar from "@/components/NavBar";
import { AuthProvider } from "@/lib/auth";
import { SearchExperienceProvider } from "@/lib/search-experience";
import SearchAnalyticsConsent from "@/components/SearchAnalyticsConsent";
import PublicSiteFooter from "@/components/home/PublicSiteFooter";
import { homeSeoKeywords } from "@/lib/home-content";

export const metadata: Metadata = {
  title: "BoardingEdu",
  description:
    "Discover trusted schools, compare what matters, and find the right fit for your family.",
  keywords: homeSeoKeywords,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {/*
          AuthProvider wraps the whole site because:
          1. NavBar reads useAuth() to show Login/Signup vs. user menu.
          2. /login, /signup, and school detail pages all use useAuth().
        */}
        <AuthProvider>
          <SearchExperienceProvider>
            <NavBar />
            {children}
            <SearchAnalyticsConsent />
            <PublicSiteFooter />
          </SearchExperienceProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
