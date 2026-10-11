import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { parseMrz, type PassportData } from "./mrz";

// Optional: reading a passport photo needs an Anthropic API key in ANTHROPIC_API_KEY.
export const passportAiEnabled = () => !!process.env.ANTHROPIC_API_KEY;

const Extracted = z.object({
  mrz_line_1: z.string().describe("First machine-readable line, exactly as printed, 44 characters, '<' for fillers. Empty string if not visible."),
  mrz_line_2: z.string().describe("Second machine-readable line, exactly as printed. Empty string if not visible."),
  surname: z.string(),
  given_names: z.string(),
  passport_number: z.string(),
  nationality: z.string().describe("Country name in English"),
  date_of_birth: z.string().describe("YYYY-MM-DD, or empty if unreadable"),
  date_of_expiry: z.string().describe("YYYY-MM-DD, or empty if unreadable"),
  sex: z.enum(["M", "F", "X", ""]),
  is_passport: z.boolean().describe("False if the image is not a passport photo page"),
});

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

/**
 * Reads a passport photo page. The machine-readable lines are copied out and checked with their
 * check digits; when they pass, those values win over what was read from the printed text.
 */
export async function readPassportPhoto(bytes: Buffer, mediaType: string): Promise<{ data: PassportData; warnings: string[]; source: "mrz" | "printed" }> {
  if (!ALLOWED.includes(mediaType as (typeof ALLOWED)[number])) throw new Error("Use a JPG or PNG photo of the passport page.");
  const client = new Anthropic();
  let response;
  try {
    response = await client.beta.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: betaZodOutputFormat(Extracted) },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType as (typeof ALLOWED)[number], data: bytes.toString("base64") } },
            {
              type: "text",
              text: "This is a photo of a passport data page uploaded by a recruitment agency to fill in a candidate's record. Copy the two machine-readable lines character for character, and read the printed fields. Leave a field empty rather than guessing.",
            },
          ],
        },
      ],
    });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new Error("The Anthropic API key is not valid. Check ANTHROPIC_API_KEY.");
    if (e instanceof Anthropic.RateLimitError) throw new Error("Passport reading is busy. Try again in a minute.");
    if (e instanceof Anthropic.APIError) throw new Error(`Passport reading failed (${e.status ?? "network"}). Type the details instead.`);
    throw e;
  }
  if (response.stop_reason === "refusal") throw new Error("The photo could not be read. Type the details instead.");
  const x = response.parsed_output;
  if (!x) throw new Error("The photo could not be read clearly. Try a sharper photo in good light.");
  if (!x.is_passport) throw new Error("That doesn't look like a passport data page.");

  const mrz = x.mrz_line_1 && x.mrz_line_2 ? parseMrz(`${x.mrz_line_1}\n${x.mrz_line_2}`) : null;
  if (mrz?.ok && mrz.warnings.length === 0) return { data: mrz.data, warnings: [], source: "mrz" };

  const title = (s: string) => s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()).trim();
  const data: PassportData = {
    surname: title(x.surname), givenNames: title(x.given_names),
    fullName: [title(x.given_names), title(x.surname)].filter(Boolean).join(" "),
    passportNo: x.passport_number.replace(/\s/g, "").toUpperCase(), nationalityCode: "", nationality: x.nationality, issuingCountry: "",
    dateOfBirth: /^\d{4}-\d{2}-\d{2}$/.test(x.date_of_birth) ? x.date_of_birth : null,
    expiry: /^\d{4}-\d{2}-\d{2}$/.test(x.date_of_expiry) ? x.date_of_expiry : null,
    gender: x.sex === "M" ? "Male" : x.sex === "F" ? "Female" : null,
  };
  return { data, warnings: ["Read from the printed text only (the machine-readable lines didn't check out). Compare with the passport before saving."], source: "printed" };
}
