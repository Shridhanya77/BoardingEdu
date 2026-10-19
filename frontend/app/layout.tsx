import type { Metadata } from "next";
import "./globals.css";
import NavBar from "@/components/NavBar";
import JsonLd from "@/components/JsonLd";
import { AuthProvider } from "@/lib/auth";
import { SearchExperienceProvider } from "@/lib/search-experience";
import SearchAnalyticsConsent from "@/components/SearchAnalyticsConsent";
import PublicSiteFooter from "@/components/home/PublicSiteFooter";
import { homeSeoKeywords, organizationJsonLd, websiteJsonLd } from "@/lib/home-content";
import { SITE_NAME, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Find the Right School for Your Child | BoardingEdu",
  description:
    "Explore day and boarding schools in India. Compare school locations, boards, fees, and facilities, then contact schools or request free counselling.",
  keywords: homeSeoKeywords,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: "Find the Right School for Your Child | BoardingEdu",
    description:
      "Explore day and boarding schools in India. Compare locations, education boards, fees, and facilities.",
    url: SITE_URL,
    images: [{ url: `${SITE_URL}/BoardingEdu_LOGO.jpeg` }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Find the Right School for Your Child | BoardingEdu",
    description: "Search, compare, and enquire with schools across India.",
  },
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
            <JsonLd data={organizationJsonLd} />
            <JsonLd data={websiteJsonLd} />
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
