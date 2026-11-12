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
export const SITE_EMAIL = "boardingedu21@gmail.com";
export const SITE_PHONE = "+919999999999";
export const SITE_PHONE_DISPLAY = "9999999999";
export const SITE_TAGLINE = "Find the right school for your child";
