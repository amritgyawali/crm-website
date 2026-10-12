import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";

/** Uploaded documents are only served to signed-in staff. */
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  if (!(await getUser())) return new NextResponse("Not signed in", { status: 401 });
  const key = (await params).path.join("/");
  const file = await db.storedFile.findUnique({ where: { key } });
  if (!file) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(file.data), {
    headers: {
      // saveUpload only stores PDF and image types, so every file can open in the browser
      "Content-Type": file.contentType,
      "Content-Disposition": "inline",
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
