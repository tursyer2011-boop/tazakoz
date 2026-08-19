import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { HardHat, LogOut, MessagesSquare, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";
import { useProfile, hasRole } from "@/hooks/useProfile";
import { SEVERITY, STATUS_LABELS, type Severity } from "@/lib/regions";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Профиль — TAZA KÖZ" },
      { name: "description", content: "Ваши кредиты, история жалоб и настройки аккаунта TAZA KÖZ." },
      { property: "og:title", content: "Профиль — TAZA KÖZ" },
      { property: "og:description", content: "Баланс кредитов и история заявок." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useSession();
  const { data: me } = useProfile();
  const isStaff = hasRole(me?.roles, "admin", "moderator");

  const { data: profile } = useQuery({
    enabled: !!user,
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: reports = [] } = useQuery({
    enabled: !!user,
    queryKey: ["my-reports", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("id, region, severity, status, approved, ai_reason, credits_awarded, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: transactions = [] } = useQuery({
    enabled: !!user,
    queryKey: ["credit-transactions", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_transactions")
        .select("id, amount, kind, note, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data;
    },
  });

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  const name = profile?.full_name || user?.email || "Пользователь";

  return (
    <main className="mx-auto max-w-lg space-y-4 px-4 py-6">
      <div className="flex items-center gap-3">
        <Avatar className="size-14">
          <AvatarImage src={profile?.avatar_url ?? undefined} alt={name} />
          <AvatarFallback className="bg-secondary">{name.slice(0, 1).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold">{name}</p>
          <p className="truncate text-sm text-muted-foreground">{profile?.city || "Город не указан"}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Баланс кредитов</p>
          <p className="text-brand-gradient mt-1 text-2xl font-semibold">{profile?.credits ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Всего накоплено</p>
          <p className="mt-1 text-2xl font-semibold">{profile?.total_credits ?? 0}</p>
        </div>
      </div>

      <div className="grid gap-2">
        <Link
          to="/chat"
          className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 text-sm font-medium"
        >
          <MessagesSquare className="size-5 text-primary" strokeWidth={1.6} /> Чат с координатором
        </Link>
        <Link
          to="/worker"
          className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 text-sm font-medium"
        >
          <HardHat className="size-5 text-primary" strokeWidth={1.6} />{" "}
          {hasRole(me?.roles, "worker", "captain") ? "Мои задания" : "Стать работником"}
        </Link>
        {isStaff && (
          <Link
            to="/admin"
            className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 text-sm font-medium"
          >
            <ShieldCheck className="size-5 text-primary" strokeWidth={1.6} /> Админ-панель
          </Link>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">История заявок</p>
        {reports.length === 0 && (
          <p className="text-sm text-muted-foreground">Заявок пока нет.</p>
        )}
        {reports.map((r) => (
          <div key={r.id} className="rounded-2xl border border-border bg-card p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">{r.region || "Без региона"}</span>
              <span className="text-xs text-muted-foreground">
                {new Date(r.created_at).toLocaleDateString("ru-RU")}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              {r.approved ? (
                <>
                  <span
                    className="rounded-full px-2.5 py-0.5 text-primary-foreground"
                    style={{ backgroundColor: SEVERITY[(r.severity as Severity) ?? "low"].color }}
                  >
                    {SEVERITY[(r.severity as Severity) ?? "low"].label}
                  </span>
                  <span className="rounded-full bg-secondary px-2.5 py-0.5">
                    {STATUS_LABELS[r.status] ?? r.status}
                  </span>
                  <span className="text-primary">+{r.credits_awarded}</span>
                </>
              ) : (
                <span className="rounded-full bg-destructive/20 px-2.5 py-0.5 text-destructive">
                  Отклонено
                </span>
              )}
            </div>
            {r.ai_reason && <p className="mt-2 text-xs text-muted-foreground">{r.ai_reason}</p>}
          </div>
        ))}
      </div>

      {transactions.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Движение кредитов</p>
          {transactions.map((t) => (
            <div key={t.id} className="flex items-center justify-between rounded-2xl border border-border bg-card p-3 text-sm">
              <div className="min-w-0">
                <p className="truncate">{t.note || t.kind}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(t.created_at).toLocaleDateString("ru-RU")}
                </p>
              </div>
              <span className={t.amount >= 0 ? "text-primary" : "text-destructive"}>
                {t.amount >= 0 ? "+" : ""}
                {t.amount}
              </span>
            </div>
          ))}
        </div>
      )}

      <Button variant="secondary" className="h-12 w-full rounded-xl" onClick={signOut}>
        <LogOut className="mr-2 size-4" /> Выйти
      </Button>
    </main>
  );
}