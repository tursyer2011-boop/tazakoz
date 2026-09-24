import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { hasRole } from "@/lib/roles";

function distM(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

const AreaInput = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radiusM: z.number().int().min(100).max(5000).default(1200),
});

/** Одобренные жалобы в выбранном микрорайоне: фото и @никнейм автора. */
export const getAreaReports = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AreaInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const dLat = data.radiusM / 111000;
    const dLng = data.radiusM / (111000 * Math.cos((data.lat * Math.PI) / 180));
    const { data: rows } = await supabaseAdmin
      .from("reports")
      .select("id, user_id, photo_url, comment, address, severity, status, lat, lng, created_at")
      .eq("approved", true)
      .gte("lat", data.lat - dLat)
      .lte("lat", data.lat + dLat)
      .gte("lng", data.lng - dLng)
      .lte("lng", data.lng + dLng)
      .order("created_at", { ascending: false })
      .limit(60);
    const list = (rows ?? [])
      .filter((r) => distM(data.lat, data.lng, r.lat, r.lng) <= data.radiusM)
      .slice(0, 30);
    const ids = Array.from(new Set(list.map((r) => r.user_id)));
    const { data: profs } = ids.length
      ? await supabaseAdmin.from("profiles").select("id, username").in("id", ids)
      : { data: [] as { id: string; username: string | null }[] };
    const names = new Map((profs ?? []).map((p) => [p.id, p.username]));
    return await Promise.all(
      list.map(async (r) => {
        const { data: s } = await supabaseAdmin.storage.from("reports").createSignedUrl(r.photo_url, 3600);
        return {
          id: r.id,
          photoUrl: s?.signedUrl ?? null,
          comment: r.comment,
          address: r.address,
          severity: r.severity,
          status: r.status,
          created_at: r.created_at,
          username: names.get(r.user_id) ?? null,
        };
      }),
    );
  });

/** Текущие позиции бригад (без личных данных). */
export const getLiveTeams = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: pos }, { data: teams }] = await Promise.all([
      supabaseAdmin.from("team_positions").select("team_id, lat, lng, status, updated_at"),
      supabaseAdmin.from("teams").select("id, team_code").eq("region_code", "09"),
    ]);
    const codes = new Map((teams ?? []).map((t) => [t.id, t.team_code]));
    return (pos ?? [])
      .filter((p) => codes.has(p.team_id))
      .map((p) => ({ team_id: p.team_id, lat: p.lat, lng: p.lng, status: p.status, code: codes.get(p.team_id)! }));
  });

/** Фото уборок пункта — только для волонтёров, капитанов и персонала. */
export const getDepotCleanups = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ depotId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const checks = await Promise.all(
      ["worker", "captain", "admin", "moderator"].map((r) => hasRole(context.supabase, context.userId, r)),
    );
    if (!checks.some(Boolean)) throw new Error("Доступно только волонтёрам");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("reports")
      .select("id, photo_url, cleaned_photo_url, address, cleaned_at, team_id")
      .eq("depot_id", data.depotId)
      .not("cleaned_photo_url", "is", null)
      .order("cleaned_at", { ascending: false })
      .limit(30);
    const teamIds = Array.from(new Set((rows ?? []).map((r) => r.team_id).filter(Boolean))) as string[];
    const { data: teams } = teamIds.length
      ? await supabaseAdmin.from("teams").select("id, team_code").in("id", teamIds)
      : { data: [] as { id: string; team_code: string }[] };
    const codes = new Map((teams ?? []).map((t) => [t.id, t.team_code]));
    const sign = async (p: string | null) => {
      if (!p) return null;
      const { data: s } = await supabaseAdmin.storage.from("reports").createSignedUrl(p, 3600);
      return s?.signedUrl ?? null;
    };
    return await Promise.all(
      (rows ?? []).map(async (r) => ({
        id: r.id,
        before: await sign(r.photo_url),
        after: await sign(r.cleaned_photo_url),
        address: r.address,
        cleaned_at: r.cleaned_at,
        teamCode: r.team_id ? (codes.get(r.team_id) ?? null) : null,
      })),
    );
  });
