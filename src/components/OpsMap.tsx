import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Map2Gis, type GisPin } from "@/components/Map2Gis";

export type MapDepot = { id: string; code: string; name: string; city: string; lat: number; lng: number };
export type MapTeam = { team_id: string; lat: number; lng: number; status: string; code?: string };
export type MapCall = { id: string; lat: number; lng: number; severity: string; address: string };

/** Leaflet map for admins: depots, live team positions and open calls of one region. */
export function OpsMap({
  depots,
  teams,
  calls,
  center,
  zoom = 7,
  heightClass = "h-[70vh]",
}: {
  depots: MapDepot[];
  teams: MapTeam[];
  calls: MapCall[];
  center: { lat: number; lng: number };
  zoom?: number;
  heightClass?: string;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const pins: GisPin[] = [
    ...depots.map((d): GisPin => ({ id: `depot-${d.id}`, lat: d.lat, lng: d.lng, kind: "depot", label: `${d.code} · ${d.name} · ${d.city}`, onClick: () => setSelected(`${d.code} · ${d.name} · ${d.city}`) })),
    ...teams.map((t): GisPin => ({ id: `team-${t.team_id}`, lat: t.lat, lng: t.lng, kind: "team", label: `Команда ${t.code ?? ""} · ${t.status}`, onClick: () => setSelected(`Команда ${t.code ?? ""} · ${t.status}`) })),
    ...calls.map((c): GisPin => ({ id: `call-${c.id}`, lat: c.lat, lng: c.lng, kind: c.severity === "high" ? "high" : c.severity === "medium" ? "medium" : "low", label: c.address || "Вызов", onClick: () => setSelected(c.address || "Вызов") })),
  ];
  return <div className="relative"><Map2Gis center={center} zoom={zoom} pins={pins} className={`${heightClass} w-full overflow-hidden rounded-3xl border border-border`} />{selected && <div className="absolute left-3 right-3 top-3 z-[500] flex items-center justify-between gap-2 rounded-lg border border-border bg-card p-3 text-sm"><span>{selected}</span><Button variant="ghost" size="icon" aria-label="Закрыть данные точки" onClick={() => setSelected(null)}><X className="size-4" /></Button></div>}</div>;
}
