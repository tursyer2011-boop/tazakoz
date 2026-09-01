import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { hasRole } from "@/lib/roles";

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
    const isAdmin = await hasRole(context.supabase, context.userId, "admin");
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
    const isAdmin = await hasRole(context.supabase, context.userId, "admin");
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

export const getEmailDiagnostics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const isAdmin = await hasRole(context.supabase, context.userId, "admin");
    if (!isAdmin) throw new Error("Недостаточно прав");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: events } = await supabaseAdmin
      .from("email_delivery_log")
      .select("id, email_masked, purpose, provider, event, status, http_status, error, created_at")
      .order("created_at", { ascending: false })
      .limit(30);

    const list = events ?? [];
    const lastSend = list.find((e) => e.event === "send") ?? null;
    const lastVerify = list.find((e) => e.event === "verify") ?? null;

    return {
      providerConfigured: Boolean(process.env["RESEND_API_KEY"]),
      sender: process.env["RESEND_FROM_EMAIL"] ?? "no-reply@tazakoz.online",
      lastSend,
      lastVerify,
      events: list,
    };
  });

export const adjustCredits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CreditInput.parse(data))
  .handler(async ({ data, context }) => {
    const isAdmin = await hasRole(context.supabase, context.userId, "admin");
    if (!isAdmin) throw new Error("Недостаточно прав");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Защита от двойного клика: одинаковое начисление в течение 15 секунд игнорируется.
    const since = new Date(Date.now() - 15_000).toISOString();
    const { data: dup } = await supabaseAdmin
      .from("credit_transactions")
      .select("id")
      .eq("user_id", data.userId)
      .eq("kind", "admin_adjust")
      .eq("amount", data.amount)
      .gte("created_at", since)
      .limit(1);
    if (dup && dup.length > 0) return { ok: true, duplicate: true };

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("credits, total_credits")
      .eq("id", data.userId)
      .maybeSingle();
    if (!profile) throw new Error("Пользователь не найден");

    // Начисление строго 1:1: пользователь получает ровно введённую сумму.
    const applied = data.amount;

    await supabaseAdmin
      .from("profiles")
      .update({
        credits: profile.credits + applied,
        total_credits: Math.max(0, profile.total_credits + Math.max(0, applied)),
      })
      .eq("id", data.userId);

    await supabaseAdmin.from("credit_transactions").insert({
      user_id: data.userId,
      amount: applied,
      kind: "admin_adjust",
      note: data.note,
      created_by: context.userId,
    });

    return { ok: true };
  });

const RegistryInput = z.object({
  kind: z.enum(["all", "resident", "worker"]).default("all"),
  search: z.string().trim().max(120).default(""),
});

/** Единый реестр всех зарегистрированных пользователей (жители / работники). */
export const listAppUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => RegistryInput.parse(data ?? {}))
  .handler(async ({ data, context }) => {
    const [isAdmin, isModerator] = await Promise.all([
      hasRole(context.supabase, context.userId, "admin"),
      hasRole(context.supabase, context.userId, "moderator"),
    ]);
    if (!isAdmin && !isModerator) throw new Error("Недостаточно прав");

    let query = context.supabase
      .from("app_users")
      .select("id, email, full_name, phone, city, region, kind, roles, credits, total_credits, created_at")
      .order("created_at", { ascending: false })
      .limit(500);

    if (data.kind !== "all") query = query.eq("kind", data.kind);
    if (data.search) {
      const q = `%${data.search}%`;
      query = query.or(`full_name.ilike.${q},email.ilike.${q},phone.ilike.${q},city.ilike.${q}`);
    }

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    const list = rows ?? [];
    return {
      users: list,
      counts: {
        total: list.length,
        residents: list.filter((u) => u.kind === "resident").length,
        workers: list.filter((u) => u.kind === "worker").length,
      },
    };
  });

const InviteInput = z.object({
  email: z.string().email().max(200),
  region: z.string().max(120).default(""),
  regionCode: z.string().max(20).default(""),
  city: z.string().max(120).default(""),
});

/** Действующий админ приглашает нового администратора по конкретному e-mail. */
export const inviteAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InviteInput.parse(data))
  .handler(async ({ data, context }) => {
    const isAdmin = await hasRole(context.supabase, context.userId, "admin");
    if (!isAdmin) throw new Error("Недостаточно прав");

    const email = data.email.trim().toLowerCase();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    await supabaseAdmin
      .from("admin_invites")
      .update({ used_at: new Date().toISOString() })
      .ilike("email", email)
      .is("used_at", null);

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60_000);
    const { error } = await supabaseAdmin.from("admin_invites").insert({
      email,
      region: data.region,
      region_code: data.regionCode,
      city: data.city,
      created_by: context.userId,
      expires_at: expiresAt.toISOString(),
    });
    if (error) throw new Error(error.message);

    const { sendAdminInviteEmail } = await import("@/lib/email.server");
    const mail = await sendAdminInviteEmail(email, data.region, data.city, expiresAt);
    if (!mail.sent) {
      throw new Error(`Приглашение сохранено, но письмо не ушло: ${mail.error ?? "неизвестная ошибка"}`);
    }
    return { ok: true, email, emailSent: true };
  });

/** Список приглашений администраторов. */
export const listAdminInvites = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const isAdmin = await hasRole(context.supabase, context.userId, "admin");
    if (!isAdmin) throw new Error("Недостаточно прав");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("admin_invites")
      .select("id, email, region, city, expires_at, used_at, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    return data ?? [];
  });

/** Заявки работников со ссылками на документы (для админ-панели). */
export const listWorkerApplications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const isAdmin = await hasRole(context.supabase, context.userId, "admin");
    const isModerator = await hasRole(context.supabase, context.userId, "moderator");
    if (!isAdmin && !isModerator) throw new Error("Недостаточно прав");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("worker_applications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(80);
    if (error) throw new Error(error.message);

    const sign = async (path: string | null) => {
      if (!path) return null;
      const { data: signed } = await supabaseAdmin.storage.from("worker-docs").createSignedUrl(path, 3600);
      return signed?.signedUrl ?? null;
    };

    return await Promise.all(
      (data ?? []).map(async (app) => ({
        ...app,
        docs: {
          front: await sign(app.doc_front_url),
          back: await sign(app.doc_back_url),
          selfie: await sign(app.selfie_url),
          parent: await sign(app.parent_doc_url),
        },
      })),
    );
  });
