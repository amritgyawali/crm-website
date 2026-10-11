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
  // records linked by any shared bucket form one group (A~B by phone, B~C by name → A, B, C)
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    const p = parent.get(x) ?? x;
    if (p === x) return x;
    const root = find(p);
    parent.set(x, root);
    return root;
  };
  const reasons = new Map<string, Set<string>>();
  for (const b of buckets.values()) {
    if (b.ids.size < 2) continue;
    const [first, ...rest] = [...b.ids];
    for (const id of rest) parent.set(find(id), find(first!));
  }
  for (const b of buckets.values()) {
    if (b.ids.size < 2) continue;
    const root = find([...b.ids][0]!);
    reasons.set(root, (reasons.get(root) ?? new Set()).add(b.reason));
  }
  const members = new Map<string, string[]>();
  for (const id of new Set([...buckets.values()].filter((b) => b.ids.size > 1).flatMap((b) => [...b.ids]))) {
    const root = find(id);
    members.set(root, [...(members.get(root) ?? []), id]);
  }
  const groups = new Map<string, DupGroup>();
  for (const [root, list] of members) {
    const ids = list.sort();
    const key = ids.join(",");
    if (ignored.has(key)) continue;
    groups.set(key, { key, reason: [...(reasons.get(root) ?? [])].join(", "), ids });
  }
  return [...groups.values()];
}
