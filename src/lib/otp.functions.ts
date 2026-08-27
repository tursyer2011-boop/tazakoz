import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RequestInput = z.object({ purpose: z.enum(["signup", "login"]).default("signup") });
const VerifyInput = z.object({
  code: z.string().trim().regex(/^\d{6}$/, "Код состоит из 6 цифр"),
  purpose: z.enum(["signup", "login"]).default("signup"),
});

const TTL_MINUTES = 10;
const RESEND_COOLDOWN_MS = 30_000;
const MAX_ATTEMPTS = 5;

export const requestEmailOtp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => RequestInput.parse(data ?? {}))
  .handler(async ({ data, context }) => {
    const email = (context.claims as { email?: string }).email;
    if (!email) throw new Error("У аккаунта нет почты");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { hashOtp, randomOtp } = await import("@/lib/otp.server");

    const { data: last } = await supabaseAdmin
      .from("email_otps")
      .select("created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (last && Date.now() - new Date(last.created_at).getTime() < RESEND_COOLDOWN_MS) {
      throw new Error("Код уже отправлен. Повторите через несколько секунд.");
    }

    const code = randomOtp();
    const expiresAt = new Date(Date.now() + TTL_MINUTES * 60_000).toISOString();

    // Каждая новая сессия должна подтверждаться кодом: сбрасываем прошлое подтверждение.
    await supabaseAdmin
      .from("profiles")
      .update({ email_verified_at: null })
      .eq("id", context.userId);

    await supabaseAdmin
      .from("email_otps")
      .update({ consumed_at: new Date().toISOString() })
      .eq("user_id", context.userId)
      .is("consumed_at", null);

    const { error } = await supabaseAdmin.from("email_otps").insert({
      user_id: context.userId,
      email,
      purpose: data.purpose,
      code_hash: hashOtp(code, context.userId),
      expires_at: expiresAt,
    });
    if (error) throw new Error(error.message);

    const { sendOtpEmail } = await import("@/lib/email.server");
    const result = await sendOtpEmail(email, code, data.purpose);
    if (!result.sent) throw new Error(result.error ?? "Не удалось отправить письмо");

    return { sent: true, email, expiresAt, cooldownSeconds: 30 };
  });

export const verifyEmailOtp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => VerifyInput.parse(data))
  .handler(async ({ data, context }) => {
    const email = (context.claims as { email?: string }).email ?? "";
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { hashOtp } = await import("@/lib/otp.server");
    const { logVerification } = await import("@/lib/email.server");

    const { data: record } = await supabaseAdmin
      .from("email_otps")
      .select("*")
      .eq("user_id", context.userId)
      .is("consumed_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!record) {
      await logVerification(email, data.purpose, "no_active_code");
      throw new Error("Код не найден. Запросите новый.");
    }
    if (new Date(record.expires_at).getTime() < Date.now()) {
      await logVerification(email, data.purpose, "expired");
      throw new Error("Срок действия кода истёк. Запросите новый.");
    }
    if (record.attempts >= MAX_ATTEMPTS) {
      await logVerification(email, data.purpose, "too_many_attempts");
      throw new Error("Слишком много попыток. Запросите новый код.");
    }

    if (record.code_hash !== hashOtp(data.code, context.userId)) {
      await supabaseAdmin
        .from("email_otps")
        .update({ attempts: record.attempts + 1 })
        .eq("id", record.id);
      await logVerification(email, data.purpose, "invalid_code");
      throw new Error("Неверный код");
    }

    await supabaseAdmin
      .from("email_otps")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", record.id);
    await supabaseAdmin
      .from("profiles")
      .update({ email_verified_at: new Date().toISOString() })
      .eq("id", context.userId);
    await logVerification(email, data.purpose, "verified");

    return { verified: true };
  });

export const getEmailVerificationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("profiles")
      .select("email_verified_at")
      .eq("id", context.userId)
      .maybeSingle();
    return { verified: Boolean(data?.email_verified_at) };
  });
