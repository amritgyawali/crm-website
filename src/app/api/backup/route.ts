import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { getUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { makeBackup } from "@/lib/backup";

/** Makes a fresh copy of the database and downloads it. */
export async function GET() {
  const user = await getUser();
  if (!user || !can(user.role, "backup.download")) return new NextResponse("Not allowed", { status: 403 });
  try {
    const b = await makeBackup();
    await audit({ userId: user.id, action: "EXPORT", entity: "Backup", summary: `Downloaded database backup ${path.basename(b.file)}` });
    return new NextResponse(new Uint8Array(await readFile(b.file)), {
      headers: { "Content-Type": "application/octet-stream", "Content-Disposition": `attachment; filename="${path.basename(b.file)}"` },
    });
  } catch (e) {
    return new NextResponse(e instanceof Error ? e.message : "Backup failed", { status: 500 });
  }
}
