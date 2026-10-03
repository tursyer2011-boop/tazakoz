import { createFileRoute } from "@tanstack/react-router";
import { esc, page, requireLite } from "@/lib/lite.server";

export const Route = createFileRoute("/lite/rating")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await requireLite(request);
        if ("response" in auth) return auth.response;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const [{ data: staff }, { data: people }] = await Promise.all([
          supabaseAdmin.from("user_roles").select("user_id").in("role", ["admin", "moderator"]),
          supabaseAdmin
            .from("profiles")
            .select("id, username, full_name, total_credits")
            .order("total_credits", { ascending: false })
            .limit(150),
        ]);
        const hidden = new Set((staff ?? []).map((s) => s.user_id));
        const rows = (people ?? [])
          .filter((p) => !hidden.has(p.id))
          .slice(0, 100)
          .map(
            (p, i) =>
              `<tr${p.id === auth.session.userId ? ' style="background:#eef3ff"' : ""}><td class="n">${i + 1}</td><td>${esc(p.username ? "@" + p.username : p.full_name || "житель")}</td><td class="r">${esc(p.total_credits)}</td></tr>`,
          )
          .join("");
        return page({
          title: "Рейтинг",
          active: "/lite/rating",
          setCookies: auth.session.setCookies,
          body: `<h1>Рейтинг</h1><div class="card"><table>${rows || '<tr><td>Пока пусто</td></tr>'}</table></div>`,
        });
      },
    },
  },
});
