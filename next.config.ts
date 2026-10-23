import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 is a native module — keep it out of the bundler.
  // pg + @electric-sql/pglite stay external too: plain Node modules that
  // only load when their driver is selected (keeps the bundle lean and the
  // WASM out of the serverless output).
  serverExternalPackages: [
    "better-sqlite3",
    "pg",
    "@electric-sql/pglite",
    "@react-pdf/renderer",
  ],
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
    resolveAlias: {
      // fontkit's ESM build ships a broken subsetter ("Offset is outside
      // the bounds of the DataView" in _addGlyph); the CJS build works.
      fontkit: "./node_modules/fontkit/dist/main.cjs",
    },
  },
  // allow the ephemeral e2b preview hostnames to reach the dev server
  // (dev-only; production is unaffected)
  allowedDevOrigins: ["**.e2b.app"],
  // The book PDF route loads the vendored Fraunces TTFs by path at runtime —
  // make sure output file tracing ships them to the serverless bundle.
  outputFileTracingIncludes: {
    "/app/trees/[id]/export/book": ["./assets/fonts/**"],
  },

  experimental: {
    serverActions: {
      // photo memories upload through server actions
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
