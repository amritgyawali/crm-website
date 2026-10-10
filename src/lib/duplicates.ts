import { db } from "./db";

const phoneKey = (p: string | null | undefined) => (p ?? "").replace(/\D/g, "").slice(-9);
const nameKey = (n: string) => n.toLowerCase().replace(/[^a-z\s]/g, "").split(/\s+/).filter((w) => w.length > 1).sort().join(" ");

export type DupGroup = { key: string; reason: string; ids: string[] };

/** Groups of candidates that are probably the same person: same phone, same passport, or same name and nationality. */
export async function findDuplicates(ignored: Set<string>): Promise<DupGroup[]> {
  const all = await db.candidate.findMany({ select: { id: true, fullName: true, phone: true, whatsapp: true, passportNo: true, nationality: true } });
  const buckets = new Map<string, { reason: string; ids: Set<string> }>();
  const add = (k: string, reason: string, id: string) => {
    const b = buckets.get(k) ?? { reason, ids: new Set<string>() };
    b.ids.add(id);
    buckets.set(k, b);
  };
  for (const c of all) {
    const p = phoneKey(c.phone);
    if (p.length >= 8) add(`phone:${p}`, "Same phone number", c.id);
    const w = phoneKey(c.whatsapp);
    if (w.length >= 8 && w !== p) add(`phone:${w}`, "Same phone number", c.id);
    if (c.passportNo && c.passportNo.length >= 6) add(`pp:${c.passportNo.toUpperCase()}`, "Same passport number", c.id);
    const n = nameKey(c.fullName);
    if (n.split(" ").length >= 2) add(`name:${n}|${c.nationality.toLowerCase()}`, "Same name and nationality", c.id);
  }
  // merge overlapping buckets into one group per set of ids
  const groups = new Map<string, DupGroup>();
  for (const [k, b] of buckets) {
    if (b.ids.size < 2) continue;
    const ids = [...b.ids].sort();
    const key = ids.join(",");
    if (ignored.has(key)) continue;
    const existing = groups.get(key);
    if (existing) existing.reason += `, ${b.reason.toLowerCase()}`;
    else groups.set(key, { key, reason: b.reason, ids });
    void k;
  }
  return [...groups.values()];
}
