import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: "12mb" },
  },
  // PGlite (demo mode, src/lib/demo-db.ts) loads its PostgreSQL build from its own folder at run time.
  serverExternalPackages: ["exceljs", "@electric-sql/pglite", "pglite-prisma-adapter"],
  // Demo mode needs the saved sample database (or the migration files to build one) and PGlite's own files,
  // so ship them with every server route.
  outputFileTracingIncludes: {
    "/**": [
      "./.demo/**",
      "./prisma/migrations/**/*.sql",
      "./node_modules/@electric-sql/pglite/dist/pglite.wasm",
      "./node_modules/@electric-sql/pglite/dist/pglite.data",
    ],
  },
};

export default nextConfig;
