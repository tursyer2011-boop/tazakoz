import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { LoaderCircle, ShieldCheck, Users, Trash2, Coins, ClipboardList, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, hasRole, type AppRole } from "@/hooks/useProfile";
import { adjustCredits, getAdminOverview, getEmailDiagnostics, setUserRole } from "@/lib/admin.functions";
import { reviewApplication } from "@/lib/worker.functions";
import { APPLICATION_STATUS_LABELS } from "@/lib/credits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Админ-панель — TAZA KÖZ" },
      { name: "description", content: "Управление пользователями, ролями, заявками работников и кредитами TAZA KÖZ." },
      { property: "og:title", content: "Админ-панель — TAZA KÖZ" },
      { property: "og:description", content: "Полный контроль платформы мониторинга водоёмов." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

const ROLES: AppRole[] = ["user", "volunteer", "worker", "captain", "moderator", "admin"];

function AdminPage() {
  const { data: me, isLoading } = useProfile();
  const isAdmin = hasRole(me?.roles, "admin");
  const isStaff = hasRole(me?.roles, "admin", "moderator");

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoaderCircle className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!isStaff) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <ShieldCheck className="mx-auto size-10 text-muted-foreground" strokeWidth={1.4} />
        <h1 className="mt-3 text-lg font-semibold">Доступ ограничен</h1>
        <p className="mt-1 text-sm text-muted-foreground">Панель доступна администраторам и модераторам.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg space-y-5 px-4 py-6">
      <h1 className="text-xl font-semibold">Админ-панель</h1>
      <Tabs defaultValue="apps">
        <TabsList className="grid w-full grid-cols-4 rounded-xl">
          <TabsTrigger value="apps">Заявки</TabsTrigger>
          <TabsTrigger value="reports">Жалобы</TabsTrigger>
          <TabsTrigger value="users" disabled={!isAdmin}>
            Люди
          </TabsTrigger>
          <TabsTrigger value="email" disabled={!isAdmin}>
            Почта
          </TabsTrigger>
        </TabsList>
        <TabsContent value="apps" className="mt-4">
          <Applications />
        </TabsContent>
        <TabsContent value="reports" className="mt-4">
          <ReportsAdmin />
        </TabsContent>
        <TabsContent value="users" className="mt-4">
          {isAdmin ? <UsersAdmin /> : null}
        </TabsContent>
        <TabsContent value="email" className="mt-4">
          {isAdmin ? <EmailDiagnostics /> : null}
        </TabsContent>
      </Tabs>
    </main>
  );
}

