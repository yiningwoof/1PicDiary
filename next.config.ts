import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Trace and copy only the production server's runtime dependencies. The
  // resulting .next/standalone directory is used by the Docker runtime stage.
  output: "standalone",
  experimental: {
    // proxy.ts runs for API uploads so Next.js must retain the complete body.
    // Keep a little multipart overhead above the app's 30 MiB file limit.
    proxyClientMaxBodySize: "31mb",
  },
};

export default nextConfig;
