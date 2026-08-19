import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { analyzePollution, reverseGeocode } from "@/lib/ai.server";
import { REPORT_CREDITS, WORKER_REWARD } from "@/lib/credits";
import { sendTelegram } from "@/lib/telegram.server";

const SubmitInput = z.object({
  imageBase64: z.string().min(100),
  photoPath: z.string().min(1),
  comment: z.string().max(600).default(""),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  region: z.string().max(80).default(""),
});

export const submitReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => SubmitInput.parse(data))
  .handler(async ({ data, context }) => {
    const [verdict, place] = await Promise.all([
      analyzePollution(data.imageBase64, data.comment),
      reverseGeocode(data.lat, data.lng),
    ]);

    const approved = verdict.is_real_photo && verdict.has_pollution;
    const severity = verdict.severity;
    const credits = approved ? (REPORT_CREDITS[severity] ?? 10) : 0;
    const reason =
      verdict.reason || (approved ? "Загрязнение подтверждено." : "Загрязнение на фото не подтверждено.");

    const { data: report, error } = await context.supabase
      .from("reports")
      .insert({
        user_id: context.userId,
        photo_url: data.photoPath,
        comment: data.comment,
        lat: data.lat,
        lng: data.lng,
        region: data.region,
        address: place.address,
        water_body: place.water,
        severity,
        status: "new",
        approved,
        ai_reason: reason,
        credits_awarded: credits,
        worker_reward: approved ? (WORKER_REWARD[severity] ?? 20) : 0,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    if (approved) {
      const { data: profile } = await context.supabase
        .from("profiles")
        .select("credits, total_credits, approved_count")
        .eq("id", context.userId)
        .maybeSingle();
      if (profile) {
        await context.supabase
          .from("profiles")
          .update({
            credits: profile.credits + credits,
            total_credits: profile.total_credits + credits,
            approved_count: profile.approved_count + 1,
          })
          .eq("id", context.userId);
      }
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("credit_transactions").insert({
        user_id: context.userId,
        amount: credits,
        kind: "report_approved",
        note: `${severity} · ${place.address || data.region}`,
        report_id: report.id,
      });
      await sendTelegram(
        `🌊 <b>Новая подтверждённая жалоба</b>\nМасштаб: ${severity}\nМесто: ${place.address || data.region}\nКомментарий: ${data.comment || "—"}`,
      );
    } else {
      const { data: profile } = await context.supabase
        .from("profiles")
        .select("rejected_count")
        .eq("id", context.userId)
        .maybeSingle();
      if (profile) {
        await context.supabase
          .from("profiles")
          .update({ rejected_count: profile.rejected_count + 1 })
          .eq("id", context.userId);
      }
    }

    return {
      approved,
      severity,
      reason,
      credits,
      reportId: report.id,
      address: place.address,
      water: place.water,
    };
  });
