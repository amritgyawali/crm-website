import ExcelJS from "exceljs";
import { parse } from "date-fns";

export const IMPORT_COLUMNS = [
  { key: "fullName", header: "Full name", required: true, aliases: ["name", "candidate", "candidatename"] },
  { key: "phone", header: "Phone", required: true, aliases: ["mobile", "phonenumber", "contact", "contactnumber"] },
  { key: "nationality", header: "Nationality", required: true, aliases: ["country", "origin"] },
  { key: "leadSource", header: "Lead source", required: true, aliases: ["source"] },
  { key: "campaign", header: "Campaign", aliases: ["campaignname"] },
  { key: "partner", header: "Partner", aliases: ["agent", "agency", "partnername"] },
  { key: "referredBy", header: "Referred by", aliases: ["referral", "referrer"] },
  { key: "whatsapp", header: "WhatsApp", aliases: ["wa", "whatsappnumber"] },
  { key: "email", header: "Email", aliases: ["mail", "emailaddress"] },
  { key: "passportNo", header: "Passport no", aliases: ["passport", "passportnumber"] },
  { key: "passportExpiry", header: "Passport expiry", aliases: ["passportexpirydate", "expiry"] },
  { key: "gender", header: "Gender", aliases: ["sex"] },
  { key: "dateOfBirth", header: "Date of birth", aliases: ["dob", "birthdate"] },
  { key: "currentLocation", header: "Location", aliases: ["currentlocation", "city"] },
  { key: "trade", header: "Trade", aliases: ["skill", "position", "job"] },
  { key: "jobOrder", header: "Job order ref", aliases: ["joborder", "rrf", "reference", "jobref"] },
  { key: "staff", header: "Staff email", aliases: ["staff", "assignedto", "salesperson"] },
  { key: "notes", header: "Notes", aliases: ["note", "remarks", "comment"] },
] as const;

export type ImportRow = Partial<Record<(typeof IMPORT_COLUMNS)[number]["key"], string>> & { _row: number };

const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

function cellText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    const o = v as { text?: string; result?: unknown; richText?: { text: string }[] };
    if (o.richText) return o.richText.map((r) => r.text).join("");
    if (o.text) return String(o.text);
    if (o.result !== undefined) return cellText(o.result);
  }
  return String(v).trim();
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cur = "", q = false;
  const sep = (text.split("\n")[0] ?? "").includes(";") && !(text.split("\n")[0] ?? "").includes(",") ? ";" : ",";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === sep) { row.push(cur); cur = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cur); rows.push(row); row = []; cur = "";
    } else cur += ch;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}

/** Reads an .xlsx or .csv upload into rows keyed by our column names. */
export async function readSheet(file: File): Promise<{ rows: ImportRow[]; unknownHeaders: string[] }> {
  let grid: string[][];
  if (/\.csv$/i.test(file.name) || file.type === "text/csv") {
    grid = parseCsv((await file.text()).replace(/^﻿/, ""));
  } else {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(await file.arrayBuffer()) as unknown as ArrayBuffer);
    const ws = wb.worksheets[0];
    if (!ws) throw new Error("The workbook has no sheets.");
    grid = [];
    ws.eachRow({ includeEmpty: false }, (r) => {
      const vals = (r.values as unknown[]).slice(1).map(cellText);
      grid.push(vals);
    });
  }
  if (grid.length < 2) throw new Error("The file needs a header row and at least one candidate.");
  const headers = grid[0]!.map((h) => norm(h));
  const map: (string | null)[] = headers.map((h) => {
    const col = IMPORT_COLUMNS.find((c) => norm(c.header) === h || norm(c.key) === h || (c.aliases as readonly string[]).includes(h));
    return col?.key ?? null;
  });
  const unknownHeaders = grid[0]!.filter((_, i) => !map[i] && grid[0]![i]!.trim());
  const rows = grid.slice(1).map((r, i) => {
    const o: ImportRow = { _row: i + 2 };
    map.forEach((k, j) => {
      if (k && r[j]?.trim()) (o as Record<string, unknown>)[k] = r[j]!.trim();
    });
    return o;
  });
  return { rows, unknownHeaders };
}

export function parseLooseDate(v?: string) {
  if (!v) return null;
  for (const f of ["yyyy-MM-dd", "dd/MM/yyyy", "d/M/yyyy", "dd-MM-yyyy", "dd.MM.yyyy", "d MMM yyyy", "MMM d, yyyy"]) {
    const d = parse(v, f, new Date());
    if (!isNaN(d.getTime()) && d.getFullYear() > 1900) return d;
  }
  return null;
}
