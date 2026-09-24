import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles } from "lucide-react";
import { getDepotCleanups } from "@/lib/community.functions";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

/** Кнопка «Смотреть уборки» с галереей фото до/после для пункта. */
export function DepotCleanupsButton({ depotId, depotCode }: { depotId: string; depotCode: string }) {
  const [open, setOpen] = useState(false);
  const fetchFn = useServerFn(getDepotCleanups);
  const { data = [], isLoading, error } = useQuery({
    queryKey: ["depot-cleanups", depotId],
    queryFn: () => fetchFn({ data: { depotId } }),
    enabled: open,
  });

  return (
    <>
      <Button variant="secondary" className="h-12 w-full rounded-xl" onClick={() => setOpen(true)}>
        <Sparkles className="size-4" /> Смотреть уборки
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="z-[1300] max-h-[85vh] overflow-y-auto rounded-t-3xl border-border bg-card">
          <SheetHeader>
            <SheetTitle>Уборки пункта {depotCode}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 px-4 pb-6">
            {isLoading && <div className="h-40 animate-pulse rounded-2xl bg-muted" />}
            {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}
            {!isLoading && !error && data.length === 0 && (
              <p className="text-sm text-muted-foreground">Пока нет завершённых уборок у этого пункта.</p>
            )}
            {data.map((c) => (
              <div key={c.id} className="space-y-2 rounded-2xl bg-secondary/50 p-3">
                <div className="grid grid-cols-2 gap-2">
                  <figure>
                    {c.before ? (
                      <img src={c.before} alt="До уборки" loading="lazy" className="h-32 w-full rounded-xl object-cover" />
                    ) : (
                      <div className="h-32 rounded-xl bg-muted" />
                    )}
                    <figcaption className="mt-1 text-center text-[0.7rem] text-muted-foreground">До</figcaption>
                  </figure>
                  <figure>
                    {c.after ? (
                      <img src={c.after} alt="После уборки" loading="lazy" className="h-32 w-full rounded-xl object-cover" />
                    ) : (
                      <div className="h-32 rounded-xl bg-muted" />
                    )}
                    <figcaption className="mt-1 text-center text-[0.7rem] text-muted-foreground">После</figcaption>
                  </figure>
                </div>
                <p className="text-xs text-muted-foreground">
                  {c.address || "Без адреса"}
                  {c.teamCode ? ` · Команда ${c.teamCode}` : ""}
                  {c.cleaned_at ? ` · ${new Date(c.cleaned_at).toLocaleDateString("ru-RU")}` : ""}
                </p>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
