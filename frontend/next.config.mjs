/** @type {import('next').NextConfig} */
const apiBase = (
  process.env.NEXT_PUBLIC_API_BASE ??
  "https://boardingedu-production-ac84.up.railway.app/api"
).replace(/\/+$/, "");

const nextConfig = {
  trailingSlash: true,
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
