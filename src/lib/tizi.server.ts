import { createOpenAI } from "@ai-sdk/openai";
import { convertToModelMessages, stepCountIs, streamText, tool, type UIMessage } from "ai";
import { z } from "zod";
import type { Json } from "@/integrations/supabase/types";
import {
  createLovableAiGatewayRunIdFetch,
  getLovableAiGatewayRunId,
  withLovableAiGatewayRunIdHeader,
} from "./tizi-run-id.server";

const TIZI_SYSTEM = `Ты — Тизи (TZ), дружелюбный эко-помощник платформы TAZA KÖZ. Платформа следит за чистотой водоёмов Мангистауской области и Каспийского моря (Актау, Жанаозен, Жетібай, Форт-Шевченко и другие города региона).

Твои возможности:
- отвечать на вопросы о платформе: жалобы на загрязнение, кредиты Taza Credits (1 кредит = 5 тенге, награды за жалобы 5/10/15), волонтёры и команды, пункты TZK, рейтинг, маркет;
- давать советы по экологии и чистоте водоёмов;
- строить маршруты по Мангистауской области через инструмент build_route: пешком (walk), на машине (car) и на автобусе (bus).

Правила:
- Всегда отвечай по-русски, коротко и дружелюбно, без лишней воды.
- Если пользователь просит маршрут — обязательно вызови build_route. Если точки непонятны, уточни названия мест.
- Если место вне Мангистауской области — честно скажи, что навигатор работает только по региону.
- Не выдумывай факты о платформе; если не знаешь — предложи написать в поддержку.`;

type GeoPoint = { lat: number; lon: number; name: string };

async function geocodePlace(query: string): Promise<GeoPoint | null> {
  try {
    const url =
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&accept-language=ru` +
      `&viewbox=50.0,46.5,56.0,41.5&bounded=1&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: { "User-Agent": "TazaKoz/1.0 (https://tazakoz.online)" } });
    if (!res.ok) return null;
    const data = (await res.json()) as { lat: string; lon: string; display_name: string }[];
    const first = data[0];
    if (!first) return null;
    return { lat: Number(first.lat), lon: Number(first.lon), name: first.display_name };
  } catch {
    return null;
  }
}

type RouteResult =
  | { ok: true; mode: string; fromName: string; toName: string; distanceKm: number; durationMin: number; details: string }
  | { ok: false; error: string };

async function routeCarOrWalk(key: string, from: GeoPoint, to: GeoPoint, mode: "car" | "walk"): Promise<RouteResult> {
  const endpoint = mode === "car" ? "carrouting" : "pedestrian";
  const res = await fetch(`https://routing.api.2gis.com/${endpoint}/6.0.0/global?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      points: [
        { type: "stop", lon: from.lon, lat: from.lat },
        { type: "stop", lon: to.lon, lat: to.lat },
      ],
      transport: mode === "car" ? "driving" : "walking",
      route_mode: "fastest",
      output: "summary",
    }),
  });
  if (!res.ok) return { ok: false, error: `Сервис маршрутов ответил ошибкой (${res.status})` };
  const data = (await res.json()) as { result?: { total_distance?: number; total_duration?: number }[] };
  const route = data.result?.[0];
  if (!route?.total_distance) return { ok: false, error: "Маршрут не найден между этими точками" };
  return {
    ok: true,
    mode,
    fromName: from.name,
    toName: to.name,
    distanceKm: Math.round((route.total_distance / 1000) * 10) / 10,
    durationMin: Math.round((route.total_duration ?? 0) / 60),
    details: mode === "car" ? "Самый быстрый автомобильный маршрут с учётом пробок." : "Пеший маршрут.",
  };
}

async function routeBus(key: string, from: GeoPoint, to: GeoPoint): Promise<RouteResult> {
  const res = await fetch(`https://routing.api.2gis.com/public_transport/6.0.0/global?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      source: { point: { lat: from.lat, lon: from.lon } },
      target: { point: { lat: to.lat, lon: to.lon } },
      transport: ["bus", "tram", "trolleybus", "shuttle_bus"],
      start_time: Math.floor(Date.now() / 1000),
    }),
  });
  if (!res.ok) return { ok: false, error: `Сервис маршрутов ответил ошибкой (${res.status})` };
  const data = (await res.json()) as {
    movements?: {
      distance?: number;
      moving_duration?: number;
      waiting_duration?: number;
      type?: string;
      routes?: { names?: string[] }[] | null;
    }[];
  }[];
  const route = data[0];
  if (!route?.movements?.length) return { ok: false, error: "Автобусный маршрут не найден между этими точками" };
  let distance = 0;
  let duration = 0;
  const lineNames = new Set<string>();
  for (const m of route.movements) {
    distance += m.distance ?? 0;
    duration += (m.moving_duration ?? 0) + (m.waiting_duration ?? 0);
    for (const r of m.routes ?? []) for (const n of r.names ?? []) lineNames.add(n);
  }
  const lines = Array.from(lineNames).slice(0, 5);
  return {
    ok: true,
    mode: "bus",
    fromName: from.name,
    toName: to.name,
    distanceKm: Math.round((distance / 1000) * 10) / 10,
    durationMin: Math.round(duration / 60),
    details: lines.length
      ? `Общественный транспорт: ${lines.join(", ")}. Время указано с учётом ожидания.`
      : "Общественный транспорт. Время указано с учётом ожидания.",
  };
}

