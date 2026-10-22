/** @type {import('next').NextConfig} */
const apiBase = (
  process.env.NEXT_PUBLIC_API_BASE ??
  "https://boardingedu-production-ac84.up.railway.app/api"
).replace(/\/+$/, "");

// Canonical public host. Set NEXT_PUBLIC_SITE_HOST when the domain changes.
const siteHost = (process.env.NEXT_PUBLIC_SITE_HOST ?? "boardingedu.com").replace(/^www\./, "");

const nextConfig = {
  trailingSlash: true,
  async redirects() {
    // Canonical host: every public URL is served from https://www.<domain>/… so
    // the apex domain permanently redirects to the `www.` host.
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: siteHost }],
        destination: `https://www.${siteHost}/:path*/`,
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/backend-api/:path*",
        destination: `${apiBase}/:path*/`,
      },
    ];
  },
};

export default nextConfig;
