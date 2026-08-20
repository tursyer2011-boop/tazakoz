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
  return `<!doctype html><html><body style="margin:0;background:#0b0f0d;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:32px 24px;color:#e9f7ef;">
    <h1 style="margin:0 0 8px;font-size:22px;letter-spacing:2px;color:#b8ff5c;">TAZA KÖZ</h1>
    <p style="margin:0 0 24px;font-size:13px;color:#9fb0a5;">KÖR. HABARLA. QORĞA.</p>
    <p style="font-size:15px;margin:0 0 12px;">Ваш код подтверждения:</p>
    <div style="font-size:34px;font-weight:700;letter-spacing:10px;padding:16px 0;color:#b8ff5c;">${code}</div>
    <p style="font-size:13px;color:#9fb0a5;margin:12px 0 0;">Код действует 10 минут. Никому его не сообщайте.</p>
    <p style="font-size:12px;color:#6d7d73;margin-top:28px;">Если вы не запрашивали код — просто игнорируйте это письмо.</p>
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
