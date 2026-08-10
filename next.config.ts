import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // better-sqlite3 is a native Node addon; keep it out of the server bundle so its
  // compiled .node binding is required at runtime instead of processed by webpack/Turbopack.
  serverExternalPackages: ['better-sqlite3'],
};

export default nextConfig;
