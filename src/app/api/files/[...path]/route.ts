import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { getUser } from "@/lib/auth";
import { UPLOAD_ROOT } from "@/lib/upload";

const TYPES: Record<string, string> = { ".pdf": "application/pdf", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".heic": "image/heic", ".heif": "image/heif" };

/** Uploaded documents are only served to signed-in staff. */
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  if (!(await getUser())) return new NextResponse("Not signed in", { status: 401 });
  const parts = (await params).path;
  const file = path.resolve(UPLOAD_ROOT, ...parts);
  if (!file.startsWith(UPLOAD_ROOT + path.sep)) return new NextResponse("Bad path", { status: 400 });
  try {
    const data = await readFile(file);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream",
        "Cache-Control": "private, max-age=3600",
        // only known document and image types open in the browser; anything else downloads
        "Content-Disposition": TYPES[path.extname(file).toLowerCase()] ? "inline" : "attachment",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
