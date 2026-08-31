import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { hasRole } from "@/lib/roles";

const SendCreditsInput = z.object({
  reportId: z.string().uuid(),
  amount: z.number().int().min(1).max(15),
});
const GrantInput = z.object({
  teamId: z.string().uuid(),
  amount: z.number().int().min(1).max(1000),
  requestId: z.string().uuid().optional(),
});
const TeamLookupInput = z.object({ teamCode: z.string().trim().min(1).max(12) });

const todayIso = () => new Date().toISOString().slice(0, 10);

async function assertAdmin(context: { supabase: any; userId: string }) {
  const isAdmin = await hasRole(context.supabase, context.userId, "admin");
  if (!isAdmin) throw new Error("Недостаточно прав");
  const { data: profile } = await context.supabase
    .from("profiles")
    .select("admin_region, admin_region_code, admin_city")
    .eq("id", context.userId)
    .maybeSingle();
  if (!profile?.admin_region_code) throw new Error("Область администратора не назначена");
  return profile as { admin_region: string; admin_region_code: string; admin_city: string };
}

/** Everything an admin can see: only their own region. */
export const getAdminScope = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const scope = await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: depots }, { data: teams }, { data: positions }, { data: requests }] = await Promise.all([
      supabaseAdmin
        .from("depots")
        .select("id, code, name, city, lat, lng")
        .eq("region_code", scope.admin_region_code)
        .eq("active", true),
      supabaseAdmin
        .from("teams")
        .select("id, team_code, depot_id, credits_balance, daily_limit, admin_topups_today, captain_id")
        .eq("region_code", scope.admin_region_code),
      supabaseAdmin.from("team_positions").select("team_id, lat, lng, status, updated_at"),
      supabaseAdmin
        .from("credit_requests")
        .select("id, team_id, amount, status, created_at")
        .eq("status", "pending"),
    ]);

    const teamList = teams ?? [];
    const teamIds = new Set(teamList.map((t) => t.id));
    const { data: spentToday } = await supabaseAdmin
      .from("credit_transactions")
      .select("amount, note, kind, created_at, report_id, user_id, created_by")
      .gte("created_at", `${todayIso()}T00:00:00Z`)
      .eq("kind", "captain_award");

    const spentByTeam: Record<string, number> = {};
    for (const tx of spentToday ?? []) {
      const teamId = (tx.note.match(/team:([0-9a-f-]{36})/) ?? [])[1];
      if (teamId && teamIds.has(teamId)) spentByTeam[teamId] = (spentByTeam[teamId] ?? 0) + tx.amount;
    }

    const { data: reports } = await supabaseAdmin
      .from("reports")
      .select("id, lat, lng, severity, status, address, water_body, created_at, depot_id, team_id")
      .eq("region_code", scope.admin_region_code)
      .neq("status", "resolved")
      .order("created_at", { ascending: false })
      .limit(500);

    return {
      scope,
      depots: depots ?? [],
      teams: teamList.map((t) => ({ ...t, spentToday: spentByTeam[t.id] ?? 0 })),
      positions: (positions ?? []).filter((p) => teamIds.has(p.team_id)),
      requests: (requests ?? []).filter((r) => teamIds.has(r.team_id)),
      reports: reports ?? [],
    };
  });

/** Detailed daily activity of one team ID, restricted to the admin's region. */
export const getTeamActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => TeamLookupInput.parse(data))
  .handler(async ({ data, context }) => {
    const scope = await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: team } = await supabaseAdmin
      .from("teams")
      .select("id, team_code, depot_id, region_code, credits_balance, daily_limit, admin_topups_today, captain_id")
      .eq("team_code", data.teamCode.trim())
      .maybeSingle();
    if (!team) throw new Error("ID не найден");
    if (team.region_code !== scope.admin_region_code) throw new Error("Эта команда в другой области");

    const [{ data: depot }, { data: members }, { data: position }] = await Promise.all([
      supabaseAdmin.from("depots").select("id, code, name, city, lat, lng").eq("id", team.depot_id).maybeSingle(),
      supabaseAdmin.from("team_members").select("user_id, is_captain").eq("team_id", team.id),
      supabaseAdmin.from("team_positions").select("*").eq("team_id", team.id).maybeSingle(),
    ]);

    const memberIds = (members ?? []).map((m) => m.user_id);
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, phone, city")
      .in("id", memberIds.length ? memberIds : ["00000000-0000-0000-0000-000000000000"]);

    const since = `${todayIso()}T00:00:00Z`;
    const [{ data: tx }, { data: reports }] = await Promise.all([
      supabaseAdmin
        .from("credit_transactions")
        .select("id, amount, kind, note, created_at, report_id")
        .gte("created_at", since)
        .like("note", `%team:${team.id}%`),
      supabaseAdmin
        .from("reports")
        .select("id, address, water_body, severity, status, lat, lng, created_at, updated_at")
        .eq("team_id", team.id)
        .gte("updated_at", since),
    ]);

    const creditsGiven = (tx ?? []).reduce((s, t) => s + (t.amount > 0 ? t.amount : 0), 0);
    return {
      team,
      depot,
      position,
      members: (members ?? []).map((m) => ({
        ...m,
        profile: (profiles ?? []).find((p) => p.id === m.user_id) ?? null,
      })),
      creditsGiven,
      transactions: tx ?? [],
      reports: reports ?? [],
    };
  });

