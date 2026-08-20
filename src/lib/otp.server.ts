import { createHash, randomInt } from "crypto";

export function randomOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashOtp(code: string, salt: string): string {
  return createHash("sha256").update(`taza-otp:${salt}:${code}`).digest("hex");
}
