import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { QrCode, ScanLine } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";
import { useProfile, hasRole } from "@/hooks/useProfile";
import { KZ_CENTER, SEVERITY, STATUS_LABELS, type Severity } from "@/lib/regions";
import { loadRegions } from "@/lib/geo";
import { getAreaReports, getLiveTeams } from "@/lib/community.functions";
import { Logo } from "@/components/Logo";
import { Map2Gis, type GisPin } from "@/components/Map2Gis";
import { PointQr } from "@/components/PointQr";
import { QrScanner } from "@/components/QrScanner";
import { DepotCleanupsButton } from "@/components/DepotCleanups";
import { Button } from "@/components/ui/button";
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
      { title: "Карта TAZA KÖZ — точки и загрязнения" },
      {
        name: "description",
        content: "Живая карта точек TAZA KÖZ, бригад и загрязнений водоёмов Мангистауской области и Каспия.",
      },
      { property: "og:title", content: "Карта TAZA KÖZ" },
      { property: "og:description", content: "Точки TAZA KÖZ, бригады и отметки о загрязнениях." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MapPage,
});

type Report = {
  id: string;
  lat: number;
  lng: number;
  region: string;
  severity: string;
  status: string;
};

type Depot = {
  id: string;
  code: string;
  name: string;
  region: string;
  region_code: string;
  city: string;
  address: string;
  lat: number;
  lng: number;
};

