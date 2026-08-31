import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const RequestInput = z.object({
  password: z.string().min(3).max(100),
  email: z.string().email(),
  region: z.string().min(2).max(120),
  regionCode: z.string().min(1).max(20),
  city: z.string().min(1).max(120),
});

const ActivateInput = z.object({
  password: z.string().min(3).max(100),
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/),
  region: z.string().min(2).max(120),
  regionCode: z.string().min(1).max(20),
  city: z.string().min(1).max(120),
});

const TTL_MINUTES = 10;

/** Пароль доступа берётся только из секрета. Нет секрета — вход закрыт. */
function checkPassword(password: string) {
  const expected = process.env["TELEGRAM_BOT_ACCESS_PASSWORD"];
  if (!expected || expected.trim().length < 12) {
    throw new Error("Доступ администратора не настроен. Обратитесь к владельцу платформы.");
  }
  if (password.trim() !== expected.trim()) throw new Error("Неверный пароль доступа");
}

/**
 * Пароля недостаточно: e-mail должен быть заранее приглашён действующим админом.
 * Исключение — первичная настройка, когда админов в системе ещё нет.
 */
async function requireInvite(supabaseAdmin: any, email: string) {
  const { count } = await supabaseAdmin
    .from("user_roles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin");

  if ((count ?? 0) === 0) return null; // bootstrap первого администратора

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
  return invite;
}

export const requestAdminAccess = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => RequestInput.parse(data))
  .handler(async ({ data }) => {
    await checkPassword(data.password);
    const email = data.email.trim().toLowerCase();

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { hashOtp, randomOtp } = await import("@/lib/otp.server");
    const { sendOtpEmail } = await import("@/lib/email.server");

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
    checkPassword(data.password);
    const email = data.email.trim().toLowerCase();

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { hashOtp } = await import("@/lib/otp.server");

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

    await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          id: userId,
          admin_region: data.region,
          admin_region_code: data.regionCode,
          admin_city: data.city,
          admin_activated_at: new Date().toISOString(),
          email_verified_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      );
    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });

    const { data: link, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (linkError) throw new Error(linkError.message);

    return { ok: true, email, otp: link.properties?.email_otp ?? "" };
  });
