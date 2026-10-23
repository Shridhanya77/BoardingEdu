export const SITE_NAME = "BoardingEdu";
const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
const configuredSiteHost = (process.env.NEXT_PUBLIC_SITE_HOST ?? "boardingedu.com").replace(/^www\./i, "");
const siteUrl = new URL(
  configuredSiteUrl || `https://www.${configuredSiteHost}`,
);
if (!siteUrl.hostname.toLowerCase().startsWith("www.")) {
  siteUrl.hostname = `www.${siteUrl.hostname}`;
}
export const SITE_URL = siteUrl.origin;
export const SITE_EMAIL = "hello@boardingedu.com";
export const SITE_PHONE = "+91-80-4611-0000";
export const SITE_TAGLINE = "Find the right school for your child";
