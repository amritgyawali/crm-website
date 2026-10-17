/* Creates (or resets) an admin login and fills in default settings.
   Use it to start a clean system without demo data:
     npm run setup:empty -- --email you@company.com --name "Your Name" --password "a-long-password"
   or later, to reset a forgotten admin password:
     npm run create-admin -- --email you@company.com --password "new-password"
   On Vercel it runs with --from-env at every build: it reads ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME and
   creates the first admin only while the database has no users, so later deploys never touch passwords. */
import "dotenv/config"; // Prisma skips .env when prisma.config.ts exists, so load it here
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_STAGE_DAYS } from "../src/lib/constants";
import { databaseUrl } from "../src/lib/database-url";

const url = databaseUrl();
const db = new PrismaClient(url ? { datasourceUrl: url } : undefined);
const arg = (k: string) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};

const TEMPLATES = [
  { name: "Payment reminder", audience: "CANDIDATE", body: "Hello {name}, this is {staff} from {company}. A reminder that {installment} of {amount} is due on {dueDate}. Your remaining balance is {balance}. Please reply once paid. Thank you." },
  { name: "Interview invitation", audience: "CANDIDATE", body: "Hello {name}, you are invited for an interview for the {job} position. Please come to our office with your passport and CV. Address: {address}." },
  { name: "Documents needed", audience: "CANDIDATE", body: "Hello {name}, to continue your file for {job} we need: passport copy, photo with white background, and experience certificate. Please send them here on WhatsApp." },
  { name: "Visa approved", audience: "CANDIDATE", body: "Good news {name}! Your visa has been approved. Please visit the office to complete the next payment and collect your travel details." },
  { name: "Partner follow-up", audience: "PARTNER", body: "Dear {contact}, following up on our recent discussion. Please share any new job orders and the status of candidates submitted last week. Regards, {staff}, {company}." },
];

async function main() {
  const fromEnv = process.argv.includes("--from-env");
  if (fromEnv) {
    if (!url) return console.log("No database connected: skipping first-admin setup.");
    if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) return console.log("ADMIN_EMAIL / ADMIN_PASSWORD not set: skipping first-admin setup.");
    if ((await db.user.count()) > 0) return console.log("Users already exist: skipping first-admin setup.");
  }
  const email = (fromEnv ? process.env.ADMIN_EMAIL : arg("email"))?.toLowerCase();
  const password = fromEnv ? process.env.ADMIN_PASSWORD : arg("password");
  const name = (fromEnv ? process.env.ADMIN_NAME : arg("name")) ?? "Office Admin";
  if (!email || !password) throw new Error('Usage: npm run create-admin -- --email you@company.com --password "..." [--name "Your Name"]');
  if (password.length < 8) throw new Error("Password must be at least 8 characters.");

  const passwordHash = await bcrypt.hash(password, 10);
  const u = await db.user.upsert({
    where: { email },
    create: { email, name, role: "ADMIN", passwordHash },
    update: { passwordHash, active: true, role: "ADMIN" },
  });
  for (const [stage, maxDays] of Object.entries(DEFAULT_STAGE_DAYS)) {
    await db.stageSetting.upsert({ where: { stage }, create: { stage, maxDays }, update: {} });
  }
  if ((await db.messageTemplate.count()) === 0) await db.messageTemplate.createMany({ data: TEMPLATES });
  console.log(`Admin ready: ${u.email}. Sign in, then set the company details under Settings and add your staff under Settings → Users.`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
