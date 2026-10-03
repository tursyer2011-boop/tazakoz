import { createFileRoute } from "@tanstack/react-router";
import { esc, page, requireLite, SEVERITY_RU, signedReportPhoto } from "@/lib/lite.server";

export const Route = createFileRoute("/lite/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await requireLite(request);
        if ("response" in auth) return auth.response;
        const { session } = auth;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const [{ data: me }, { data: reports }] = await Promise.all([
          session.supabase.from("profiles").select("full_name, credits").eq("id", session.userId).maybeSingle(),
          supabaseAdmin
            .from("reports")
            .select("id, user_id, photo_url, address, region, comment, severity, created_at")
            .eq("approved", true)
            .eq("region_code", "09")
            .order("created_at", { ascending: false })
            .limit(15),
        ]);
        const ids = [...new Set((reports ?? []).map((r) => r.user_id))];
        const { data: names } = ids.length
          ? await supabaseAdmin.from("profiles").select("id, username").in("id", ids)
          : { data: [] as { id: string; username: string }[] };
        const nick = new Map((names ?? []).map((n) => [n.id, n.username]));
        const cards = await Promise.all(
          (reports ?? []).map(async (r) => {
            const url = await signedReportPhoto(r.photo_url);
            return `<div class="card">${url ? `<img class="ph" src="${esc(url)}" alt="">` : ""}
<b>@${esc(nick.get(r.user_id) || "житель")}</b> · ${esc(SEVERITY_RU[r.severity] ?? r.severity)}<br>
<span class="muted">${esc(r.address || r.region)} · ${esc(new Date(r.created_at).toLocaleDateString("ru-RU"))}</span>
${r.comment ? `<p>${esc(r.comment)}</p>` : ""}</div>`;
          }),
        );
        const body = `<div class="card"><span class="muted">Здравствуйте, ${esc(me?.full_name || "")}</span><br>
<span class="big">${esc(me?.credits ?? 0)}</span> кредитов
<a class="btn" href="/lite/report">Сообщить о загрязнении</a></div>
<h1>Последние жалобы</h1>${cards.join("") || '<p class="muted">Пока нет одобренных жалоб.</p>'}`;
        return page({ title: "Главная", active: "/lite", body, setCookies: session.setCookies });
      },
    },
  },
});
