import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, LoaderCircle, MailCheck, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { LocationPicker, type PickedLocation } from "@/components/LocationPicker";
import { UsernameField, type UsernameState } from "@/components/UsernameField";
import { fallbackUsername } from "@/lib/username";
import { WheelDatePicker } from "@/components/WheelDatePicker";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";
import { getEmailVerificationStatus, requestEmailOtp, verifyEmailOtp } from "@/lib/otp.functions";
import { getVerifiedCache, setVerifiedCache, clearVerifiedCache } from "@/lib/verified-cache";

export const Route = createFileRoute("/auth/")({
  head: () => ({
    meta: [
      { title: "Вход и регистрация — TAZA KÖZ" },
      {
        name: "description",
        content:
          "Создайте аккаунт TAZA KÖZ или войдите, чтобы сообщать о загрязнениях водоёмов Казахстана и получать Taza Credits.",
      },
      { property: "og:title", content: "Вход и регистрация — TAZA KÖZ" },
      {
        property: "og:description",
        content: "Регистрация с подтверждением по коду на почту. Kör. Habarla. Qorğa.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthScreen,
});

const EMPTY_CODE = ["", "", "", "", "", ""];

function AuthScreen() {
  const navigate = useNavigate();
  const { session, loading } = useSession();
  const sendOtp = useServerFn(requestEmailOtp);
  const checkOtp = useServerFn(verifyEmailOtp);
  const checkStatus = useServerFn(getEmailVerificationStatus);
  const [mode, setMode] = useState<"signup" | "login" | "forgot">("login");
  const [step, setStep] = useState<"form" | "verify">("form");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [patronymic, setPatronymic] = useState("");
  const [username, setUsername] = useState("");
  const [usernameState, setUsernameState] = useState<UsernameState>("empty");
  const [birthDate, setBirthDate] = useState("");
  const [phone, setPhone] = useState("");
  const [place, setPlace] = useState<PickedLocation | null>(null);
  const [agree, setAgree] = useState(false);

  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState(EMPTY_CODE);
  const [resendSeconds, setResendSeconds] = useState(0);
  const codeInputs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (loading || !session || step === "verify") return;
    if (getVerifiedCache(session.user.id)) {
      navigate({ to: "/map", replace: true });
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const status = await checkStatus({});
        if (cancelled) return;
        if (status.verified) {
          setVerifiedCache(session.user.id);
          navigate({ to: "/map", replace: true });
          return;
        }
        // Сессия есть, но почта не подтверждена — требуем код.
        setEmail(session.user.email ?? "");
        setStep("verify");
      } catch {
        // Не удалось проверить статус — остаёмся на экране входа.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, session, step, navigate, checkStatus]);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = window.setInterval(() => setResendSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [resendSeconds]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        // Код подтверждения обязателен при каждом входе.
        await startVerification("login");
        return;
      }

      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Письмо для восстановления пароля отправлено");
        setMode("login");
        return;
      }

      if (!firstName.trim()) {
        toast.error("Укажите имя");
        return;
      }
      if (!/^\+?\d{10,15}$/.test(phone.replace(/[\s()-]/g, ""))) {
        toast.error("Укажите корректный номер телефона");
        return;
      }
      if (!birthDate) {
        toast.error("Укажите дату рождения");
        return;
      }
      if (password.length < 8) {
        toast.error("Пароль должен быть не короче 8 символов");
        return;
      }

      const home = REGIONS[0]!;
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            first_name: firstName.trim(),
            last_name: "",
            patronymic: "",
            username: fallbackUsername(),
            phone: phone.trim(),
            birth_date: birthDate,
            city: home.name,
            region: "Мангистауская область",
            region_code: "09",
            lat: String(home.lat),
            lng: String(home.lng),
            consent_privacy: "true",
            consent_terms: "true",
            consent_data: "true",
          },
        },
      });
      if (error) throw error;

      if (!data.session) {
        await supabase.auth.signInWithPassword({ email: email.trim(), password });
      }
      await startVerification("signup");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка авторизации");
    } finally {
      setBusy(false);
    }
  }

  async function startVerification(purpose: "signup" | "login") {
    setCode(EMPTY_CODE);
    setStep("verify");
    try {
      await sendOtp({ data: { purpose } });
      setResendSeconds(30);
      toast.success("Код подтверждения отправлен на почту");
    } catch (err) {
      setResendSeconds(30);
      toast.error(err instanceof Error ? err.message : "Не удалось отправить код");
    }
  }

  function updateCode(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    setCode((current) => current.map((item, i) => (i === index ? digit : item)));
    if (digit && index < 5) codeInputs.current[index + 1]?.focus();
  }

  function handleCodeKeyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !code[index] && index > 0) codeInputs.current[index - 1]?.focus();
  }

  function handleCodePaste(event: React.ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    const digits = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6).split("");
    if (digits.length === 0) return;
    setCode(EMPTY_CODE.map((_, i) => digits[i] ?? ""));
    codeInputs.current[Math.min(digits.length, 5)]?.focus();
  }

  async function verifyCode() {
    const token = code.join("");
    if (token.length !== 6) {
      toast.error("Введите 6-значный код");
      return;
    }
    setBusy(true);
    try {
      await checkOtp({ data: { code: token, purpose: mode === "signup" ? "signup" : "login" } });
      toast.success("Почта подтверждена");
      const { data: authed } = await supabase.auth.getUser();
      if (authed.user) setVerifiedCache(authed.user.id);
      navigate({ to: "/map", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Неверный код");
    } finally {
      setBusy(false);
    }
  }

  async function resendCode() {
    if (resendSeconds > 0 || busy) return;
    setBusy(true);
    try {
      await sendOtp({ data: { purpose: mode === "signup" ? "signup" : "login" } });
      setResendSeconds(30);
      toast.success("Новый код отправлен");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось отправить код");
    } finally {
      setBusy(false);
    }
  }

  // Пока идёт проверка существующей сессии, не показываем форму входа — иначе
  // авторизованный пользователь на секунду видит регистрацию.
  if (loading || (session && step === "form")) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoaderCircle className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center gap-3 text-center">
          <Logo />
          <h1 className="text-2xl font-semibold">
            {step === "verify"
              ? "Подтверждение почты"
              : mode === "login"
                ? "Вход в TAZA KÖZ"
                : mode === "forgot"
                  ? "Восстановление пароля"
                  : "Регистрация"}
          </h1>
        </div>

        <div className="glass-card mt-6 rounded-3xl p-5">
          {step === "verify" ? (
            <div className="space-y-5">
              <div className="flex items-start gap-3 rounded-2xl bg-primary/10 p-3 text-sm">
                <MailCheck className="mt-0.5 size-5 shrink-0 text-primary" strokeWidth={1.5} />
                <p className="text-muted-foreground">
                  Мы отправили 6-значный код на <span className="text-foreground">{email}</span>
                </p>
              </div>

              <div className="flex justify-between gap-2" onPaste={handleCodePaste}>
                {code.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => {
                      codeInputs.current[index] = el;
                    }}
                    value={digit}
                    onChange={(e) => updateCode(index, e.target.value)}
                    onKeyDown={(e) => handleCodeKeyDown(index, e)}
                    inputMode="numeric"
                    maxLength={1}
                    aria-label={`Цифра ${index + 1}`}
                    className="neon-ring h-14 w-full rounded-xl bg-background text-center text-xl font-semibold outline-none focus:border-primary"
                  />
                ))}
              </div>

              <Button
                onClick={verifyCode}
                disabled={busy}
                className="bg-brand-gradient shadow-brand-glow h-12 w-full rounded-xl text-base font-semibold text-primary-foreground"
              >
                {busy ? <LoaderCircle className="size-5 animate-spin" /> : "Подтвердить"}
              </Button>

              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={async () => {
                    clearVerifiedCache();
                    await supabase.auth.signOut();
                    setPassword("");
                    setCode(EMPTY_CODE);
                    setStep("form");
                  }}
                  className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="size-4" /> Назад
                </button>
                <button
                  type="button"
                  onClick={resendCode}
                  disabled={resendSeconds > 0 || busy}
                  className="flex items-center gap-1 text-primary disabled:text-muted-foreground"
                >
                  <RefreshCw className="size-4" />
                  {resendSeconds > 0 ? `Повтор через ${resendSeconds}с` : "Отправить снова"}
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              {mode === "signup" && (
                <>
                  <div className="grid gap-1.5">
                    <Label htmlFor="last">Фамилия</Label>
                    <Input id="last" value={lastName} onChange={(e) => setLastName(e.target.value)} className="h-11 rounded-xl" maxLength={60} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-1.5">
                      <Label htmlFor="first">Имя</Label>
                      <Input id="first" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="h-11 rounded-xl" maxLength={60} />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="patronymic">Отчество</Label>
                      <Input id="patronymic" value={patronymic} onChange={(e) => setPatronymic(e.target.value)} className="h-11 rounded-xl" maxLength={60} />
                    </div>
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Дата рождения</Label>
                    <WheelDatePicker value={birthDate} onChange={setBirthDate} />
                  </div>
                  <UsernameField value={username} onChange={setUsername} onStateChange={setUsernameState} />
                  <div className="grid gap-1.5">
                    <Label htmlFor="phone">Телефон</Label>
                    <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7 700 000 00 00" className="h-11 rounded-xl" maxLength={20} />
                  </div>
                  <LocationPicker value={place} onChange={setPlace} />
                </>
              )}

              <div className="grid gap-1.5">
                <Label htmlFor="email">Электронная почта</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@gmail.com"
                  className="h-11 rounded-xl"
                  maxLength={255}
                />
              </div>

              {mode !== "forgot" && (
                <div className="grid gap-1.5">
                  <Label htmlFor="password">Пароль</Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 rounded-xl"
                    maxLength={72}
                  />
                </div>
              )}

              {mode === "signup" && (
                <label className="flex items-start gap-3 rounded-2xl bg-secondary/40 p-3 text-sm">
                  <Checkbox checked={agree} onCheckedChange={(v) => setAgree(v === true)} className="mt-0.5" />
                  <span className="text-muted-foreground">
                    Я принимаю условия использования и даю согласие на обработку персональных данных
                    в соответствии с законодательством Республики Казахстан.
                  </span>
                </label>
              )}

              <Button
                type="submit"
                disabled={busy}
                className="bg-brand-gradient shadow-brand-glow h-12 w-full rounded-xl text-base font-semibold text-primary-foreground"
              >
                {busy ? (
                  <LoaderCircle className="size-5 animate-spin" />
                ) : mode === "login" ? (
                  "Войти"
                ) : mode === "forgot" ? (
                  "Отправить ссылку"
                ) : (
                  "Зарегистрироваться"
                )}
              </Button>

              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  className="text-primary"
                  onClick={() => setMode(mode === "signup" ? "login" : "signup")}
                >
                  {mode === "signup" ? "У меня уже есть аккаунт" : "Создать аккаунт"}
                </button>
                {mode !== "forgot" && (
                  <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => setMode("forgot")}>
                    Забыли пароль?
                  </button>
                )}
              </div>
            </form>
          )}
        </div>

        <p className="mt-5 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="size-4 text-primary" strokeWidth={1.5} />
          Данные защищены и используются только для работы платформы
        </p>
      </div>
    </main>
  );
}
