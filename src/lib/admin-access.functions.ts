import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const RequestInput = z.object({
  password: z.string().max(100).default(""),
  email: z.string().email(),
  region: z.string().min(2).max(120),
  regionCode: z.string().min(1).max(20),
  city: z.string().min(1).max(120),
});

const ActivateInput = z.object({
  password: z.string().max(100).default(""),
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/),
  region: z.string().min(2).max(120),
  regionCode: z.string().min(1).max(20),
  city: z.string().min(1).max(120),
});

const TTL_MINUTES = 10;
const ACCESS_DAYS = 30;

/** Пароль доступа берётся только из секрета. Нет секрета — вход закрыт. */
function checkPassword(password: string) {
  const expected = process.env["TELEGRAM_BOT_ACCESS_PASSWORD"];
  if (!expected || expected.trim().length < 12) {
    throw new Error("Доступ администратора не настроен. Обратитесь к владельцу платформы.");
  }
  if (password.trim() !== expected.trim()) throw new Error("Неверный пароль доступа");
}

/** Открыта ли одноразовая первичная регистрация владельца. */
async function bootstrapOpen(supabaseAdmin: any) {
  const { data } = await supabaseAdmin.from("admin_bootstrap").select("used_at").eq("id", true).maybeSingle();
  return !data?.used_at;
}

/**
 * Режим входа: пока не создан первый (постоянный) админ — вход по служебному паролю.
 * После этого пароль не работает никогда: только приглашение действующего админа.
 */
async function resolveMode(supabaseAdmin: any, password: string, email: string) {
  if (await bootstrapOpen(supabaseAdmin)) {
    checkPassword(password);
    return { bootstrap: true as const, invite: null };
  }

  const { data: invite } = await supabaseAdmin
    .from("admin_invites")
    .select("*")
    .ilike("email", email)
    .is("used_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!invite) throw new Error("Этот e-mail не приглашён администратором платформы");
  if (new Date(invite.expires_at).getTime() < Date.now()) {
    throw new Error("Срок действия приглашения истёк. Попросите админа выслать новое.");
  }
  return { bootstrap: false as const, invite };
}

/** Публичный статус страницы /admin: открыта ли первичная регистрация владельца. */
export const getAdminGateStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return { bootstrapOpen: await bootstrapOpen(supabaseAdmin) };
});

export const requestAdminAccess = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => RequestInput.parse(data))
  .handler(async ({ data }) => {
    const email = data.email.trim().toLowerCase();

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { hashOtp, randomOtp } = await import("@/lib/otp.server");
    const { sendOtpEmail } = await import("@/lib/email.server");

    await resolveMode(supabaseAdmin, data.password, email);

    const { data: last } = await supabaseAdmin
      .from("email_otps")
      .select("created_at")
      .eq("email", email)
      .eq("purpose", "admin")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (last && Date.now() - new Date(last.created_at).getTime() < 30_000) {
      throw new Error("Код уже отправлен. Повторите через несколько секунд.");
    }

    await supabaseAdmin
      .from("email_otps")
      .update({ consumed_at: new Date().toISOString() })
      .eq("email", email)
      .eq("purpose", "admin")
      .is("consumed_at", null);

    const code = randomOtp();
    const { error } = await supabaseAdmin.from("email_otps").insert({
      email,
      purpose: "admin",
      code_hash: hashOtp(code, email),
      expires_at: new Date(Date.now() + TTL_MINUTES * 60_000).toISOString(),
    });
    if (error) throw new Error(error.message);

    const sent = await sendOtpEmail(email, code, "admin");
    if (!sent.sent) throw new Error(sent.error ?? "Не удалось отправить письмо");
    return { sent: true, email };
  });

export const activateAdminAccess = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => ActivateInput.parse(data))
  .handler(async ({ data }) => {
    const email = data.email.trim().toLowerCase();

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { hashOtp } = await import("@/lib/otp.server");

    const mode = await resolveMode(supabaseAdmin, data.password, email);

    const { data: record } = await supabaseAdmin
      .from("email_otps")
      .select("*")
      .eq("email", email)
      .eq("purpose", "admin")
      .is("consumed_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!record) throw new Error("Код не найден. Запросите новый.");
    if (new Date(record.expires_at).getTime() < Date.now()) throw new Error("Срок действия кода истёк.");
    if (record.attempts >= 5) throw new Error("Слишком много попыток. Запросите новый код.");
    if (record.code_hash !== hashOtp(data.code, email)) {
      await supabaseAdmin.from("email_otps").update({ attempts: record.attempts + 1 }).eq("id", record.id);
      throw new Error("Неверный код");
    }
    await supabaseAdmin
      .from("email_otps")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", record.id);

    // find or create the account behind this email
    let userId: string | null = null;
    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    userId = list?.users.find((u) => (u.email ?? "").toLowerCase() === email)?.id ?? null;
    if (!userId) {
      const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { first_name: "Администратор" },
      });
      if (createError) throw new Error(createError.message);
      userId = created.user!.id;
    }

    const expiresAt = mode.bootstrap ? null : new Date(Date.now() + ACCESS_DAYS * 24 * 60 * 60_000).toISOString();

    await supabaseAdmin.from("profiles").upsert(
      {
        id: userId,
        admin_region: data.region,
        admin_region_code: data.regionCode,
        admin_city: data.city,
        admin_activated_at: new Date().toISOString(),
        admin_permanent: mode.bootstrap,
        admin_expires_at: expiresAt,
        email_verified_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });

    if (mode.bootstrap) {
      // Страница первичной регистрации закрывается навсегда.
      await supabaseAdmin
        .from("admin_bootstrap")
        .update({ used_at: new Date().toISOString(), used_by: userId, updated_at: new Date().toISOString() })
        .eq("id", true);
    } else if (mode.invite) {
      await supabaseAdmin
        .from("admin_invites")
        .update({ used_at: new Date().toISOString() })
        .eq("id", mode.invite.id);
    }

    const { data: link, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (linkError) throw new Error(linkError.message);

    return {
      ok: true,
      email,
      permanent: mode.bootstrap,
      expiresAt,
      otp: link.properties?.email_otp ?? "",
    };
  });

/**
 * Одноразовый захват прав владельца: текущий вошедший пользователь становится
 * постоянным администратором, все прочие админы лишаются роли, страница /admin
 * закрывается навсегда.
 */
export const claimFirstAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!(await bootstrapOpen(supabaseAdmin))) {
      throw new Error("Первичная регистрация владельца уже закрыта");
    }

    // снять админку со всех остальных
    await supabaseAdmin.from("user_roles").delete().eq("role", "admin").neq("user_id", context.userId);
    await supabaseAdmin
      .from("profiles")
      .update({ admin_permanent: false, admin_expires_at: null, admin_activated_at: null })
      .neq("id", context.userId);

    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: context.userId, role: "admin" }, { onConflict: "user_id,role" });
    await supabaseAdmin
      .from("profiles")
      .update({
        admin_permanent: true,
        admin_expires_at: null,
        admin_activated_at: new Date().toISOString(),
      })
      .eq("id", context.userId);

    await supabaseAdmin
      .from("admin_bootstrap")
      .update({ used_at: new Date().toISOString(), used_by: context.userId, updated_at: new Date().toISOString() })
      .eq("id", true);

    return { ok: true };
  });
