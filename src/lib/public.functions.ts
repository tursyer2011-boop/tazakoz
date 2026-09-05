import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const UsernameInput = z.object({ username: z.string().trim().min(1).max(24) });
const LimitInput = z.object({ limit: z.number().int().min(1).max(500).optional() });

const USERNAME_RE = /^[a-zA-Z0-9_.]{3,24}$/;

export type LeaderboardRow = {
  id: string;
  full_name: string;
  city: string;
  total_credits: number;
  approved_count: number;
};

/** Рейтинг участников (без админов и модераторов). Только для вошедших. */
export const getLeaderboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => LimitInput.parse(data ?? {}))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const limit = data.limit ?? 100;

    const [{ data: staff }, { data: rows }] = await Promise.all([
      supabaseAdmin.from("user_roles").select("user_id").in("role", ["admin", "moderator"]),
      supabaseAdmin
        .from("profiles")
        .select("id, full_name, city, total_credits, approved_count")
        .order("total_credits", { ascending: false })
        .limit(limit + 100),
    ]);

    const excluded = new Set((staff ?? []).map((r) => r.user_id));
    return ((rows ?? []) as LeaderboardRow[]).filter((r) => !excluded.has(r.id)).slice(0, limit);
  });

/** Проверка свободен ли @никнейм (нужна на экране регистрации). */
export const checkUsernameAvailable = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => UsernameInput.parse(data))
  .handler(async ({ data }) => {
    const username = data.username.trim();
    if (!USERNAME_RE.test(username)) return { available: false };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .ilike("username", username)
      .maybeSingle();
    return { available: !existing };
  });
