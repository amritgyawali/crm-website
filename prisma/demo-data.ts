/* Demo data so every screen has something real to show. Wipes existing data first.
   Used by `npm run db:seed` (prisma/seed.ts) and by demo mode (src/lib/demo-db.ts). */
import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { addDays, addMonths, startOfDay, startOfMonth, subDays, subMonths, format, getDay, isAfter } from "date-fns";
import { randomBytes } from "crypto";

let db: PrismaClient;
let now = new Date();
let today = startOfDay(now);

export async function seedDemo(client: PrismaClient) {
  db = client;
  now = new Date();
  today = startOfDay(now);
  seed = 20261010;
  await main();
}

// deterministic random
let seed = 20261010;
const rnd = () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = <T,>(a: readonly T[]) => a[Math.floor(rnd() * a.length)]!;
const int = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
const at = (date: Date, h: number, m = 0) => { const x = new Date(date); x.setHours(h, m, 0, 0); return x; };
const token = () => randomBytes(12).toString("base64url");

const STAGES = ["SELECTED", "WP_SUBMITTED", "WP_APPROVED", "VFS_BOOKED", "VISA_APPROVED", "FLIGHT_BOOKED", "BRIEFING_DONE", "ARRIVED", "POST_ARRIVAL"] as const;

async function wipe() {
  const tables = [
    "auditLog", "messageLog", "callLog", "stageEvent", "document", "payment", "refund", "installment", "candidate",
    "campaign", "feePackageStep", "feePackage", "feeRule", "partnerEntry", "partnerNote", "partnerAgreement",
    "partnerContact", "jobOrder", "partner", "bill", "expense", "attendance", "payroll", "target",
    "messageTemplate", "stageSetting", "setting", "user",
  ] as const;
  for (const t of tables) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any)[t].deleteMany();
  }
}

