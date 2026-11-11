import { randomBytes } from "node:crypto";

/** Unguessable URL token (32 random bytes, base64url, 43 chars). Carries no personal data. */
export function newUrlToken(): string {
  return randomBytes(32).toString("base64url");
}

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function isUrlToken(value: string): boolean {
  return TOKEN_PATTERN.test(value);
}
