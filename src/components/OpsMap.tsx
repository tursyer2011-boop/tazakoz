import { useEffect, useRef, useState } from "react";
import { SEVERITY, type Severity } from "@/lib/regions";

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
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const layerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      await import("leaflet/dist/leaflet.css");
      if (cancelled || !containerRef.current || mapRef.current) return;
      const map = L.map(containerRef.current, { zoomControl: false }).setView([center.lat, center.lng], zoom);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      const layer = layerRef.current;
      if (cancelled || !layer) return;
      layer.clearLayers();

      for (const d of depots) {
        const icon = L.divIcon({
          className: "",
          html: `<span class="depot-pin"><span class="dot"></span>${escapeHtml(d.code)}</span>`,
          iconSize: [0, 0],
        });
        L.marker([d.lat, d.lng], { icon })
          .bindPopup(`<b>${escapeHtml(d.name)}</b><br/>${escapeHtml(d.city)}`)
          .addTo(layer);
      }

      for (const t of teams) {
        const icon = L.divIcon({ className: "", html: `<span class="team-pin"></span>`, iconSize: [16, 16] });
        L.marker([t.lat, t.lng], { icon })
          .bindPopup(`Команда ${escapeHtml(t.code ?? "")}<br/>${escapeHtml(t.status)}`)
          .addTo(layer);
      }

      for (const c of calls) {
        const color = SEVERITY[(c.severity as Severity) ?? "low"]?.color ?? "var(--severity-low)";
        L.circleMarker([c.lat, c.lng], {
          radius: 8,
          color,
          weight: 2,
          fillColor: color,
          fillOpacity: 0.55,
        })
          .bindPopup(escapeHtml(c.address || "Вызов"))
          .addTo(layer);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [depots, teams, calls, ready]);

  return <div ref={containerRef} className={`${heightClass} w-full overflow-hidden rounded-3xl border border-border`} />;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}
