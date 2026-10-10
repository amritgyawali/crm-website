import type { Role } from "./constants";

// What each role may do. ADMIN gets everything.
const MATRIX = {
  "candidate.edit": ["MANAGEMENT", "SALES", "OPERATIONS", "FINANCE"],
  "candidate.delete": ["MANAGEMENT"],
  "candidate.assign": ["MANAGEMENT", "OPERATIONS"],
  "call.log": ["MANAGEMENT", "SALES", "OPERATIONS", "FINANCE"],
  "calls.viewAll": ["MANAGEMENT"],
  "payment.record": ["MANAGEMENT", "FINANCE", "SALES"],
  "payment.edit": ["MANAGEMENT", "FINANCE"],
  "ledger.setup": ["MANAGEMENT", "FINANCE"],
  "refund.request": ["MANAGEMENT", "FINANCE", "OPERATIONS", "SALES"],
  "refund.approve": ["MANAGEMENT"],
  "refund.pay": ["MANAGEMENT", "FINANCE"],
  "finance.view": ["MANAGEMENT", "FINANCE"],
  "packages.manage": ["MANAGEMENT", "FINANCE"],
  "stage.update": ["MANAGEMENT", "OPERATIONS"],
  "document.upload": ["MANAGEMENT", "OPERATIONS", "SALES", "FINANCE"],
  "jobs.manage": ["MANAGEMENT", "OPERATIONS"],
  "partners.manage": ["MANAGEMENT", "OPERATIONS"],
  "partners.finance": ["MANAGEMENT", "FINANCE"],
  "campaigns.manage": ["MANAGEMENT"],
  "campaigns.view": ["MANAGEMENT", "SALES", "FINANCE"],
  "expenses.manage": ["MANAGEMENT", "FINANCE"],
  "expenses.approve": ["MANAGEMENT"],
  "staff.manage": ["MANAGEMENT"],
  "payroll.manage": ["MANAGEMENT", "FINANCE"],
  "payroll.approve": ["MANAGEMENT"],
  "reports.view": ["MANAGEMENT", "FINANCE"],
  "settings.manage": ["MANAGEMENT"],
  "users.manage": ["MANAGEMENT"],
  "audit.view": ["MANAGEMENT"],
  "backup.download": ["MANAGEMENT"],
} satisfies Record<string, Role[]>;

export type Permission = keyof typeof MATRIX;

export function can(role: string | undefined | null, perm: Permission) {
  if (!role) return false;
  if (role === "ADMIN") return true;
  return (MATRIX[perm] as readonly string[]).includes(role);
}
