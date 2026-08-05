import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin Turbopack root to this folder so it doesn't pick up the parent CoSA
  // lockfile and infer the workspace as the repo root.
  turbopack: {
    root: path.join(import.meta.dirname),
  },
  // Post Machine → Post Master rename
  async redirects() {
    return [
      {
        source: "/post-machine",
        destination: "/post-master",
        permanent: true,
      },
      {
        source: "/post-machine/:path*",
        destination: "/post-master/:path*",
        permanent: true,
      },
      {
        source: "/api/post-machine/:path*",
        destination: "/api/post-master/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
