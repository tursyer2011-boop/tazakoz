export type TelegramButton = { text: string; callback_data: string };

function apiUrl(method: string): string | null {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) return null;
  return `https://api.telegram.org/bot${token}/${method}`;
}

async function adminChatIds(): Promise<Array<string | number>> {
  const envChat = process.env["TELEGRAM_ADMIN_CHAT_ID"];
  const ids: Array<string | number> = envChat ? [envChat] : [];
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("telegram_admin_chats").select("chat_id");
    for (const row of data ?? []) {
      if (!ids.some((id) => String(id) === String(row.chat_id))) ids.push(row.chat_id);
    }
  } catch (error) {
    console.error("[telegram] admin chats lookup failed", error);
  }
  return ids;
}

async function post(method: string, body: Record<string, unknown>) {
  const url = apiUrl(method);
  if (!url) return { ok: false, error: "Telegram не подключён" };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`[telegram] ${method} ${res.status}: ${text}`);
    return { ok: false, error: `Telegram ${res.status}` };
  }
  const payload = (await res.json()) as { ok?: boolean; description?: string };
  if (payload.ok === false) return { ok: false, error: payload.description ?? "telegram error" };
  return { ok: true };
}

export async function sendTelegram(
  text: string,
  buttons?: TelegramButton[][],
  chatIdOverride?: string | number,
): Promise<{ sent: boolean; error?: string }> {
  const targets = chatIdOverride != null ? [chatIdOverride] : await adminChatIds();
  if (targets.length === 0) {
    return { sent: false, error: "Нет подключённых Telegram-чатов админов" };
  }

  let sent = false;
  let lastError: string | undefined;
  for (const chatId of targets) {
    const result = await post("sendMessage", {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      ...(buttons ? { reply_markup: { inline_keyboard: buttons } } : {}),
    });
    if (result.ok) sent = true;
    else lastError = result.error;
  }
  return sent ? { sent: true } : { sent: false, error: lastError };
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
