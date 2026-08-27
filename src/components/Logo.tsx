import logo from "@/assets/tazakoz-logo-2026.jpg.asset.json";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <img
        src={logo.url}
        alt="TazaKÖZ — таза табиғат, таза болашақ"
        className={
          compact
            ? "h-10 w-auto rounded-xl bg-white"
            : "h-28 w-auto rounded-2xl bg-white p-1"
        }
        loading="eager"
      />
    </div>
  );
}
