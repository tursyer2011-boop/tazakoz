import { createFileRoute } from "@tanstack/react-router";
import { csrfToken, esc, page, requireLite, SEVERITY_RU, STATUS_RU } from "@/lib/lite.server";

export const Route = createFileRoute("/lite/profile")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await requireLite(request);
        if ("response" in auth) return auth.response;
        const { session } = auth;
        const [{ data: me }, { data: mine }] = await Promise.all([
          session.supabase
            .from("profiles")
            .select("full_name, username, credits, total_credits, approved_count, rejected_count")
            .eq("id", session.userId)
            .maybeSingle(),
          session.supabase
            .from("reports")
            .select("address, region, severity, status, approved, credits_awarded, ai_reason, created_at")
            .eq("user_id", session.userId)
            .order("created_at", { ascending: false })
            .limit(30),
        ]);
        const { token, setCookie } = csrfToken(request);
        const list = (mine ?? [])
          .map(
            (r) => `<div class="card"><b>${esc(r.address || r.region || "Без адреса")}</b><br>
<span class="${r.approved ? "ok" : "bad"}">${r.approved ? `одобрена · +${esc(r.credits_awarded)}` : "отклонена"}</span>
<span class="muted"> · ${esc(SEVERITY_RU[r.severity] ?? r.severity)} · ${esc(STATUS_RU[r.status] ?? r.status)} · ${esc(new Date(r.created_at).toLocaleDateString("ru-RU"))}</span>
${r.ai_reason ? `<br><span class="muted">${esc(r.ai_reason)}</span>` : ""}</div>`,
          )
          .join("");
        const body = `<div class="card"><h2>${esc(me?.full_name || "")}</h2>
<span class="muted">${me?.username ? "@" + esc(me.username) : ""}</span>
<p>Баланс: <b>${esc(me?.credits ?? 0)}</b> · Всего: ${esc(me?.total_credits ?? 0)}<br>
Одобрено: ${esc(me?.approved_count ?? 0)} · Отклонено: ${esc(me?.rejected_count ?? 0)}</p>
<form method="post" action="/lite/logout"><input type="hidden" name="csrf" value="${esc(token)}"><button class="btn gray" type="submit">Выйти</button></form></div>
<h1>Мои жалобы</h1>${list || '<p class="muted">Вы ещё не отправляли жалоб.</p>'}`;
        return page({ title: "Профиль", active: "/lite/profile", body, setCookies: [...session.setCookies, setCookie] });
      },
    },
  },
});
