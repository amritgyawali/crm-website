import "server-only";
import { randomBytes } from "crypto";
import { format } from "date-fns";
import { db } from "./db";

// Serverless hosts (Vercel) have no writable disk, so uploads are stored in the database (StoredFile)
// and served by /api/files. Vercel also rejects request bodies over 4.5 MB before they reach the app.
const MAX = (process.env.VERCEL ? 4 : 10) * 1024 * 1024;
export const MAX_UPLOAD_LABEL = process.env.VERCEL ? "4 MB" : "10 MB";
const ALLOWED = /^(image\/(jpeg|png|webp|heic|heif)|application\/pdf)$/;
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic", "image/heif": "heif", "application/pdf": "pdf" };

/** Saves an uploaded file and returns its served URL. Returns null when no file was chosen. */
export async function saveUpload(file: FormDataEntryValue | null, folder: string) {
  if (!file || typeof file === "string" || file.size === 0) return null;
  if (file.size > MAX) throw new Error(`File is larger than ${MAX_UPLOAD_LABEL}.`);
  if (!ALLOWED.test(file.type)) throw new Error("Only PDF, JPG, PNG, WEBP or HEIC files can be attached.");
  // the stored extension comes from the checked type, never from the uploaded name
  const ext = EXT[file.type] ?? "bin";
  const base = file.name.replace(/\.[^.]*$/, "").replace(/[^\w\-]+/g, "_").slice(-60) || "file";
  const key = `${folder}/${format(new Date(), "yyyy-MM")}/${randomBytes(6).toString("hex")}-${base}.${ext}`;
  await db.storedFile.create({
    data: { key, contentType: file.type, size: file.size, data: Buffer.from(await file.arrayBuffer()) },
  });
  return { url: `/api/files/${key}`, name: file.name };
}
