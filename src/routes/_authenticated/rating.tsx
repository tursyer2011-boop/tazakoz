import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";

export const Route = createFileRoute("/_authenticated/rating")({
  head: () => ({
    meta: [
      { title: "Рейтинг участников — TAZA KÖZ" },
      { name: "description", content: "Топ пользователей TAZA KÖZ по накопленным кредитам." },
      { property: "og:title", content: "Рейтинг участников — TAZA KÖZ" },
      { property: "og:description", content: "Кто больше всех защищает водоёмы Казахстана." },
    ],
  }),
  component: RatingPage,
});

type Row = {
  id: string;
  full_name: string;
  city: string;
  total_credits: number;
  approved_count: number;
};

function RatingPage() {
  const { user } = useSession();
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["rating"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_leaderboard", { _limit: 100 });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const myIndex = rows.findIndex((r) => r.id === user?.id);
  const me = myIndex >= 0 ? rows[myIndex] : null;

  return (
    <main className="mx-auto max-w-lg space-y-4 px-4 py-6">
      <h1 className="flex items-center gap-2 text-xl font-semibold">
        <Trophy className="size-5 text-primary" /> Рейтинг
      </h1>

      {me && <RowCard row={me} place={myIndex + 1} highlight />}

      {isLoading && <p className="text-sm text-muted-foreground">Загрузка...</p>}
      {!isLoading && rows.length === 0 && (
        <p className="text-sm text-muted-foreground">Пока никого нет — станьте первым!</p>
      )}

      <ul className="space-y-2">
        {rows.map((r, i) => (r.id === user?.id ? null : (
          <li key={r.id}>
            <RowCard row={r} place={i + 1} />
          </li>
        )))}
      </ul>
    </main>
  );
}

function RowCard({ row, place, highlight }: { row: Row; place: number; highlight?: boolean }) {
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border p-3 ${
        highlight ? "border-primary bg-secondary" : "border-border bg-card"
      }`}
    >
      <span className="w-7 text-center text-sm font-semibold text-muted-foreground">{place}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{row.full_name || "Без имени"}</p>
        <p className="truncate text-xs text-muted-foreground">
          {row.city || "—"} · {row.approved_count} подтверждённых
        </p>
      </div>
      <span className="text-brand-gradient text-base font-semibold">{row.total_credits}</span>
    </div>
  );
}