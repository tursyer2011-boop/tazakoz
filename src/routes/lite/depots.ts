import { createFileRoute } from "@tanstack/react-router";
import { esc, page, requireLite } from "@/lib/lite.server";

export const Route = createFileRoute("/lite/depots")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await requireLite(request);
        if ("response" in auth) return auth.response;
        const { data } = await auth.session.supabase
          .from("depots")
          .select("code, name, address, city, lat, lng")
          .eq("active", true)
          .eq("region_code", "09")
          .order("city");
        const cards = (data ?? [])
          .map(
            (d) => `<div class="card"><h2>${esc(d.code)}</h2>${esc(d.name)}<br>
<span class="muted">${esc([d.city, d.address].filter(Boolean).join(", "))}</span><br>
<a href="https://maps.apple.com/?ll=${d.lat},${d.lng}&q=${encodeURIComponent(d.code)}">Открыть на карте</a></div>`,
          )
          .join("");
        return page({
          title: "Пункты",
          active: "/lite/depots",
          setCookies: auth.session.setCookies,
          body: `<h1>Пункты TZK</h1>${cards || '<p class="muted">Пунктов пока нет.</p>'}`,
        });
      },
    },
  },
});
