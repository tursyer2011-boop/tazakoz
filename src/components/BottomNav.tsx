import { Link, useRouterState } from "@tanstack/react-router";
import { Camera, Droplets, Home, Trophy, User } from "lucide-react";

const items = [
  { to: "/map", label: "Главная", icon: Home },
  { to: "/rating", label: "Рейтинг", icon: Trophy },
  { to: "/report", label: "Жалоба", icon: Camera, center: true },
  { to: "/water", label: "Вода", icon: Droplets },
  { to: "/profile", label: "Профиль", icon: User },
] as const;

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav className="fixed inset-x-0 bottom-0 z-[1000] border-t border-border bg-card/95 backdrop-blur">
      <ul className="mx-auto flex max-w-lg items-end justify-between px-4 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {items.map(({ to, label, icon: Icon, ...rest }) => {
          const active = pathname === to;
          const center = "center" in rest && rest.center;
          if (center) {
            return (
              <li key={to}>
                <Link to={to} className="flex flex-col items-center gap-1">
                  <span className="bg-brand-gradient shadow-brand-glow -mt-6 flex size-14 items-center justify-center rounded-full">
                    <Icon className="size-7 text-primary-foreground" strokeWidth={1.75} />
                  </span>
                  <span className="text-[0.6rem] text-muted-foreground">{label}</span>
                </Link>
              </li>
            );
          }
          return (
            <li key={to}>
              <Link
                to={to}
                className={`flex w-14 flex-col items-center gap-1 py-1 ${active ? "text-primary" : "text-muted-foreground"}`}
              >
                <Icon className="size-6" strokeWidth={1.6} />
                <span className="text-[0.6rem]">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}