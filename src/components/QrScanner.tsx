import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Camera QR scanner with a manual code fallback for browsers without BarcodeDetector. */
export function QrScanner({ onResult, onClose }: { onResult: (value: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [manual, setManual] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;

    void (async () => {
      const Detector = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => { detect: (s: CanvasImageSource) => Promise<Array<{ rawValue: string }>> } }).BarcodeDetector;
      if (!Detector) {
        setError("Камера-сканер не поддерживается — введите код точки вручную");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      } catch {
        setError("Нет доступа к камере — введите код точки вручную");
        return;
      }
      if (stopped || !videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play().catch(() => {});
      const detector = new Detector({ formats: ["qr_code"] });
      const tick = async () => {
        if (stopped || !videoRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes[0]?.rawValue) {
            onResult(codes[0].rawValue);
            return;
          }
        } catch {
          /* keep scanning */
        }
        raf = requestAnimationFrame(() => void tick());
      };
      void tick();
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onResult]);

  return (
    <div className="space-y-3">
      {!error && (
        <video ref={videoRef} playsInline muted className="h-56 w-full rounded-2xl bg-black object-cover" />
      )}
      {error && <p className="text-sm text-muted-foreground">{error}</p>}
      <div className="flex gap-2">
        <Input
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          placeholder="Код точки, напр. 02-014"
          className="h-11 rounded-xl"
        />
        <Button className="h-11 rounded-xl" disabled={!manual.trim()} onClick={() => onResult(manual.trim())}>
          Найти
        </Button>
      </div>
      <Button variant="secondary" className="h-11 w-full rounded-xl" onClick={onClose}>
        Закрыть
      </Button>
    </div>
  );
}
