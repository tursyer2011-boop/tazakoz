import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Приватные переписки текущего пользователя: только те, где он автор жалобы
 * или назначенный работник. Возвращает имя собеседника без лишних данных.
 */
export const getMyThreads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const { data: threads } = await supabaseAdmin
      .from("chat_threads")
      .select("id, subject, report_id, created_by, worker_id, status, last_message_at")
      .or(`created_by.eq.${userId},worker_id.eq.${userId}`)
      .order("last_message_at", { ascending: false })
      .limit(50);

    const list = threads ?? [];
    const otherIds = Array.from(
      new Set(
        list
          .map((t) => (t.created_by === userId ? t.worker_id : t.created_by))
          .filter((id): id is string => Boolean(id)),
      ),
    );
    const reportIds = Array.from(new Set(list.map((t) => t.report_id).filter((id): id is string => Boolean(id))));

    const [{ data: profiles }, { data: reports }] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, full_name, username")
        .in("id", otherIds.length ? otherIds : ["00000000-0000-0000-0000-000000000000"]),
      supabaseAdmin
        .from("reports")
        .select("id, address, water_body, status, photo_url, cleaned_photo_url")
        .in("id", reportIds.length ? reportIds : ["00000000-0000-0000-0000-000000000000"]),
    ]);

    return list.map((t) => {
      const otherId = t.created_by === userId ? t.worker_id : t.created_by;
      const other = (profiles ?? []).find((p) => p.id === otherId) ?? null;
      const report = (reports ?? []).find((r) => r.id === t.report_id) ?? null;
      return {
        id: t.id,
        subject: t.subject,
        lastMessageAt: t.last_message_at,
        iAmWorker: t.worker_id === userId,
        other: other
          ? { name: other.full_name || "Участник", username: other.username }
          : null,
        report: report
          ? {
              id: report.id,
              address: report.address || report.water_body || "",
              status: report.status,
              photoUrl: report.photo_url,
              cleanedPhotoUrl: report.cleaned_photo_url,
            }
          : null,
      };
    });
  });
