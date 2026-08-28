/** Общие правила для уникальных @никнеймов (TikTok-стиль). */
export const USERNAME_PATTERN = /^[a-z0-9_.]{3,24}$/;

export function sanitizeUsername(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_.]/g, "")
    .slice(0, 24);
}

export function isValidUsername(value: string) {
  return USERNAME_PATTERN.test(value);
}

/** Автоматический никнейм на случай, если пользователь не выбрал свой. */
export function fallbackUsername() {
  return `user_${Math.floor(10000 + Math.random() * 90000)}`;
}

/** Публичный ID работника вида WRK-84920 — стабильно выводится из его user id. */
export function workerCode(userId: string) {
  const hex = userId.replace(/[^0-9a-f]/gi, "").slice(0, 8);
  const num = parseInt(hex || "0", 16) % 100000;
  return `WRK-${String(num).padStart(5, "0")}`;
}
