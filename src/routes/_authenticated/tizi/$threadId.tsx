import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { ArrowLeft, Bus, Car, Footprints } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getTiziMessages } from "@/lib/tizi.functions";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from "@/components/ai-elements/tool";
import { Shimmer } from "@/components/ai-elements/shimmer";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import tiziAvatar from "@/assets/tizi-avatar.png";

export const Route = createFileRoute("/_authenticated/tizi/$threadId")({
  head: () => ({
    meta: [
      { title: "Разговор с Тизи — TAZA KÖZ" },
      { name: "description", content: "Чат с Тизи — эко-помощником и навигатором Мангистауской области." },
      { property: "og:title", content: "Разговор с Тизи — TAZA KÖZ" },
      { property: "og:description", content: "Вопросы об экологии и маршруты по Мангистау." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TiziChatPage,
});

type RouteOutput =
  | { ok: true; mode: "walk" | "car" | "bus"; fromName: string; toName: string; distanceKm: number; durationMin: number; details: string }
  | { ok: false; error: string };

const MODE_LABELS = { walk: "Пешком", car: "На машине", bus: "На автобусе" } as const;
const MODE_ICONS = { walk: Footprints, car: Car, bus: Bus } as const;

function shortPlace(name: string) {
  return name.split(",").slice(0, 2).join(",").trim();
}

function RouteCard({ output }: { output: RouteOutput }) {
  if (!output.ok) {
    return <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{output.error}</p>;
  }
  const Icon = MODE_ICONS[output.mode] ?? Car;
  return (
    <div className="space-y-2 rounded-2xl bg-secondary/60 p-4">
      <div className="flex items-center gap-2 font-medium">
        <span className="flex size-9 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Icon className="size-5" strokeWidth={1.6} />
        </span>
        <span>{MODE_LABELS[output.mode] ?? "Маршрут"}</span>
      </div>
      <p className="text-sm">
        <span className="font-medium">{shortPlace(output.fromName)}</span>
        <span className="text-muted-foreground"> → </span>
        <span className="font-medium">{shortPlace(output.toName)}</span>
      </p>
      <p className="text-sm text-muted-foreground">
        {output.distanceKm} км · примерно {output.durationMin} мин
      </p>
      <p className="text-xs text-muted-foreground">{output.details}</p>
    </div>
  );
}

function TiziChatPage() {
  const { threadId } = Route.useParams();
  const getMessages = useServerFn(getTiziMessages);
  const { data: initial, isLoading } = useQuery({
    queryKey: ["tizi-messages", threadId],
    queryFn: () => getMessages({ data: { threadId } }),
  });

  if (isLoading || !initial) {
    return (
      <div className="mx-auto flex h-[calc(100dvh-9.5rem)] max-w-lg items-center justify-center">
        <Shimmer className="text-sm">Тизи просыпается…</Shimmer>
      </div>
    );
  }

  return <ChatWindow key={threadId} threadId={threadId} initial={initial} />;
}

function ChatWindow({
  threadId,
  initial,
}: {
  threadId: string;
  initial: { id: string; role: "user" | "assistant"; parts: unknown[] }[];
}) {
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setToken(data.session?.access_token ?? null));
  }, []);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/tizi/chat",
        body: { threadId },
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }),
    [threadId, token],
  );

  const initialMessages = useMemo<UIMessage[]>(
    () => initial.map((m) => ({ id: `m-${m.id}`, role: m.role, parts: m.parts as UIMessage["parts"] })),
    [initial],
  );

  const { messages, sendMessage, status, stop } = useChat({
    id: threadId,
    transport,
    messages: initialMessages,
    onError: (error) => {
      toast.error(error.message || "Тизи не смог ответить. Попробуйте ещё раз.");
    },
  });

  const busy = status === "submitted" || status === "streaming";
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!busy) composerRef.current?.focus();
  }, [busy]);

  return (
    <div className="mx-auto flex h-[calc(100dvh-9.5rem)] max-w-lg flex-col">
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <Link to="/tizi" aria-label="К списку разговоров" className="text-muted-foreground">
          <ArrowLeft className="size-5" strokeWidth={1.6} />
        </Link>
        <img src={tiziAvatar} alt="Тизи" width={816} height={816} loading="lazy" className="size-9 rounded-xl bg-secondary object-cover" />
        <div>
          <p className="font-semibold leading-tight">Тизи</p>
          <p className="text-xs text-muted-foreground">эко-помощник · навигатор</p>
        </div>
      </div>

      <Conversation className="flex-1">
        <ConversationContent className="gap-4 px-4">
          {messages.length === 0 && (
            <ConversationEmptyState
              icon={<img src={tiziAvatar} alt="Тизи" width={816} height={816} loading="lazy" className="size-20 rounded-3xl bg-secondary object-cover" />}
              title="Сәлем! Я Тизи"
              description="Спросите об экологии, платформе или попросите маршрут: «Как доехать от Актау до Жанаозена на автобусе?»"
            />
          )}
          {messages.map((message) => (
            <Message key={message.id} from={message.role}>
              {message.role === "assistant" && (
                <img src={tiziAvatar} alt="" width={816} height={816} loading="lazy" className="mt-1 size-7 shrink-0 rounded-lg bg-secondary object-cover" />
              )}
              <MessageContent>
                {message.parts.map((part, index) => {
                  if (part.type === "text") {
                    return <MessageResponse key={index}>{part.text}</MessageResponse>;
                  }
                  if (part.type === "tool-build_route") {
                    return (
                      <Tool key={index} defaultOpen={false}>
                        <ToolHeader type="tool-build_route" state={part.state} title="Маршрут 2ГИС" />
                        <ToolContent>
                          <ToolInput input={part.input} />
                          {part.state === "output-available" && (
                            <>
                              <RouteCard output={part.output as RouteOutput} />
                              <ToolOutput output={undefined} errorText={undefined} />
                            </>
                          )}
                          {part.state === "output-error" && (
                            <ToolOutput output={undefined} errorText={part.errorText} />
                          )}
                        </ToolContent>
                      </Tool>
                    );
                  }
                  return null;
                })}
                {message.role === "assistant" && busy && message.id === messages[messages.length - 1]?.id && (
                  <Shimmer className="text-xs">Тизи думает…</Shimmer>
                )}
              </MessageContent>
            </Message>
          ))}
          {status === "submitted" && (
            <Message from="assistant">
              <img src={tiziAvatar} alt="" width={816} height={816} loading="lazy" className="mt-1 size-7 shrink-0 rounded-lg bg-secondary object-cover" />
              <MessageContent>
                <Shimmer className="text-sm">Тизи думает…</Shimmer>
              </MessageContent>
            </Message>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="px-4 pb-2">
        <PromptInput
          onSubmit={(msg) => {
            const text = msg.text.trim();
            if (!text || busy) return;
            void sendMessage({ text });
          }}
        >
          <PromptInputTextarea
            ref={composerRef}
            placeholder="Спросите Тизи…"
            disabled={!token}
            autoFocus
          />
          <PromptInputFooter className="justify-end">
            <PromptInputSubmit status={status} disabled={!token} onStop={stop} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}