/** Admin tops a team up: max 1000 per grant, once a day per team. */
export const grantTeamCredits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => GrantInput.parse(data))
  .handler(async ({ data, context }) => {
    const scope = await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { ADMIN_MAX_TOPUPS_PER_DAY } = await import("@/lib/teams.server");

    const { data: team } = await supabaseAdmin.from("teams").select("*").eq("id", data.teamId).maybeSingle();
    if (!team) throw new Error("Команда не найдена");
    if (team.region_code !== scope.admin_region_code) throw new Error("Эта команда в другой области");
    if (team.refill_date === todayIso() && team.admin_topups_today >= ADMIN_MAX_TOPUPS_PER_DAY) {
      throw new Error("Этой команде уже выдана дневная докупка кредитов");
    }

    await supabaseAdmin
      .from("teams")
      .update({
        credits_balance: team.credits_balance + data.amount,
        admin_topups_today: (team.refill_date === todayIso() ? team.admin_topups_today : 0) + 1,
        refill_date: todayIso(),
      })
      .eq("id", team.id);

    if (data.requestId) {
      await supabaseAdmin
        .from("credit_requests")
        .update({ status: "approved", decided_by: context.userId, decided_at: new Date().toISOString() })
        .eq("id", data.requestId);
    }
    return { ok: true };
  });

/** Captain requests a new 1000-credit allowance from the admin. */
export const requestTeamCredits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: member } = await supabaseAdmin
      .from("team_members")
      .select("team_id, is_captain")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!member?.is_captain) throw new Error("Запрашивать кредиты может только капитан");

    const { data: pending } = await supabaseAdmin
      .from("credit_requests")
      .select("id")
      .eq("team_id", member.team_id)
      .eq("status", "pending")
      .maybeSingle();
    if (pending) throw new Error("Запрос уже отправлен и ждёт решения администратора");

    await supabaseAdmin.from("credit_requests").insert({
      team_id: member.team_id,
      requested_by: context.userId,
      amount: 1000,
    });
    return { ok: true };
  });

/** Captain rewards the resident who reported the pollution (max 15 credits). */
export const awardResidentCredits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => SendCreditsInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { ensureDailyRefill } = await import("@/lib/teams.server");

    const { data: member } = await supabaseAdmin
      .from("team_members")
      .select("team_id, is_captain")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!member?.is_captain) throw new Error("Отправлять кредиты может только капитан команды");

    const { data: team } = await supabaseAdmin.from("teams").select("*").eq("id", member.team_id).single();
    if (!team) throw new Error("Команда не найдена");
    await ensureDailyRefill(supabaseAdmin, team);
    const { data: fresh } = await supabaseAdmin.from("teams").select("*").eq("id", team.id).single();
    if (!fresh || fresh.credits_balance < data.amount) {
      throw new Error("Недостаточно кредитов. Запросите пополнение у администратора.");
    }

    const { data: report } = await supabaseAdmin
      .from("reports")
      .select("id, user_id, team_id")
      .eq("id", data.reportId)
      .maybeSingle();
    if (!report) throw new Error("Заявка не найдена");

    const { data: already } = await supabaseAdmin
      .from("credit_transactions")
      .select("id")
      .eq("report_id", report.id)
      .eq("kind", "captain_award")
      .maybeSingle();
    if (already) throw new Error("По этой заявке кредиты уже отправлены");

    await supabaseAdmin
      .from("teams")
      .update({ credits_balance: fresh.credits_balance - data.amount })
      .eq("id", fresh.id);

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("credits, total_credits")
      .eq("id", report.user_id)
      .maybeSingle();
    if (profile) {
      await supabaseAdmin
        .from("profiles")
        .update({
          credits: profile.credits + data.amount,
          total_credits: profile.total_credits + data.amount,
        })
        .eq("id", report.user_id);
    }

    await supabaseAdmin.from("credit_transactions").insert({
      user_id: report.user_id,
      amount: data.amount,
      kind: "captain_award",
      note: `Оценка капитана · team:${fresh.id}`,
      report_id: report.id,
      created_by: context.userId,
    });

    return { ok: true, balance: fresh.credits_balance - data.amount };
  });

