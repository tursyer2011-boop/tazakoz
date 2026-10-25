import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getMapKey } from "@/lib/map-weather.functions";
import { MapWeather } from "@/components/MapWeather";
import { cn } from "@/lib/utils";
import type { Map as GisMap, HtmlMarker } from "@2gis/mapgl/types";

export type GisPin = { id: string; lat: number; lng: number; kind: "depot" | "team" | "low" | "medium" | "high"; label: string; onClick?: () => void };
export function Map2Gis({ center, zoom = 7, pins, className, onAreaClick, onReady }: { center: { lat: number; lng: number }; zoom?: number; pins: GisPin[]; className?: string; onAreaClick?: (point: { lat: number; lng: number }) => void; onReady?: (map: GisMap | null) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<GisMap | null>(null);
  const sdkRef = useRef<typeof import("@2gis/mapgl/types") | null>(null);
  const markers = useRef(new Map<string, { marker: HtmlMarker; element: HTMLSpanElement }>());
  const callbacks = useRef({ onAreaClick, onReady });
  callbacks.current = { onAreaClick, onReady };
  const getKey = useServerFn(getMapKey);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [{ load }, { key }] = await Promise.all([import("@2gis/mapgl"), getKey()]);
        const sdk = await load();
        if (cancelled || !container.current) return;
        const map = new sdk.Map(container.current, { key, center: [center.lng, center.lat], zoom, lang: "ru", zoomControl: "bottomRight", copyright: "bottomRight" });
        sdkRef.current = sdk;
        mapRef.current = map;
        map.on("click", (event) => {
          const [lng, lat] = event.lngLat;
          if (typeof lat === "number" && typeof lng === "number") callbacks.current.onAreaClick?.({ lat, lng });
        });
        callbacks.current.onReady?.(map);
        setReady(true);
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => {
      cancelled = true;
      for (const { marker } of markers.current.values()) marker.destroy();
      markers.current.clear();
      mapRef.current?.destroy();
      mapRef.current = null;
      callbacks.current.onReady?.(null);
    };
  }, []);
  useEffect(() => {
    const sdk = sdkRef.current;
    const map = mapRef.current;
    if (!ready || !sdk || !map) return;
    const seen = new Set<string>();
    for (const pin of pins) {
      seen.add(pin.id);
      let existing = markers.current.get(pin.id);
      if (!existing) {
        const element = document.createElement("span");
        const marker = new sdk.HtmlMarker(map, { coordinates: [pin.lng, pin.lat], html: element, anchor: [10, 10], interactive: true, preventMapInteractions: true });
        existing = { marker, element };
        markers.current.set(pin.id, existing);
      }
      existing.marker.setCoordinates([pin.lng, pin.lat]);
      existing.element.className = `gis-pin gis-pin-${pin.kind}`;
      existing.element.title = pin.label;
      existing.element.setAttribute("aria-label", pin.label);
      existing.element.setAttribute("role", "button");
      existing.element.tabIndex = 0;
      existing.element.onclick = (event) => { event.stopPropagation(); pin.onClick?.(); };
      existing.element.onkeydown = (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); pin.onClick?.(); } };
    }
    for (const [id, entry] of markers.current) {
      if (!seen.has(id)) { entry.marker.destroy(); markers.current.delete(id); }
    }
  }, [pins, ready]);
  return <div className={cn("relative", className)}><div ref={container} className="absolute inset-0" />{error && <p role="alert" className="absolute inset-x-4 top-44 z-[500] rounded-lg bg-card p-3 text-sm text-destructive">Не удалось открыть 2ГИС. Проверьте доступ к сервису карты.</p>}<MapWeather /></div>;
}