import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Camera, CheckCircle2, Loader2, MapPin, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { submitReport } from "@/lib/reports.functions";
import { resizeImage } from "@/lib/photos";
import { KZ_CENTER, nearestRegion, SEVERITY, type Severity } from "@/lib/regions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/report")({
  head: () => ({
    meta: [
      { title: "Отправить жалобу — TAZA KÖZ" },
      { name: "description", content: "Сфотографируйте загрязнение водоёма и отправьте жалобу на проверку ИИ." },
      { property: "og:title", content: "Отправить жалобу — TAZA KÖZ" },
      { property: "og:description", content: "Фото, геолокация, ИИ-проверка — жалоба попадает на карту." },
    ],
  }),
  component: ReportPage,
});

type Result = {
  approved: boolean;
  severity: string;
  reason: string;
  credits: number;
  address?: string;
  water?: string;
};

function ReportPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const send = useServerFn(submitReport);
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number }>(KZ_CENTER);
  const [geoState, setGeoState] = useState<"pending" | "ok" | "failed">("pending");
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [address, setAddress] = useState<string>("");
  const [manual, setManual] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const hasGeo = geoState === "ok";

  function locate() {
    if (!("geolocation" in navigator)) {
      setGeoState("failed");
      return;
    }
    setGeoState("pending");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setAccuracy(pos.coords.accuracy ?? null);
        setGeoState("ok");
      },
      () => setGeoState("failed"),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  useEffect(() => {
    locate();
  }, []);

  // Resolve a human-readable street address for the detected point.
  useEffect(() => {
    if (geoState !== "ok" && !manual) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${coords.lat}&lon=${coords.lng}&accept-language=ru&zoom=18&addressdetails=1`,
          { signal: ctrl.signal },
        );
        if (!res.ok) return;
        const json = (await res.json()) as { display_name?: string; address?: Record<string, string> };
        const a = json.address ?? {};
        const street = a["road"] ?? a["pedestrian"] ?? a["residential"] ?? "";
        const house = a["house_number"] ?? "";
        const district = a["neighbourhood"] ?? a["quarter"] ?? a["suburb"] ?? a["city_district"] ?? "";
        const city = a["city"] ?? a["town"] ?? a["village"] ?? "";
        const parts = [street ? (house ? `${street}, ${house}` : street) : "", district, city].filter(Boolean);
        setAddress(Array.from(new Set(parts)).join(", ") || json.display_name || "");
      } catch {
        /* address preview is optional */
      }
    }, 400);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [coords.lat, coords.lng, geoState, manual]);

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setResult(null);
    setPreview(URL.createObjectURL(f));
  }

  async function onSubmit() {
    if (!file) {
      toast.error("Добавьте фото");
      return;
    }
    if (geoState === "pending") {
      toast.error("Ждём определения местоположения");
      return;
    }
    if (geoState === "failed" && !manual) {
      toast.error("Разрешите геолокацию или укажите точку вручную");
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const { blob, dataUrl } = await resizeImage(file);
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Сессия истекла, войдите заново");
      const path = `${uid}/${crypto.randomUUID()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("reports")
        .upload(path, blob, { contentType: "image/jpeg" });
      if (upErr) throw upErr;

      const res = (await send({
        data: {
          imageBase64: dataUrl,
          photoPath: path,
          comment: comment.trim(),
          lat: coords.lat,
          lng: coords.lng,
          region: nearestRegion(coords.lat, coords.lng),
        },
      })) as Result;

      setResult(res);
      // Сбрасываем фото и текст, чтобы одно и то же нельзя было отправить дважды.
      setFile(null);
      setPreview((p) => {
        if (p) URL.revokeObjectURL(p);
        return null;
      });
      setComment("");
      if (fileRef.current) fileRef.current.value = "";
      await queryClient.invalidateQueries();
      if (res.approved) toast.success(`Принято! +${res.credits} кредитов`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось отправить жалобу");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-lg space-y-5 px-4 py-6">
      <h1 className="text-xl font-semibold">Отправить жалобу</h1>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={pick}
      />

      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="flex h-56 w-full items-center justify-center overflow-hidden rounded-3xl border border-dashed border-border bg-card"
      >
        {preview ? (
          <img src={preview} alt="Предпросмотр" className="h-full w-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-2 text-muted-foreground">
            <Camera className="size-8" strokeWidth={1.5} />
            <span className="text-sm">Сделать фото или выбрать из галереи</span>
          </span>
        )}
      </button>

      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 text-sm">
          {geoState === "pending" ? (
            <Loader2 className="size-4 animate-spin text-primary" />
          ) : (
            <MapPin className={hasGeo ? "size-4 text-primary" : "size-4 text-destructive"} />
          )}
          <span>
            {geoState === "pending"
              ? "Определяем ваше местоположение..."
              : hasGeo
                ? "Местоположение определено автоматически"
                : "Не удалось определить местоположение"}
          </span>
        </div>

        {hasGeo && (
          <p className="mt-2 text-sm font-medium">{address || "Уточняем адрес..."}</p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          {nearestRegion(coords.lat, coords.lng)} · {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
          {accuracy != null && hasGeo ? ` · точность ±${Math.round(accuracy)} м` : ""}
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" variant="secondary" className="h-9 rounded-xl text-xs" onClick={locate}>
            Обновить местоположение
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-9 rounded-xl text-xs"
            onClick={() => setManual((m) => !m)}
          >
            {manual ? "Скрыть ручной ввод" : "Указать вручную"}
          </Button>
        </div>

        {!hasGeo && geoState === "failed" && (
          <p className="mt-2 text-xs text-muted-foreground">
            Разрешите доступ к геолокации в браузере — тогда работник увидит точный адрес отправки.
          </p>
        )}

        {manual && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <input
              type="number"
              step="0.00001"
              value={coords.lat}
              onChange={(e) => setCoords((c) => ({ ...c, lat: Number(e.target.value) }))}
              className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
            />
            <input
              type="number"
              step="0.00001"
              value={coords.lng}
              onChange={(e) => setCoords((c) => ({ ...c, lng: Number(e.target.value) }))}
              className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
            />
          </div>
        )}
      </div>

      <Textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        maxLength={600}
        rows={3}
        placeholder="Комментарий: что вы видите?"
        className="rounded-2xl"
      />

      <Button
        onClick={onSubmit}
        disabled={busy}
        className="bg-brand-gradient shadow-brand-glow h-12 w-full rounded-xl text-base font-semibold text-primary-foreground"
      >
        {busy ? (
          <span className="flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" /> ИИ проверяет фото...
          </span>
        ) : (
          "Отправить"
        )}
      </Button>

      {result && (
        <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 font-medium">
            {result.approved ? (
              <CheckCircle2 className="size-5 text-primary" />
            ) : (
              <XCircle className="size-5 text-destructive" />
            )}
            {result.approved ? "Жалоба принята" : "Жалоба отклонена"}
          </div>
          {result.approved && (
            <p className="text-sm">
              Масштаб:{" "}
              <span style={{ color: SEVERITY[(result.severity as Severity) ?? "low"].color }}>
                {SEVERITY[(result.severity as Severity) ?? "low"].label}
              </span>{" "}
              · +{result.credits} кредитов
            </p>
          )}
          {(result.address || result.water) && (
            <p className="text-sm text-muted-foreground">
              {result.address}
              {result.water ? ` · водоём: ${result.water}` : ""}
            </p>
          )}
          <p className="text-sm text-muted-foreground">{result.reason}</p>
          {result.approved && (
            <Button variant="secondary" className="w-full rounded-xl" onClick={() => navigate({ to: "/map" })}>
              Смотреть на карте
            </Button>
          )}
        </div>
      )}
    </main>
  );
}