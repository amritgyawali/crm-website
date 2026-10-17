/* Loads the demo data. Run: npm run db:seed   (wipes existing data first) */
import { PrismaClient } from "@prisma/client";
import { databaseUrl } from "../src/lib/database-url";
import { seedDemo } from "./demo-data";

const url = databaseUrl();
const db = new PrismaClient(url ? { datasourceUrl: url } : undefined);

seedDemo(db)
  .then(() => console.log("Seed complete. Sign in with manager@office.test / office123"))
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
