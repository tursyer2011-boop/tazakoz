import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
import { lovable } from "@/integrations/lovable/index";
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

  useEffect(() => {
    if (!loading && session) navigate({ to: "/map", replace: true });
  }, [loading, session, navigate]);

  async function social(provider: "google" | "apple") {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: window.location.origin,
    });
    setBusy(false);
    if (result.error) {
      toast.error("Не удалось войти. Попробуйте ещё раз.");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/map", replace: true });
  }

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
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName.trim(), phone: phone.trim(), city },
          },
        });
        if (error) throw error;
        if (data.session) {
          navigate({ to: "/map", replace: true });
        } else {
          toast.success("Проверьте почту — мы отправили ссылку для подтверждения.");
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка входа");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-5 py-10">
      <div className="w-full max-w-sm space-y-7">
        <Logo />

        <div className="space-y-3">
          <Button
            variant="secondary"
            className="h-12 w-full rounded-xl text-base"
            disabled={busy}
            onClick={() => social("google")}
          >
            Войти через Google
          </Button>
          <Button
            variant="secondary"
            className="h-12 w-full rounded-xl text-base"
            disabled={busy}
            onClick={() => social("apple")}
          >
            Войти через Apple
          </Button>
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          или
          <span className="h-px flex-1 bg-border" />
        </div>

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
            {mode === "signup" ? "Зарегистрироваться" : "Войти"}
          </Button>
        </form>

        <button
          type="button"
          className="w-full text-center text-sm text-muted-foreground"
          onClick={() => setMode(mode === "signup" ? "login" : "signup")}
        >
          {mode === "signup" ? "Уже есть аккаунт? Войти" : "Нет аккаунта? Зарегистрироваться"}
        </button>
      </div>
    </main>
  );
}
