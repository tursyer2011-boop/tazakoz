import { createFileRoute } from "@tanstack/react-router";
import { createHash, timingSafeEqual } from "crypto";
import { answerCallback, sendTelegram } from "@/lib/telegram.server";

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export const Route = createFileRoute("/api/public/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const botToken = process.env["TELEGRAM_BOT_TOKEN"];
        if (!botToken) return new Response("Not configured", { status: 503 });
        const adminPassword = process.env["TELEGRAM_BOT_ACCESS_PASSWORD"] ?? "";

        const expected = createHash("sha256")
          .update(`telegram-webhook:${botToken}`)
          .digest("base64url");
        const provided = request.headers.get("X-Telegram-Bot-Api-Secret-Token") ?? "";
        if (!safeEqual(provided, expected)) return new Response("Unauthorized", { status: 401 });

        const update = (await request.json()) as {
          callback_query?: { id: string; data?: string };
          message?: { text?: string; chat?: { id: number; title?: string; username?: string } };
        };

        const message = update.message;
        if (message?.chat?.id && message.text) {
          const chatId = message.chat.id;
          const text = message.text.trim();

          if (text.startsWith("/start")) {
            await sendTelegram(
              `👁 <b>TAZA KÖZ</b>\n\nЧтобы получать заявки работников, отправьте код доступа сообщением.`,
              undefined,
              chatId,
            );
            return Response.json({ ok: true });
          }

          if (adminPassword && text.replace(/^\/code\s+/i, "") === adminPassword) {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            await supabaseAdmin
              .from("telegram_admin_chats")
              .upsert(
                { chat_id: chatId, title: message.chat.title ?? message.chat.username ?? null },
                { onConflict: "chat_id" },
              );
            await sendTelegram(
              `✅ Доступ подтверждён. Этот чат будет получать заявки работников TAZA KÖZ.\nChat ID: <code>${chatId}</code>`,
              undefined,
              chatId,
            );
            return Response.json({ ok: true });
          }

          await sendTelegram(`❌ Неверный код доступа.`, undefined, chatId);
          return Response.json({ ok: true });
        }

        const callback = update.callback_query;
        if (!callback?.data) return Response.json({ ok: true });

        const [scope, action, id] = callback.data.split(":");
        if (scope === "payout" && id) {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const status = action === "paid" ? "paid" : "rejected";
          const { data: payout } = await supabaseAdmin
            .from("payout_requests")
            .select("*")
            .eq("id", id)
            .maybeSingle();
          if (!payout || payout.status !== "pending") {
            await answerCallback(callback.id, "Заявка уже обработана");
            return Response.json({ ok: true });
          }
          await supabaseAdmin
            .from("payout_requests")
            .update({ status, decided_at: new Date().toISOString() })
            .eq("id", id);
          if (status === "rejected") {
            const { data: profile } = await supabaseAdmin
              .from("profiles")
              .select("credits")
              .eq("id", payout.user_id)
              .maybeSingle();
            if (profile) {
              await supabaseAdmin
                .from("profiles")
                .update({ credits: profile.credits + payout.credits })
                .eq("id", payout.user_id);
            }
            await supabaseAdmin.from("credit_transactions").insert({
              user_id: payout.user_id,
              amount: payout.credits,
              kind: "payout_refund",
              note: "Возврат кредитов: выплата отклонена",
            });
          }
          await answerCallback(callback.id, status === "paid" ? "Отмечено как выплачено" : "Отклонено, кредиты возвращены");
          return Response.json({ ok: true });
        }
        if (scope !== "wapp" || !id) return Response.json({ ok: true });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const status = action === "approve" ? "approved" : "rejected";

        const { data: application, error } = await supabaseAdmin
          .from("worker_applications")
          .update({ status, reviewed_at: new Date().toISOString(), review_note: "Решение через Telegram" })
          .eq("id", id)
          .select()
          .maybeSingle();

        if (error || !application) {
          await answerCallback(callback.id, "Заявка не найдена");
          return Response.json({ ok: true });
        }

        if (status === "approved") {
          await supabaseAdmin
            .from("user_roles")
            .upsert({ user_id: application.user_id, role: "worker" }, { onConflict: "user_id,role" });
        }

        await answerCallback(callback.id, status === "approved" ? "Заявка одобрена" : "Заявка отклонена");
        return Response.json({ ok: true });
      },
    },
  },
});
