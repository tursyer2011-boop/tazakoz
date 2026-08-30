import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ImagePlus, Lock, LoaderCircle, MessagesSquare, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { getMyThreads } from "@/lib/chat.functions";
import { ReportPhoto } from "@/components/ReportPhoto";
import { NotifyPermissionCard } from "@/components/NotifyPermissionCard";
import { pushNotify } from "@/lib/notify";
import { resizeImage } from "@/lib/photos";
import { REPORT_STATUS_LABELS } from "@/lib/credits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const PHOTO_PREFIX = "[photo]";

type ChatSearch = { thread?: string };

export const Route = createFileRoute("/_authenticated/chat")({
  validateSearch: (search: Record<string, unknown>): ChatSearch => ({
    thread: typeof search['thread'] === "string" ? (search['thread'] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Чат — TAZA KÖZ" },
      {
        name: "description",
        content: "Приватная переписка жителя и работника TAZA KÖZ по конкретной жалобе: фото до и после уборки.",
      },
      { property: "og:title", content: "Чат — TAZA KÖZ" },
      { property: "og:description", content: "Личная переписка по заявке: только вы и ваш работник." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChatPage,
});

function ChatPage() {
  const { data: me } = useProfile();
  const navigate = useNavigate({ from: "/chat" });
  const search = Route.useSearch();
  const loadThreads = useServerFn(getMyThreads);
  const activeId = search.thread ?? null;

  const threads = useQuery({
    queryKey: ["chat-threads", me?.user.id],
    enabled: Boolean(me?.user.id),
    refetchInterval: 20_000,
    queryFn: () => loadThreads({}),
  });

  const active = (threads.data ?? []).find((t) => t.id === activeId) ?? null;

  if (!activeId || !active) {
    return (
      <main className="mx-auto max-w-lg space-y-4 px-4 py-6">
        <div>
          <h1 className="text-xl font-semibold">Чат по заявкам</h1>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Lock className="size-3" /> Переписку видят только вы и второй участник заявки
          </p>
        </div>
        <NotifyPermissionCard text="Включите уведомления, чтобы не пропускать новые сообщения по заявке." />
        {threads.isLoading && <LoaderCircle className="mx-auto size-5 animate-spin text-primary" />}
        {(threads.data ?? []).length === 0 && !threads.isLoading && (
          <p className="glass-card rounded-3xl p-6 text-center text-sm text-muted-foreground">
            <MessagesSquare className="mx-auto mb-2 size-8" strokeWidth={1.4} />
            Переписок пока нет. Чат открывается автоматически, когда работник берёт вашу жалобу в работу.
          </p>
        )}
        <ul className="space-y-2">
          {(threads.data ?? []).map((t) => (
            <li key={t.id}>
              <button
                onClick={() => navigate({ search: { thread: t.id } })}
                className="glass-card w-full rounded-2xl p-4 text-left text-sm"
              >
                <p className="font-medium">{t.subject}</p>
                <p className="text-xs text-muted-foreground">
                  {t.iAmWorker ? "Житель" : "Работник"}:{" "}
                  {t.other ? (t.other.username ? `@${t.other.username}` : t.other.name) : "ожидается"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(t.lastMessageAt).toLocaleString("ru-RU")}
                </p>
              </button>
            </li>
          ))}
        </ul>
      </main>
    );
  }

  return <ThreadView key={active.id} thread={active} onBack={() => navigate({ search: {} })} meId={me?.user.id} />;
}

type Thread = NonNullable<ReturnType<typeof useThreadType>>;
function useThreadType() {
  return null as unknown as Awaited<ReturnType<typeof getMyThreads>>[number] | null;
}

function ThreadView({
  thread,
  onBack,
  meId,
}: {
  thread: Thread;
  onBack: () => void;
  meId: string | undefined;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const seen = useRef<Set<string> | null>(null);

  const messages = useQuery({
    queryKey: ["chat-messages", thread.id],
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("thread_id", thread.id)
        .order("created_at", { ascending: true })
        .limit(300);
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`chat-${thread.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `thread_id=eq.${thread.id}` },
        () => queryClient.invalidateQueries({ queryKey: ["chat-messages", thread.id] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [thread.id, queryClient]);

  // Уведомление о новых сообщениях собеседника.
  useEffect(() => {
    const list = messages.data;
    if (!list) return;
    if (seen.current === null) {
      seen.current = new Set(list.map((m) => m.id));
      return;
    }
    for (const m of list) {
      if (seen.current.has(m.id) || m.sender_id === meId) continue;
      pushNotify("Новое сообщение по заявке", {
        body: m.body.startsWith(PHOTO_PREFIX) ? "Прислано фото" : m.body.slice(0, 120),
        tag: `chat-${thread.id}`,
        url: `/chat?thread=${thread.id}`,
      });
    }
    seen.current = new Set(list.map((m) => m.id));
  }, [messages.data, meId, thread.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.data]);

  async function sendBody(body: string) {
    if (!body || !meId) return;
    setSending(true);
    const { error } = await supabase
      .from("chat_messages")
      .insert({ thread_id: thread.id, sender_id: meId, body });
    setSending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setDraft("");
    await supabase.from("chat_threads").update({ last_message_at: new Date().toISOString() }).eq("id", thread.id);
    await messages.refetch();
  }

  async function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !meId) return;
    setSending(true);
    try {
      const { blob } = await resizeImage(file, 1400);
      const path = `${meId}/chat-${crypto.randomUUID()}.jpg`;
      const { error } = await supabase.storage.from("reports").upload(path, blob, { contentType: "image/jpeg" });
      if (error) throw error;
      await sendBody(`${PHOTO_PREFIX}${path}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось отправить фото");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="mx-auto flex h-[calc(100dvh-5rem)] max-w-lg flex-col px-4 py-4">
      <button onClick={onBack} className="mb-2 self-start text-sm text-muted-foreground">
        ← Все переписки
      </button>
      <div className="glass-card mb-2 rounded-2xl p-3">
        <p className="text-sm font-medium">
          {thread.iAmWorker ? "Житель" : "Работник"}:{" "}
          {thread.other ? (thread.other.username ? `@${thread.other.username}` : thread.other.name) : "ожидается"}
        </p>
        {thread.report && (
          <p className="text-xs text-muted-foreground">
            {thread.report.address} · {REPORT_STATUS_LABELS[thread.report.status] ?? thread.report.status}
          </p>
        )}
        <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
          <Lock className="size-3" /> Приватно: сообщения и фото видны только вам двоим
        </p>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto pb-2">
        {(messages.data ?? []).map((m) => {
          const mine = m.sender_id === meId;
          const isPhoto = m.body.startsWith(PHOTO_PREFIX);
          return (
            <div
              key={m.id}
              className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-brand-gradient ml-auto text-primary-foreground" : "glass-card"}`}
            >
              {isPhoto ? (
                <ReportPhoto
                  path={m.body.slice(PHOTO_PREFIX.length)}
                  alt="Фото в переписке"
                  className="aspect-video w-56 rounded-xl object-cover"
                />
              ) : (
                m.body
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const body = draft.trim();
          if (body && !sending) void sendBody(body);
        }}
        className="flex gap-2 pt-2"
      >
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickPhoto} />
        <Button
          type="button"
          variant="secondary"
          aria-label="Отправить фото"
          disabled={sending}
          onClick={() => fileRef.current?.click()}
          className="size-11 shrink-0 rounded-xl p-0"
        >
          <ImagePlus className="size-4" />
        </Button>
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Сообщение..."
          maxLength={2000}
          className="h-11 rounded-xl"
        />
        <Button type="submit" aria-label="Отправить сообщение" disabled={sending} className="size-11 shrink-0 rounded-xl p-0">
          {sending ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}
        </Button>
      </form>
    </main>
  );
}
