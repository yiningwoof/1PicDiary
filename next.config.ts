import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Trace and copy only the production server's runtime dependencies. The
  // resulting .next/standalone directory is used by the Docker runtime stage.
  output: "standalone",
};

export default nextConfig;
