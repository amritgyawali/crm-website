// Fixed lists used across the app. Labels are what staff see.

type Opt<T extends string> = { value: T; label: string };
const labelsOf = <T extends string>(list: readonly Opt<T>[]) =>
  Object.fromEntries(list.map((o) => [o.value, o.label])) as Record<T, string>;

export const ROLES = [
  { value: "ADMIN", label: "Admin" },
  { value: "MANAGEMENT", label: "Management" },
  { value: "FINANCE", label: "Finance" },
  { value: "SALES", label: "Sales" },
  { value: "OPERATIONS", label: "Operations" },
] as const;
export type Role = (typeof ROLES)[number]["value"];
export const ROLE_LABEL = labelsOf(ROLES);

export const CANDIDATE_STATUS = [
  { value: "LEAD", label: "New lead" },
  { value: "CONTACTED", label: "Contacted" },
  { value: "INTERESTED", label: "Interested" },
  { value: "ENROLLED", label: "Enrolled" },
  { value: "IN_PROCESS", label: "In process" },
  { value: "DEPLOYED", label: "Deployed" },
  { value: "WITHDRAWN", label: "Withdrawn" },
  { value: "REFUSED", label: "Refused" },
  { value: "NOT_ELIGIBLE", label: "Not eligible" },
  { value: "NOT_INTERESTED", label: "Not interested" },
] as const;
export type CandidateStatus = (typeof CANDIDATE_STATUS)[number]["value"];
export const CANDIDATE_STATUS_LABEL = labelsOf(CANDIDATE_STATUS);
export const CLOSED_STATUSES: CandidateStatus[] = ["WITHDRAWN", "REFUSED", "NOT_ELIGIBLE", "NOT_INTERESTED"];
export const PAYING_STATUSES: CandidateStatus[] = ["ENROLLED", "IN_PROCESS", "DEPLOYED"];

export const LEAD_SOURCES = [
  { value: "CAMPAIGN", label: "Campaign" },
  { value: "WALK_IN", label: "Walk-in" },
  { value: "REFERRAL", label: "Referral" },
  { value: "PARTNER", label: "Partner" },
  { value: "OTHER", label: "Other" },
] as const;
export const LEAD_SOURCE_LABEL = labelsOf(LEAD_SOURCES);

// Visa & deployment stages, in order.
export const STAGES = [
  { value: "SELECTED", label: "Selected by employer", short: "Selected" },
  { value: "WP_SUBMITTED", label: "Work permit submitted", short: "WP submitted" },
  { value: "WP_APPROVED", label: "Work permit approved", short: "WP approved" },
  { value: "VFS_BOOKED", label: "Embassy / VFS appointment booked", short: "Appointment" },
  { value: "VISA_APPROVED", label: "Visa approved", short: "Visa approved" },
  { value: "FLIGHT_BOOKED", label: "Flight ticket booked", short: "Flight booked" },
  { value: "BRIEFING_DONE", label: "Pre-departure briefing done", short: "Briefing" },
  { value: "ARRIVED", label: "Departed and arrived", short: "Arrived" },
  { value: "POST_ARRIVAL", label: "Post-arrival check-in", short: "Settled" },
] as const;
export type Stage = (typeof STAGES)[number]["value"];
export const STAGE_LABEL = Object.fromEntries(STAGES.map((s) => [s.value, s.label])) as Record<Stage, string>;
export const STAGE_SHORT = Object.fromEntries(STAGES.map((s) => [s.value, s.short])) as Record<Stage, string>;
export const STAGE_ORDER = STAGES.map((s) => s.value) as Stage[];
export const stageIndex = (s?: string | null) => (s ? STAGE_ORDER.indexOf(s as Stage) : -1);
// Stages where the outcome can be a refusal.
export const REFUSABLE_STAGES: Stage[] = ["WP_APPROVED", "VISA_APPROVED"];
export const DEFAULT_STAGE_DAYS: Record<Stage, number> = {
  SELECTED: 7,
  WP_SUBMITTED: 45,
  WP_APPROVED: 10,
  VFS_BOOKED: 30,
  VISA_APPROVED: 10,
  FLIGHT_BOOKED: 14,
  BRIEFING_DONE: 7,
  ARRIVED: 30,
  POST_ARRIVAL: 9999,
};

