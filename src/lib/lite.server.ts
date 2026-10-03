// Lite (iOS 6 / old Safari) version: server-rendered HTML, no client framework.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type LiteSession = {
  supabase: SupabaseClient<Database>;
  userId: string;
  setCookies: string[];
};

const AT = "lite_at";
const RT = "lite_rt";
const CSRF = "lite_csrf";
const MONTH = 60 * 60 * 24 * 30;

export function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function readCookies(request: Request): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function cookie(name: string, value: string, maxAge: number): string {
  return `${name}=${encodeURIComponent(value)}; Path=/lite; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

export function sessionCookies(accessToken: string, refreshToken: string): string[] {
  return [cookie(AT, accessToken, MONTH), cookie(RT, refreshToken, MONTH)];
}

export function clearSessionCookies(): string[] {
  return [cookie(AT, "", 0), cookie(RT, "", 0)];
}

function env() {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Backend is not configured");
  return { url, key };
}

export function anonClient(): SupabaseClient<Database> {
  const { url, key } = env();
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function userClient(accessToken: string): SupabaseClient<Database> {
  const { url, key } = env();
  return createClient<Database>(url, key, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Resolves the signed-in user from cookies, refreshing tokens when needed. */
export async function getLiteSession(request: Request): Promise<LiteSession | null> {
  const c = readCookies(request);
  let at = c[AT];
  const rt = c[RT];
  if (!at && !rt) return null;
  const anon = anonClient();
  const setCookies: string[] = [];
  let userId: string | null = null;
  if (at) {
    const { data } = await anon.auth.getUser(at);
    userId = data.user?.id ?? null;
  }
  if (!userId && rt) {
    const { data } = await anon.auth.refreshSession({ refresh_token: rt });
    if (data.session && data.user) {
      at = data.session.access_token;
      userId = data.user.id;
      setCookies.push(...sessionCookies(data.session.access_token, data.session.refresh_token));
    }
  }
  if (!userId || !at) return null;
  return { supabase: userClient(at), userId, setCookies };
}

/** Double-submit CSRF token: returns the token and a cookie to set if new. */
export function csrfToken(request: Request): { token: string; setCookie: string | null } {
  const existing = readCookies(request)[CSRF];
  if (existing && /^[a-f0-9]{32}$/.test(existing)) return { token: existing, setCookie: null };
  const token = crypto.randomUUID().replace(/-/g, "");
  return { token, setCookie: cookie(CSRF, token, MONTH) };
}

export function checkCsrf(request: Request, form: FormData): boolean {
  const c = readCookies(request)[CSRF];
  const f = form.get("csrf");
  return Boolean(c) && typeof f === "string" && f === c;
}

export function redirect(to: string, setCookies: string[] = []): Response {
  const headers = new Headers({ Location: to, "Cache-Control": "no-store" });
  for (const c of setCookies) headers.append("Set-Cookie", c);
  return new Response(null, { status: 303, headers });
}

const CSS = `
*{-webkit-box-sizing:border-box;box-sizing:border-box}
body{margin:0;background:#f2f6fb;color:#2b3550;font-family:Helvetica,Arial,sans-serif;font-size:16px;-webkit-text-size-adjust:100%}
.top{background:#2f5fe0;background:-webkit-linear-gradient(left,#3aa0e8,#2f5fe0);color:#fff;padding:12px 14px}
.top b{font-size:19px;letter-spacing:1px}.top span{float:right;font-size:14px;margin-top:3px}
.nav{background:#fff;border-bottom:1px solid #dde5f0;padding:0;margin:0;list-style:none;overflow:hidden}
.nav li{float:left;width:20%;text-align:center}
.nav a{display:block;padding:10px 0;color:#5a6680;text-decoration:none;font-size:13px}
.nav a.on{color:#2f5fe0;font-weight:bold}
.wrap{padding:12px}
.card{background:#fff;border:1px solid #dde5f0;border-radius:12px;padding:12px;margin-bottom:12px}
h1{font-size:20px;margin:4px 0 12px}h2{font-size:17px;margin:0 0 8px}
.muted{color:#7a859c;font-size:13px}
.ok{color:#178a4c}.bad{color:#c8382e}
img.ph{display:block;width:100%;border-radius:8px;margin-bottom:8px}
label{display:block;font-size:14px;margin:10px 0 4px}
input[type=text],input[type=email],input[type=password],textarea,select{width:100%;padding:10px;border:1px solid #c9d4e4;border-radius:8px;font-size:16px;background:#fff;-webkit-appearance:none}
textarea{height:90px}
.btn{display:block;width:100%;margin-top:14px;padding:13px;border:0;border-radius:10px;background:#2f5fe0;color:#fff;font-size:17px;font-weight:bold;text-align:center;text-decoration:none;-webkit-appearance:none}
.btn.gray{background:#e4eaf3;color:#2b3550}
.msg{padding:10px;border-radius:8px;margin-bottom:12px;background:#e8f0ff}
.msg.err{background:#fde8e6;color:#a8291f}
table{width:100%;border-collapse:collapse}td{padding:8px 4px;border-bottom:1px solid #eef2f7;font-size:15px}
td.n{width:34px;color:#7a859c}td.r{text-align:right;font-weight:bold}
.big{font-size:28px;font-weight:bold;color:#2f5fe0}
`;

const NAV: [string, string][] = [
  ["/lite", "Главная"],
  ["/lite/report", "Жалоба"],
  ["/lite/rating", "Рейтинг"],
  ["/lite/depots", "Пункты"],
  ["/lite/profile", "Профиль"],
];

export function page(opts: {
  title: string;
  body: string;
  active?: string;
  nav?: boolean;
  setCookies?: (string | null)[];
  status?: number;
}): Response {
  const nav =
    opts.nav === false
      ? ""
      : `<ul class="nav">${NAV.map(
          ([href, label]) =>
            `<li><a href="${href}"${opts.active === href ? ' class="on"' : ""}>${label}</a></li>`,
        ).join("")}</ul>`;
  const html = `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="TAZA KÖZ">
<meta name="robots" content="noindex">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<title>${esc(opts.title)} — TAZA KÖZ Lite</title><style>${CSS}</style></head>
<body><div class="top"><b>TAZA KÖZ</b><span>Lite</span></div>${nav}
<div class="wrap">${opts.body}</div></body></html>`;
  const headers = new Headers({
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
  });
  for (const c of opts.setCookies ?? []) if (c) headers.append("Set-Cookie", c);
  return new Response(html, { status: opts.status ?? 200, headers });
}

export async function requireLite(
  request: Request,
): Promise<{ session: LiteSession } | { response: Response }> {
  const session = await getLiteSession(request);
  if (!session) return { response: redirect("/lite/login", clearSessionCookies()) };
  const { data } = await session.supabase
    .from("profiles")
    .select("email_verified_at")
    .eq("id", session.userId)
    .maybeSingle();
  if (!data?.email_verified_at) {
    return {
      response: page({
        title: "Подтвердите почту",
        nav: false,
        setCookies: [...session.setCookies, ...clearSessionCookies()],
        body: `<div class="card"><h2>Почта не подтверждена</h2><p>Подтвердите почту на основном сайте tazakoz.online, затем войдите снова.</p><a class="btn" href="/lite/login">Ко входу</a></div>`,
      }),
    };
  }
  return { session };
}

export async function signedReportPhoto(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.storage.from("reports").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

export const SEVERITY_RU: Record<string, string> = { low: "слабое", medium: "среднее", high: "сильное" };
export const STATUS_RU: Record<string, string> = { new: "новая", in_progress: "в работе", resolved: "убрано" };
