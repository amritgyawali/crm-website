// Reads the two machine-readable lines at the bottom of a passport photo page (ICAO 9303, TD3).
// Check digits are verified, so a misread character is caught instead of saved.

export type PassportData = {
  surname: string;
  givenNames: string;
  fullName: string;
  passportNo: string;
  nationalityCode: string;
  nationality: string;
  issuingCountry: string;
  dateOfBirth: string | null; // yyyy-mm-dd
  expiry: string | null; // yyyy-mm-dd
  gender: "Male" | "Female" | null;
};

export type MrzResult = { ok: true; data: PassportData; warnings: string[] } | { ok: false; error: string };

// Common origin countries; anything else shows the 3-letter code.
const COUNTRY: Record<string, string> = {
  NPL: "Nepal", IND: "India", PAK: "Pakistan", BGD: "Bangladesh", LKA: "Sri Lanka", PHL: "Philippines", UGA: "Uganda", KEN: "Kenya",
  NGA: "Nigeria", GHA: "Ghana", ETH: "Ethiopia", MMR: "Myanmar", IDN: "Indonesia", VNM: "Vietnam", EGY: "Egypt", MAR: "Morocco",
  TUN: "Tunisia", CMR: "Cameroon", ZWE: "Zimbabwe", TZA: "Tanzania", RWA: "Rwanda", SDN: "Sudan", AFG: "Afghanistan", UZB: "Uzbekistan",
  KGZ: "Kyrgyzstan", TJK: "Tajikistan", ARE: "United Arab Emirates", SAU: "Saudi Arabia", JOR: "Jordan", LBN: "Lebanon", SYR: "Syria",
};
export const countryName = (code: string) => COUNTRY[code] ?? code;

function charValue(c: string) {
  if (c >= "0" && c <= "9") return c.charCodeAt(0) - 48;
  if (c >= "A" && c <= "Z") return c.charCodeAt(0) - 55;
  return 0; // '<'
}
export function checkDigit(s: string) {
  const w = [7, 3, 1];
  let sum = 0;
  for (let i = 0; i < s.length; i++) sum += charValue(s[i]!) * w[i % 3]!;
  return String(sum % 10);
}

function date(yymmdd: string, kind: "birth" | "expiry"): string | null {
  if (!/^\d{6}$/.test(yymmdd)) return null;
  const yy = Number(yymmdd.slice(0, 2)), mm = yymmdd.slice(2, 4), dd = yymmdd.slice(4, 6);
  const nowYY = new Date().getFullYear() % 100;
  // births are in the past; expiries within the next ~20 years
  const century = kind === "birth" ? (yy > nowYY ? 1900 : 2000) : yy < 70 ? 2000 : 1900;
  const iso = `${century + yy}-${mm}-${dd}`;
  // reject impossible days (e.g. 30 Feb), which Date would quietly roll into March
  const dt = new Date(`${iso}T00:00:00Z`);
  return dt.getUTCMonth() + 1 === Number(mm) && dt.getUTCDate() === Number(dd) ? iso : null;
}

const title = (s: string) => s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());

/** Accepts the two lines as typed, scanned or pasted (spaces and lowercase are tolerated). */
export function parseMrz(input: string): MrzResult {
  const lines = input
    .toUpperCase()
    .replace(/[«‹]/g, "<")
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ""))
    .filter((l) => l.length >= 30);
  if (lines.length < 2) return { ok: false, error: "Paste both lines from the bottom of the passport photo page." };
  let [l1, l2] = lines.slice(-2) as [string, string];
  l1 = l1.padEnd(44, "<").slice(0, 44);
  l2 = l2.padEnd(44, "<").slice(0, 44);
  if (l1[0] !== "P") return { ok: false, error: "The first line should start with P (passport)." };

  const issuingCountry = l1.slice(2, 5).replace(/</g, "");
  const [surRaw, givenRaw = ""] = l1.slice(5).split("<<");
  const surname = title(surRaw!.replace(/</g, " ").trim());
  const givenNames = title(givenRaw.replace(/</g, " ").trim());

  const numRaw = l2.slice(0, 9);
  const nat = l2.slice(10, 13).replace(/</g, "");
  const dob = l2.slice(13, 19);
  const sex = l2[20];
  const exp = l2.slice(21, 27);

  const warnings: string[] = [];
  if (checkDigit(numRaw) !== l2[9]) warnings.push("Passport number check digit does not match. Re-check the number.");
  if (checkDigit(dob) !== l2[19]) warnings.push("Date of birth check digit does not match.");
  if (checkDigit(exp) !== l2[27]) warnings.push("Expiry date check digit does not match.");
  const composite = l2.slice(0, 10) + l2.slice(13, 20) + l2.slice(21, 43);
  if (l2[43] !== "<" && checkDigit(composite) !== l2[43]) warnings.push("Overall check digit does not match. A character may be misread.");
  if (warnings.length >= 3) return { ok: false, error: "These lines don't read as a valid passport. Check for typing or scanning mistakes (0/O, 1/I, 8/B)." };

  return {
    ok: true,
    warnings,
    data: {
      surname, givenNames, fullName: [givenNames, surname].filter(Boolean).join(" "),
      passportNo: numRaw.replace(/</g, ""), nationalityCode: nat, nationality: countryName(nat), issuingCountry,
      dateOfBirth: date(dob, "birth"), expiry: date(exp, "expiry"),
      gender: sex === "M" ? "Male" : sex === "F" ? "Female" : null,
    },
  };
}
