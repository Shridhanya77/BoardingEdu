import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import NavBar from "@/components/NavBar";
import JsonLd from "@/components/JsonLd";
import { AuthProvider } from "@/lib/auth";
import { SearchExperienceProvider } from "@/lib/search-experience";
import SearchAnalyticsConsent from "@/components/SearchAnalyticsConsent";
import PublicSiteFooter from "@/components/home/PublicSiteFooter";
import { homeSeoKeywords } from "@/lib/home-content";
import { organizationJsonLd, websiteJsonLd } from "@/lib/structured-data";
import { SITE_NAME, SITE_URL } from "@/lib/site";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const googleSiteVerification = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION;

export const viewport: Viewport = {
  themeColor: "#0f3d2e",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Find the Right School for Your Child | BoardingEdu",
    template: `%s | ${SITE_NAME}`,
  },
  description:
    "Explore day and boarding schools in India. Compare school locations, boards, fees, and facilities, then contact schools or request free counselling.",
  keywords: homeSeoKeywords,
  applicationName: SITE_NAME,
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  alternates: {
    canonical: "/",
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: SITE_NAME,
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false, address: false, email: false },
  ...(googleSiteVerification
    ? { verification: { google: googleSiteVerification } }
    : {}),
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_IN",
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
    <html lang="en" className={inter.variable}>
      <body>
        {/*
          AuthProvider wraps the whole site because:
          1. NavBar reads useAuth() to show Login/Signup vs. user menu.
          2. /login, /signup, and school detail pages all use useAuth().
        */}
        <AuthProvider>
          <SearchExperienceProvider>
            <JsonLd data={organizationJsonLd()} />
            <JsonLd data={websiteJsonLd()} />
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
