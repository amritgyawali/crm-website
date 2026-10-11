// Edge-safe session helpers (used by middleware and server code).
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "crm_session";
const MAX_AGE = 60 * 60 * 12; // one working day

function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) throw new Error("SESSION_SECRET is missing or too short");
  return new TextEncoder().encode(secret);
}

export type SessionPayload = { uid: string; role: string; name: string };

export async function signSession(p: SessionPayload) {
  return new SignJWT(p)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(key());
}

export async function readSession(token?: string): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

/**
 * Cookie settings. `secure` follows the actual connection: on https (or behind a proxy that
 * says so) the cookie is https-only; on a plain http office network it still works.
 */
export function sessionCookieOptions(isHttps: boolean) {
  return { httpOnly: true, sameSite: "lax" as const, secure: isHttps, path: "/", maxAge: MAX_AGE };
}
