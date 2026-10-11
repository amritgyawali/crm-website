// Prisma settings (replaces the old "prisma" block in package.json).
// Prisma doesn't read .env on its own when this file exists, so load it here.
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { seed: "tsx prisma/seed.ts" },
});
