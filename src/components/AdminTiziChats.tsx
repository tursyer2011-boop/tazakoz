import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, ChevronUp, MessageSquare } from "lucide-react";
import { getAdminTiziMessages, listAdminTiziThreads, type TiziMessage } from "@/lib/tizi.functions";
import { Button } from "@/components/ui/button";
import tiziAvatar from "@/assets/tizi-avatar.png";

function messageText(m: TiziMessage): string {
  return (m.parts as { type?: string; text?: string }[])
    .filter((p) => p.type === "text" && p.text)
    .map((p) => p.text)
    .join("\n");
}

export function AdminTiziChats() {
  const listFn = useServerFn(listAdminTiziThreads);
  const messagesFn = useServerFn(getAdminTiziMessages);
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: threads = [], isLoading } = useQuery({
    queryKey: ["admin-tizi-threads"],
    queryFn: () => listFn(),
  });

  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ["admin-tizi-messages", openId],
    queryFn: () => (openId ? messagesFn({ data: { threadId: openId } }) : Promise.resolve([])),
    enabled: !!openId,
  });

  if (isLoading) return <div className="h-40 animate-pulse rounded-2xl bg-muted" />;

  if (threads.length === 0) {
    return (
      <p className="rounded-2xl bg-secondary/50 p-4 text-center text-sm text-muted-foreground">
        Пока никто не общался с Тизи.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {threads.map((t) => {
        const open = openId === t.id;
        return (
          <li key={t.id} className="rounded-2xl bg-card p-3 shadow-sm">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                className="min-w-0 flex-1 justify-start gap-2 px-2 text-left"
                onClick={() => setOpenId(open ? null : t.id)}
              >
                <MessageSquare className="size-4 shrink-0 text-primary" strokeWidth={1.6} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{t.title}</span>
                  <span className="block text-xs text-muted-foreground">
                    {t.ownerName}
                    {t.ownerUsername ? ` @${t.ownerUsername}` : ""} · {t.messageCount} сообщ. ·{" "}
                    {new Date(t.updated_at).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </span>
                {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
              </Button>
            </div>
            {open && (
              <div className="mt-2 space-y-2 border-t border-border pt-2">
                {messagesLoading && <div className="h-20 animate-pulse rounded-xl bg-muted" />}
                {!messagesLoading && messages.length === 0 && (
                  <p className="text-sm text-muted-foreground">Сообщений нет.</p>
                )}
                {messages.map((m) => (
                  <div key={m.id} className="flex items-start gap-2 text-sm">
                    {m.role === "assistant" ? (
                      <img src={tiziAvatar} alt="Тизи" width={816} height={816} loading="lazy" className="mt-0.5 size-6 shrink-0 rounded-md bg-secondary object-cover" />
                    ) : (
                      <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/15 text-[0.65rem] font-bold text-primary">
                        {t.ownerName.slice(0, 1)}
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">
                        {m.role === "assistant" ? "Тизи" : t.ownerName} ·{" "}
                        {new Date(m.created_at).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </p>
                      <p className="whitespace-pre-wrap break-words">{messageText(m) || "…"}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
