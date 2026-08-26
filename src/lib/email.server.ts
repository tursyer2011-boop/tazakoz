const RESEND_URL = "https://api.resend.com/emails";

function maskEmail(email: string) {
  const [name = "", domain = ""] = email.split("@");
  if (!domain) return "***";
  return `${name.slice(0, 2)}${"*".repeat(Math.max(1, name.length - 2))}@${domain}`;
}

async function logDelivery(entry: {
  email: string;
  purpose: string;
  event: string;
  status?: string;
  httpStatus?: number;
  error?: string;
}) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("email_delivery_log").insert({
      email_masked: maskEmail(entry.email),
      purpose: entry.purpose,
      provider: "resend",
      event: entry.event,
      status: entry.status ?? "",
      http_status: entry.httpStatus ?? null,
      error: entry.error ?? "",
    });
  } catch (error) {
    console.error("[email] log failed", error);
  }
}

export function otpEmailHtml(code: string) {
  return `<!doctype html><html><body style="margin:0;">
<div style="background-color: #F4F7FA; padding: 40px 20px; font-family: 'Segoe UI', Arial, sans-serif; color: #1E293B;">
  <div style="max-width: 500px; margin: 0 auto; background: #FFFFFF; border-radius: 20px; padding: 32px; box-shadow: 8px 8px 20px #E2E8F0, -8px -8px 20px #FFFFFF;">
    <div style="text-align: center; margin-bottom: 24px;">
      <h1 style="color: #0066FF; font-size: 26px; margin: 0; font-weight: 800; letter-spacing: -0.5px;">Taza Koz</h1>
      <p style="color: #64748B; font-size: 13px; margin-top: 4px;">Платформа экологического мониторинга</p>
    </div>
    <div style="font-size: 15px; line-height: 1.6; color: #334155;">
      <p>Здравствуйте!</p>
      <p>Подтвердите регистрацию в системе <strong>Taza Koz</strong>, введя код ниже:</p>
    </div>
    <div style="text-align: center; margin: 32px 0;">
      <div style="background-color: #0066FF; color: #FFFFFF; padding: 14px 32px; border-radius: 12px; font-weight: 700; font-size: 30px; letter-spacing: 10px; display: inline-block; box-shadow: 0 4px 14px rgba(0, 102, 255, 0.35);">${code}</div>
      <p style="color: #64748B; font-size: 13px; margin-top: 12px;">Код действует 10 минут. Никому его не сообщайте.</p>
    </div>
    <div style="border-top: 1px solid #F1F5F9; padding-top: 20px; margin-top: 32px; text-align: center; font-size: 12px; color: #94A3B8;">
      © Taza Koz • Казахстан
    </div>
  </div>
</div></body></html>`;
}

export async function sendOtpEmail(
  email: string,
  code: string,
  purpose: string,
): Promise<{ sent: boolean; error?: string }> {
  const apiKey = process.env["RESEND_API_KEY"];
  const from = process.env["RESEND_FROM_EMAIL"] ?? "TAZA KÖZ <no-reply@tazakoz.online>";
  if (!apiKey) {
    await logDelivery({ email, purpose, event: "send", status: "failed", error: "RESEND_API_KEY missing" });
    return { sent: false, error: "Почтовый сервис не настроен" };
  }

  try {
    const res = await fetch(RESEND_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [email],
        subject: `Taza Koz Verification Code: ${code}`,
        html: otpEmailHtml(code),
        text: `Taza Koz verification code: ${code}. Код действует 10 минут.`,
      }),
    });
    const body = await res.text();
    if (!res.ok) {
      console.error(`[resend] ${res.status}: ${body}`);
      await logDelivery({
        email,
        purpose,
        event: "send",
        status: "failed",
        httpStatus: res.status,
        error: body.slice(0, 400),
      });
      return { sent: false, error: `Resend ${res.status}` };
    }
    await logDelivery({ email, purpose, event: "send", status: "accepted", httpStatus: res.status });
    return { sent: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "network error";
    await logDelivery({ email, purpose, event: "send", status: "failed", error: message });
    return { sent: false, error: message };
  }
}

export async function logVerification(email: string, purpose: string, status: string, error = "") {
  await logDelivery({ email, purpose, event: "verify", status, error });
}
