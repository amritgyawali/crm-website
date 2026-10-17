// Demo mode only (no database connected): builds the sample database once during the build and saves it,
// so each server starts in about a second instead of filling the sample data itself (about five seconds).
// Never fails the build: without the file the server simply builds the sample data when it starts.
import "dotenv/config";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { demoMode } from "../src/lib/database-url";
import { buildDemoDatabase, DEMO_SNAPSHOT } from "../src/lib/demo-db";

async function main() {
  rmSync(DEMO_SNAPSHOT, { force: true });
  if (!demoMode()) return console.log("Database connected: no demo snapshot needed.");
  // Same office clock as the running app (src/instrumentation.ts), so "today" in the sample data matches.
  process.env.TZ = process.env.OFFICE_TIMEZONE || process.env.TZ || "Asia/Dubai";
  const started = Date.now();
  const pg = await buildDemoDatabase();
  const dump = await pg.dumpDataDir("gzip");
  mkdirSync(path.dirname(DEMO_SNAPSHOT), { recursive: true });
  writeFileSync(DEMO_SNAPSHOT, Buffer.from(await dump.arrayBuffer()));
  await pg.close();
  console.log(`Demo mode: sample database saved to ${DEMO_SNAPSHOT} (${Math.round(dump.size / 1024)} KB, ${Date.now() - started} ms).`);
}

main().catch((e) => console.warn("Demo mode: could not save the sample database; the server will build it when it starts.", e));
