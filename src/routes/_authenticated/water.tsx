import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Droplets, Thermometer, Wind } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { REGIONS } from "@/lib/regions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/water")({
  head: () => ({
    meta: [
      { title: "Погода и вода — TAZA KÖZ" },
      { name: "description", content: "Погода по регионам Казахстана и данные по водоёмам." },
      { property: "og:title", content: "Погода и вода — TAZA KÖZ" },
      { property: "og:description", content: "Температура воздуха, ветер и последние замеры по водоёмам." },
    ],
  }),
  component: WaterPage,
});

function WaterPage() {
  const [city, setCity] = useState(REGIONS[0]!.name);
  const region = REGIONS.find((r) => r.name === city)!;

  const { data: weather, isLoading } = useQuery({
    queryKey: ["weather", city],
    queryFn: async () => {
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${region.lat}&longitude=${region.lng}&current=temperature_2m,wind_speed_10m,relative_humidity_2m&daily=temperature_2m_max,temperature_2m_min&timezone=auto`,
      );
      if (!res.ok) throw new Error("Не удалось получить погоду");
      return (await res.json()) as {
        current: { temperature_2m: number; wind_speed_10m: number; relative_humidity_2m: number };
        daily: { time: string[]; temperature_2m_max: number[]; temperature_2m_min: number[] };
      };
    },
  });

  const { data: recent = [] } = useQuery({
    queryKey: ["recent-reports", city],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("id, region, severity, created_at, comment")
        .eq("approved", true)
        .eq("region", city)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  return (
    <main className="mx-auto max-w-lg space-y-4 px-4 py-6">
      <h1 className="flex items-center gap-2 text-xl font-semibold">
        <Droplets className="size-5 text-primary" /> Погода и вода
      </h1>

      <Select value={city} onValueChange={setCity}>
        <SelectTrigger className="h-12 w-full rounded-xl bg-card">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {REGIONS.map((r) => (
            <SelectItem key={r.name} value={r.name}>
              {r.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Воздух</p>
          <p className="mt-1 flex items-center gap-2 text-2xl font-semibold">
            <Thermometer className="size-5 text-primary" />
            {isLoading || !weather ? "—" : `${Math.round(weather.current.temperature_2m)}°`}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Ветер</p>
          <p className="mt-1 flex items-center gap-2 text-2xl font-semibold">
            <Wind className="size-5 text-primary" />
            {isLoading || !weather ? "—" : `${Math.round(weather.current.wind_speed_10m)} м/с`}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="text-xs text-muted-foreground">Температура воды</p>
        <p className="mt-1 text-2xl font-semibold text-muted-foreground">Скоро</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Данные датчиков водоёмов появятся позже.
        </p>
      </div>

      {weather && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="mb-2 text-sm font-medium">Прогноз</p>
          <ul className="space-y-1.5">
            {weather.daily.time.slice(0, 5).map((d, i) => (
              <li key={d} className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {new Date(d).toLocaleDateString("ru-RU", { weekday: "short", day: "numeric" })}
                </span>
                <span>
                  {Math.round(weather.daily.temperature_2m_min[i] ?? 0)}° /{" "}
                  {Math.round(weather.daily.temperature_2m_max[i] ?? 0)}°
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="mb-2 text-sm font-medium">Последние замеры по региону</p>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">Пока нет данных по этому региону.</p>
        ) : (
          <ul className="space-y-2">
            {recent.map((r) => (
              <li key={r.id} className="flex justify-between gap-3 text-sm">
                <span className="truncate text-muted-foreground">{r.comment || "Без описания"}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleDateString("ru-RU")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}