async function buildRoute(fromQuery: string, toQuery: string, mode: "walk" | "car" | "bus"): Promise<RouteResult> {
  const key = process.env["TWOGIS_BROWSER_KEY"];
  if (!key) return { ok: false, error: "Сервис карт не настроен" };
  const [from, to] = await Promise.all([geocodePlace(fromQuery), geocodePlace(toQuery)]);
  if (!from) return { ok: false, error: `Не нашёл место «${fromQuery}» в Мангистауской области` };
  if (!to) return { ok: false, error: `Не нашёл место «${toQuery}» в Мангистауской области` };
  if (mode === "bus") return routeBus(key, from, to);
  return routeCarOrWalk(key, from, to, mode);
}

export async function handleTiziChat(request: Request): Promise<Response> {
  const authHeader = request.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return Response.json({ error: "Нужно войти в аккаунт" }, { status: 401 });

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  const userId = userData?.user?.id;
  if (userError || !userId) return Response.json({ error: "Сессия устарела, войдите снова" }, { status: 401 });

  let body: { threadId?: string; messages?: UIMessage[] };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Некорректный запрос" }, { status: 400 });
  }
  const threadId = body.threadId;
  const messages = body.messages;
  if (!threadId || !Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const { data: thread } = await supabaseAdmin
    .from("tizi_threads")
    .select("id, user_id, title")
    .eq("id", threadId)
    .maybeSingle();
  if (!thread || thread.user_id !== userId) {
    return Response.json({ error: "Разговор не найден" }, { status: 403 });
  }

  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUser) return Response.json({ error: "Некорректный запрос" }, { status: 400 });

  const userText = lastUser.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join(" ")
    .trim();

  const { error: insertError } = await supabaseAdmin.from("tizi_messages").insert({
    thread_id: threadId,
    user_id: userId,
    role: "user",
    parts: lastUser.parts as unknown as Json,
  });
  if (insertError) return Response.json({ error: "Не удалось сохранить сообщение" }, { status: 500 });

  const titleUpdate: { updated_at: string; title?: string } = { updated_at: new Date().toISOString() };
  if (thread.title === "Новый разговор" && userText) {
    titleUpdate.title = userText.slice(0, 60);
  }
  await supabaseAdmin.from("tizi_threads").update(titleUpdate).eq("id", threadId);

  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return Response.json({ error: "ИИ-сервис не настроен" }, { status: 500 });

  const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(request));
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });

  const modelMessages = await convertToModelMessages(messages);
  const result = streamText({
    model: provider.responses("openai/gpt-6-astra"),
    system: TIZI_SYSTEM,
    messages: modelMessages,
    abortSignal: request.signal,
    stopWhen: stepCountIs(5),
    tools: {
      build_route: tool({
        description:
          "Построить маршрут между двумя местами в Мангистауской области. Режимы: walk — пешком, car — на машине, bus — на автобусе/общественном транспорте.",
        inputSchema: z.object({
          from: z.string().describe("Откуда: название места, улицы или города"),
          to: z.string().describe("Куда: название места, улицы или города"),
          mode: z.enum(["walk", "car", "bus"]).describe("Режим: walk пешком, car машина, bus автобус"),
        }),
        execute: async ({ from, to, mode }) => buildRoute(from, to, mode),
      }),
    },
    providerOptions: {
      openai: {
        store: false,
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        include: ["reasoning.encrypted_content"],
      },
    },
  });

  const response = result.toUIMessageStreamResponse({
    originalMessages: messages,
    sendReasoning: true,
    onFinish: async ({ responseMessage }) => {
      const { error } = await supabaseAdmin.from("tizi_messages").insert({
        thread_id: threadId,
        user_id: userId,
        role: "assistant",
        parts: responseMessage.parts as unknown as Json,
      });
      if (error) console.error("tizi: failed to save assistant message", error.message);
    },
  });

  return withLovableAiGatewayRunIdHeader(response, runIdFetch);
}
