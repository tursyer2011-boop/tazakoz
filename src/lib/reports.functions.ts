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

async function sha256(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function metersBetween(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const submitReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => SubmitInput.parse(data))
  .handler(async ({ data, context }) => {
    const photoHash = await sha256(data.imageBase64);
    const { supabaseAdmin: dupAdmin } = await import("@/integrations/supabase/client.server");

    // 1) Точно такое же фото уже отправляли — повтор не оплачивается.
    const { data: samePhoto } = await dupAdmin
      .from("reports")
      .select("id")
      .eq("photo_hash", photoHash)
      .limit(1)
      .maybeSingle();
    if (samePhoto) {
      throw new Error("Это фото уже отправляли. Сделайте новое фото загрязнения.");
    }

    // 2) Та же точка от того же пользователя за последние 24 часа.
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recent } = await dupAdmin
      .from("reports")
      .select("lat, lng")
      .eq("user_id", context.userId)
      .gte("created_at", since);
    if ((recent ?? []).some((r) => metersBetween(data.lat, data.lng, r.lat, r.lng) < 100)) {
      throw new Error("Вы уже отправляли жалобу с этого места за последние 24 часа.");
    }

    const [verdict, place] = await Promise.all([
      analyzePollution(data.imageBase64, data.comment),
      reverseGeocode(data.lat, data.lng),
    ]);

    const approved = verdict.is_real_photo && verdict.has_pollution;
    const severity = verdict.severity;
    const credits = approved ? (REPORT_CREDITS[severity] ?? 5) : 0;
    const reason =
      verdict.reason || (approved ? "Загрязнение подтверждено." : "Загрязнение на фото не подтверждено.");

    const { data: report, error } = await context.supabase
      .from("reports")
      .insert({
        user_id: context.userId,
        photo_url: data.photoPath,
        photo_hash: photoHash,
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

    // Route the call to the closest depot (and its team) so only the nearest crew sees it.
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { nearestDepot } = await import("@/lib/teams.server");
      const nearest = await nearestDepot(supabaseAdmin, data.lat, data.lng);
      if (nearest) {
        const { data: team } = await supabaseAdmin
          .from("teams")
          .select("id")
          .eq("depot_id", nearest.depot.id)
          .limit(1)
          .maybeSingle();
        await supabaseAdmin
          .from("reports")
          .update({
            depot_id: nearest.depot.id,
            team_id: team?.id ?? null,
            region_code: nearest.depot.region_code,
          })
          .eq("id", report.id);
      }
    } catch (routingError) {
      console.error("[reports] depot routing failed", routingError);
    }

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
