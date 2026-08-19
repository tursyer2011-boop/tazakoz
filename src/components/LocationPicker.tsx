import { useEffect, useMemo, useState } from "react";
import { Check, ChevronsUpDown, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { loadRegions, loadSettlements, searchSettlements, type KzRegion, type Settlement } from "@/lib/geo";
import { cn } from "@/lib/utils";

export type PickedLocation = {
  regionCode: string;
  regionName: string;
  settlement: Settlement;
};

export function LocationPicker({
  value,
  onChange,
}: {
  value: PickedLocation | null;
  onChange: (next: PickedLocation | null) => void;
}) {
  const [regions, setRegions] = useState<KzRegion[]>([]);
  const [regionCode, setRegionCode] = useState(value?.regionCode ?? "");
  const [items, setItems] = useState<Settlement[]>([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadRegions().then(setRegions).catch(() => setRegions([]));
  }, []);

  useEffect(() => {
    if (!regionCode) {
      setItems([]);
      return;
    }
    setLoading(true);
    loadSettlements(regionCode)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [regionCode]);

  const results = useMemo(() => searchSettlements(items, query), [items, query]);
  const region = regions.find((r) => r.code === regionCode);

  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <Label>Область / город республиканского значения</Label>
        <Select
          value={regionCode}
          onValueChange={(code) => {
            setRegionCode(code);
            setQuery("");
            onChange(null);
          }}
        >
          <SelectTrigger className="h-11 rounded-xl">
            <SelectValue placeholder="Выберите регион" />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {regions.map((r) => (
              <SelectItem key={r.code} value={r.code}>
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-1.5">
        <Label>Населённый пункт</Label>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              disabled={!regionCode}
              className="h-11 w-full justify-between rounded-xl font-normal"
            >
              <span className={cn("truncate", !value && "text-muted-foreground")}>
                {value ? value.settlement.name : loading ? "Загрузка..." : "Найти город, село, аул"}
              </span>
              <ChevronsUpDown className="size-4 opacity-60" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[--radix-popover-trigger-width] p-2">
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск по названию"
              className="h-10 rounded-lg"
            />
            <div className="mt-2 max-h-64 overflow-y-auto">
              {results.length === 0 && (
                <p className="px-2 py-4 text-center text-sm text-muted-foreground">Ничего не найдено</p>
              )}
              {results.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onChange({ regionCode, regionName: region?.name ?? "", settlement: item });
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-accent/10"
                >
                  <MapPin className="size-3.5 shrink-0 text-primary" strokeWidth={1.5} />
                  <span className="truncate">{item.name}</span>
                  {item.pop > 0 && (
                    <span className="ml-auto text-xs text-muted-foreground">
                      {item.pop.toLocaleString("ru-RU")}
                    </span>
                  )}
                  {value?.settlement.id === item.id && <Check className="size-4 text-primary" />}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
