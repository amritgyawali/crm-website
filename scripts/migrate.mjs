// Applies the committed database migrations (prisma/migrations) to the database in DATABASE_URL.
// Runs on every Vercel build (see "vercel-build" in package.json) and is safe to run again and again.
//
// Migrations need a direct (non-pooled) connection. If your host gives you two connection strings
// (Neon: DATABASE_URL_UNPOOLED, Supabase/Vercel: POSTGRES_URL_NON_POOLING) or you set DIRECT_URL,
// that one is used here; the app itself keeps using the pooled DATABASE_URL.
import "dotenv/config"; // local runs read .env; on Vercel the variables are already in the environment
import { spawnSync } from "node:child_process";

const direct = process.env.DIRECT_URL || process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING;
const env = { ...process.env, ...(direct ? { DATABASE_URL: direct } : {}) };

if (!env.DATABASE_URL && process.env.VERCEL_ENV === "preview") {
  // Preview builds may legitimately have no database (README: give Preview its own database "or leave it unset").
  // Production still fails below: deploying without tables would give a site that errors on every page.
  console.warn("\nDATABASE_URL is not set for this Preview deployment: skipping database migrations.\nThe deployed pages that need data will not work until Preview gets its own DATABASE_URL.\n");
  process.exit(0);
}

if (!env.DATABASE_URL) {
  console.error(
    "\nDATABASE_URL is not set, so the database tables can't be created.\n" +
      "Add a PostgreSQL connection string (Neon, Supabase, Vercel Postgres...) as DATABASE_URL in\n" +
      "Vercel -> Project -> Settings -> Environment Variables, then redeploy.\n",
  );
  process.exit(1);
}

const run = spawnSync("npx", ["prisma", "migrate", "deploy"], { stdio: "inherit", env, shell: process.platform === "win32" });
process.exit(run.status ?? 1);
