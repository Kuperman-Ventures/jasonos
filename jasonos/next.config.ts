import type { NextConfig } from "next";
import path from "node:path";

// JasonOS lives in a subfolder of the CoSA repo. Next requires
// outputFileTracingRoot and turbopack.root to be the same path. On Vercel
// that path is the repo root (NEXT_PRIVATE_OUTPUT_TRACE_ROOT). Pointing
// Turbopack there breaks Google fonts, so the Vercel build uses webpack.
// Locally there is no override, and the root stays this folder.
const projectRoot =
  process.env.NEXT_PRIVATE_OUTPUT_TRACE_ROOT || path.join(import.meta.dirname);

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
