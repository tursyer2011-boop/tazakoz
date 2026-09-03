// Кэш статуса подтверждения почты, чтобы не ждать серверный вызов при каждом переходе.
const KEY = "tk_email_verified";

let memo: string | null = null;

export function getVerifiedCache(userId: string): boolean {
  if (memo === userId) return true;
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(KEY) === userId;
  } catch {
    return false;
  }
}

export function setVerifiedCache(userId: string) {
  memo = userId;
  try {
    window.sessionStorage.setItem(KEY, userId);
  } catch {
    /* ignore */
  }
}

export function clearVerifiedCache() {
  memo = null;
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function hasAnyVerifiedCache(): boolean {
  if (memo) return true;
  if (typeof window === "undefined") return false;
  try {
    return Boolean(window.sessionStorage.getItem(KEY));
  } catch {
    return false;
  }
}
