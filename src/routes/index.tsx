import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, LoaderCircle, MailCheck, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";
import { REGIONS } from "@/lib/regions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TAZA KÖZ — мониторинг чистоты водоёмов Казахстана" },
      {
        name: "description",
        content:
          "Фотографируй загрязнение водоёма, ИИ проверит фото, отметка появится на карте. Kör. Habarla. Qorğa.",
      },
      { property: "og:title", content: "TAZA KÖZ — чистые водоёмы Казахстана" },
      {
        property: "og:description",
        content: "Сообщай о загрязнениях воды, получай кредиты и следи за картой загрязнений.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthScreen,
});

function AuthScreen() {
  const navigate = useNavigate();
  const { session, loading } = useSession();
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<"form" | "verify">("form");
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [resendSeconds, setResendSeconds] = useState(0);
  const codeInputs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (!loading && session) navigate({ to: "/map", replace: true });
  }, [loading, session, navigate]);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setResendSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendSeconds]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/map", replace: true });
      } else {
        if (!fullName.trim() || !phone.trim() || !city) {
          toast.error("Заполните ФИО, телефон и город");
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
            data: { full_name: fullName.trim(), phone: phone.trim(), city },
          },
        });
        if (error) throw error;
        if (data.session) {
          navigate({ to: "/map", replace: true });
        } else {
          setCode(["", "", "", "", "", ""]);
          setStep("verify");
          setResendSeconds(60);
          toast.success("Код подтверждения отправлен на почту");
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка входа");
    } finally {
      setBusy(false);
    }
  }

  function updateCode(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    setCode((current) => current.map((item, itemIndex) => (itemIndex === index ? digit : item)));
    if (digit && index < 5) codeInputs.current[index + 1]?.focus();
  }

  function handleCodeKeyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !code[index] && index > 0) {
      codeInputs.current[index - 1]?.focus();
    }
  }

  function handleCodePaste(event: React.ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    const digits = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6).split("");
    if (!digits.length) return;
    setCode(Array.from({ length: 6 }, (_, index) => digits[index] ?? ""));
    codeInputs.current[Math.min(digits.length, 6) - 1]?.focus();
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    const token = code.join("");
    if (token.length !== 6) {
      toast.error("Введите все 6 цифр");
      return;
    }

    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({ email, token, type: "signup" });
    setBusy(false);
    if (error) {
      toast.error("Неверный или просроченный код");
      return;
    }
    navigate({ to: "/map", replace: true });
  }

  async function resendCode() {
    if (resendSeconds > 0 || busy) return;
    setBusy(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setResendSeconds(60);
    toast.success("Новый код отправлен");
  }

  if (step === "verify") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-background px-5 py-10">
        <section className="w-full max-w-sm" aria-labelledby="verify-title">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="mb-8 rounded-full"
            onClick={() => setStep("form")}
            aria-label="Вернуться к регистрации"
          >
            <ArrowLeft />
          </Button>

          <div className="mb-8 flex size-16 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <MailCheck className="size-8" />
          </div>
          <h1 id="verify-title" className="text-2xl font-semibold text-foreground">
            Подтвердите почту
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Введите 6-значный код, отправленный на <span className="font-medium text-foreground">{email}</span>
          </p>

          <form className="mt-8" onSubmit={verifyCode}>
            <div className="grid grid-cols-6 gap-2" aria-label="Код подтверждения">
              {code.map((digit, index) => (
                <Input
                  key={index}
                  ref={(element) => {
                    codeInputs.current[index] = element;
                  }}
                  value={digit}
                  onChange={(event) => updateCode(index, event.target.value)}
                  onKeyDown={(event) => handleCodeKeyDown(index, event)}
                  onPaste={handleCodePaste}
                  inputMode="numeric"
                  autoComplete={index === 0 ? "one-time-code" : "off"}
                  maxLength={1}
                  aria-label={`Цифра ${index + 1}`}
                  className="h-14 rounded-lg px-0 text-center text-xl font-semibold"
                  autoFocus={index === 0}
                />
              ))}
            </div>

            <Button
              type="submit"
              disabled={busy || code.some((digit) => !digit)}
              className="bg-brand-gradient shadow-brand-glow mt-6 h-12 w-full rounded-xl text-base font-semibold text-primary-foreground"
            >
              {busy ? <LoaderCircle className="animate-spin" /> : null}
              Подтвердить
            </Button>
          </form>

          <Button
            type="button"
            variant="ghost"
            className="mt-4 h-11 w-full text-muted-foreground"
            disabled={busy || resendSeconds > 0}
            onClick={resendCode}
          >
            <RefreshCw />
            {resendSeconds > 0 ? `Отправить снова через ${resendSeconds} сек.` : "Отправить код снова"}
          </Button>
        </section>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-5 py-10">
      <div className="w-full max-w-sm space-y-7">
        <Logo />

        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 rounded-xl"
              placeholder="you@mail.kz"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Пароль</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 rounded-xl"
              placeholder="••••••"
            />
          </div>

          {mode === "signup" && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="fullName">ФИО</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  maxLength={100}
                  className="h-12 rounded-xl"
                  placeholder="Айдос Нұрланұлы"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Телефон</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  maxLength={20}
                  className="h-12 rounded-xl"
                  placeholder="+7 700 000 00 00"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Город / область</Label>
                <Select value={city} onValueChange={setCity}>
                  <SelectTrigger className="h-12 w-full rounded-xl">
                    <SelectValue placeholder="Выберите город" />
                  </SelectTrigger>
                  <SelectContent>
                    {REGIONS.map((r) => (
                      <SelectItem key={r.name} value={r.name}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          <Button
            type="submit"
            disabled={busy}
            className="bg-brand-gradient shadow-brand-glow h-12 w-full rounded-xl text-base font-semibold text-primary-foreground"
          >
            {busy ? <LoaderCircle className="animate-spin" /> : null}
            {mode === "signup" ? "Зарегистрироваться" : "Войти"}
          </Button>
        </form>

        <Button
          type="button"
          variant="ghost"
          className="w-full text-center text-sm text-muted-foreground"
          onClick={() => setMode(mode === "signup" ? "login" : "signup")}
        >
          {mode === "signup" ? "Уже есть аккаунт? Войти" : "Нет аккаунта? Зарегистрироваться"}
        </Button>
      </div>
    </main>
  );
}
