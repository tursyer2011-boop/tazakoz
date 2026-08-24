import { useEffect, useState } from "react";
import { CheckCircle2, MapPin, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  /** Unique storage key so the animation plays once per decision. */
  storageKey: string;
  status: "approved" | "rejected";
  depotCode?: string | null | undefined;
  depotName?: string | null | undefined;
  depotCity?: string | null | undefined;
  teamCode?: string | null | undefined;
  note?: string | null | undefined;
};

/** Full-screen animated result of a worker application decision. */
export function HireResultOverlay({ storageKey, status, depotCode, depotName, depotCity, teamCode, note }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(storageKey)) return;
    setOpen(true);
  }, [storageKey]);

  if (!open) return null;

  const approved = status === "approved";

  function close() {
    try {
      window.localStorage.setItem(storageKey, "1");
    } catch {
      /* storage may be blocked */
    }
    setOpen(false);
  }

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-background/90 px-5 backdrop-blur-xl">
      <div className="glass-card w-full max-w-sm animate-[hire-pop_.5s_cubic-bezier(.2,.9,.3,1.3)] space-y-4 rounded-[2rem] p-7 text-center">
        <span
          className={`mx-auto flex size-20 items-center justify-center rounded-full ${
            approved ? "bg-brand-gradient" : "bg-destructive/15"
          } animate-[hire-pulse_1.6s_ease-in-out_infinite]`}
        >
          {approved ? (
            <CheckCircle2 className="size-10 text-primary-foreground" strokeWidth={1.6} />
          ) : (
            <XCircle className="size-10 text-destructive" strokeWidth={1.6} />
          )}
        </span>

        <h2 className="text-2xl font-semibold">{approved ? "Вы приняты!" : "Вы не приняты"}</h2>

        {approved ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Ваша работа началась. Вот ваш пункт назначения:</p>
            <div className="rounded-2xl bg-secondary/70 p-4">
              <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">ID пункта</p>
              <p className="text-brand-gradient text-3xl font-semibold tracking-widest">{depotCode ?? "—"}</p>
              <p className="mt-1 flex items-center justify-center gap-1 text-sm text-muted-foreground">
                <MapPin className="size-4" /> {depotName ?? "—"}
                {depotCity ? ` · ${depotCity}` : ""}
              </p>
              {teamCode && <p className="mt-1 text-xs text-muted-foreground">Команда №{teamCode}</p>}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {note?.trim() ? note : "Администратор отклонил вашу заявку. Вы можете подать её повторно."}
          </p>
        )}

        <Button className="h-12 w-full rounded-2xl" onClick={close}>
          {approved ? "Начать работу" : "Понятно"}
        </Button>
      </div>

      <style>{`
        @keyframes hire-pop { 0% { opacity: 0; transform: scale(.85) translateY(16px); } 100% { opacity: 1; transform: none; } }
        @keyframes hire-pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.08); } }
      `}</style>
    </div>
  );
}