export const CALL_OUTCOMES = [
  { value: "NO_ANSWER", label: "No answer" },
  { value: "INTERESTED", label: "Interested" },
  { value: "CALL_BACK", label: "Call back later" },
  { value: "NOT_ELIGIBLE", label: "Not eligible" },
  { value: "NOT_INTERESTED", label: "Not interested" },
  { value: "ENROLLED", label: "Enrolled" },
  { value: "PAYMENT_PROMISED", label: "Payment promised" },
  { value: "PAYMENT_RECEIVED", label: "Payment received" },
] as const;
export type CallOutcome = (typeof CALL_OUTCOMES)[number]["value"];
export const CALL_OUTCOME_LABEL = labelsOf(CALL_OUTCOMES);

export const PAYMENT_METHODS = [
  { value: "CASH", label: "Cash" },
  { value: "BANK_TRANSFER", label: "Bank transfer" },
  { value: "CARD", label: "Card" },
  { value: "CHEQUE", label: "Cheque" },
  { value: "OTHER", label: "Other" },
] as const;
export const PAYMENT_METHOD_LABEL = labelsOf(PAYMENT_METHODS);

export const REFUND_REASONS = [
  { value: "WITHDRAWN", label: "Candidate withdrew" },
  { value: "WP_REFUSED", label: "Work permit refused" },
  { value: "VISA_REFUSED", label: "Visa refused" },
  { value: "NOT_ELIGIBLE", label: "Found not eligible" },
  { value: "OTHER", label: "Other" },
] as const;
export const REFUND_REASON_LABEL = labelsOf(REFUND_REASONS);

export const REFUND_STATUS_LABEL: Record<string, string> = {
  PENDING: "Waiting approval",
  APPROVED: "Approved, not paid",
  REJECTED: "Rejected",
  PAID: "Refunded",
};

export const PARTNER_TYPES = [
  { value: "JOB_ORDERS", label: "Sends job orders" },
  { value: "CANDIDATES", label: "Supplies candidates" },
  { value: "BOTH", label: "Both" },
] as const;
export const PARTNER_TYPE_LABEL = labelsOf(PARTNER_TYPES);

export const JOB_STATUS = [
  { value: "OPEN", label: "Open" },
  { value: "ON_HOLD", label: "On hold" },
  { value: "FILLED", label: "Filled" },
  { value: "CLOSED", label: "Closed" },
] as const;
export const JOB_STATUS_LABEL = labelsOf(JOB_STATUS);

export const PLATFORMS = [
  { value: "FACEBOOK", label: "Facebook" },
  { value: "INSTAGRAM", label: "Instagram" },
  { value: "TIKTOK", label: "TikTok" },
  { value: "OTHER", label: "Other" },
] as const;
export const PLATFORM_LABEL = labelsOf(PLATFORMS);

export const DOCUMENT_KINDS = [
  { value: "PASSPORT", label: "Passport" },
  { value: "PHOTO", label: "Photo" },
  { value: "CV", label: "CV" },
  { value: "CERTIFICATE", label: "Certificate" },
  { value: "MEDICAL", label: "Medical" },
  { value: "POLICE", label: "Police clearance" },
  { value: "WORK_PERMIT", label: "Work permit" },
  { value: "VISA", label: "Visa" },
  { value: "TICKET", label: "Flight ticket" },
  { value: "CONTRACT", label: "Contract" },
  { value: "OTHER", label: "Other" },
] as const;
export const DOCUMENT_KIND_LABEL = labelsOf(DOCUMENT_KINDS);

