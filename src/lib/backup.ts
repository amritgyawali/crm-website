import { copyFile, mkdir, readdir, stat, unlink } from "fs/promises";
import path from "path";
import { format } from "date-fns";

/** Path of the SQLite file from DATABASE_URL (file:./dev.db is relative to /prisma). */
export function dbFile() {
  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  if (!url.startsWith("file:")) return null;
  const p = url.slice(5);
  return path.isAbsolute(p) ? p : path.join(process.cwd(), "prisma", p);
}

export const BACKUP_DIR = path.join(process.cwd(), "backups");

/** Copies the database into /backups with today's date and keeps the latest 30. */
export async function makeBackup() {
  const src = dbFile();
  if (!src) throw new Error("Backups from here only work with the SQLite database. Use your database host's backups.");
  await mkdir(BACKUP_DIR, { recursive: true });
  const dest = path.join(BACKUP_DIR, `crm-${format(new Date(), "yyyy-MM-dd_HHmm")}.db`);
  await copyFile(src, dest);
  const files = (await readdir(BACKUP_DIR)).filter((f) => f.endsWith(".db")).sort();
  for (const old of files.slice(0, Math.max(0, files.length - 30))) await unlink(path.join(BACKUP_DIR, old));
  return { file: dest, size: (await stat(dest)).size };
}