/** Worker view: my team, my depot, my balance and the calls routed to my depot. */
export const getMyTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { ensureDailyRefill } = await import("@/lib/teams.server");

    const { data: member } = await supabaseAdmin
      .from("team_members")
      .select("team_id, is_captain")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!member) return null;

    const { data: team } = await supabaseAdmin.from("teams").select("*").eq("id", member.team_id).single();
    if (!team) throw new Error("Команда не найдена");
    await ensureDailyRefill(supabaseAdmin, team);
    const { data: fresh } = await supabaseAdmin.from("teams").select("*").eq("id", team.id).single();

    const [{ data: depot }, { data: members }, { data: calls }, { data: pending }] = await Promise.all([
      supabaseAdmin.from("depots").select("*").eq("id", team.depot_id).maybeSingle(),
      supabaseAdmin.from("team_members").select("user_id, is_captain").eq("team_id", team.id),
      supabaseAdmin
        .from("reports")
        .select("id, address, water_body, severity, status, lat, lng, comment, photo_url, created_at, user_id")
        .eq("depot_id", team.depot_id)
        .neq("status", "resolved")
        .order("created_at", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("credit_requests")
        .select("id, status")
        .eq("team_id", team.id)
        .eq("status", "pending")
        .maybeSingle(),
    ]);

    return {
      team: fresh,
      depot,
      isCaptain: member.is_captain,
      memberCount: (members ?? []).length,
      calls: calls ?? [],
      pendingRequest: Boolean(pending),
    };
  });

/**
 * Рабочий стол работника: его ID, пункт назначения, карта зоны и ближайшие вызовы.
 * Вызовы сортируются по расстоянию от рабочей точки (GPS жалобы vs GPS работника).
 */
export const getWorkerBoard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { haversineKm } = await import("@/lib/teams.server");

    const [{ data: member }, { data: profile }] = await Promise.all([
      supabaseAdmin.from("team_members").select("team_id, is_captain").eq("user_id", context.userId).maybeSingle(),
      supabaseAdmin.from("profiles").select("full_name, username, city, region, lat, lng").eq("id", context.userId).maybeSingle(),
    ]);

    let depot: any = null;
    let team: any = null;
    if (member) {
      const { data: t } = await supabaseAdmin.from("teams").select("*").eq("id", member.team_id).maybeSingle();
      team = t;
      if (t?.depot_id) {
        const { data: d } = await supabaseAdmin.from("depots").select("*").eq("id", t.depot_id).maybeSingle();
        depot = d;
      }
    }

    const originLat = depot?.lat ?? profile?.lat ?? null;
    const originLng = depot?.lng ?? profile?.lng ?? null;

    const { data: reports } = await supabaseAdmin
      .from("reports")
      .select("id, user_id, address, water_body, region, severity, status, lat, lng, comment, photo_url, worker_reward, assigned_worker_id, depot_id, created_at")
      .eq("approved", true)
      .neq("status", "resolved")
      .order("created_at", { ascending: false })
      .limit(300);

    const list = (reports ?? []).map((r) => ({
      ...r,
      distanceKm:
        originLat != null && originLng != null && r.lat != null && r.lng != null
          ? haversineKm(originLat, originLng, r.lat, r.lng)
          : null,
      mine: r.assigned_worker_id === context.userId,
      atMyDepot: depot ? r.depot_id === depot.id : false,
    }));

    // Ближайшие: свои задания, вызовы моего пункта и всё в радиусе 80 км.
    const calls = list
      .filter((r) => r.mine || r.atMyDepot || (r.distanceKm != null && r.distanceKm <= 80) || originLat == null)
      .sort((a, b) => {
        if (a.mine !== b.mine) return a.mine ? -1 : 1;
        return (a.distanceKm ?? 9e9) - (b.distanceKm ?? 9e9);
      })
      .slice(0, 40);

    // Данные отправителя жалобы и приватный чат по каждому вызову.
    const reporterIds = Array.from(new Set(calls.map((c) => c.user_id).filter(Boolean)));
    const callIds = calls.map((c) => c.id);
    const [{ data: reporters }, { data: threads }] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, full_name, username, phone, city")
        .in("id", reporterIds.length ? reporterIds : ["00000000-0000-0000-0000-000000000000"]),
      supabaseAdmin
        .from("chat_threads")
        .select("id, report_id, worker_id")
        .in("report_id", callIds.length ? callIds : ["00000000-0000-0000-0000-000000000000"]),
    ]);

    const enriched = calls.map((c) => {
      const reporter = (reporters ?? []).find((p) => p.id === c.user_id) ?? null;
      const thread = (threads ?? []).find((t) => t.report_id === c.id) ?? null;
      return {
        ...c,
        reporter: reporter
          ? {
              id: reporter.id,
              name: reporter.full_name || "Житель",
              username: reporter.username,
              // Телефон виден только назначенному работнику.
              phone: c.mine ? reporter.phone : "",
            }
          : null,
        threadId: thread && thread.worker_id === context.userId ? thread.id : null,
      };
    });

    return {
      workerUserId: context.userId,
      profile,
      team,
      depot,
      isCaptain: Boolean(member?.is_captain),
      origin: originLat != null && originLng != null ? { lat: originLat, lng: originLng } : null,
      calls: enriched,
    };

  });
