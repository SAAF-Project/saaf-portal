import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The visualisation manifests are read from disk on the server (src/lib/visualisations.ts); make sure they ship with the page.
  outputFileTracingIncludes: {
    "/visualised": ["./src/components/temple/views/**/visualization.yaml"],
  },
};

export default nextConfig;
