import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, MessagesSquare, Plus, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({
    meta: [
      { title: "Чат — TAZA KÖZ" },
      { name: "description", content: "Живая переписка с координаторами и работниками TAZA KÖZ по уборке водоёмов." },
      { property: "og:title", content: "Чат — TAZA KÖZ" },
      { property: "og:description", content: "Обсуждайте жалобы и уборку водоёмов в реальном времени." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChatPage,
});

function ChatPage() {
  const { data: me } = useProfile();
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const threads = useQuery({
    queryKey: ["chat-threads"],
    enabled: Boolean(me?.user.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_threads")
        .select("*")
        .order("last_message_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  const messages = useQuery({
    queryKey: ["chat-messages", activeId],
    enabled: Boolean(activeId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("thread_id", activeId!)
        .order("created_at", { ascending: true })
        .limit(300);
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!activeId) return;
    const channel = supabase
      .channel(`chat-${activeId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `thread_id=eq.${activeId}` },
        () => queryClient.invalidateQueries({ queryKey: ["chat-messages", activeId] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [activeId, queryClient]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.data]);

  async function createThread() {
    if (!me?.user.id) return;
    const { data, error } = await supabase
      .from("chat_threads")
      .insert({ created_by: me.user.id, subject: "Новое обращение" })
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    await threads.refetch();
    setActiveId(data.id);
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || !activeId || !me?.user.id || sending) return;
    setSending(true);
    const { error } = await supabase
      .from("chat_messages")
      .insert({ thread_id: activeId, sender_id: me.user.id, body });
    setSending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setDraft("");
    await supabase.from("chat_threads").update({ last_message_at: new Date().toISOString() }).eq("id", activeId);
    await messages.refetch();
  }

  if (!activeId) {
    return (
      <main className="mx-auto max-w-lg space-y-4 px-4 py-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Чат</h1>
          <Button size="sm" className="rounded-xl" onClick={createThread}>
            <Plus className="size-4" /> Новый
          </Button>
        </div>
        {threads.isLoading && <LoaderCircle className="mx-auto size-5 animate-spin text-primary" />}
        {(threads.data ?? []).length === 0 && !threads.isLoading && (
          <p className="glass-card rounded-3xl p-6 text-center text-sm text-muted-foreground">
            <MessagesSquare className="mx-auto mb-2 size-8" strokeWidth={1.4} />
            Обращений пока нет. Создайте новое, чтобы связаться с координатором.
          </p>
        )}
        <ul className="space-y-2">
          {(threads.data ?? []).map((t) => (
            <li key={t.id}>
              <button
                onClick={() => setActiveId(t.id)}
                className="glass-card w-full rounded-2xl p-4 text-left text-sm"
              >
                <p className="font-medium">{t.subject}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(t.last_message_at).toLocaleString("ru-RU")}
                </p>
              </button>
            </li>
          ))}
        </ul>
      </main>
    );
  }

  return (
    <main className="mx-auto flex h-[calc(100dvh-5rem)] max-w-lg flex-col px-4 py-4">
      <button onClick={() => setActiveId(null)} className="mb-3 self-start text-sm text-muted-foreground">
        ← Все обращения
      </button>
      <div className="flex-1 space-y-2 overflow-y-auto pb-2">
        {(messages.data ?? []).map((m) => {
          const mine = m.sender_id === me?.user.id;
          return (
            <div
              key={m.id}
              className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-brand-gradient ml-auto text-primary-foreground" : "glass-card"}`}
            >
              {m.body}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={send} className="flex gap-2 pt-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Сообщение..."
          maxLength={2000}
          className="h-11 rounded-xl"
        />
        <Button type="submit" aria-label="Отправить сообщение" disabled={sending} className="size-11 rounded-xl p-0">
          {sending ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}
        </Button>
      </form>
    </main>
  );
}
