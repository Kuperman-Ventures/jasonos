import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin Turbopack to this folder so the parent repo lockfile is not the root.
  turbopack: {
    root: path.join(import.meta.dirname),
  },
};

export default nextConfig;
