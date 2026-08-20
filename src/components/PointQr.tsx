import { useEffect, useState } from "react";

export type PointPayload = { id: string; code: string; name: string; lat: number; lng: number; city: string };

export function pointQrValue(p: PointPayload) {
  return `TAZAKOZ|${p.code}|${p.lat.toFixed(6)},${p.lng.toFixed(6)}|${p.city}`;
}

/** Renders a QR code for a TAZA KÖZ point (id, coordinates, address). */
export function PointQr({ point, size = 160 }: { point: PointPayload; size?: number }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const QR = (await import("qrcode")).default;
      const url = await QR.toDataURL(pointQrValue(point), {
        width: size * 2,
        margin: 1,
        color: { dark: "#04131a", light: "#ffffff" },
      });
      if (!cancelled) setSrc(url);
    })();
    return () => {
      cancelled = true;
    };
  }, [point, size]);

  return src ? (
    <img src={src} alt={`QR-код точки ${point.code}`} width={size} height={size} className="rounded-xl bg-white p-2" />
  ) : (
    <div className="animate-pulse rounded-xl bg-muted" style={{ width: size, height: size }} />
  );
}
