import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 is a native module — keep it out of the bundler
  serverExternalPackages: ["better-sqlite3"],
  experimental: {
    serverActions: {
      // photo memories upload through server actions
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
