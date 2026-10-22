import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 is a native module — keep it out of the bundler.
  // pg + @electric-sql/pglite stay external too: plain Node modules that
  // only load when their driver is selected (keeps the bundle lean and the
  // WASM out of the serverless output).
  serverExternalPackages: ["better-sqlite3", "pg", "@electric-sql/pglite"],
  // Tailwind CSS v4 compiler for Turbopack (dev + build). Without this
  // rule the stylesheet ships raw: @theme unprocessed and zero utility
  // classes — the page renders unstyled even though the CSS file loads.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // allow the ephemeral e2b preview hostnames to reach the dev server
  // (dev-only; production is unaffected)
  allowedDevOrigins: ["**.e2b.app"],
  experimental: {
    serverActions: {
      // photo memories upload through server actions
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