async function main() {
  await wipe();

  // ------------------------------------------------------------ settings
  const settings: Record<string, string> = {
    companyName: "Recruitment Office",
    companyAddress: "Office 1204, Al Rigga Road, Deira, Dubai, UAE",
    companyPhone: "+971 4 123 4567",
    companyEmail: "accounts@example.com",
    companyTrn: "100000000000003",
  };
  for (const [key, value] of Object.entries(settings)) await db.setting.create({ data: { key, value } });
  const stageDays: Record<string, number> = { SELECTED: 7, WP_SUBMITTED: 45, WP_APPROVED: 10, VFS_BOOKED: 30, VISA_APPROVED: 10, FLIGHT_BOOKED: 14, BRIEFING_DONE: 7, ARRIVED: 30, POST_ARRIVAL: 9999 };
  for (const [stage, maxDays] of Object.entries(stageDays)) await db.stageSetting.create({ data: { stage, maxDays } });

  // ------------------------------------------------------------ staff
  const hash = await bcrypt.hash("office123", 10);
  const mk = (name: string, email: string, role: string, salary: number, phone: string) =>
    db.user.create({ data: { name, email, role, passwordHash: hash, monthlySalary: salary, phone, joinedOn: subMonths(today, int(6, 30)) } });
  const admin = await mk("Office Admin", "admin@office.test", "ADMIN", 0, "+971501110000");
  const manager = await mk("Rashid Khan", "manager@office.test", "MANAGEMENT", 18000, "+971501110001");
  const finance = await mk("Priya Nair", "finance@office.test", "FINANCE", 9500, "+971501110002");
  const ops = await mk("Rohan Shrestha", "ops@office.test", "OPERATIONS", 7000, "+971501110003");
  const s1 = await mk("Sunita Rai", "sunita@office.test", "SALES", 5000, "+971501110004");
  const s2 = await mk("Imran Qureshi", "imran@office.test", "SALES", 5000, "+971501110005");
  const s3 = await mk("Grace Wanjiru", "grace@office.test", "SALES", 4500, "+971501110006");
  const sales = [s1, s2, s3];
  void admin;

  // ------------------------------------------------------------ partners
  const partnerSeed = [
    { name: "Krakow Staffing Sp. z o.o.", country: "Poland", type: "JOB_ORDERS", fee: 1500, commission: "AED 1,500 service fee per deployed worker", terms: "Invoice on worker arrival, 30 days", contact: ["Marta Nowak", "Recruitment Lead", "+48601234567", "marta@krakowstaffing.example"] },
    { name: "Bucharest Workforce SRL", country: "Romania", type: "BOTH", fee: 1200, commission: "AED 1,200 per worker; AED 400 paid to them per candidate they supply", terms: "50% on visa approval, 50% on arrival", contact: ["Andrei Popescu", "Director", "+40722123456", "andrei@bucharestwf.example"] },
    { name: "Adriatic Hire d.o.o.", country: "Croatia", type: "JOB_ORDERS", fee: 1400, commission: "AED 1,400 per deployed worker", terms: "Monthly statement, 15 days", contact: ["Ivana Horvat", "HR Manager", "+385912345678", "ivana@adriatichire.example"] },
    { name: "Kathmandu Skills Pvt. Ltd.", country: "Nepal", type: "CANDIDATES", fee: 0, commission: "We pay AED 600 per selected candidate they supply", terms: "Paid after first installment received from candidate", contact: ["Suman Adhikari", "Managing Director", "+9779851012345", "suman@ktmskills.example"] },
    { name: "Malta Hospitality Group", country: "Malta", type: "JOB_ORDERS", fee: 1800, commission: "AED 1,800 per worker", terms: "On arrival, 30 days", contact: ["Luke Camilleri", "Group HR", "+35679123456", "hr@mhg.example"] },
    { name: "Colombo Manpower Services", country: "Sri Lanka", type: "CANDIDATES", fee: 0, commission: "AED 500 per deployed candidate", terms: "Paid after candidate arrives", contact: ["Nimal Perera", "Partner", "+94771234567", "nimal@colombomp.example"] },
  ] as const;
  const partners = [];
  for (const [i, p] of partnerSeed.entries()) {
    const partner = await db.partner.create({
      data: {
        name: p.name, country: p.country, type: p.type, serviceFeePerWorker: p.fee, commission: p.commission, paymentTerms: p.terms,
        phone: p.contact[2], whatsapp: p.contact[2], email: p.contact[3],
        nextFollowUp: i % 2 === 0 ? addDays(today, int(-2, 6)) : null,
        contacts: { create: [{ name: p.contact[0], position: p.contact[1], phone: p.contact[2], whatsapp: p.contact[2], email: p.contact[3] }] },
        agreements: {
          create: [{
            title: "Cooperation agreement", signedOn: subMonths(today, int(8, 20)),
            expiresOn: i === 1 ? addDays(today, 18) : i === 3 ? subDays(today, 4) : addMonths(today, int(3, 14)), remindDays: 30,
          }],
        },
        partnerNotes: {
          create: [
            { userId: manager.id, channel: "CALL", body: "Discussed next quarter demand. They expect new orders after the holiday season.", createdAt: subDays(today, int(10, 25)) },
            { userId: ops.id, channel: "WHATSAPP", body: "Sent updated CVs and passport copies for shortlisted candidates.", createdAt: subDays(today, int(1, 8)) },
          ],
        },
      },
    });
    partners.push(partner);
  }
  const [pPL, pRO, pHR, pNP, pMT, pLK] = partners;

  // ------------------------------------------------------------ job orders + fee packages
  const jobSeed = [
    { ref: "PL-RRF-2026-114", position: "Warehouse Operative", employer: "LogiPol Warehousing", partner: pPL, country: "Poland", city: "Wroclaw", vac: 25, salary: "PLN 4,666 gross / month", months: 24, fee: 9500 },
    { ref: "PL-RRF-2026-121", position: "MIG/MAG Welder", employer: "Stalbud S.A.", partner: pPL, country: "Poland", city: "Gdansk", vac: 8, salary: "PLN 6,200 gross / month", months: 24, fee: 11000 },
    { ref: "RO-2026-031", position: "Construction Helper", employer: "ConstructNord SRL", partner: pRO, country: "Romania", city: "Cluj-Napoca", vac: 30, salary: "RON 3,700 net / month", months: 24, fee: 7500 },
    { ref: "RO-2026-044", position: "Food Delivery Rider", employer: "Rapid Courier SRL", partner: pRO, country: "Romania", city: "Bucharest", vac: 15, salary: "RON 3,300 net + tips", months: 12, fee: 7000 },
    { ref: "HR-26-009", position: "Housekeeping Attendant", employer: "Hotel Lungomare", partner: pHR, country: "Croatia", city: "Split", vac: 12, salary: "EUR 1,050 net / month", months: 12, fee: 8000 },
    { ref: "HR-26-012", position: "Kitchen Helper", employer: "Dubrovnik Riviera Hotels", partner: pHR, country: "Croatia", city: "Dubrovnik", vac: 10, salary: "EUR 1,100 net / month", months: 12, fee: 8000 },
    { ref: "MT-2026-07", position: "Waiter / Waitress", employer: "Malta Hospitality Group", partner: pMT, country: "Malta", city: "St Julian's", vac: 10, salary: "EUR 1,250 gross / month", months: 24, fee: 11500 },
    { ref: "AE-DIR-2026-03", position: "Security Guard", employer: "Gulf Shield Security LLC", partner: null, country: "United Arab Emirates", city: "Dubai", vac: 20, salary: "AED 2,800 / month + accommodation", months: 24, fee: 2500 },
  ];
  const jobs = [];
  for (const j of jobSeed) {
    const job = await db.jobOrder.create({
      data: {
        reference: j.ref, position: j.position, employer: j.employer, partnerId: j.partner?.id ?? null, country: j.country, city: j.city,
        vacancies: j.vac, salary: j.salary, contractMonths: j.months, receivedOn: subDays(today, int(40, 160)),
        deadline: addDays(today, int(20, 90)), status: j.ref === "HR-26-012" ? "ON_HOLD" : "OPEN",
        requirements: "Age 21–40. Passport valid 2+ years. Basic English. Medical fit.",
      },
    });
    const first = Math.round(j.fee * 0.3);
    const second = Math.round(j.fee * 0.4);
    const pkg = await db.feePackage.create({
      data: {
        name: `${j.position} · ${j.country}`, jobOrderId: job.id, country: j.country, totalAmount: j.fee,
        refundPolicy: "Visa or work permit refused: full refund less AED 750 processing. Candidate withdraws after WP submission: first installment not refunded.",
        steps: {
          create: j.fee <= 3000
            ? [{ sequence: 1, label: "Registration", amount: 1000, dueAfterDays: 0 }, { sequence: 2, label: "Balance before ticket", amount: j.fee - 1000, stage: "VISA_APPROVED" }]
            : [
                { sequence: 1, label: "First installment (enrolment)", amount: first, dueAfterDays: 0 },
                { sequence: 2, label: "After work permit approval", amount: second, stage: "WP_APPROVED" },
                { sequence: 3, label: "After visa approval", amount: j.fee - first - second, stage: "VISA_APPROVED" },
              ],
        },
      },
      include: { steps: true },
    });
    jobs.push({ job, pkg, seed: j });
  }

  await db.feeRule.createMany({
    data: [
      { country: "Poland", side: "DESTINATION", maxAmount: 12000, note: "Company policy cap for Poland packages. Check against current rules before changing." },
      { country: "Romania", side: "DESTINATION", maxAmount: 9000, note: "Company policy cap." },
      { country: "Croatia", side: "DESTINATION", maxAmount: 9500, note: "Company policy cap." },
      { country: "Malta", side: "DESTINATION", maxAmount: 13000, note: "Company policy cap." },
      { country: "United Arab Emirates", side: "DESTINATION", maxAmount: 3000, note: "Local placements. Keep within MOHRE rules." },
      { country: "Nepal", side: "ORIGIN", maxAmount: 14000, note: "Placeholder. Confirm with the current Department of Foreign Employment fee ceiling." },
    ],
  });

  // ------------------------------------------------------------ campaigns
  const campSeed = [
    { name: "Poland warehouse jobs, Sept boost", platform: "FACEBOOK", job: 0, start: -55, end: -25, spent: 1850 },
    { name: "Welders for Poland, reel", platform: "INSTAGRAM", job: 1, start: -40, end: -20, spent: 720 },
    { name: "Romania construction, TikTok", platform: "TIKTOK", job: 2, start: -35, end: -5, spent: 640 },
    { name: "Croatia hotel jobs, carousel", platform: "INSTAGRAM", job: 4, start: -30, end: null, spent: 980 },
    { name: "Malta waiter jobs, lead form", platform: "FACEBOOK", job: 6, start: -21, end: null, spent: 1240 },
    { name: "Security guard walk-in day", platform: "FACEBOOK", job: 7, start: -14, end: -7, spent: 380 },
  ];
  const campaigns = [];
  for (const c of campSeed) {
    campaigns.push(await db.campaign.create({
      data: {
        name: c.name, platform: c.platform, jobOrderId: jobs[c.job]!.job.id, startDate: addDays(today, c.start),
        endDate: c.end === null ? null : addDays(today, c.end), amountSpent: c.spent,
      },
    }));
  }

  // ------------------------------------------------------------ candidates
  const first = {
    Nepal: ["Bishal", "Sushma", "Ramesh", "Anita", "Prakash", "Dipendra", "Sabina", "Kiran", "Manoj", "Rabin", "Pooja", "Suresh"],
    India: ["Arjun", "Vikram", "Deepa", "Rahul", "Sanjay", "Lakshmi", "Anil", "Jaspreet"],
    Pakistan: ["Usman", "Bilal", "Hamza", "Asad", "Zeeshan"],
    "Sri Lanka": ["Chaminda", "Nuwan", "Dilani", "Kasun"],
    Philippines: ["Mark", "Joy", "Rhea", "Jericho", "Angelica"],
    Uganda: ["Brian", "Esther", "Ronald"],
    Kenya: ["Kevin", "Faith", "Dennis"],
    Bangladesh: ["Rakib", "Sohel", "Tanvir"],
  } as Record<string, string[]>;
  const last = {
    Nepal: ["Gurung", "Tamang", "Shrestha", "Magar", "Karki", "Adhikari", "Thapa", "Bhandari", "Poudel", "Limbu"],
    India: ["Sharma", "Singh", "Menon", "Pillai", "Kumar", "Reddy"],
    Pakistan: ["Ahmed", "Hussain", "Iqbal", "Raza"],
    "Sri Lanka": ["Perera", "Fernando", "Silva", "Jayasinghe"],
    Philippines: ["Santos", "Reyes", "Dela Cruz", "Bautista"],
    Uganda: ["Okello", "Namukasa", "Ssempala"],
    Kenya: ["Otieno", "Wambui", "Kiprono"],
    Bangladesh: ["Hossain", "Rahman", "Islam"],
  } as Record<string, string[]>;
  const nats = ["Nepal", "Nepal", "Nepal", "Nepal", "India", "India", "Pakistan", "Sri Lanka", "Philippines", "Uganda", "Kenya", "Bangladesh"];
  const trades: Record<string, string> = { "Warehouse Operative": "Warehouse / forklift", "MIG/MAG Welder": "Welder", "Construction Helper": "Construction", "Food Delivery Rider": "Driver / rider", "Housekeeping Attendant": "Housekeeping", "Kitchen Helper": "Kitchen", "Waiter / Waitress": "F&B service", "Security Guard": "Security" };

  type Plan = { status: string; stageIdx?: number; refused?: "WP" | "VISA"; withdrawn?: boolean };
  const plans: Plan[] = [
    ...Array.from({ length: 16 }, () => ({ status: "LEAD" })),
    ...Array.from({ length: 8 }, () => ({ status: "CONTACTED" })),
    ...Array.from({ length: 9 }, () => ({ status: "INTERESTED" })),
    ...Array.from({ length: 11 }, () => ({ status: "ENROLLED" })),
    ...[0, 0, 1, 1, 1, 1, 2, 2, 3, 3, 3, 4, 4, 5, 6, 6].map((i) => ({ status: "IN_PROCESS", stageIdx: i })),
    ...[7, 7, 7, 8, 8, 8].map((i) => ({ status: "DEPLOYED", stageIdx: i })),
    { status: "WITHDRAWN", stageIdx: 1, withdrawn: true },
    { status: "WITHDRAWN", withdrawn: true },
    { status: "REFUSED", stageIdx: 2, refused: "WP" },
    { status: "REFUSED", stageIdx: 4, refused: "VISA" },
    ...Array.from({ length: 3 }, () => ({ status: "NOT_INTERESTED" })),
    ...Array.from({ length: 2 }, () => ({ status: "NOT_ELIGIBLE" })),
  ];

  let code = 0;
  let receipt = 0;
  const usedNames = new Set<string>();
  const jobWeights = [0, 0, 0, 1, 2, 2, 2, 3, 4, 4, 5, 6, 6, 7, 7];
  const outcomesFor: Record<string, string[]> = {
    LEAD: ["NO_ANSWER"],
    CONTACTED: ["NO_ANSWER", "CALL_BACK"],
    INTERESTED: ["NO_ANSWER", "CALL_BACK", "INTERESTED"],
    NOT_INTERESTED: ["NO_ANSWER", "NOT_INTERESTED"],
    NOT_ELIGIBLE: ["INTERESTED", "NOT_ELIGIBLE"],
  };

  for (const [idx, plan] of plans.entries()) {
    const nat = pick(nats);
    let name = "";
    let tries = 0;
    do {
      name = `${pick(first[nat]!)} ${pick(last[nat]!)}`;
      if (++tries > 30) name = `${pick(first[nat]!)} ${String.fromCharCode(65 + int(0, 25))}. ${pick(last[nat]!)}`;
    } while (usedNames.has(name));
    usedNames.add(name);

    const jw = jobs[pick(jobWeights)]!;
    const paying = ["ENROLLED", "IN_PROCESS", "DEPLOYED", "WITHDRAWN", "REFUSED"].includes(plan.status);
    const isEarly = ["LEAD", "CONTACTED", "INTERESTED", "NOT_INTERESTED", "NOT_ELIGIBLE"].includes(plan.status);
    const daysAgo = plan.status === "LEAD" ? int(0, 6) : isEarly ? int(4, 30) : (plan.stageIdx ?? 0) >= 7 ? int(150, 220) : int(25, 120);
    const createdAt = at(subDays(today, daysAgo), int(9, 17), int(0, 59));

    // lead source
    const campaign = campaigns.find((c) => c.jobOrderId === jw.job.id);
    const r = rnd();
    let leadSource = "WALK_IN", campaignId: string | null = null, sourcePartnerId: string | null = null, referredBy: string | null = null;
    if (campaign && r < 0.55) { leadSource = "CAMPAIGN"; campaignId = campaign.id; }
    else if (r < 0.68) { leadSource = "PARTNER"; sourcePartnerId = nat === "Sri Lanka" ? pLK!.id : pick([pNP!.id, pRO!.id]); }
    else if (r < 0.82) { leadSource = "REFERRAL"; referredBy = `${pick(first.Nepal!)} (deployed candidate)`; }
    else if (r < 0.92) leadSource = "WALK_IN";
    else leadSource = "OTHER";

    const assigned = sales[idx % 3]!;
    const enrolledOn = paying ? at(addDays(createdAt, int(2, 9)), 11) : null;
    const passportExpiry = idx % 9 === 0 ? addMonths(today, int(3, 11)) : addMonths(today, int(18, 90));

    code += 1;
    const cand = await db.candidate.create({
      data: {
        code: "C-" + String(code).padStart(5, "0"),
        fullName: name,
        phone: `+9715${int(0, 8)}${int(1000000, 9999999)}`,
        whatsapp: null,
        nationality: nat,
        gender: rnd() < 0.75 ? "Male" : "Female",
        dateOfBirth: subMonths(today, int(22 * 12, 38 * 12)),
        currentLocation: rnd() < 0.7 ? "Dubai" : rnd() < 0.5 ? "Sharjah" : "Home country",
        trade: trades[jw.job.position],
        experienceYears: int(0, 8),
        passportNo: `${nat.slice(0, 1)}${int(1000000, 9999999)}`,
        passportExpiry,
        status: plan.status,
        leadSource, campaignId, sourcePartnerId, referredBy,
        jobOrderId: isEarly && rnd() < 0.3 ? null : jw.job.id,
        assignedToId: plan.status === "LEAD" && idx % 7 === 3 ? null : assigned.id,
        feePackageId: paying ? jw.pkg.id : null,
        agreedAmount: paying ? jw.pkg.totalAmount : 0,
        enrolledOn,
        createdAt,
        lastContactedAt: null,
        closedAt: plan.withdrawn || plan.refused || plan.status === "NOT_INTERESTED" || plan.status === "NOT_ELIGIBLE" ? subDays(today, int(3, 20)) : null,
        closedReason: plan.withdrawn ? "Family reasons, not travelling" : plan.refused === "WP" ? "Work permit refused" : plan.refused === "VISA" ? "Visa refused" : null,
      },
    });

    // ----- calls
    let lastCall: Date | null = null;
    const nCalls = plan.status === "LEAD" ? (idx % 3 === 0 ? 0 : int(0, 1)) : int(2, 6);
    const callStart = createdAt;
    for (let k = 0; k < nCalls; k++) {
      const when = at(addDays(callStart, Math.min(k * int(1, 4), Math.max(daysAgo - 1, 0))), int(9, 18), int(0, 59));
      if (isAfter(when, now)) break;
      let outcome: string;
      if (outcomesFor[plan.status]) {
        const list = outcomesFor[plan.status]!;
        outcome = k === nCalls - 1 ? list[list.length - 1]! : pick(list);
      } else {
        outcome = k === 0 ? "INTERESTED" : k === 1 ? "ENROLLED" : pick(["PAYMENT_PROMISED", "PAYMENT_RECEIVED", "CALL_BACK", "NO_ANSWER"]);
      }
      await db.callLog.create({
        data: {
          candidateId: cand.id, userId: assigned.id, outcome, createdAt: when,
          channel: rnd() < 0.3 ? "WHATSAPP" : "PHONE",
          note: outcome === "NO_ANSWER" ? null : pick(["Asked about salary and accommodation", "Will bring passport copy tomorrow", "Discussed fee plan", "Wants to talk to family first", "Asked about medical test", "Confirmed interest"]),
        },
      });
      lastCall = when;
    }

    // today's calls for the counts
    if (["CONTACTED", "INTERESTED", "ENROLLED"].includes(plan.status) && rnd() < 0.5) {
      const when = at(today, int(9, Math.max(9, Math.min(now.getHours(), 17))), int(0, 59));
      if (!isAfter(when, now)) {
        await db.callLog.create({ data: { candidateId: cand.id, userId: assigned.id, outcome: pick(["NO_ANSWER", "INTERESTED", "CALL_BACK", "PAYMENT_PROMISED"]), createdAt: when } });
        lastCall = when;
      }
    }

    let nextCallAt: Date | null = null;
    if (plan.status === "CONTACTED" || plan.status === "INTERESTED") {
      nextCallAt = at(addDays(today, int(-2, 3)), int(10, 16));
    }
    await db.candidate.update({ where: { id: cand.id }, data: { lastContactedAt: lastCall, nextCallAt } });

    if (!paying || !enrolledOn) continue;

    // ----- stage history
    const reached: Record<string, Date> = {};
    if (plan.stageIdx !== undefined) {
      const totalSteps = plan.stageIdx + 1;
      const startAt = addDays(enrolledOn, int(3, 10));
      const span = Math.max(Math.floor((today.getTime() - startAt.getTime()) / 86400000) - int(2, 12), totalSteps);
      for (let s = 0; s <= plan.stageIdx; s++) {
        const stage = STAGES[s]!;
        let date = addDays(startAt, Math.floor((span * s) / totalSteps));
        if (isAfter(date, today)) date = today;
        const refusedHere = (plan.refused === "WP" && stage === "WP_APPROVED") || (plan.refused === "VISA" && stage === "VISA_APPROVED");
        reached[stage] = date;
        await db.stageEvent.create({
          data: {
            candidateId: cand.id, stage, date, userId: ops.id, result: refusedHere ? "REFUSED" : "DONE",
            refusalReason: refusedHere ? (plan.refused === "WP" ? "Employer quota exceeded for this permit type" : "Insufficient proof of qualifications") : null,
            location: stage === "VFS_BOOKED" ? pick(["VFS Global, Wafi Mall, Dubai", "Embassy, Abu Dhabi"]) : null,
            appointmentAt: stage === "VFS_BOOKED" ? at(addDays(date, int(5, 20)), int(9, 14)) : stage === "FLIGHT_BOOKED" ? at(addDays(date, 9), int(2, 22)) : null,
            flightDetails: stage === "FLIGHT_BOOKED" ? `${pick(["FZ", "EK", "LO", "W6"])} ${int(100, 1999)}, DXB → ${jw.job.city}, ${format(addDays(date, 9), "d MMM")}` : null,
            note: s === 0 ? `Selected in interview for ${jw.job.employer}` : null,
          },
        });
      }
      const current = STAGES[plan.stageIdx]!;
      await db.candidate.update({
        where: { id: cand.id },
        data: { stage: current, stageEnteredAt: reached[current]! },
      });
    }

    // ----- installments from package
    const steps = [...jw.pkg.steps].sort((a, b) => a.sequence - b.sequence);
    const insts = [];
    for (const st of steps) {
      let due: Date | null = null;
      if (st.dueAfterDays !== null && st.dueAfterDays !== undefined) due = addDays(startOfDay(enrolledOn), st.dueAfterDays);
      else if (st.stage && reached[st.stage]) due = addDays(startOfDay(reached[st.stage]!), 5);
      // a few enrolled candidates have a split first payment due this week
      insts.push(await db.installment.create({ data: { candidateId: cand.id, sequence: st.sequence, label: st.label, amount: st.amount, dueDate: due, stage: st.stage } }));
    }
    // enrolled-but-not-selected: make some second installments due soon so the due lists have entries
    if (plan.status === "ENROLLED" && insts[1] && idx % 2 === 0) {
      await db.installment.update({ where: { id: insts[1].id }, data: { dueDate: addDays(today, int(-6, 6)), stage: null, label: "Second installment (agreed date)" } });
      insts[1].dueDate = addDays(today, 0);
    }

    // ----- payments: pay due installments, leave a few behind
    const behind = idx % 5 === 0;
    for (const [k, inst] of insts.entries()) {
      if (!inst.dueDate) continue;
      if (isAfter(inst.dueDate, today)) continue;
      if (behind && k > 0) continue;
      if (plan.status === "ENROLLED" && k > 0 && idx % 3 !== 0) continue;
      const partial = idx % 7 === 0 && k === insts.length - 1;
      const amountPaid = partial ? Math.round(inst.amount / 2) : inst.amount;
      const date = at(addDays(inst.dueDate, int(0, 3) > now.getDate() ? 0 : int(0, 3)), int(10, 18), int(0, 59));
      const payDate = isAfter(date, now) ? at(today, 10) : date;
      receipt += 1;
      const method = rnd() < 0.55 ? "CASH" : "BANK_TRANSFER";
      await db.payment.create({
        data: {
          receiptNo: `RC-${payDate.getFullYear()}-${String(receipt).padStart(5, "0")}`,
          shareToken: token(),
          candidateId: cand.id, date: payDate, amount: amountPaid, method,
          reference: method === "BANK_TRANSFER" ? `FT${int(10000000, 99999999)}` : null,
          receivedById: method === "CASH" ? assigned.id : finance.id,
          createdAt: payDate,
        },
      });
    }

    // ----- refunds for closed cases
    if (plan.withdrawn || plan.refused) {
      const paid = (await db.payment.aggregate({ where: { candidateId: cand.id }, _sum: { amount: true } }))._sum.amount ?? 0;
      if (paid > 0) {
        const policyAmount = plan.refused ? Math.max(paid - 750, 0) : 0;
        await db.refund.create({
          data: {
            candidateId: cand.id,
            reason: plan.withdrawn ? "WITHDRAWN" : plan.refused === "WP" ? "WP_REFUSED" : "VISA_REFUSED",
            stageAtClose: plan.stageIdx !== undefined ? STAGES[plan.stageIdx] : null,
            paidToDate: paid, policyAmount,
            note: plan.withdrawn ? "Withdrew after work permit submission; first installment is not refundable." : "Full refund less AED 750 processing per agreement.",
            requestedById: ops.id,
            status: plan.refused === "VISA" ? "PENDING" : plan.withdrawn ? "APPROVED" : "PAID",
            approvedById: plan.refused === "VISA" ? null : manager.id,
            approvedAt: plan.refused === "VISA" ? null : subDays(today, 5),
            refundedOn: plan.refused === "WP" ? subDays(today, 2) : null,
            refundMethod: plan.refused === "WP" ? "BANK_TRANSFER" : null,
          },
        });
      }
    }
  }

  // ------------------------------------------------------------ part payments earlier this month
  const owing = await db.candidate.findMany({ where: { status: { in: ["ENROLLED", "IN_PROCESS"] } }, include: { payments: true } });
  for (const c of owing.filter((_, i) => i % 2 === 0).slice(0, 14)) {
    const paid = c.payments.reduce((s, p) => s + p.amount, 0);
    const left = c.agreedAmount - paid;
    if (left < 500) continue;
    const day = Math.min(now.getDate() - 1, int(1, 28));
    const date = at(addDays(startOfMonth(today), Math.max(day - 1, 0)), int(10, 18), int(0, 59));
    if (isAfter(date, now)) continue;
    receipt += 1;
    const method = rnd() < 0.5 ? "CASH" : "BANK_TRANSFER";
    await db.payment.create({
      data: {
        receiptNo: `RC-${date.getFullYear()}-${String(receipt).padStart(5, "0")}`, shareToken: token(), candidateId: c.id, date,
        amount: Math.min(left, pick([500, 1000, 1500, 2000])), method,
        reference: method === "BANK_TRANSFER" ? `FT${int(10000000, 99999999)}` : null,
        receivedById: method === "CASH" ? (c.assignedToId ?? finance.id) : finance.id, note: "Part payment", createdAt: date,
      },
    });
  }

  // ------------------------------------------------------------ partner money
  for (const { job, seed: j } of jobs) {
    if (!j.partner) continue;
    const deployed = await db.candidate.count({ where: { jobOrderId: job.id, status: "DEPLOYED" } });
    if (deployed && j.partner.serviceFeePerWorker) {
      const amt = deployed * j.partner.serviceFeePerWorker;
      await db.partnerEntry.create({ data: { partnerId: j.partner.id, direction: "RECEIVABLE", kind: "CHARGE", amount: amt, date: subDays(today, 40), dueDate: subDays(today, 10), reference: `INV-${job.reference}`, description: `Service fee, ${deployed} workers deployed`, jobOrderId: job.id } });
      await db.partnerEntry.create({ data: { partnerId: j.partner.id, direction: "RECEIVABLE", kind: "PAYMENT", amount: Math.round(amt * 0.5), date: subDays(today, 12), reference: `SWIFT-${int(100000, 999999)}`, description: "Part payment received", method: "BANK_TRANSFER", jobOrderId: job.id } });
    }
    const inProcess = await db.candidate.count({ where: { jobOrderId: job.id, status: "IN_PROCESS", stage: { in: ["VISA_APPROVED", "FLIGHT_BOOKED", "BRIEFING_DONE"] } } });
    if (inProcess && j.partner.serviceFeePerWorker) {
      await db.partnerEntry.create({ data: { partnerId: j.partner.id, direction: "RECEIVABLE", kind: "CHARGE", amount: inProcess * j.partner.serviceFeePerWorker * 0.5, date: subDays(today, 6), dueDate: addDays(today, 24), reference: `INV-${job.reference}-B`, description: `50% advance on ${inProcess} visas approved`, jobOrderId: job.id } });
    }
  }
  for (const p of [pNP!, pLK!, pRO!]) {
    const supplied = await db.candidate.count({ where: { sourcePartnerId: p.id, status: { in: ["IN_PROCESS", "DEPLOYED"] } } });
    if (!supplied) continue;
    const rate = p.id === pNP!.id ? 600 : p.id === pLK!.id ? 500 : 400;
    await db.partnerEntry.create({ data: { partnerId: p.id, direction: "PAYABLE", kind: "CHARGE", amount: supplied * rate, date: subDays(today, 20), dueDate: addDays(today, 5), reference: `COMM-${format(today, "yyMM")}`, description: `Commission for ${supplied} supplied candidates` } });
    await db.partnerEntry.create({ data: { partnerId: p.id, direction: "PAYABLE", kind: "PAYMENT", amount: rate, date: subDays(today, 8), description: "Commission paid", method: "BANK_TRANSFER" } });
  }

  // ------------------------------------------------------------ bills
  const billSeed = [
    { name: "Office rent (Q)", category: "RENT", vendor: "Al Rigga Properties", amount: 18500, freq: "QUARTERLY", firstDue: subMonths(startOfMonth(today), 6), remind: 10 },
    { name: "DEWA electricity & water", category: "DEWA", vendor: "DEWA", amount: 1180, freq: "MONTHLY", firstDue: addDays(subMonths(startOfMonth(today), 3), 14), remind: 5 },
    { name: "Fibre internet 500 Mbps", category: "INTERNET", vendor: "du", amount: 499, freq: "MONTHLY", firstDue: addDays(subMonths(startOfMonth(today), 3), 9), remind: 5 },
    { name: "Mobile lines (6)", category: "PHONE", vendor: "e&", amount: 735, freq: "MONTHLY", firstDue: addDays(subMonths(startOfMonth(today), 3), 19), remind: 5 },
    { name: "Google Workspace", category: "SOFTWARE", vendor: "Google", amount: 276, freq: "MONTHLY", firstDue: addDays(subMonths(startOfMonth(today), 3), 0), remind: 3 },
    { name: "Accounting software", category: "SOFTWARE", vendor: "Zoho", amount: 1450, freq: "YEARLY", firstDue: addDays(today, 22), remind: 14 },
    { name: "Trade licence renewal", category: "LICENCE", vendor: "DET Dubai", amount: 14850, freq: "YEARLY", firstDue: addDays(today, 41), remind: 30 },
  ];
  const monthsByFreq: Record<string, number> = { MONTHLY: 1, QUARTERLY: 3, YEARLY: 12 };
  for (const b of billSeed) {
    const seriesId = token();
    let due = b.firstDue;
    while (true) {
      const paid = isAfter(today, addDays(due, 2)) || (due < today && rnd() < 0.5);
      const isPastLike = due < today;
      await db.bill.create({
        data: {
          name: b.name, category: b.category, vendor: b.vendor, amount: b.category === "DEWA" ? b.amount + int(-160, 220) : b.amount, dueDate: due,
          frequency: b.freq, remindDays: b.remind, seriesId,
          status: paid && isPastLike ? "PAID" : "UNPAID",
          paidOn: paid && isPastLike ? addDays(due, int(-2, 1)) : null,
          paidMethod: paid && isPastLike ? (b.category === "RENT" ? "CHEQUE" : "BANK_TRANSFER") : null,
        },
      });
      if (!(paid && isPastLike)) break;
      due = addMonths(due, monthsByFreq[b.freq]!);
    }
  }

  // ------------------------------------------------------------ expenses
  for (let m = 3; m >= 0; m--) {
    const base = subMonths(startOfMonth(today), m);
    const items: [string, number, string][] = [
      ["OFFICE_SUPPLIES", int(180, 620), "Printer paper, toner, files"],
      ["OFFICE_SUPPLIES", int(90, 260), "Water and tea supplies"],
      ["TRAVEL", int(120, 480), "Taxi to embassy and VFS"],
      ["VISA_GOV", int(600, 2400), "Attestation and typing centre fees"],
      ["VISA_GOV", int(300, 900), "Courier of documents to partner"],
      ["OTHER", int(150, 400), "Office cleaning"],
    ];
    for (const [cat, amount, note] of items) {
      const date = addDays(base, int(0, 26));
      if (isAfter(date, today)) continue;
      await db.expense.create({
        data: { date, category: cat, amount, note, paidBy: pick(["Petty cash", "Company card", "Priya Nair"]), method: pick(["CASH", "CARD"]), status: m === 0 && rnd() < 0.4 ? "PENDING" : "APPROVED", createdById: finance.id, approvedById: manager.id, approvedAt: date },
      });
    }
  }
  for (const c of campaigns) {
    await db.expense.create({
      data: { date: c.startDate, category: "MARKETING", amount: c.amountSpent, note: `Boost: ${c.name}`, paidBy: "Company card", method: "CARD", campaignId: c.id, status: "APPROVED", createdById: finance.id, approvedById: manager.id, approvedAt: c.startDate },
    });
  }

  // ------------------------------------------------------------ attendance, payroll, targets
  const staff = [manager, finance, ops, ...sales];
  const prevMonth = subMonths(startOfMonth(today), 1);
  for (const u of staff) {
    for (let day = prevMonth; day <= today; day = addDays(day, 1)) {
      if (getDay(day) === 0) continue; // Sunday off
      const r = rnd();
      const status = getDay(day) === 6 && rnd() < 0.5 ? "HOLIDAY" : r < 0.82 ? "PRESENT" : r < 0.9 ? "LATE" : r < 0.94 ? "HALF_DAY" : r < 0.97 ? "LEAVE" : "ABSENT";
      if (day.getTime() === today.getTime() && rnd() < 0.2) continue;
      await db.attendance.create({
        data: {
          userId: u.id, date: day, status,
          checkIn: status === "PRESENT" ? `08:${String(int(40, 59)).padStart(2, "0")}` : status === "LATE" ? `09:${String(int(16, 50)).padStart(2, "0")}` : status === "HALF_DAY" ? "09:00" : null,
          checkOut: status === "PRESENT" || status === "LATE" ? `18:${String(int(0, 30)).padStart(2, "0")}` : status === "HALF_DAY" ? "13:00" : null,
        },
      });
    }
  }
  const pm = format(prevMonth, "yyyy-MM");
  for (const u of staff) {
    const days = await db.attendance.findMany({ where: { userId: u.id, date: { gte: prevMonth, lt: startOfMonth(today) } } });
    const pay: Record<string, number> = { PRESENT: 1, LATE: 1, HALF_DAY: 0.5, ABSENT: 0, LEAVE: 1, HOLIDAY: 1 };
    const workingDays = days.length;
    const paidDays = days.reduce((s, x) => s + (pay[x.status] ?? 0), 0);
    const net = Math.round((u.monthlySalary * paidDays) / Math.max(workingDays, 1));
    await db.payroll.create({ data: { userId: u.id, month: pm, baseSalary: u.monthlySalary, workingDays, paidDays, netPay: net, status: "PAID", approvedById: manager.id, approvedAt: addDays(startOfMonth(today), 1), paidOn: addDays(startOfMonth(today), 2) } });
  }
  const cm = format(today, "yyyy-MM");
  for (const u of sales) await db.target.create({ data: { userId: u.id, month: cm, calls: 400, enrolments: 8, collection: 30000 } });
  for (const u of sales) await db.target.create({ data: { userId: u.id, month: pm, calls: 380, enrolments: 7, collection: 28000 } });

  // ------------------------------------------------------------ templates
  await db.messageTemplate.createMany({
    data: [
      { name: "Payment reminder", audience: "CANDIDATE", body: "Hello {name}, this is {staff} from {company}. A reminder that {installment} of {amount} is due on {dueDate}. Your remaining balance is {balance}. Please reply once paid. Thank you." },
      { name: "Interview invitation", audience: "CANDIDATE", body: "Hello {name}, you are invited for an interview for the {job} position. Please come to our office with your passport and CV. Address: {address}." },
      { name: "Documents needed", audience: "CANDIDATE", body: "Hello {name}, to continue your file for {job} we need: passport copy, photo with white background, and experience certificate. Please send them here on WhatsApp." },
      { name: "Visa approved", audience: "CANDIDATE", body: "Good news {name}! Your visa has been approved. Please visit the office to complete the next payment and collect your travel details." },
      { name: "Partner follow-up", audience: "PARTNER", body: "Dear {contact}, following up on our recent discussion. Please share any new job orders and the status of candidates submitted last week. Regards, {staff}, {company}." },
      { name: "Partner statement", audience: "PARTNER", body: "Dear {contact}, our records show an outstanding balance of {balance}. Kindly arrange payment or share remittance details. Regards, {company}." },
    ],
  });

}
