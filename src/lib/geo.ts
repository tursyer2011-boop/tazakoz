export type KzRegion = { code: string; name: string; count: number };

export type Settlement = {
  id: number;
  name: string;
  en: string;
  lat: number;
  lng: number;
  pop: number;
  kind: string;
};

let regionsCache: KzRegion[] | null = null;
const settlementCache = new Map<string, Settlement[]>();

export async function loadRegions(): Promise<KzRegion[]> {
  if (regionsCache) return regionsCache;
  const res = await fetch("/geo/regions.json");
  if (!res.ok) throw new Error("Не удалось загрузить список регионов");
  regionsCache = (await res.json()) as KzRegion[];
  return regionsCache;
}

export async function loadSettlements(regionCode: string): Promise<Settlement[]> {
  const cached = settlementCache.get(regionCode);
  if (cached) return cached;
  const res = await fetch(`/geo/settlements/${regionCode}.json`);
  if (!res.ok) throw new Error("Не удалось загрузить список населённых пунктов");
  const items = (await res.json()) as Settlement[];
  settlementCache.set(regionCode, items);
  return items;
}

export function searchSettlements(items: Settlement[], query: string, limit = 60): Settlement[] {
  const q = query.trim().toLowerCase();
  if (!q) return items.slice(0, limit);
  const out: Settlement[] = [];
  for (const item of items) {
    if (item.name.toLowerCase().includes(q) || item.en.toLowerCase().includes(q)) {
      out.push(item);
      if (out.length >= limit) break;
    }
  }
  return out;
}