async function fetchAllDepots(): Promise<Depot[]> {
  const out: Depot[] = [];
  for (let from = 0; from < 6000; from += 1000) {
    const { data, error } = await supabase
      .from("depots")
      .select("id, code, name, region, region_code, city, address, lat, lng")
      .eq("active", true)
      .eq("region_code", "09")
      .range(from, from + 999);
    if (error) throw error;
    out.push(...((data ?? []) as Depot[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

function MapPage() {
  const { user } = useSession();
  const { data: me } = useProfile();
  const isVolunteer = hasRole(me?.roles, "worker", "captain", "admin", "moderator");
  const [region, setRegion] = useState("all");
  const [status, setStatus] = useState("all");
  const [area, setArea] = useState<{ lat: number; lng: number } | null>(null);
  const [point, setPoint] = useState<Depot | null>(null);
  const [scanning, setScanning] = useState(false);
  const mapRef = useRef<import("@2gis/mapgl/types").Map | null>(null);

  const areaFn = useServerFn(getAreaReports);
  const teamsFn = useServerFn(getLiveTeams);

  const { data: depots = [] } = useQuery({ queryKey: ["depots", "all"], queryFn: fetchAllDepots });
  const { data: regions = [] } = useQuery({ queryKey: ["kz-regions"], queryFn: loadRegions });
  const { data: teams = [] } = useQuery({
    queryKey: ["live-teams"],
    queryFn: () => teamsFn(),
    refetchInterval: 10_000,
  });
  const { data: areaReports = [], isLoading: areaLoading } = useQuery({
    queryKey: ["area-reports", area?.lat, area?.lng],
    queryFn: () => area ? areaFn({ data: { lat: area.lat, lng: area.lng, radiusM: 1200 } }) : Promise.resolve([]),
    enabled: !!area,
  });

  const { data: reports = [] } = useQuery({
    queryKey: ["reports", "approved", "pins"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("id, lat, lng, region, severity, status")
        .eq("approved", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Report[];
    },
  });

  const visibleDepots = useMemo(
    () => (region === "all" ? depots : depots.filter((d) => d.region === region)),
    [depots, region],
  );

  const filtered = useMemo(
    () =>
      reports.filter(
        (r) => (region === "all" || r.region === region) && (status === "all" || r.status === status),
      ),
    [reports, region, status],
  );

  const pins = useMemo<GisPin[]>(() => [
    ...visibleDepots.map((d): GisPin => ({ id: `depot-${d.id}`, lat: d.lat, lng: d.lng, kind: "depot", label: `#TK-${d.code} · ${d.name}`, onClick: () => setPoint(d) })),
    ...filtered.map((r): GisPin => ({ id: `report-${r.id}`, lat: r.lat, lng: r.lng, kind: r.severity === "high" ? "high" : r.severity === "medium" ? "medium" : "low", label: "Жалобы в этом районе", onClick: () => setArea({ lat: r.lat, lng: r.lng }) })),
    ...teams.map((t): GisPin => ({ id: `team-${t.team_id}`, lat: t.lat, lng: t.lng, kind: "team", label: `Команда ${t.code} · ${t.status}`, onClick: () => toast.info(`Команда ${t.code} · ${t.status}`) })),
  ], [visibleDepots, filtered, teams]);

  const focusPoint = useCallback(
    (d: Depot) => {
      setPoint(d);
      mapRef.current?.setCenter([d.lng, d.lat]);
      mapRef.current?.setZoom(14);
    },
    [],
  );

  const handleScan = useCallback(
    (value: string) => {
      const code = value.startsWith("TAZAKOZ|") ? (value.split("|")[1] ?? "") : value;
      const found = depots.find((d) => d.code === code.trim() || `TK-${d.code}` === code.trim());
      setScanning(false);
      if (!found) {
        toast.error("Точка с таким кодом не найдена");
        return;
      }
      focusPoint(found);
      toast.success(`Точка #TK-${found.code} найдена`);
    },
    [depots, focusPoint],
  );

  async function checkIn() {
    if (!point || !user) return;
    const { error } = await supabase.from("point_checkins").insert({ depot_id: point.id, user_id: user.id });
    if (error) toast.error("Не удалось отметиться");
    else toast.success(`Вы отметились на точке #TK-${point.code}`);
  }

  return (
    <div className="relative h-[calc(100dvh-9.5rem)] min-h-80">
      <Map2Gis className="absolute inset-0" center={KZ_CENTER} zoom={7} pins={pins} onAreaClick={setArea} onReady={(map) => { mapRef.current = map; }} />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] space-y-3 bg-gradient-to-b from-background via-background/80 to-transparent px-4 pt-4 pb-8">
        <div className="pointer-events-auto flex items-center justify-center gap-2">
          <Logo compact />
        </div>
        <h1 className="sr-only">Карта точек TAZA KÖZ и загрязнений водоёмов Мангистау и Каспия</h1>
        <div className="pointer-events-auto flex gap-2">
          <Select value={region} onValueChange={setRegion}>
            <SelectTrigger className="h-10 flex-1 rounded-xl bg-card">
              <SelectValue placeholder="Регион" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="all">Все регионы</SelectItem>
              {regions.map((r) => (
                <SelectItem key={r.code} value={r.name}>
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
          <Button
            size="icon"
            className="h-10 w-10 rounded-xl"
            aria-label="Сканировать QR точки"
            onClick={() => setScanning(true)}
          >
            <ScanLine className="size-5" strokeWidth={1.6} />
          </Button>
        </div>
        <div className="pointer-events-auto flex flex-wrap justify-center gap-4 text-[0.7rem] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-primary/50 ring-1 ring-primary" />
            Точки ({visibleDepots.length})
          </span>
          {(Object.keys(SEVERITY) as Severity[]).map((k) => (
            <span key={k} className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full" style={{ backgroundColor: SEVERITY[k].color }} />
              {SEVERITY[k].label}
            </span>
          ))}
        </div>
      </div>

      <Sheet open={scanning} onOpenChange={(o) => !o && setScanning(false)}>
        <SheetContent side="bottom" className="z-[1200] rounded-t-3xl border-border bg-card">
          <SheetHeader>
            <SheetTitle>Сканирование QR точки</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-6">
            <QrScanner onResult={handleScan} onClose={() => setScanning(false)} />
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={!!point} onOpenChange={(o) => !o && setPoint(null)}>
        <SheetContent side="bottom" className="z-[1200] rounded-t-3xl border-border bg-card">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <QrCode className="size-5 text-primary" strokeWidth={1.6} />
              Пункт {point?.code}
            </SheetTitle>
          </SheetHeader>
          {point && (
            <div className="space-y-4 px-4 pb-6">
              <div className="flex items-center gap-4">
                <PointQr point={point} />
                <div className="min-w-0 space-y-1 text-sm">
                  <p className="text-lg font-semibold tracking-widest">{point.code}</p>
                  <p className="font-medium">{point.name}</p>
                  <p className="text-muted-foreground">
                    {point.address ? `${point.address}, ` : ""}
                    {point.city}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
                  </p>
                </div>
              </div>
              <Button className="h-12 w-full rounded-xl" onClick={() => void checkIn()}>
                Я на месте
              </Button>
              {isVolunteer && <DepotCleanupsButton depotId={point.id} depotCode={point.code} />}
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={!!area} onOpenChange={(o) => !o && setArea(null)}>
        <SheetContent side="bottom" className="z-[1200] max-h-[85vh] overflow-y-auto rounded-t-3xl border-border bg-card">
          <SheetHeader>
            <SheetTitle>Жалобы в этом районе</SheetTitle>
          </SheetHeader>
          <div className="space-y-3 px-4 pb-6">
            {areaLoading && <div className="h-52 w-full animate-pulse rounded-2xl bg-muted" />}
            {!areaLoading && areaReports.length === 0 && (
              <p className="text-sm text-muted-foreground">Здесь пока нет одобренных жалоб.</p>
            )}
            {areaReports.map((r) => {
              const sev = SEVERITY[(r.severity as Severity) ?? "low"] ?? SEVERITY.low;
              return (
                <div key={r.id} className="space-y-2 rounded-2xl bg-secondary/50 p-3">
                  {r.photoUrl ? (
                    <img src={r.photoUrl} alt="Фото жалобы" loading="lazy" className="h-48 w-full rounded-xl object-cover" />
                  ) : (
                    <div className="h-48 w-full rounded-xl bg-muted" />
                  )}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-semibold text-foreground">{r.username ? `@${r.username}` : "Житель"}</span>
                    <span
                      className="rounded-full px-2.5 py-0.5 font-medium text-primary-foreground"
                      style={{ backgroundColor: sev.color }}
                    >
                      {sev.label}
                    </span>
                    <span className="rounded-full bg-secondary px-2.5 py-0.5">
                      {STATUS_LABELS[r.status] ?? r.status}
                    </span>
                    <span className="text-muted-foreground">{new Date(r.created_at).toLocaleDateString("ru-RU")}</span>
                  </div>
                  {r.address && <p className="text-xs text-muted-foreground">{r.address}</p>}
                  {r.comment && <p className="text-sm">{r.comment}</p>}
                </div>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

