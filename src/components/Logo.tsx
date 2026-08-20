import logo from "@/assets/tazakoz-logo.png.asset.json";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <img
        src={logo.url}
        alt="TAZA KÖZ — мониторинг водоёмов Казахстана"
        className={compact ? "h-10 w-auto" : "h-24 w-auto"}
        loading="eager"
      />
      {!compact && (
        <p className="text-[0.7rem] tracking-[0.35em] text-muted-foreground uppercase">
          Kör. Habarla. Qorğa.
        </p>
      )}
    </div>
  );
}
