import { Link, useRouterState } from "@tanstack/react-router";
import { Camera, ClipboardCheck, Droplets, HardHat, Home, ShieldCheck, ShoppingBag, Trophy, User } from "lucide-react";
import { hasRole, useProfile } from "@/hooks/useProfile";
import tiziAvatar from "@/assets/tizi-avatar.png";

const baseItems = [
  { to: "/map", label: "Главная", icon: Home },
  { to: "/tizi", label: "Тизи", tizi: true },
  { to: "/report", label: "Жалоба", icon: Camera, center: true },
  { to: "/market", label: "Маркет", icon: ShoppingBag },
  { to: "/profile", label: "Профиль", icon: User },
] as const;

const staffItems = [
  { to: "/map", label: "Главная", icon: Home },
  { to: "/tizi", label: "Тизи", tizi: true },
  { to: "/report", label: "Жалоба", icon: Camera, center: true },
  { to: "/admin-panel", label: "Панель", icon: ShieldCheck },
  { to: "/profile", label: "Профиль", icon: User },
] as const;

const workerItems = [
  { to: "/map", label: "Главная", icon: Home },
  { to: "/tizi", label: "Тизи", tizi: true },
  { to: "/worker", label: "Отчёт", icon: ClipboardCheck, center: true },
  { to: "/worker", label: "Задания", icon: HardHat },
  { to: "/profile", label: "Профиль", icon: User },
] as const;


export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: me } = useProfile();
  const items = hasRole(me?.roles, "admin", "moderator")
    ? staffItems
    : hasRole(me?.roles, "worker", "captain")
      ? workerItems
      : baseItems;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-[1000] border-t border-border bg-card/95 backdrop-blur">
      <ul className="mx-auto flex max-w-lg items-end justify-between gap-1 px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {items.map(({ to, label, ...rest }) => {
          const active = pathname === to || (to === "/tizi" && pathname.startsWith("/tizi"));
          const center = "center" in rest && rest.center;
          const isTizi = "tizi" in rest && rest.tizi;
          if (center && "icon" in rest) {
            const Icon = rest.icon;
            return (
              <li key={label}>
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
            <li key={label}>
              <Link
                to={to}
                className={`flex w-12 flex-col items-center gap-1 py-1 ${active ? "text-primary" : "text-muted-foreground"}`}
              >
                {isTizi ? (
                  <img
                    src={tiziAvatar}
                    alt="Тизи"
                    width={816}
                    height={816}
                    loading="lazy"
                    className={`size-6 rounded-md bg-secondary object-cover ${active ? "ring-1 ring-primary" : ""}`}
                  />
                ) : (
                  "icon" in rest && <rest.icon className="size-6" strokeWidth={1.6} />
                )}
                <span className="text-[0.6rem]">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
