import "server-only";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";
import { format } from "date-fns";

export const UPLOAD_ROOT = path.join(process.cwd(), "uploads");
const MAX = 10 * 1024 * 1024;
const ALLOWED = /^(image\/(jpeg|png|webp|heic|heif)|application\/pdf)$/;

/** Saves an uploaded file under /uploads and returns its served URL. Returns null when no file was chosen. */
export async function saveUpload(file: FormDataEntryValue | null, folder: string) {
  if (!file || typeof file === "string" || file.size === 0) return null;
  if (file.size > MAX) throw new Error("File is larger than 10 MB.");
  if (!ALLOWED.test(file.type)) throw new Error("Only PDF, JPG, PNG, WEBP or HEIC files can be attached.");
  const sub = path.join(folder, format(new Date(), "yyyy-MM"));
  const dir = path.join(UPLOAD_ROOT, sub);
  await mkdir(dir, { recursive: true });
  const safe = file.name.replace(/[^\w.\-]+/g, "_").slice(-80);
  const name = `${randomBytes(6).toString("hex")}-${safe}`;
  await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
  return { url: `/api/files/${sub.split(path.sep).join("/")}/${name}`, name: file.name };
}
