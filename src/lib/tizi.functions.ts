import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type TiziThread = {
  id: string;
  title: string;
  updated_at: string;
};

export type TiziMessage = {
  id: string;
  role: "user" | "assistant";
  parts: unknown[];
  created_at: string;
};

export const listTiziThreads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("tizi_threads")
      .select("id, title, updated_at")
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false })
      .limit(100);
    if (error) throw new Error("Не удалось загрузить разговоры");
    return (data ?? []) as TiziThread[];
  });

export const createTiziThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("tizi_threads")
      .insert({ user_id: context.userId })
      .select("id")
      .single();
    if (error || !data) throw new Error("Не удалось создать разговор");
    return { id: data.id as string };
  });

export const getTiziMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ threadId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: thread } = await context.supabase
      .from("tizi_threads")
      .select("id")
      .eq("id", data.threadId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!thread) throw new Error("Разговор не найден");
    const { data: rows, error } = await context.supabase
      .from("tizi_messages")
      .select("id, role, parts, created_at")
      .eq("thread_id", data.threadId)
      .order("created_at", { ascending: true })
      .limit(500);
    if (error) throw new Error("Не удалось загрузить сообщения");
    return (rows ?? []) as TiziMessage[];
  });

export const deleteTiziThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ threadId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("tizi_threads")
      .delete()
      .eq("id", data.threadId)
      .eq("user_id", context.userId);
    if (error) throw new Error("Не удалось удалить разговор");
    return { ok: true };
  });

async function requireStaff(supabase: { from: (t: string) => any }, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .in("role", ["admin", "moderator"])
    .limit(1);
  if (!data || data.length === 0) throw new Error("Только для администраторов");
}

export type AdminTiziThread = TiziThread & {
  ownerName: string;
  ownerUsername: string | null;
  messageCount: number;
};

export const listAdminTiziThreads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: threads, error } = await supabaseAdmin
      .from("tizi_threads")
      .select("id, user_id, title, updated_at")
      .order("updated_at", { ascending: false })
      .limit(200);
    if (error) throw new Error("Не удалось загрузить разговоры");
    const list = threads ?? [];
    const ownerIds = Array.from(new Set(list.map((t) => t.user_id)));
    const threadIds = list.map((t) => t.id);
    const [{ data: profiles }, { data: messages }] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, full_name, username")
        .in("id", ownerIds.length ? ownerIds : ["00000000-0000-0000-0000-000000000000"]),
      supabaseAdmin
        .from("tizi_messages")
        .select("thread_id")
        .in("thread_id", threadIds.length ? threadIds : ["00000000-0000-0000-0000-000000000000"]),
    ]);
    const counts = new Map<string, number>();
    for (const m of messages ?? []) counts.set(m.thread_id, (counts.get(m.thread_id) ?? 0) + 1);
    return list.map((t): AdminTiziThread => {
      const owner = (profiles ?? []).find((p) => p.id === t.user_id);
      return {
        id: t.id,
        title: t.title,
        updated_at: t.updated_at,
        ownerName: owner?.full_name || "Участник",
        ownerUsername: owner?.username ?? null,
        messageCount: counts.get(t.id) ?? 0,
      };
    });
  });

export const getAdminTiziMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ threadId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await requireStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("tizi_messages")
      .select("id, role, parts, created_at")
      .eq("thread_id", data.threadId)
      .order("created_at", { ascending: true })
      .limit(500);
    if (error) throw new Error("Не удалось загрузить сообщения");
    return (rows ?? []) as TiziMessage[];
  });
