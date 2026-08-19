export type TelegramButton = { text: string; callback_data: string };

function apiUrl(method: string): string | null {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) return null;
  return `https://api.telegram.org/bot${token}/${method}`;
}

export async function sendTelegram(
  text: string,
  buttons?: TelegramButton[][],
  chatIdOverride?: string | number,
): Promise<{ sent: boolean; error?: string }> {
  const url = apiUrl("sendMessage");
  const chatId = chatIdOverride ?? process.env["TELEGRAM_ADMIN_CHAT_ID"];
  if (!url || !chatId) {
    return { sent: false, error: "Telegram не подключён" };
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      ...(buttons ? { reply_markup: { inline_keyboard: buttons } } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`[telegram] ${res.status}: ${body}`);
    return { sent: false, error: `Telegram ${res.status}` };
  }
  const payload = (await res.json()) as { ok?: boolean; error?: string };
  if (payload.ok === false) return { sent: false, error: payload.error ?? "telegram error" };
  return { sent: true };
}

export async function answerCallback(callbackId: string, text: string) {
  const url = apiUrl("answerCallbackQuery");
  if (!url) return;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackId, text }),
  });
}
