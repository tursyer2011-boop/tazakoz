import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { HardHat, Heart, LogOut, MapPin, MessagesSquare, ShieldCheck, Wallet } from "lucide-react";
import { getMyTeam } from "@/lib/ops.functions";
import { KZT_PER_CREDIT, MIN_PAYOUT_CREDITS, MIN_DONATION_CREDITS } from "@/lib/credits";
import { requestPayout, donateCredits } from "@/lib/payouts.functions";
import { Input } from "@/components/ui/input";
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

/** Assigned destination point for approved workers. */
function MyPointCard() {
  const load = useServerFn(getMyTeam);
  const team = useQuery({ queryKey: ["my-team"], queryFn: () => load({}) });
  const depot = team.data?.depot;
  if (!team.data?.team || !depot) return null;
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">ID пункта</p>
      <p className="text-brand-gradient text-2xl font-semibold tracking-widest">{depot.code}</p>
      <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
        <MapPin className="size-4" /> {depot.name} · {depot.city}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">Команда №{team.data.team.team_code}</p>
    </div>
  );
}

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
    navigate({ to: "/auth", replace: true });
  }

  const payouts = useQuery({
    enabled: !!user,
    queryKey: ["payouts", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payout_requests")
        .select("id, credits, amount_kzt, status, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  const name = profile?.full_name || user?.email || "Пользователь";

  return (
    <main className="mx-auto max-w-lg space-y-4 px-4 py-6">
      <h1 className="sr-only">Профиль пользователя</h1>
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

      {hasRole(me?.roles, "worker", "captain") && <MyPointCard />}

      <div className="grid gap-2">
        <Link
          to="/chat"
          className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 text-sm font-medium"
        >
          <MessagesSquare className="size-5 text-primary" strokeWidth={1.6} /> Чат с координатором
        </Link>
        {!isStaff && (
          <Link
            to="/worker"
            className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 text-sm font-medium"
          >
            <HardHat className="size-5 text-primary" strokeWidth={1.6} />{" "}
            {hasRole(me?.roles, "worker", "captain") ? "Мои задания" : "Стать работником"}
          </Link>
        )}
        {isStaff && (
          <Link
            to="/admin-panel"
            className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 text-sm font-medium"
          >
            <ShieldCheck className="size-5 text-primary" strokeWidth={1.6} /> Админ-панель
          </Link>
        )}
      </div>

      <CashoutCard
        credits={profile?.credits ?? 0}
        fullName={profile?.full_name ?? ""}
        phone={profile?.phone ?? ""}
        onDone={() => {
          void queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
          void payouts.refetch();
        }}
      />

      <DonateCard
        credits={profile?.credits ?? 0}
        onDone={() => void queryClient.invalidateQueries({ queryKey: ["profile", user?.id] })}
      />

      {(payouts.data ?? []).length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Заявки на вывод</p>
          {(payouts.data ?? []).map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-2xl border border-border bg-card p-3 text-sm">
              <div>
                <p>{p.amount_kzt} ₸ · {p.credits} кредитов</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(p.created_at).toLocaleDateString("ru-RU")}
                </p>
              </div>
              <span className="text-xs text-muted-foreground">{PAYOUT_STATUS[p.status] ?? p.status}</span>
            </div>
          ))}
        </div>
      )}

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
const PAYOUT_STATUS: Record<string, string> = {
  pending: "Ожидает",
  paid: "Выплачено",
  rejected: "Отклонено",
};

/** Kaspi cashout form: credits are converted to tenge and sent to admins in Telegram. */
function CashoutCard({
  credits,
  fullName,
  phone,
  onDone,
}: {
  credits: number;
  fullName: string;
  phone: string;
  onDone: () => void;
}) {
  const submit = useServerFn(requestPayout);
  const [amount, setAmount] = useState(String(Math.max(MIN_PAYOUT_CREDITS, credits)));
  const [contact, setContact] = useState(phone);
  const [busy, setBusy] = useState(false);
  const value = Number(amount) || 0;

  async function send() {
    setBusy(true);
    try {
      const res = await submit({ data: { credits: value, fullName: fullName || "Без имени", phone: contact } });
      toast.success(`Заявка отправлена: ${res.amount} ₸`);
      onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось отправить заявку");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <p className="flex items-center gap-2 text-sm font-medium">
        <Wallet className="size-5 text-primary" strokeWidth={1.6} /> Вывод на Kaspi
      </p>
      <p className="text-xs text-muted-foreground">
        1 кредит = {KZT_PER_CREDIT} ₸. Минимум {MIN_PAYOUT_CREDITS} кредитов.
      </p>
      <div className="flex gap-2">
        <Input
          inputMode="numeric"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
          placeholder="Кредиты"
          className="h-11 rounded-xl"
          aria-label="Сумма в кредитах"
        />
        <Input
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="Номер Kaspi"
          className="h-11 rounded-xl"
          aria-label="Номер телефона Kaspi"
        />
      </div>
      <Button
        className="h-12 w-full rounded-xl"
        disabled={busy || value < MIN_PAYOUT_CREDITS || value > credits || contact.trim().length < 10}
        onClick={() => void send()}
      >
        {busy ? "Отправляем…" : `Вывести ${value * KZT_PER_CREDIT} ₸`}
      </Button>
    </div>
  );
}

/** Пожертвование кредитов на благотворительность: указывается только сумма в кредитах. */
function DonateCard({ credits, onDone }: { credits: number; onDone: () => void }) {
  const submit = useServerFn(donateCredits);
  const [amount, setAmount] = useState(String(MIN_DONATION_CREDITS));
  const [busy, setBusy] = useState(false);
  const value = Number(amount) || 0;

  async function send() {
    setBusy(true);
    try {
      const res = await submit({ data: { credits: value } });
      toast.success(`Спасибо! Пожертвовано ${res.credits} кредитов (${res.amount} ₸)`);
      setAmount(String(MIN_DONATION_CREDITS));
      onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось отправить пожертвование");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <p className="flex items-center gap-2 text-sm font-medium">
        <Heart className="size-5 text-primary" strokeWidth={1.6} /> Пожертвовать на благотворительность
      </p>
      <p className="text-xs text-muted-foreground">
        1 кредит = {KZT_PER_CREDIT} ₸. Минимум {MIN_DONATION_CREDITS} кредитов.
      </p>
      <Input
        inputMode="numeric"
        value={amount}
        onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
        placeholder="Сколько кредитов"
        className="h-11 rounded-xl"
        aria-label="Сумма пожертвования в кредитах"
      />
      <Button
        variant="secondary"
        className="h-12 w-full rounded-xl"
        disabled={busy || value < MIN_DONATION_CREDITS || value > credits}
        onClick={() => void send()}
      >
        {busy ? "Отправляем…" : `Пожертвовать ${value * KZT_PER_CREDIT} ₸`}
      </Button>
    </div>
  );
}
