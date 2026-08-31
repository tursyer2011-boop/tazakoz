import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const UsernameInput = z.object({ username: z.string().trim().min(1).max(24) });
const LimitInput = z.object({ limit: z.number().int().min(1).max(100).optional() });

/** Рейтинг участников (без админов и модераторов). Только для вошедших. */
export const getLeaderboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => LimitInput.parse(data ?? {}))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("get_leaderboard" as never, {
      _limit: data.limit ?? 100,
    } as never);
    if (error) throw new Error(error.message);
    return (rows ?? []) as Array<{
      id: string;
      full_name: string;
      city: string;
      total_credits: number;
      approved_count: number;
    }>;
  });

/** Проверка свободен ли @никнейм (нужна на экране регистрации). */
export const checkUsernameAvailable = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => UsernameInput.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: available, error } = await supabaseAdmin.rpc("username_available" as never, {
      _username: data.username,
    } as never);
    if (error) throw new Error(error.message);
    return { available: Boolean(available) };
  });
