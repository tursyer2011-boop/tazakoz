import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SubmitInput = z.object({
  imageBase64: z.string().min(100),
  photoPath: z.string().min(1),
  comment: z.string().max(600).default(""),
  lat: z.number(),
  lng: z.number(),
  region: z.string().max(80).default(""),
});

const CREDITS: Record<string, number> = { low: 10, medium: 25, high: 50 };

type Verdict = {
  is_real_photo: boolean;
  has_pollution: boolean;
  severity: "low" | "medium" | "high";
  reason: string;
};

export const submitReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => SubmitInput.parse(data))
  .handler(async ({ data, context }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI сервис не настроен");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
      },
      body: JSON.stringify({
        model: "google/gemini-3.7-flash",
        messages: [
          {
            role: "system",
            content:
              "Ты — эксперт-эколог, проверяющий жалобы о загрязнении водоёмов Казахстана. Оцени фото строго: " +
              "1) is_real_photo — это настоящая фотография с камеры, а не AI-генерация, рендер, скриншот, рисунок или явный фотомонтаж; " +
              "2) has_pollution — видны ли признаки загрязнения воды или берега: мусор, пластик, мутная/тёмная вода, нефтяная плёнка, пена, мёртвая рыба, свалка у воды; " +
              "3) severity — масштаб: low = единичный мусор, малая площадь, экосистеме почти не вредит; medium = заметное скопление мусора или помутнение на средней площади; high = обширное загрязнение, нефтепродукты, массовая свалка, мёртвая рыба, явный вред экосистеме; " +
              "4) reason — одно короткое предложение на русском языке. Отвечай ТОЛЬКО JSON.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Комментарий пользователя: ${data.comment || "нет"}. Проверь фото и верни JSON с полями is_real_photo (boolean), has_pollution (boolean), severity ("low"|"medium"|"high"), reason (string).`,
              },
              { type: "image_url", image_url: { url: data.imageBase64 } },
            ],
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      if (res.status === 429) throw new Error("Слишком много запросов. Попробуйте через минуту.");
      if (res.status === 402) throw new Error("Закончились кредиты ИИ. Пополните баланс в настройках проекта.");
      throw new Error(`Ошибка ИИ-проверки: ${text.slice(0, 200)}`);
    }

    const payload = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = payload.choices?.[0]?.message?.content ?? "{}";
    let verdict: Verdict;
    try {
      verdict = JSON.parse(raw) as Verdict;
    } catch {
      throw new Error("ИИ вернул неожиданный ответ. Попробуйте ещё раз.");
    }

    const approved = Boolean(verdict.is_real_photo && verdict.has_pollution);
    const severity = ["low", "medium", "high"].includes(verdict.severity) ? verdict.severity : "low";
    const credits = approved ? (CREDITS[severity] ?? 10) : 0;
    const reason =
      verdict.reason ||
      (approved ? "Загрязнение подтверждено." : "Загрязнение на фото не подтверждено.");

    const { data: report, error } = await context.supabase
      .from("reports")
      .insert({
        user_id: context.userId,
        photo_url: data.photoPath,
        comment: data.comment,
        lat: data.lat,
        lng: data.lng,
        region: data.region,
        severity,
        status: "new",
        approved,
        ai_reason: reason,
        credits_awarded: credits,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    const { data: profile } = await context.supabase
      .from("profiles")
      .select("credits, total_credits, approved_count, rejected_count")
      .eq("id", context.userId)
      .maybeSingle();

    if (profile) {
      await context.supabase
        .from("profiles")
        .update({
          credits: profile.credits + credits,
          total_credits: profile.total_credits + credits,
          approved_count: profile.approved_count + (approved ? 1 : 0),
          rejected_count: profile.rejected_count + (approved ? 0 : 1),
        })
        .eq("id", context.userId);
    }

    return { approved, severity, reason, credits, reportId: report.id };
  });