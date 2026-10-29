import { Link } from "@tanstack/react-router";
import { Coins } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import tiziAvatar from "@/assets/tizi-avatar.png";
import { VolunteerNotifications } from "@/components/VolunteerNotifications";

/** Sticky top bar with the neon Taza Credits balance badge. */
export function CreditsHeader() {
  const { data } = useProfile();
  const credits = data?.profile?.credits ?? 0;

  return (
    <header className="sticky top-0 z-[900] flex items-center justify-between border-b border-border/60 bg-background/80 px-4 py-2 backdrop-blur-xl">
      <Link to="/tizi" aria-label="Открыть Тизи — эко-помощника" className="flex min-w-0 items-center gap-2">
        <img src={tiziAvatar} alt="Тизи" width={48} height={48} className="size-11 shrink-0 rounded-full bg-secondary object-cover" />
        <span className="max-w-40 rounded-lg border border-border bg-card px-2 py-1 text-[11px] leading-tight text-foreground sm:max-w-56 sm:text-xs">
          Привет, я Тизи,<br />твой эко-помощник
        </span>
      </Link>
      <div className="flex shrink-0 items-center gap-1">
      <VolunteerNotifications />
      <Link
        to="/profile"
        aria-label={`Ваш баланс: ${credits} Taza Credits`}
        className="neon-ring shadow-brand-glow flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5"
      >
        <Coins className="size-4 text-primary" strokeWidth={1.8} />
        <span className="text-sm font-semibold text-foreground">{credits}</span>
        <span className="text-[0.65rem] tracking-widest text-muted-foreground uppercase">TC</span>
      </Link>
      </div>
    </header>
  );
}
