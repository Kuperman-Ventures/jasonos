import type { NextConfig } from "next";
import path from "node:path";

// JasonOS lives in a subfolder of the CoSA repo, which has its own lockfile.
// Next 16 treats that parent lockfile as the file-tracing root, then forces
// Turbopack to use it too. Google fonts then fail to resolve
// ("next/font/google queries have exactly one entry"). Both roots have to be
// this folder, and they have to be the same path.
const projectRoot = path.join(import.meta.dirname);

const nextConfig: NextConfig = {
  outputFileTracingRoot: projectRoot,
  turbopack: {
    root: projectRoot,
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
