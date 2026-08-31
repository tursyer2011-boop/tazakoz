import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { hasRole } from "@/lib/roles";

const SearchInput = z.object({ query: z.string().trim().min(1).max(80) });

const TransferInput = z.object({
  amount: z.number().int().min(1).max(500),
  targetUserId: z.string().uuid().optional(),
  handle: z.string().trim().max(80).optional(),
  reportId: z.string().uuid().optional(),
  note: z.string().max(200).default(""),
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function actorRoles(context: { supabase: any; userId: string }) {
  const [isAdmin, isCaptain] = await Promise.all([
    hasRole(context.supabase, context.userId, "admin"),
    hasRole(context.supabase, context.userId, "captain"),
  ]);
  if (!isAdmin && !isCaptain) throw new Error("Недостаточно прав");
  return { isAdmin: Boolean(isAdmin), isCaptain: Boolean(isCaptain) };
}

/** Поиск получателя по @никнейму, ID или ФИО (для админа и капитана). */
export const findUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => SearchInput.parse(data))
  .handler(async ({ data, context }) => {
    await actorRoles(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const q = data.query.replace(/^@/, "").trim();
    let query = supabaseAdmin
      .from("profiles")
      .select("id, username, full_name, city, region, credits, total_credits")
      .limit(20);

    if (UUID_RE.test(q)) query = query.eq("id", q);
    else query = query.or(`username.ilike.%${q}%,full_name.ilike.%${q}%`);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return { users: rows ?? [] };
  });

/**
 * Перевод Taza Credits конкретному пользователю.
 * Начисляется удвоенная сумма (amount * 2) — по требованию заказчика.
 */
export const transferCredits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => TransferInput.parse(data))
  .handler(async ({ data, context }) => {
    const { isAdmin, isCaptain } = await actorRoles(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { ensureDailyRefill } = await import("@/lib/teams.server");

    let targetId = data.targetUserId ?? null;
    if (!targetId && data.handle) {
      const handle = data.handle.replace(/^@/, "").trim();
      const { data: found } = UUID_RE.test(handle)
        ? await supabaseAdmin.from("profiles").select("id").eq("id", handle).maybeSingle()
        : await supabaseAdmin.from("profiles").select("id").ilike("username", handle).maybeSingle();
      targetId = found?.id ?? null;
    }
    if (!targetId) throw new Error("Получатель не найден");
    if (targetId === context.userId) throw new Error("Нельзя переводить кредиты самому себе");

    const credited = data.amount * 2;

    // Капитан платит из баланса своей команды и ограничен 15 кредитами за перевод.
    let teamId: string | null = null;
    if (!isAdmin && isCaptain) {
      if (data.amount > 15) throw new Error("Капитан может отправить не более 15 кредитов за раз");
      const { data: member } = await supabaseAdmin
        .from("team_members")
        .select("team_id, is_captain")
        .eq("user_id", context.userId)
        .maybeSingle();
      if (!member?.is_captain) throw new Error("Только капитан команды может переводить кредиты");
      const { data: team } = await supabaseAdmin.from("teams").select("*").eq("id", member.team_id).single();
      if (!team) throw new Error("Команда не найдена");
      await ensureDailyRefill(supabaseAdmin, team);
      const { data: fresh } = await supabaseAdmin.from("teams").select("*").eq("id", team.id).single();
      if (!fresh || fresh.credits_balance < credited) {
        throw new Error("Недостаточно кредитов команды. Запросите пополнение у администратора.");
      }
      await supabaseAdmin
        .from("teams")
        .update({ credits_balance: fresh.credits_balance - credited })
        .eq("id", fresh.id);
      teamId = fresh.id;
    }

    // Защита от двойного клика.
    const since = new Date(Date.now() - 15_000).toISOString();
    const { data: dup } = await supabaseAdmin
      .from("credit_transactions")
      .select("id")
      .eq("user_id", targetId)
      .eq("kind", "credit_transfer")
      .eq("amount", credited)
      .gte("created_at", since)
      .limit(1);
    if (dup && dup.length > 0) return { ok: true, duplicate: true, credited };

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("credits, total_credits")
      .eq("id", targetId)
      .maybeSingle();
    if (!profile) throw new Error("Профиль получателя не найден");

    await supabaseAdmin
      .from("profiles")
      .update({ credits: profile.credits + credited, total_credits: profile.total_credits + credited })
      .eq("id", targetId);

    await supabaseAdmin.from("credit_transactions").insert({
      user_id: targetId,
      amount: credited,
      kind: "credit_transfer",
      note: `${data.note || "Перевод кредитов"} · x2${teamId ? ` · team:${teamId}` : ""}`,
      report_id: data.reportId ?? null,
      created_by: context.userId,
    });

    return { ok: true, credited };
  });
