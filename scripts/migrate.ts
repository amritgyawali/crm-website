// Applies the committed database migrations (prisma/migrations), creating or updating the tables.
// Runs on every Vercel build (see "vercel-build" in package.json) and is safe to run again and again.
//
// Migrations need a direct (non-pooled) connection. If your host gives you two connection strings
// (Neon: DATABASE_URL_UNPOOLED, Supabase/Vercel: POSTGRES_URL_NON_POOLING) or you set DIRECT_URL,
// that one is used here; the app itself keeps using the pooled one.
import "dotenv/config"; // local runs read .env; on Vercel the variables are already in the environment
import { spawnSync } from "node:child_process";
import { databaseUrlProblem, directDatabaseUrl } from "../src/lib/database-url";

const url = directDatabaseUrl();
const onVercel = !!process.env.VERCEL;
const where = onVercel ? "Vercel -> Project -> Settings -> Environment Variables" : "the .env file";

if (!url) {
  const msg =
    `\n${databaseUrlProblem()} No tables were created: the site will run in DEMO MODE, on sample data that is not kept.\n` +
    `To keep real records, connect a PostgreSQL database (Vercel: Storage -> Create Database -> Supabase or Neon),\n` +
    `or put its connection string in DATABASE_URL in ${where}, then redeploy.\n`;
  // On Vercel the deploy goes ahead in demo mode (src/lib/demo-db.ts).
  // Locally this command is only run to set up a database, so stop.
  if (onVercel) {
    console.warn(msg);
    process.exit(0);
  }
  console.error(msg);
  process.exit(1);
}

const run = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: url },
  shell: process.platform === "win32",
});
if (run.status !== 0) {
  console.error(
    `\nThe database tables could not be created or updated (see the error above).\n` +
      `Check the connection string (${where}): copy it again from your database host, and make sure the\n` +
      `database accepts connections. Neon and Supabase also give a direct connection string; set it as DIRECT_URL.\n`,
  );
}
process.exit(run.status ?? 1);
