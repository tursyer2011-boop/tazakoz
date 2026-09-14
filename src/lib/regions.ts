export type Region = { name: string; lat: number; lng: number };

/** Только Мангистауская область. */
export const REGIONS: Region[] = [
  { name: "Ақтау", lat: 43.6512, lng: 51.1575 },
  { name: "Жаңаөзен", lat: 43.3411, lng: 52.8619 },
  { name: "Жетібай", lat: 43.5928, lng: 52.0656 },
  { name: "Құрық", lat: 43.1978, lng: 51.6486 },
  { name: "Шетпе", lat: 44.1667, lng: 52.1167 },
  { name: "Бейнеу", lat: 45.3167, lng: 55.2 },
  { name: "Форт-Шевченко", lat: 44.5089, lng: 50.2647 },
  { name: "Мұнайлы", lat: 43.7361, lng: 51.2222 },
];

export const KZ_CENTER = { lat: 43.8, lng: 52.0 };

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