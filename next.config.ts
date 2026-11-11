import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Basic hardening: no MIME sniffing, no framing by other sites, and no full
  // room URLs leaked to other sites through the Referer header.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // HTTPS only, for two years, on every subdomain.
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          // A light CSP: no plugins, no <base> hijacking, no framing by other
          // sites, and any stray http:// asset is upgraded to https.
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self'; base-uri 'self'; object-src 'none'; upgrade-insecure-requests",
          },
        ],
      },
    ];
  },
  // The old Vercel address keeps working, but sends people to the real
  // domain. Shared *.vercel.app hosts are a common phishing home, so browsers
  // and Safe Browsing trust them less than kindlyputstudio.com.
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "kindlyputstudio-com.vercel.app" }],
        destination: "https://www.kindlyputstudio.com/:path*",
        permanent: true,
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
