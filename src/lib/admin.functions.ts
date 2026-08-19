import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RoleInput = z.object({
  userId: z.string().uuid(),
  role: z.enum(["user", "volunteer", "worker", "captain", "moderator", "admin"]),
  action: z.enum(["grant", "revoke"]),
});

const CreditInput = z.object({
  userId: z.string().uuid(),
  amount: z.number().int().min(-100000).max(100000),
  note: z.string().max(300).default(""),
});

export const getAdminOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Недостаточно прав");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [users, reports, resolved, pendingApps, credits] = await Promise.all([
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("reports").select("id", { count: "exact", head: true }).eq("approved", true),
      supabaseAdmin.from("reports").select("id", { count: "exact", head: true }).eq("status", "resolved"),
      supabaseAdmin
        .from("worker_applications")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      supabaseAdmin.from("profiles").select("total_credits"),
    ]);

    const totalCredits = (credits.data ?? []).reduce((sum, row) => sum + (row.total_credits ?? 0), 0);

    const { data: recentUsers } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, city, region, credits, total_credits, approved_count, rejected_count, created_at")
      .order("created_at", { ascending: false })
      .limit(50);

    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role");

    return {
      stats: {
        users: users.count ?? 0,
        reports: reports.count ?? 0,
        resolved: resolved.count ?? 0,
        pendingApplications: pendingApps.count ?? 0,
        totalCredits,
      },
      users: recentUsers ?? [],
      roles: roles ?? [],
    };
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => RoleInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Недостаточно прав");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.action === "grant") {
      await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: data.userId, role: data.role }, { onConflict: "user_id,role" });
    } else {
      await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", data.role);
    }
    return { ok: true };
  });

export const adjustCredits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CreditInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Недостаточно прав");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("credits, total_credits")
      .eq("id", data.userId)
      .maybeSingle();
    if (!profile) throw new Error("Пользователь не найден");

    await supabaseAdmin
      .from("profiles")
      .update({
        credits: profile.credits + data.amount,
        total_credits: Math.max(0, profile.total_credits + Math.max(0, data.amount)),
      })
      .eq("id", data.userId);

    await supabaseAdmin.from("credit_transactions").insert({
      user_id: data.userId,
      amount: data.amount,
      kind: "admin_adjust",
      note: data.note,
      created_by: context.userId,
    });

    return { ok: true };
  });
