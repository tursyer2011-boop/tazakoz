import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { KZ_CENTER, REGIONS, SEVERITY, STATUS_LABELS, type Severity } from "@/lib/regions";
import { signedPhotoUrl } from "@/lib/photos";
import { Logo } from "@/components/Logo";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export const Route = createFileRoute("/_authenticated/map")({
  head: () => ({
    meta: [
      { title: "Карта загрязнений — TAZA KÖZ" },
      { name: "description", content: "Карта загрязнений водоёмов Казахстана в реальном времени." },
      { property: "og:title", content: "Карта загрязнений — TAZA KÖZ" },
      { property: "og:description", content: "Отметки о загрязнениях водоёмов по всему Казахстану." },
    ],
  }),
  component: MapPage,
});

type Report = {
  id: string;
  photo_url: string;
  comment: string;
  lat: number;
  lng: number;
  region: string;
  severity: string;
  status: string;
  created_at: string;
};

function MapPage() {
  const [region, setRegion] = useState("all");
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState<Report | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const layerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const [ready, setReady] = useState(false);

  const { data: reports = [] } = useQuery({
    queryKey: ["reports", "approved"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("id, photo_url, comment, lat, lng, region, severity, status, created_at")
        .eq("approved", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Report[];
    },
  });

  const filtered = useMemo(
    () =>
      reports.filter(
        (r) => (region === "all" || r.region === region) && (status === "all" || r.status === status),
      ),
    [reports, region, status],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      await import("leaflet/dist/leaflet.css");
      if (cancelled || !containerRef.current || mapRef.current) return;
      const map = L.map(containerRef.current, { zoomControl: false, attributionControl: true }).setView(
        [KZ_CENTER.lat, KZ_CENTER.lng],
        5,
      );
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 18,
      }).addTo(map);
      L.control.zoom({ position: "bottomright" }).addTo(map);
      mapRef.current = map;
      layerRef.current = L.layerGroup().addTo(map);
      setReady(true);
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      const layer = layerRef.current;
      if (cancelled || !layer) return;
      layer.clearLayers();
      for (const r of filtered) {
        const color = SEVERITY[(r.severity as Severity) ?? "low"]?.color ?? "var(--severity-low)";
        const marker = L.circleMarker([r.lat, r.lng], {
          radius: 9,
          color,
          weight: 2,
          fillColor: color,
          fillOpacity: 0.6,
        });
        marker.on("click", () => setSelected(r));
        marker.addTo(layer);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filtered, ready]);

  useEffect(() => {
    setPhoto(null);
    if (selected) void signedPhotoUrl(selected.photo_url).then(setPhoto);
  }, [selected]);

  return (
    <div className="relative h-[calc(100vh-5rem)]">
      <div ref={containerRef} className="absolute inset-0" />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] space-y-3 bg-gradient-to-b from-background via-background/80 to-transparent px-4 pt-4 pb-8">
        <div className="pointer-events-auto flex justify-center">
          <Logo compact />
        </div>
        <div className="pointer-events-auto flex gap-2">
          <Select value={region} onValueChange={setRegion}>
            <SelectTrigger className="h-10 flex-1 rounded-xl bg-card">
              <SelectValue placeholder="Регион" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все регионы</SelectItem>
              {REGIONS.map((r) => (
                <SelectItem key={r.name} value={r.name}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-10 flex-1 rounded-xl bg-card">
              <SelectValue placeholder="Статус" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все статусы</SelectItem>
              <SelectItem value="new">Новое</SelectItem>
              <SelectItem value="in_progress">В работе</SelectItem>
              <SelectItem value="resolved">Убрано</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="pointer-events-auto flex justify-center gap-4 text-[0.7rem] text-muted-foreground">
          {(Object.keys(SEVERITY) as Severity[]).map((k) => (
            <span key={k} className="flex items-center gap-1.5">
              <span
                className="size-2.5 rounded-full"
                style={{ backgroundColor: SEVERITY[k].color }}
              />
              {SEVERITY[k].label}
            </span>
          ))}
        </div>
      </div>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="bottom" className="z-[1200] rounded-t-3xl border-border bg-card">
          <SheetHeader>
            <SheetTitle>{selected?.region || "Загрязнение"}</SheetTitle>
          </SheetHeader>
          {selected && (
            <div className="space-y-3 px-4 pb-6">
              {photo ? (
                <img
                  src={photo}
                  alt="Фото загрязнения"
                  className="h-52 w-full rounded-2xl object-cover"
                />
              ) : (
                <div className="h-52 w-full animate-pulse rounded-2xl bg-muted" />
              )}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span
                  className="rounded-full px-3 py-1 font-medium text-primary-foreground"
                  style={{ backgroundColor: SEVERITY[(selected.severity as Severity) ?? "low"].color }}
                >
                  {SEVERITY[(selected.severity as Severity) ?? "low"].label}
                </span>
                <span className="rounded-full bg-secondary px-3 py-1">
                  {STATUS_LABELS[selected.status] ?? selected.status}
                </span>
                <span className="text-muted-foreground">
                  {new Date(selected.created_at).toLocaleDateString("ru-RU")}
                </span>
              </div>
              {selected.comment && <p className="text-sm text-foreground">{selected.comment}</p>}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}