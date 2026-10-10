import { db } from "./db";
import { getSettings } from "./settings";
import { d, fillTemplate, money } from "./format";

const FALLBACK =
  "Hello {name}, this is {staff} from {company}. A reminder that {installment} of {amount} is due on {dueDate}. Your remaining balance is {balance}. Please reply once paid. Thank you.";

/** Returns a function that builds the WhatsApp payment reminder text for one installment. */
export async function reminderWriter(staffName: string) {
  const [s, tpl] = await Promise.all([getSettings(), db.messageTemplate.findFirst({ where: { audience: "CANDIDATE", name: { contains: "reminder" } } })]);
  const body = tpl?.body ?? FALLBACK;
  return (x: { name: string; label: string; outstanding: number; dueDate: Date | null; balance: number }) =>
    fillTemplate(body, {
      name: x.name.split(" ")[0], fullName: x.name, staff: staffName, company: s.companyName, address: s.companyAddress,
      installment: x.label, amount: money(x.outstanding), dueDate: x.dueDate ? d(x.dueDate) : "", balance: money(x.balance),
    });
}
