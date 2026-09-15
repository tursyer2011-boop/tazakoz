export type VisionVerdict = {
  is_real_photo: boolean;
  has_pollution: boolean;
  severity: "low" | "medium" | "high";
  reason: string;
};

export type CleanupVerdict = {
  is_real_photo: boolean;
  is_clean: boolean;
  same_place: boolean;
  reason: string;
};

async function callVision(system: string, user: string, images: string[]): Promise<unknown> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("ИИ-сервис не настроен");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
    body: JSON.stringify({
      model: "google/gemini-3.7-flash",
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: [
            { type: "text", text: user },
            ...images.map((url) => ({ type: "image_url", image_url: { url } })),
          ],
        },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    if (res.status === 429) throw new Error("Слишком много запросов. Попробуйте через минуту.");
    if (res.status === 402) throw new Error("Закончились кредиты ИИ.");
    throw new Error(`Ошибка ИИ-проверки: ${text.slice(0, 200)}`);
  }

  const payload = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  try {
    return JSON.parse(payload.choices?.[0]?.message?.content ?? "{}");
  } catch {
    throw new Error("ИИ вернул неожиданный ответ. Попробуйте ещё раз.");
  }
}

export async function analyzePollution(imageBase64: string, comment: string): Promise<VisionVerdict> {
  const verdict = (await callVision(
    "Ты — эксперт-эколог, проверяющий жалобы о загрязнении водоёмов Казахстана. Оцени фото строго: " +
      "1) is_real_photo — это настоящая фотография с камеры, а не AI-генерация, рендер, скриншот, рисунок или фотомонтаж; " +
      "2) has_pollution — видны ли признаки загрязнения воды или берега: мусор, пластик, мутная вода, нефтяная плёнка, пена, мёртвая рыба, свалка; " +
      "3) severity — low = единичный мусор; medium = заметное скопление; high = обширное загрязнение, нефтепродукты, массовая свалка, мёртвая рыба; " +
      "4) reason — одно короткое предложение на русском. Отвечай ТОЛЬКО JSON.",
    `Комментарий пользователя: ${comment || "нет"}. Верни JSON: is_real_photo (boolean), has_pollution (boolean), severity ("low"|"medium"|"high"), reason (string).`,
    [imageBase64],
  )) as VisionVerdict;

  return {
    is_real_photo: Boolean(verdict.is_real_photo),
    has_pollution: Boolean(verdict.has_pollution),
    severity: ["low", "medium", "high"].includes(verdict.severity) ? verdict.severity : "low",
    reason: verdict.reason || "",
  };
}

export async function analyzeCleanup(beforeImage: string, afterImage: string): Promise<CleanupVerdict> {
  const verdict = (await callVision(
    "Ты проверяешь работу службы уборки водоёмов. Первое фото — до уборки, второе — после. Оцени: " +
      "1) is_real_photo — второе фото настоящее, не сгенерировано и не взято из интернета; " +
      "2) same_place — это то же самое место; " +
      "3) is_clean — мусор и загрязнение действительно убраны; " +
      "4) reason — одно короткое предложение на русском. Отвечай ТОЛЬКО JSON.",
    "Верни JSON: is_real_photo (boolean), same_place (boolean), is_clean (boolean), reason (string).",
    [beforeImage, afterImage],
  )) as CleanupVerdict;

  return {
    is_real_photo: Boolean(verdict.is_real_photo),
    same_place: Boolean(verdict.same_place),
    is_clean: Boolean(verdict.is_clean),
    reason: verdict.reason || "",
  };
}

export async function reverseGeocode(lat: number, lng: number): Promise<{ address: string; water: string }> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=ru&zoom=18&addressdetails=1`,
      { headers: { "User-Agent": "TazaKoz/1.0 (https://tazakoz.online)" } },
    );
    if (!res.ok) return { address: "", water: "" };
    const data = (await res.json()) as {
      display_name?: string;
      address?: Record<string, string>;
    };
    const a = data.address ?? {};
    // Precise street-level line: house, street, microdistrict, city.
    const street = a["road"] ?? a["pedestrian"] ?? a["footway"] ?? a["residential"] ?? "";
    const house = a["house_number"] ?? "";
    const district = a["neighbourhood"] ?? a["quarter"] ?? a["suburb"] ?? a["city_district"] ?? "";
    const city = a["city"] ?? a["town"] ?? a["village"] ?? a["municipality"] ?? "";
    const parts = [
      street ? (house ? `${street}, ${house}` : street) : "",
      district,
      city,
    ].filter(Boolean);
    const short = Array.from(new Set(parts)).join(", ");
    return {
      address: short || data.display_name || "",
      water: a["water"] ?? a["river"] ?? a["lake"] ?? a["bay"] ?? a["reservoir"] ?? "",
    };
  } catch {
    return { address: "", water: "" };
  }
}
