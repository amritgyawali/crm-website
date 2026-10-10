import { randomBytes } from "crypto";
import type { Prisma, PrismaClient } from "@prisma/client";

type Tx = PrismaClient | Prisma.TransactionClient;

export async function nextReceiptNo(tx: Tx, prefix: string, date = new Date()) {
  const year = date.getFullYear();
  const head = `${prefix}-${year}-`;
  const last = await tx.payment.findFirst({ where: { receiptNo: { startsWith: head } }, orderBy: { receiptNo: "desc" }, select: { receiptNo: true } });
  const n = last ? Number(last.receiptNo.slice(head.length)) + 1 : 1;
  return head + String(n).padStart(5, "0");
}

export async function nextCandidateCode(tx: Tx) {
  const last = await tx.candidate.findFirst({ orderBy: { code: "desc" }, select: { code: true } });
  const n = last ? Number(last.code.replace(/\D/g, "")) + 1 : 1;
  return "C-" + String(n).padStart(5, "0");
}

export const shareToken = () => randomBytes(12).toString("base64url");
