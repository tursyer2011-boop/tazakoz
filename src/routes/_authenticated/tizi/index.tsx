import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MessageSquarePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createTiziThread, deleteTiziThread, listTiziThreads } from "@/lib/tizi.functions";
import { Button } from "@/components/ui/button";
import tiziAvatar from "@/assets/tizi-avatar.png";

export const Route = createFileRoute("/_authenticated/tizi/")({
  head: () => ({
    meta: [
      { title: "Тизи — ИИ-помощник TAZA KÖZ" },
      { name: "description", content: "Разговоры с Тизи — эко-помощником и навигатором Мангистауской области." },
      { property: "og:title", content: "Тизи — ИИ-помощник TAZA KÖZ" },
      { property: "og:description", content: "Спросите Тизи об экологии, платформе или попросите построить маршрут." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TiziThreadsPage,
});

function TiziThreadsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const listFn = useServerFn(listTiziThreads);
  const createFn = useServerFn(createTiziThread);
  const deleteFn = useServerFn(deleteTiziThread);

  const { data: threads = [], isLoading } = useQuery({
    queryKey: ["tizi-threads"],
    queryFn: () => listFn(),
  });

  const createMutation = useMutation({
    mutationFn: () => createFn(),
    onSuccess: ({ id }) => {
      void queryClient.invalidateQueries({ queryKey: ["tizi-threads"] });
      navigate({ to: "/tizi/$threadId", params: { threadId: id } });
    },
    onError: () => toast.error("Не удалось создать разговор"),
  });

  const deleteMutation = useMutation({
    mutationFn: (threadId: string) => deleteFn({ data: { threadId } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tizi-threads"] });
      toast.success("Разговор удалён");
    },
    onError: () => toast.error("Не удалось удалить разговор"),
  });

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 pt-6 pb-28">
      <div className="flex items-center gap-3">
        <img src={tiziAvatar} alt="Тизи" width={816} height={816} loading="lazy" className="size-14 rounded-2xl bg-secondary object-cover" />
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold">Тизи</h1>
          <p className="text-sm text-muted-foreground">Эко-помощник и навигатор Мангистау</p>
        </div>
      </div>

      <Button
        className="h-12 w-full rounded-xl"
        disabled={createMutation.isPending}
        onClick={() => createMutation.mutate()}
      >
        <MessageSquarePlus className="size-5" strokeWidth={1.6} />
        Новый разговор
      </Button>

      {isLoading && <div className="h-40 animate-pulse rounded-2xl bg-muted" />}

      {!isLoading && threads.length === 0 && (
        <p className="rounded-2xl bg-secondary/50 p-4 text-center text-sm text-muted-foreground">
          Пока нет разговоров. Начните новый — Тизи ответит на вопросы и построит маршрут пешком, на машине или на автобусе.
        </p>
      )}

      <ul className="space-y-2">
        {threads.map((t) => (
          <li key={t.id} className="flex items-center gap-2 rounded-2xl bg-card p-3 shadow-sm">
            <button
              type="button"
              className="min-w-0 flex-1 text-left"
              onClick={() => navigate({ to: "/tizi/$threadId", params: { threadId: t.id } })}
            >
              <p className="truncate font-medium">{t.title}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(t.updated_at).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
              </p>
            </button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Удалить разговор"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate(t.id)}
            >
              <Trash2 className="size-4 text-destructive" strokeWidth={1.6} />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
