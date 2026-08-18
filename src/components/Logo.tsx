import { Eye } from "lucide-react";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-3">
        <span className="bg-brand-gradient shadow-brand-glow flex size-11 items-center justify-center rounded-2xl">
          <Eye className="size-6 text-primary-foreground" strokeWidth={1.75} />
        </span>
        <span className="text-brand-gradient text-2xl font-semibold tracking-[0.18em] uppercase">
          Taza Köz
        </span>
      </div>
      {!compact && (
        <p className="text-[0.7rem] tracking-[0.35em] text-muted-foreground uppercase">
          Kör. Habarla. Qorğa.
        </p>
      )}
    </div>
  );
}