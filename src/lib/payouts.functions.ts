import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sendTelegram } from "@/lib/telegram.server";
import { KZT_PER_CREDIT, MIN_PAYOUT_CREDITS, MIN_DONATION_CREDITS } from "@/lib/credits";

const PayoutInput = z.object({
  credits: z.number().int().min(MIN_PAYOUT_CREDITS).max(100000),
  fullName: z.string().trim().min(3).max(120),
  phone: z.string().trim().min(10).max(20),
});

const DonationInput = z.object({
  credits: z.number().int().min(MIN_DONATION_CREDITS).max(100000),
});

/** Resident requests a Kaspi cashout: credits are held and admins decide in Telegram. */
export const requestPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => PayoutInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: pending } = await supabaseAdmin
      .from("payout_requests")
      .select("id")
      .eq("user_id", context.userId)
      .eq("status", "pending")
      .maybeSingle();
    if (pending) throw new Error("Заявка на вывод уже отправлена и ждёт решения");

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("credits")
      .eq("id", context.userId)
      .maybeSingle();
    if (!profile || profile.credits < data.credits) throw new Error("Недостаточно кредитов");

    const amount = data.credits * KZT_PER_CREDIT;
    const { data: request, error } = await supabaseAdmin
      .from("payout_requests")
      .insert({
        user_id: context.userId,
        credits: data.credits,
        amount_kzt: amount,
        full_name: data.fullName,
        phone: data.phone,
      })
      .select()
      .single();
    if (error || !request) throw new Error("Не удалось создать заявку");

    await supabaseAdmin
      .from("profiles")
      .update({ credits: profile.credits - data.credits })
      .eq("id", context.userId);

    await supabaseAdmin.from("credit_transactions").insert({
      user_id: context.userId,
      amount: -data.credits,
      kind: "payout_hold",
      note: `Заявка на вывод Kaspi · ${amount} ₸`,
    });

    await sendTelegram(
      `💸 <b>Заявка на выплату Kaspi</b>\n\n👤 ${data.fullName.replace(/[<>&]/g, "")}\n📱 <code>${data.phone.replace(/[<>&]/g, "")}</code>\n🪙 ${data.credits} кредитов\n💰 <b>${amount} ₸</b>`,
      [
        [
          { text: "✅ Выплачено", callback_data: `payout:paid:${request.id}` },
          { text: "❌ Отклонить", callback_data: `payout:reject:${request.id}` },
        ],
      ],
    );

    return { ok: true, amount };
  });