export const BILL_CATEGORIES = [
  { value: "RENT", label: "Rent" },
  { value: "DEWA", label: "DEWA" },
  { value: "INTERNET", label: "Internet" },
  { value: "PHONE", label: "Phone lines" },
  { value: "SOFTWARE", label: "Software" },
  { value: "LICENCE", label: "Licence renewal" },
  { value: "OTHER", label: "Other" },
] as const;
export const BILL_CATEGORY_LABEL = labelsOf(BILL_CATEGORIES);

export const FREQUENCIES = [
  { value: "MONTHLY", label: "Monthly" },
  { value: "QUARTERLY", label: "Every 3 months" },
  { value: "HALF_YEARLY", label: "Every 6 months" },
  { value: "YEARLY", label: "Yearly" },
  { value: "ONCE", label: "One time" },
] as const;
export const FREQUENCY_LABEL = labelsOf(FREQUENCIES);
export const FREQUENCY_MONTHS: Record<string, number> = { MONTHLY: 1, QUARTERLY: 3, HALF_YEARLY: 6, YEARLY: 12, ONCE: 0 };

export const EXPENSE_CATEGORIES = [
  { value: "OFFICE_SUPPLIES", label: "Office supplies" },
  { value: "MARKETING", label: "Marketing / boosting" },
  { value: "TRAVEL", label: "Travel" },
  { value: "VISA_GOV", label: "Visa & government fees" },
  { value: "OTHER", label: "Other" },
] as const;
export const EXPENSE_CATEGORY_LABEL = labelsOf(EXPENSE_CATEGORIES);

export const ATTENDANCE_STATUS = [
  { value: "PRESENT", label: "Present", short: "P", pay: 1 },
  { value: "LATE", label: "Late", short: "L", pay: 1 },
  { value: "HALF_DAY", label: "Half day", short: "H", pay: 0.5 },
  { value: "ABSENT", label: "Absent", short: "A", pay: 0 },
  { value: "LEAVE", label: "Paid leave", short: "PL", pay: 1 },
  { value: "HOLIDAY", label: "Holiday", short: "—", pay: 1 },
] as const;
export const ATTENDANCE_LABEL = Object.fromEntries(ATTENDANCE_STATUS.map((a) => [a.value, a.label])) as Record<string, string>;
export const ATTENDANCE_PAY = Object.fromEntries(ATTENDANCE_STATUS.map((a) => [a.value, a.pay])) as Record<string, number>;
export const ATTENDANCE_SHORT = Object.fromEntries(ATTENDANCE_STATUS.map((a) => [a.value, a.short])) as Record<string, string>;

export const COUNTRIES_DEST = [
  "Poland", "Romania", "Croatia", "Malta", "Serbia", "Slovakia", "Czech Republic", "Lithuania",
  "Hungary", "Bulgaria", "Portugal", "United Arab Emirates", "Saudi Arabia", "Qatar", "Japan",
];
export const NATIONALITIES = [
  "Nepal", "India", "Pakistan", "Bangladesh", "Sri Lanka", "Philippines", "Uganda", "Kenya", "Nigeria", "Ghana",
];

// Setting keys with defaults (stored in Setting table)
export const SETTING_DEFAULTS = {
  companyName: "Your Company Name",
  companyAddress: "Office address, Dubai, UAE",
  companyPhone: "+971 4 000 0000",
  companyEmail: "accounts@example.com",
  companyTrn: "",
  currency: "AED",
  receiptPrefix: "RC",
  leadNoContactDays: "2",
  paymentReminderDays: "3",
  passportAlertMonths: "12",
  postArrivalCheckDays: "30",
  stageDueDays: "5",
  refundPolicy:
    "Refunds follow the signed candidate agreement. Visa or work permit refusal: full refund less government and embassy fees already paid. Withdrawal by candidate after work permit submission: no refund of the first installment.",
} as const;
export type SettingKey = keyof typeof SETTING_DEFAULTS;
