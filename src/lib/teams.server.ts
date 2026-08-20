import type { SupabaseClient } from "@supabase/supabase-js";

type Admin = SupabaseClient<any, any, any>;

export const TEAM_SIZE = 4;
export const CAPTAIN_MAX_PER_REPORT = 15;
export const TEAM_DAILY_LIMIT = 1000;
export const ADMIN_MAX_TOPUPS_PER_DAY = 1;

export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const la1 = (aLat * Math.PI) / 180;
  const la2 = (bLat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export async function nearestDepot(admin: Admin, lat: number, lng: number) {
  const d = 1.2;
  const { data } = await admin
    .from("depots")
    .select("id, code, name, region, region_code, city, lat, lng")
    .gte("lat", lat - d)
    .lte("lat", lat + d)
    .gte("lng", lng - d * 1.6)
    .lte("lng", lng + d * 1.6)
    .eq("active", true)
    .limit(2000);
  let list = data ?? [];
  if (!list.length) {
    const { data: all } = await admin
      .from("depots")
      .select("id, code, name, region, region_code, city, lat, lng")
      .eq("active", true)
      .limit(3000);
    list = all ?? [];
  }
  let best: (typeof list)[number] | null = null;
  let bestKm = Number.POSITIVE_INFINITY;
  for (const depot of list) {
    const km = haversineKm(lat, lng, depot.lat, depot.lng);
    if (km < bestKm) {
      bestKm = km;
      best = depot;
    }
  }
  return best ? { depot: best, distanceKm: bestKm } : null;
}

function teamCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/** Puts a freshly approved worker into a team: fills incomplete teams first, else opens a new one (that worker becomes captain). */
export async function assignWorkerToTeam(admin: Admin, userId: string, lat: number | null, lng: number | null) {
  const { data: existing } = await admin
    .from("team_members")
    .select("team_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (existing) return existing.team_id as string;

  const point = lat != null && lng != null ? await nearestDepot(admin, lat, lng) : null;
  const depot = point?.depot ?? null;
  if (!depot) throw new Error("Не удалось определить пункт назначения");

  const { data: teams } = await admin
    .from("teams")
    .select("id, team_code, depot_id")
    .eq("depot_id", depot.id);

  for (const team of teams ?? []) {
    const { count } = await admin
      .from("team_members")
      .select("id", { count: "exact", head: true })
      .eq("team_id", team.id);
    if ((count ?? 0) < TEAM_SIZE) {
      await admin.from("team_members").insert({ team_id: team.id, user_id: userId });
      return team.id as string;
    }
  }

  let code = teamCode();
  for (let i = 0; i < 5; i++) {
    const { data: clash } = await admin.from("teams").select("id").eq("team_code", code).maybeSingle();
    if (!clash) break;
    code = teamCode();
  }

  const { data: team, error } = await admin
    .from("teams")
    .insert({
      team_code: code,
      depot_id: depot.id,
      region_code: depot.region_code,
      captain_id: userId,
      credits_balance: TEAM_DAILY_LIMIT,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  await admin.from("team_members").insert({ team_id: team.id, user_id: userId, is_captain: true });
  await admin.from("user_roles").upsert({ user_id: userId, role: "captain" }, { onConflict: "user_id,role" });
  await admin.from("team_positions").upsert({ team_id: team.id, lat: depot.lat, lng: depot.lng, status: "idle" });
  return team.id as string;
}

/** Restores the daily 1000-credit allowance once per UTC day. */
export async function ensureDailyRefill(admin: Admin, team: { id: string; refill_date: string; daily_limit: number }) {
  const today = new Date().toISOString().slice(0, 10);
  if (team.refill_date === today) return;
  await admin
    .from("teams")
    .update({ credits_balance: team.daily_limit, refill_date: today, admin_topups_today: 0 })
    .eq("id", team.id);
}
