import type { NextConfig } from "next";

// Baseline headers for every response. There is no Content-Security-Policy here on purpose:
// the inline scripts of Next.js need a policy with a nonce, which is a change of its own.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
  // The visualisation manifests are read from disk on the server (src/lib/visualisations.ts); make sure they ship with the page.
  outputFileTracingIncludes: {
    "/visualised": ["./src/components/temple/views/**/visualization.yaml"],
  },
};

export default nextConfig;
