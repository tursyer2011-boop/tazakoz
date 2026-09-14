import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, KeyRound, LoaderCircle, Lock, MailCheck, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { activateAdminAccess, getAdminGateStatus, requestAdminAccess } from "@/lib/admin-access.functions";
import { loadRegions, loadSettlements, searchSettlements, type KzRegion, type Settlement } from "@/lib/geo";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Вход для администраторов — TAZA KÖZ" },
      { name: "description", content: "Служебный вход контролёров TAZA KÖZ: пароль доступа, область и код подтверждения." },
      { property: "og:title", content: "Вход для администраторов — TAZA KÖZ" },
      { property: "og:description", content: "Панель контролёра команд TAZA KÖZ по областям Казахстана." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminGate,
});

type Step = "password" | "details" | "code" | "done";

function AdminGate() {
  const navigate = useNavigate();
  const request = useServerFn(requestAdminAccess);
  const activate = useServerFn(activateAdminAccess);

  const gateStatus = useServerFn(getAdminGateStatus);
  const [bootstrapOpen, setBootstrapOpen] = useState<boolean | null>(null);
  const [step, setStep] = useState<Step>("password");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [regions, setRegions] = useState<KzRegion[]>([]);
  const [regionCode, setRegionCode] = useState("");
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void gateStatus({})
      .then((s) => {
        setBootstrapOpen(s.bootstrapOpen);
        if (!s.bootstrapOpen) setStep("details");
      })
      .catch(() => setBootstrapOpen(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void loadRegions().then(setRegions).catch(() => toast.error("Не удалось загрузить регионы"));
  }, []);

  useEffect(() => {
    if (!regionCode) return;
    setCity("");
    setQuery("");
    void loadSettlements(regionCode).then(setSettlements).catch(() => setSettlements([]));
  }, [regionCode]);

  const region = useMemo(() => regions.find((r) => r.code === regionCode)?.name ?? "", [regions, regionCode]);
  const found = useMemo(() => searchSettlements(settlements, query, 30), [settlements, query]);

  async function sendCode() {
    if (!email.includes("@") || !regionCode || !city) {
      toast.error("Заполните почту, область и населённый пункт");
      return;
    }
    setBusy(true);
    try {
      await request({ data: { password, email, region, regionCode, city } });
      toast.success("Код отправлен на почту");
      setStep("code");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    setBusy(true);
    try {
      const result = await activate({ data: { password, email, code, region, regionCode, city } });
      if (result.otp) {
        const { error } = await supabase.auth.verifyOtp({ email, token: result.otp, type: "magiclink" });
        if (error) throw new Error(error.message);
      }
      setStep("done");
      setTimeout(() => void navigate({ to: "/admin-panel" }), 2200);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-5 py-10">
      <Logo />
      <h1 className="sr-only">Вход для администраторов TAZA KÖZ</h1>

      <div className="glass-card w-full max-w-md rounded-3xl p-6">
        {bootstrapOpen === null && (
          <div className="flex justify-center py-10">
            <LoaderCircle className="size-6 animate-spin text-primary" />
          </div>
        )}

        {bootstrapOpen === false && step === "details" && (
          <div className="mb-4 flex items-start gap-2 rounded-2xl border border-border bg-secondary/50 p-3 text-xs text-muted-foreground">
            <Lock className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>
              Первичная регистрация владельца закрыта навсегда. Вход только по приглашению действующего
              администратора — доступ выдаётся на 30 дней.
            </span>
          </div>
        )}

        {bootstrapOpen === true && step === "password" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-primary">
              <KeyRound className="size-5" />
              <span className="text-sm font-semibold tracking-wide uppercase">Первый администратор</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Вы вошли как {sessionEmail || "гость"}. Нажмите кнопку — вы станете постоянным администратором,
              остальные админы будут сняты, а эта страница закроется навсегда.
            </p>
            {sessionEmail ? (
              <Button className="w-full" disabled={busy} onClick={claim}>
                {busy ? <LoaderCircle className="size-4 animate-spin" /> : "Стать админом"}
              </Button>
            ) : (
              <Button className="w-full" onClick={() => void navigate({ to: "/auth" })}>
                Сначала войдите в аккаунт
              </Button>
            )}
            <button
              type="button"
              onClick={() => setStep("details")}
              className="w-full text-center text-xs text-muted-foreground underline"
            >
              Вход по паролю и коду с почты
            </button>
          </div>
        )}

        {bootstrapOpen !== null && step === "details" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-primary">
              <ShieldCheck className="size-5" />
              <span className="text-sm font-semibold tracking-wide uppercase">Данные администратора</span>
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-email">Почта</Label>
              <Input
                id="admin-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@tazakoz.online"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-region">Область</Label>
              <select
                id="admin-region"
                value={regionCode}
                onChange={(e) => setRegionCode(e.target.value)}
                className="h-11 w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground"
              >
                <option value="">Выберите область</option>
                {regions.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            {regionCode && (
              <div className="space-y-2">
                <Label htmlFor="admin-city">Местность</Label>
                <Input
                  id="admin-city"
                  value={city || query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setCity("");
                  }}
                  placeholder="Например: Щучинск"
                />
                {!city && (
                  <div className="max-h-44 space-y-1 overflow-y-auto rounded-xl border border-border p-1">
                    {found.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setCity(s.name);
                          setQuery(s.name);
                        }}
                        className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-secondary"
                      >
                        {s.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Область назначается один раз: после подтверждения администратор видит команды и пункты назначения
              только своей области.
            </p>
            <Button className="w-full" onClick={sendCode} disabled={busy}>
              {busy ? <LoaderCircle className="size-4 animate-spin" /> : "Отправить код на почту"}
            </Button>
          </div>
        )}

        {bootstrapOpen !== null && step === "code" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-primary">
              <MailCheck className="size-5" />
              <span className="text-sm font-semibold tracking-wide uppercase">Код подтверждения</span>
            </div>
            <p className="text-sm text-muted-foreground">Код отправлен на {email}. Он действует 10 минут.</p>
            <Input
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="text-center text-2xl tracking-[0.6em]"
              placeholder="000000"
            />
            <Button className="w-full" onClick={confirm} disabled={busy || code.length !== 6}>
              {busy ? <LoaderCircle className="size-4 animate-spin" /> : "Подтвердить"}
            </Button>
            <button
              type="button"
              onClick={sendCode}
              className="w-full text-center text-xs text-muted-foreground underline"
            >
              Отправить код ещё раз
            </button>
          </div>
        )}

        {step === "done" && (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <span className="bg-brand-gradient shadow-brand-glow flex size-20 animate-[ping_1.4s_ease-out_1] items-center justify-center rounded-full">
              <CheckCircle2 className="size-10 text-primary-foreground" />
            </span>
            <p className="text-lg font-semibold text-foreground">
              {bootstrapOpen ? "Вы — постоянный администратор" : "Доступ выдан на 30 дней"}
            </p>
            <p className="text-sm text-muted-foreground">
              {region} · {city}. Открываем панель контролёра…
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
