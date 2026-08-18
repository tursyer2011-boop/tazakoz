export type Region = { name: string; lat: number; lng: number };

export const REGIONS: Region[] = [
  { name: "Астана", lat: 51.1605, lng: 71.4704 },
  { name: "Алматы", lat: 43.2389, lng: 76.8897 },
  { name: "Шымкент", lat: 42.3417, lng: 69.5901 },
  { name: "Атырау", lat: 47.0945, lng: 51.9238 },
  { name: "Ақтау", lat: 43.6512, lng: 51.1575 },
  { name: "Ақтөбе", lat: 50.2839, lng: 57.167 },
  { name: "Қарағанды", lat: 49.8047, lng: 73.1094 },
  { name: "Түркістан", lat: 43.2973, lng: 68.2517 },
  { name: "Орал", lat: 51.2333, lng: 51.3667 },
  { name: "Павлодар", lat: 52.2871, lng: 76.9674 },
  { name: "Өскемен", lat: 49.9787, lng: 82.6014 },
  { name: "Семей", lat: 50.4111, lng: 80.2275 },
  { name: "Тараз", lat: 42.9, lng: 71.3667 },
  { name: "Қызылорда", lat: 44.8479, lng: 65.4823 },
  { name: "Қостанай", lat: 53.2144, lng: 63.6246 },
  { name: "Петропавл", lat: 54.8667, lng: 69.15 },
  { name: "Көкшетау", lat: 53.2833, lng: 69.4 },
  { name: "Талдықорған", lat: 45.0156, lng: 78.3739 },
];

export const KZ_CENTER = { lat: 48.0196, lng: 66.9237 };

export const SEVERITY = {
  low: { label: "Слабое", color: "var(--severity-low)" },
  medium: { label: "Среднее", color: "var(--severity-medium)" },
  high: { label: "Сильное", color: "var(--severity-high)" },
} as const;

export type Severity = keyof typeof SEVERITY;

export const STATUS_LABELS: Record<string, string> = {
  new: "Новое",
  in_progress: "В работе",
  resolved: "Убрано",
};

export function nearestRegion(lat: number, lng: number): string {
  let best = REGIONS[0]!;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const r of REGIONS) {
    const d = (r.lat - lat) ** 2 + (r.lng - lng) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = r;
    }
  }
  return best.name;
}