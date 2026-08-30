/**
 * Браузерные уведомления TAZA KÖZ.
 * Работают на нашем домене после разрешения пользователя и показываются,
 * даже если вкладка свёрнута или открыта другая вкладка.
 */

export type NotifyPermission = "unsupported" | "default" | "granted" | "denied";

export function notifyPermission(): NotifyPermission {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission as NotifyPermission;
}

export async function requestNotifyPermission(): Promise<NotifyPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  if (Notification.permission === "granted" || Notification.permission === "denied") {
    return Notification.permission as NotifyPermission;
  }
  const result = await Notification.requestPermission();
  return result as NotifyPermission;
}

export function pushNotify(title: string, options: { body?: string; tag?: string; url?: string } = {}) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    const n = new Notification(title, {
      body: options.body,
      tag: options.tag,
      icon: "/favicon.png",
      badge: "/favicon.png",
    });
    n.onclick = () => {
      window.focus();
      if (options.url) window.location.href = options.url;
      n.close();
    };
  } catch {
    /* некоторые браузеры блокируют конструктор — тихо игнорируем */
  }
}
