import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["web-push"],                       // a CommonJS package: loaded by Node as it is, not bundled
  experimental: { serverActions: { bodySizeLimit: "2mb" } }, // brand logo uploads (limit 1 MB) travel through a server action
  images: { formats: ["image/avif", "image/webp"] },
  // the invoice PDF reads its font files from disk: make sure the serverless bundle contains them
  outputFileTracingIncludes: { "/receipts/[id]/invoice/pdf": ["./node_modules/@fontsource/noto-sans-thai/files/*-{400,700}-normal.woff"] },
  async headers() {
    return [
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }] },
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(self)" },
        ],
      },
    ];
  },
};

export default nextConfig;
