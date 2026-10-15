/** Set on the auth callback only when the server decides this is the first sign-in. */
export const REGISTRATION_COOKIE = "pj_meta_reg";

export function registrationCookieOptions(): {
  path: string;
  maxAge: number;
  sameSite: "lax";
  secure: boolean;
  httpOnly: false;
} {
  return {
    path: "/",
    maxAge: 60 * 30,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    httpOnly: false,
  };
}

/** Opaque marker. Not an email, name, or user id. */
export function newRegistrationToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function isRegistrationToken(value: string): boolean {
  return /^[a-f0-9]{32}$/.test(value);
}
