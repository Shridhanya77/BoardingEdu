/** @type {import('next').NextConfig} */
const apiBase = (
  process.env.NEXT_PUBLIC_API_BASE ??
  "https://boardingedu-production-ac84.up.railway.app/api"
).replace(/\/+$/, "");

// Canonical public host. Set NEXT_PUBLIC_SITE_URL or NEXT_PUBLIC_SITE_HOST when it changes.
const configuredSiteHost = process.env.NEXT_PUBLIC_SITE_URL
  ? new URL(process.env.NEXT_PUBLIC_SITE_URL).hostname
  : process.env.NEXT_PUBLIC_SITE_HOST ?? "boardingedu.com";
const siteHost = configuredSiteHost.replace(/^www\./i, "");

const nextConfig = {
  trailingSlash: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "boardingedu.com", pathname: "/media/**" },
      { protocol: "https", hostname: "www.boardingedu.com", pathname: "/media/**" },
      { protocol: "https", hostname: "media.boardingeu.com", pathname: "/**" },
      { protocol: "https", hostname: "*.up.railway.app", pathname: "/**" },
      { protocol: "http", hostname: "127.0.0.1", pathname: "/**" },
      { protocol: "http", hostname: "localhost", pathname: "/**" },
    ],
  },
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
    const backendOrigin = apiBase.replace(/\/api\/?$/, "");
    return [
      {
        source: "/backend-api/:path*",
        destination: `${apiBase}/:path*/`,
      },
      {
        source: "/media/schools/:path*",
        destination: `${backendOrigin}/media/schools/:path*`,
      },
    ];
  },
};

export default nextConfig;
