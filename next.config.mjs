/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // The status board is a `use cache` function (src/lib/status/board.ts), so the
  // page is prerendered and refreshed in the background instead of calling every
  // provider on every visit.
  cacheComponents: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
