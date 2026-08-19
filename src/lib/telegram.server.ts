const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";

export type TelegramButton = { text: string; callback_data: string };

export async function sendTelegram(
  text: string,
  buttons?: TelegramButton[][],
): Promise<{ sent: boolean; error?: string }> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const telegramKey = process.env["TELEGRAM_API_KEY"];
  const chatId = process.env["TELEGRAM_ADMIN_CHAT_ID"];
  if (!lovableKey || !telegramKey || !chatId) {
    return { sent: false, error: "Telegram не подключён" };
  }

  const res = await fetch(`${GATEWAY_URL}/sendMessage`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": telegramKey,
      "Content-Type": "application/json",
    },
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
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const telegramKey = process.env["TELEGRAM_API_KEY"];
  if (!lovableKey || !telegramKey) return;
  await fetch(`${GATEWAY_URL}/answerCallbackQuery`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": telegramKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ callback_query_id: callbackId, text }),
  });
}
