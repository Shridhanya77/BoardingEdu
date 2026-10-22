/** @type {import('next').NextConfig} */
const apiBase = (
  process.env.NEXT_PUBLIC_API_BASE ??
  "https://boardingedu-production-ac84.up.railway.app/api"
).replace(/\/+$/, "");

const nextConfig = {
  trailingSlash: true,
  async redirects() {
    // Canonical host: send the apex domain to the `www.` host so every public
    // URL is served from https://www.boardingedu.com/… with a trailing slash.
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "boardingedu.com" }],
        destination: "https://www.boardingedu.com/:path*/",
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
