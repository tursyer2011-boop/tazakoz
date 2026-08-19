import { createFileRoute } from "@tanstack/react-router";
import { createHash, timingSafeEqual } from "crypto";
import { answerCallback } from "@/lib/telegram.server";

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export const Route = createFileRoute("/api/public/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const telegramKey = process.env["TELEGRAM_API_KEY"];
        if (!telegramKey) return new Response("Not configured", { status: 503 });

        const expected = createHash("sha256")
          .update(`telegram-webhook:${telegramKey}`)
          .digest("base64url");
        const provided = request.headers.get("X-Telegram-Bot-Api-Secret-Token") ?? "";
        if (!safeEqual(provided, expected)) return new Response("Unauthorized", { status: 401 });

        const update = (await request.json()) as {
          callback_query?: { id: string; data?: string };
        };
        const callback = update.callback_query;
        if (!callback?.data) return Response.json({ ok: true });

        const [scope, action, id] = callback.data.split(":");
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
