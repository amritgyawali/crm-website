import { db } from "./db";

export async function audit(opts: {
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  summary: string;
  before?: unknown;
  after?: unknown;
}) {
  await db.auditLog.create({
    data: {
      userId: opts.userId ?? null,
      action: opts.action,
      entity: opts.entity,
      entityId: opts.entityId ?? null,
      summary: opts.summary,
      before: opts.before === undefined ? null : JSON.stringify(opts.before),
      after: opts.after === undefined ? null : JSON.stringify(opts.after),
    },
  });
}