function EmailDiagnostics() {
  const load = useServerFn(getEmailDiagnostics);
  const diag = useQuery({ queryKey: ["email-diagnostics"], queryFn: () => load({}), refetchInterval: 30_000 });

  if (diag.isLoading) return <LoaderCircle className="mx-auto size-5 animate-spin text-primary" />;
  if (diag.error)
    return <p className="glass-card rounded-3xl p-5 text-center text-sm text-muted-foreground">Нет доступа</p>;
  const data = diag.data!;

  return (
    <div className="space-y-3">
      <div className="glass-card space-y-2 rounded-3xl p-4 text-sm">
        <p className="flex items-center gap-2 font-medium">
          <MailCheck className="size-4 text-primary" /> Диагностика писем
        </p>
        <p className="text-muted-foreground">
          Провайдер: Resend · {data.providerConfigured ? "ключ подключён" : "ключ не настроен"}
        </p>
        <p className="text-muted-foreground">Отправитель: {data.sender}</p>
        <p className="text-muted-foreground">
          Последняя отправка:{" "}
          {data.lastSend
            ? `${data.lastSend.status}${data.lastSend.http_status ? ` (${data.lastSend.http_status})` : ""} · ${new Date(data.lastSend.created_at).toLocaleString("ru-RU")}`
            : "—"}
        </p>
        <p className="text-muted-foreground">
          Последняя проверка кода:{" "}
          {data.lastVerify
            ? `${data.lastVerify.status} · ${new Date(data.lastVerify.created_at).toLocaleString("ru-RU")}`
            : "—"}
        </p>
        {data.lastSend?.error && (
          <p className="rounded-xl bg-destructive/10 p-2 text-xs text-destructive">{data.lastSend.error}</p>
        )}
      </div>

      <div className="glass-card space-y-2 rounded-3xl p-4 text-xs">
        {data.events.length === 0 && <p className="text-center text-muted-foreground">Событий пока нет</p>}
        {data.events.map((e) => (
          <div key={e.id} className="flex items-center justify-between gap-2 border-b border-border/40 pb-1 last:border-0">
            <span className="text-muted-foreground">{e.email_masked}</span>
            <span>
              {e.event} · {e.status}
            </span>
            <span className="text-muted-foreground">{new Date(e.created_at).toLocaleTimeString("ru-RU")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Applications() {
  const queryClient = useQueryClient();
  const review = useServerFn(reviewApplication);
  const [busy, setBusy] = useState<string | null>(null);

  const apps = useQuery({
    queryKey: ["worker-applications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("worker_applications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(80);
      if (error) throw error;
      return data;
    },
  });

  async function decide(applicationId: string, decision: "approved" | "rejected") {
    setBusy(applicationId);
    try {
      await review({ data: { applicationId, decision, note: "" } });
      toast.success(decision === "approved" ? "Заявка одобрена" : "Заявка отклонена");
      await queryClient.invalidateQueries({ queryKey: ["worker-applications"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBusy(null);
    }
  }

  if (apps.isLoading) return <LoaderCircle className="mx-auto size-5 animate-spin text-primary" />;
  const items = apps.data ?? [];
  if (items.length === 0)
    return <p className="glass-card rounded-3xl p-5 text-center text-sm text-muted-foreground">Заявок нет</p>;

  return (
    <div className="space-y-3">
      {items.map((app) => (
        <article key={app.id} className="glass-card space-y-2 rounded-3xl p-4 text-sm">
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium">{app.full_name}</p>
            <span className="text-xs text-muted-foreground">{APPLICATION_STATUS_LABELS[app.status]}</span>
          </div>
          <p className="text-muted-foreground">
            {app.phone} · {app.region} {app.city}
          </p>
          {app.experience && <p className="text-muted-foreground">Опыт: {app.experience}</p>}
          {app.about && <p className="text-muted-foreground">О себе: {app.about}</p>}
          <p className="text-xs text-muted-foreground">Транспорт: {app.has_transport ? "есть" : "нет"}</p>
          {app.status === "pending" && (
            <div className="flex gap-2 pt-1">
              <Button size="sm" className="flex-1 rounded-xl" disabled={busy === app.id} onClick={() => decide(app.id, "approved")}>
                Одобрить
              </Button>
              <Button size="sm" variant="secondary" className="flex-1 rounded-xl" disabled={busy === app.id} onClick={() => decide(app.id, "rejected")}>
                Отклонить
              </Button>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}

function ReportsAdmin() {
  const queryClient = useQueryClient();
  const reports = useQuery({
    queryKey: ["admin-reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(80);
      if (error) throw error;
      return data;
    },
  });

  async function remove(id: string) {
    const { error } = await supabase.from("reports").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Жалоба удалена");
      await queryClient.invalidateQueries({ queryKey: ["admin-reports"] });
    }
  }

  if (reports.isLoading) return <LoaderCircle className="mx-auto size-5 animate-spin text-primary" />;
  const items = reports.data ?? [];
  if (items.length === 0)
    return <p className="glass-card rounded-3xl p-5 text-center text-sm text-muted-foreground">Жалоб нет</p>;

  return (
    <div className="space-y-3">
      {items.map((r) => (
        <article key={r.id} className="glass-card space-y-1 rounded-3xl p-4 text-sm">
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium">{r.address || r.region || "Без адреса"}</p>
            <button onClick={() => remove(r.id)} className="text-muted-foreground hover:text-destructive" aria-label="Удалить">
              <Trash2 className="size-4" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            {r.severity} · {r.status} · {r.approved ? "подтверждена" : "отклонена ИИ"}
          </p>
          <p className="text-muted-foreground">{r.ai_reason}</p>
        </article>
      ))}
    </div>
  );
}

function UsersAdmin() {
  const queryClient = useQueryClient();
  const load = useServerFn(getAdminOverview);
  const changeRole = useServerFn(setUserRole);
  const changeCredits = useServerFn(adjustCredits);
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  const overview = useQuery({ queryKey: ["admin-overview"], queryFn: () => load({ data: undefined }) });

  if (overview.isLoading) return <LoaderCircle className="mx-auto size-5 animate-spin text-primary" />;
  if (overview.error)
    return <p className="glass-card rounded-3xl p-5 text-center text-sm text-muted-foreground">Нет доступа</p>;

  const { stats, users, roles } = overview.data!;

  async function toggleRole(userId: string, role: AppRole, active: boolean) {
    try {
      await changeRole({ data: { userId, role, action: active ? "revoke" : "grant" } });
      await queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
      toast.success("Роль обновлена");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка");
    }
  }

  async function applyCredits(userId: string) {
    const amount = Number(amounts[userId] ?? 0);
    if (!Number.isFinite(amount) || amount === 0) return;
    try {
      await changeCredits({ data: { userId, amount, note: "Ручная корректировка" } });
      setAmounts((a) => ({ ...a, [userId]: "" }));
      await queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
      toast.success("Кредиты обновлены");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка");
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={<Users className="size-4" />} label="Пользователей" value={stats.users} />
        <StatCard icon={<ClipboardList className="size-4" />} label="Жалоб принято" value={stats.reports} />
        <StatCard icon={<ShieldCheck className="size-4" />} label="Убрано" value={stats.resolved} />
        <StatCard icon={<Coins className="size-4" />} label="Всего кредитов" value={stats.totalCredits} />
      </div>

      {users.map((u) => {
        const userRoles = roles.filter((r) => r.user_id === u.id).map((r) => r.role as AppRole);
        return (
          <article key={u.id} className="glass-card space-y-3 rounded-3xl p-4 text-sm">
            <div>
              <p className="font-medium">{u.full_name || "Без имени"}</p>
              <p className="text-xs text-muted-foreground">
                {u.region} {u.city} · {u.credits} кредитов
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ROLES.map((role) => {
                const active = userRoles.includes(role);
                return (
                  <button
                    key={role}
                    onClick={() => toggleRole(u.id, role, active)}
                    className={`rounded-full px-2.5 py-1 text-xs ${active ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}
                  >
                    {role}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <Input
                type="number"
                value={amounts[u.id] ?? ""}
                onChange={(e) => setAmounts((a) => ({ ...a, [u.id]: e.target.value }))}
                placeholder="± кредиты"
                className="h-10 rounded-xl"
              />
              <Button size="sm" className="rounded-xl" onClick={() => applyCredits(u.id)}>
                Применить
              </Button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="glass-card rounded-2xl p-3">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon} {label}
      </p>
      <p className="mt-1 text-xl font-semibold">{value.toLocaleString("ru-RU")}</p>
    </div>
  );
}
