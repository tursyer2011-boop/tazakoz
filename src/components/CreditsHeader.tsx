import { Link } from "@tanstack/react-router";
import { Coins } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { Logo } from "@/components/Logo";

/** Sticky top bar with the neon Taza Credits balance badge. */
export function CreditsHeader() {
  const { data } = useProfile();
  const credits = data?.profile?.credits ?? 0;

  return (
    <header className="sticky top-0 z-[900] flex items-center justify-between border-b border-border/60 bg-background/80 px-4 py-2 backdrop-blur-xl">
      <Link to="/map" aria-label="TAZA KÖZ — на карту">
        <Logo compact />
      </Link>
      <Link
        to="/profile"
        aria-label={`Ваш баланс: ${credits} Taza Credits`}
        className="neon-ring shadow-brand-glow flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5"
      >
        <Coins className="size-4 text-primary" strokeWidth={1.8} />
        <span className="text-sm font-semibold text-foreground">{credits}</span>
        <span className="text-[0.65rem] tracking-widest text-muted-foreground uppercase">TC</span>
      </Link>
    </header>
  );
}
