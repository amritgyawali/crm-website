import { endOfMonth, startOfMonth } from "date-fns";
import { db } from "@/lib/db";

export async function performance(userIds: string[], month: Date) {
  const from = startOfMonth(month), to = endOfMonth(month);
  const [calls, enrolled, pays] = await Promise.all([
    db.callLog.groupBy({ by: ["userId"], where: { createdAt: { gte: from, lte: to }, userId: { in: userIds } }, _count: true }),
    db.candidate.groupBy({ by: ["assignedToId"], where: { enrolledOn: { gte: from, lte: to }, assignedToId: { in: userIds } }, _count: true }),
    db.payment.findMany({ where: { date: { gte: from, lte: to }, candidate: { assignedToId: { in: userIds } } }, select: { amount: true, candidate: { select: { assignedToId: true } } } }),
  ]);
  return new Map(userIds.map((id) => [id, {
    calls: calls.find((c) => c.userId === id)?._count ?? 0,
    enrolments: enrolled.find((e) => e.assignedToId === id)?._count ?? 0,
    collection: pays.filter((p) => p.candidate.assignedToId === id).reduce((s, p) => s + p.amount, 0),
  }]));
}
