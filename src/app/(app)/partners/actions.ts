"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requirePerm } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { amount, need, optNum, optStr, run, str } from "@/lib/action";
import { parseDateInput } from "@/lib/dates";
import { saveUpload } from "@/lib/upload";
import { money } from "@/lib/format";
import { PARTNER_TYPES } from "@/lib/constants";

export async function savePartner(id: string | null, fd: FormData) {
  let target = id;
  const res = await run(async () => {
    const user = await requirePerm("partners.manage");
    const type = str(fd, "type");
    if (!PARTNER_TYPES.some((t) => t.value === type)) throw new Error("Choose the partner type.");
    const data = {
      name: need(fd, "name", "Company name"),
      country: need(fd, "country", "Country"),
      type,
      phone: optStr(fd, "phone"),
      whatsapp: optStr(fd, "whatsapp"),
      email: optStr(fd, "email"),
      address: optStr(fd, "address"),
      website: optStr(fd, "website"),
      serviceFeePerWorker: optNum(fd, "serviceFeePerWorker") ?? 0,
      commission: optStr(fd, "commission"),
      paymentTerms: optStr(fd, "paymentTerms"),
      status: str(fd, "status") || "ACTIVE",
      notes: optStr(fd, "notes"),
    };
    if (id) {
      const before = await db.partner.findUniqueOrThrow({ where: { id } });
      await db.partner.update({ where: { id }, data });
      await audit({ userId: user.id, action: "UPDATE", entity: "Partner", entityId: id, summary: `Edited partner ${data.name}`, before, after: data });
    } else {
      const contactName = optStr(fd, "contactName");
      const p = await db.partner.create({
        data: {
          ...data,
          ...(contactName ? { contacts: { create: [{ name: contactName, position: optStr(fd, "contactPosition"), phone: data.phone, whatsapp: data.whatsapp, email: data.email }] } } : {}),
        },
      });
      target = p.id;
      await audit({ userId: user.id, action: "CREATE", entity: "Partner", entityId: p.id, summary: `Added partner ${data.name}` });
    }
  });
  if (res?.ok) redirect(`/partners/${target}`);
  return res;
}

export async function addContact(partnerId: string, fd: FormData) {
  return run(async () => {
    await requirePerm("partners.manage");
    await db.partnerContact.create({
      data: { partnerId, name: need(fd, "name", "Name"), position: optStr(fd, "position"), phone: optStr(fd, "phone"), whatsapp: optStr(fd, "whatsapp"), email: optStr(fd, "email") },
    });
    return "Contact added.";
  });
}

export async function deleteContact(id: string) {
  return run(async () => {
    await requirePerm("partners.manage");
    await db.partnerContact.delete({ where: { id } });
  });
}

export async function addAgreement(partnerId: string, fd: FormData) {
  return run(async () => {
    const user = await requirePerm("partners.manage");
    const file = await saveUpload(fd.get("file"), `partners/${partnerId}`);
    const a = await db.partnerAgreement.create({
      data: {
        partnerId, title: need(fd, "title", "Title"), signedOn: parseDateInput(fd.get("signedOn")), expiresOn: parseDateInput(fd.get("expiresOn")),
        remindDays: optNum(fd, "remindDays") ?? 30, note: optStr(fd, "note"), fileUrl: file?.url ?? null, fileName: file?.name ?? null,
      },
    });
    await audit({ userId: user.id, action: "CREATE", entity: "PartnerAgreement", entityId: a.id, summary: `Added agreement "${a.title}"` });
    return "Agreement saved.";
  });
}

export async function deleteAgreement(id: string) {
  return run(async () => {
    const user = await requirePerm("partners.manage");
    const a = await db.partnerAgreement.delete({ where: { id } });
    await audit({ userId: user.id, action: "DELETE", entity: "PartnerAgreement", entityId: id, summary: `Removed agreement "${a.title}"`, before: a });
  });
}

export async function addPartnerNote(partnerId: string, fd: FormData) {
  return run(async () => {
    const user = await requirePerm("partners.manage");
    const nextFollowUp = parseDateInput(fd.get("nextFollowUp"));
    await db.partnerNote.create({ data: { partnerId, userId: user.id, channel: str(fd, "channel") || "CALL", body: need(fd, "body", "Note"), nextFollowUp } });
    await db.partner.update({ where: { id: partnerId }, data: { nextFollowUp } });
    return "Note saved.";
  });
}

export async function addPartnerEntry(partnerId: string, fd: FormData) {
  return run(async () => {
    const user = await requirePerm("partners.finance");
    const direction = str(fd, "direction") === "PAYABLE" ? "PAYABLE" : "RECEIVABLE";
    const kind = str(fd, "kind") === "PAYMENT" ? "PAYMENT" : "CHARGE";
    const e = await db.partnerEntry.create({
      data: {
        partnerId, direction, kind, amount: amount(fd, "amount", "Amount"),
        date: parseDateInput(fd.get("date")) ?? new Date(), dueDate: kind === "CHARGE" ? parseDateInput(fd.get("dueDate")) : null,
        reference: optStr(fd, "reference"), description: need(fd, "description", "Description"), method: kind === "PAYMENT" ? optStr(fd, "method") : null,
        jobOrderId: optStr(fd, "jobOrderId"), createdById: user.id,
      },
    });
    const what = direction === "RECEIVABLE" ? (kind === "CHARGE" ? "Invoice to partner" : "Payment from partner") : kind === "CHARGE" ? "Amount we owe partner" : "Payment to partner";
    await audit({ userId: user.id, action: "CREATE", entity: "PartnerEntry", entityId: e.id, summary: `${what}: ${money(e.amount)} (${e.description})` });
    return "Saved.";
  });
}

export async function deletePartnerEntry(id: string) {
  return run(async () => {
    const user = await requirePerm("partners.finance");
    const e = await db.partnerEntry.delete({ where: { id } });
    await audit({ userId: user.id, action: "DELETE", entity: "PartnerEntry", entityId: id, summary: `Deleted partner entry ${money(e.amount)} (${e.description})`, before: e });
  });
}
