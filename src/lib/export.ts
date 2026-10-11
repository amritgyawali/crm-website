import ExcelJS from "exceljs";

export type Col = { header: string; key: string; width?: number; money?: boolean; date?: boolean };

export async function toXlsx(title: string, cols: Col[], rows: Record<string, unknown>[]) {
  const wb = new ExcelJS.Workbook();
  wb.created = new Date();
  const ws = wb.addWorksheet(title.slice(0, 31));
  ws.columns = cols.map((c) => ({ header: c.header, key: c.key, width: c.width ?? Math.max(12, c.header.length + 2) }));
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFECE9E1" } };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  for (const r of rows) ws.addRow(r);
  cols.forEach((c, i) => {
    const col = ws.getColumn(i + 1);
    if (c.money) col.numFmt = "#,##0.00";
    if (c.date) col.numFmt = "dd-mmm-yyyy";
  });
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export function toCsv(cols: Col[], rows: Record<string, unknown>[]) {
  const esc = (v: unknown) => {
    if (v === null || v === undefined) return "";
    let s = v instanceof Date ? v.toISOString().slice(0, 10) : String(v);
    // a cell starting with = + - @ would run as a formula in Excel. Phone numbers and
    // signed numbers ("+971 50…", "-250.00") are safe and left exactly as they are.
    if (typeof v === "string" && /^[=+\-@\t\r]/.test(s) && !/^[+-][\d\s().-]*$/.test(s)) s = "'" + s;
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.map((c) => esc(c.header)).join(","), ...rows.map((r) => cols.map((c) => esc(r[c.key])).join(","))].join("\n");
}
