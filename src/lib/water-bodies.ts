export type WaterBody = {
  name: string;
  kind: "Море" | "Залив" | "Озеро" | "Канал" | "Водохранилище";
  lat: number;
  lng: number;
  /** true — открытая вода, данные точнее */
  open: boolean;
};

/** Водоёмы рядом с городами Мангистауской области. */
export const WATER_BODIES: Record<string, WaterBody[]> = {
  "Ақтау": [
    { name: "Каспийское море (городской пляж)", kind: "Море", lat: 43.6455, lng: 51.1421, open: true },
    { name: "Каспийское море (Достар)", kind: "Море", lat: 43.6866, lng: 51.1747, open: true },
    { name: "Озеро Караколь", kind: "Озеро", lat: 43.5789, lng: 51.2489, open: false },
  ],
  "Жаңаөзен": [
    { name: "Озеро Тущыбас", kind: "Озеро", lat: 43.3719, lng: 52.7714, open: false },
    { name: "Каспийское море (Кендерли)", kind: "Море", lat: 42.9932, lng: 52.3231, open: true },
  ],
  "Жетібай": [
    { name: "Каспийское море (Жетібай жағалауы)", kind: "Море", lat: 43.5389, lng: 51.5778, open: true },
    { name: "Сор Кошкар-Ата", kind: "Озеро", lat: 43.7386, lng: 51.3203, open: false },
  ],
  "Құрық": [
    { name: "Залив Александра Бековича", kind: "Залив", lat: 43.1861, lng: 51.6083, open: true },
    { name: "Каспийское море (порт Құрық)", kind: "Море", lat: 43.2072, lng: 51.5619, open: true },
  ],
  "Шетпе": [
    { name: "Водохранилище Шетпе", kind: "Водохранилище", lat: 44.1583, lng: 52.1189, open: false },
    { name: "Каспийское море (Тущыкудык)", kind: "Море", lat: 44.0833, lng: 51.3, open: true },
  ],
  "Бейнеу": [
    { name: "Канал Бейнеу", kind: "Канал", lat: 45.3167, lng: 55.1833, open: false },
    { name: "Озеро Каратурык", kind: "Озеро", lat: 45.2286, lng: 55.0261, open: false },
  ],
  "Форт-Шевченко": [
    { name: "Бухта Баутино", kind: "Залив", lat: 44.5378, lng: 50.2528, open: true },
    { name: "Залив Кочак", kind: "Залив", lat: 44.4636, lng: 50.2789, open: true },
    { name: "Каспийское море (Тюб-Караган)", kind: "Море", lat: 44.6, lng: 50.1, open: true },
  ],
  "Мұнайлы": [
    { name: "Каспийское море (Умирзак)", kind: "Море", lat: 43.7781, lng: 51.1792, open: true },
    { name: "Сор Кошкар-Ата", kind: "Озеро", lat: 43.7386, lng: 51.3203, open: false },
  ],
};

export function waterBodiesFor(city: string): WaterBody[] {
  return WATER_BODIES[city] ?? [];
}

/** Текущая температура воды по каждому водоёму (Open-Meteo, одна выборка). */
export async function fetchWaterTemperatures(bodies: WaterBody[]): Promise<(number | null)[]> {
  if (bodies.length === 0) return [];
  const lat = bodies.map((b) => b.lat).join(",");
  const lng = bodies.map((b) => b.lng).join(",");
  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=sea_surface_temperature&timezone=auto`,
  );
  if (!res.ok) throw new Error("Не удалось получить температуру воды");
  const json = (await res.json()) as
    | { current?: { sea_surface_temperature?: number | null } }
    | Array<{ current?: { sea_surface_temperature?: number | null } }>;
  const list = Array.isArray(json) ? json : [json];
  return bodies.map((_, i) => {
    const v = list[i]?.current?.sea_surface_temperature;
    return typeof v === "number" ? v : null;
  });
}
