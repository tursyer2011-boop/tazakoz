import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMapKey = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const key = process.env['TWOGIS_BROWSER_KEY'];
    if (!key) throw new Error("Ключ карты 2ГИС не настроен");
    // MapGL requires its browser rendering key in the browser; no other credentials are returned.
    return { key };
  });

export type MapWeather = { temperature: number; description: string; type: string };
let cached: { until: number; value: MapWeather } | undefined;

export const getMapWeather = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<MapWeather> => {
    if (cached && cached.until > Date.now()) return cached.value;
    const gatewayKey = process.env['LOVABLE_API_KEY'];
    const connectionKey = process.env['GOOGLE_MAPS_API_KEY'];
    if (!gatewayKey || !connectionKey) throw new Error("Сервис погоды не подключён");
    // Fixed Aktau location: never follows the map outside Mangystau.
    const response = await fetch("https://connector-gateway.lovable.dev/google_maps/weather/v1/currentConditions:lookup?location.latitude=43.6512&location.longitude=51.1575&unitsSystem=METRIC&languageCode=ru", {
      headers: { Authorization: `Bearer ${gatewayKey}`, 'X-Connection-Api-Key': connectionKey },
    });
    if (!response.ok) {
      const body = await response.text();
      console.error(`Weather request failed [${response.status}]: ${body}`);
      throw new Error(`Погода недоступна [${response.status}]: ${body}`);
    }
    const data = await response.json() as { temperature?: { degrees?: number }; weatherCondition?: { type?: string; description?: { text?: string } } };
    if (typeof data.temperature?.degrees !== 'number') throw new Error("Нет данных о температуре");
    const value = { temperature: data.temperature.degrees, description: data.weatherCondition?.description?.text ?? "", type: data.weatherCondition?.type ?? "" };
    cached = { until: Date.now() + 600_000, value };
    return value;
  });