import os from "node:os";
import type { NextConfig } from "next";

function lanDevOrigins(): string[] {
  const hosts = new Set<string>(["*.local"]);
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const addr of addrs ?? []) {
      if (addr.internal) continue;
      if (addr.family === "IPv4" || addr.family === 4) {
        hosts.add(addr.address);
      }
    }
  }
  return [...hosts];
}

const nextConfig: NextConfig = {
  /* config options here */
  // better-sqlite3 is a native Node addon; keep it out of the server bundle so its
  // compiled .node binding is required at runtime instead of processed by webpack/Turbopack.
  serverExternalPackages: ['better-sqlite3'],
  // Phone browsers hit this sandbox by LAN IP, which Next.js otherwise blocks in dev.
  allowedDevOrigins: lanDevOrigins(),
};

export default nextConfig;
