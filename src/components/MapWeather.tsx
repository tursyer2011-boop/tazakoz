import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Cloud, CloudRain, CloudSnow, CloudSun, CloudLightning, Sun, RefreshCw } from "lucide-react";
import { getMapWeather } from "@/lib/map-weather.functions";
import { Button } from "@/components/ui/button";

export function MapWeather() {
  const fetchWeather = useServerFn(getMapWeather);
  const { data, isPending, isError, refetch } = useQuery({ queryKey: ["map-weather", "aktau"], queryFn: () => fetchWeather(), staleTime: 600_000, refetchInterval: 600_000, retry: false });
  const type = data?.type ?? "";
  const Icon = type.includes("THUNDER") ? CloudLightning : type.includes("SNOW") ? CloudSnow : type.includes("RAIN") || type.includes("DRIZZLE") ? CloudRain : type.includes("PARTLY") || type.includes("MOSTLY_CLEAR") ? CloudSun : type.includes("CLOUD") || type.includes("FOG") ? Cloud : Sun;
  return (
    <div className="absolute bottom-7 left-3 z-[500]" title={`Ақтау · Мангистауская область${data ? ` · ${data.description}` : ""}`}>
      <Button variant="secondary" className="map-weather h-14 min-w-28 gap-2 rounded-full px-4" aria-label={data ? `Погода в Актау, Мангистау: ${Math.round(data.temperature)} градусов, ${data.description}` : "Погода Мангистау недоступна, повторить"} onClick={() => void refetch()} disabled={isPending}>
        {isError ? <RefreshCw className="size-6 text-muted-foreground" /> : <Icon className="size-7 text-weather-icon" strokeWidth={2} />}
        <span className="text-3xl font-bold tabular-nums text-foreground">{data ? `${Math.round(data.temperature)}°` : "—°"}</span>
      </Button>
    </div>
  );
}