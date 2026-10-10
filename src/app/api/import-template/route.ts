import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { toXlsx } from "@/lib/export";
import { IMPORT_COLUMNS } from "@/lib/import";

export async function GET() {
  if (!(await getUser())) return new NextResponse("Not signed in", { status: 401 });
  const cols = IMPORT_COLUMNS.map((c) => ({ header: c.header, key: c.key, width: Math.max(14, c.header.length + 4) }));
  const example = {
    fullName: "Ram Bahadur Thapa", phone: "+971501234567", nationality: "Nepal", leadSource: "Walk-in", whatsapp: "", email: "",
    passportNo: "PA1234567", passportExpiry: "2031-05-20", gender: "Male", dateOfBirth: "1995-03-14", currentLocation: "Dubai",
    trade: "Warehouse", jobOrder: "", staff: "", notes: "Came with a friend", campaign: "", partner: "", referredBy: "",
  };
  const buf = await toXlsx("Candidates", cols, [example]);
  return new NextResponse(new Uint8Array(buf), {
    headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": 'attachment; filename="candidate-import-template.xlsx"' },
  });
}
