import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Новый пароль — TAZA KÖZ" },
      { name: "description", content: "Установите новый пароль для входа в платформу TAZA KÖZ." },
      { property: "og:title", content: "Новый пароль — TAZA KÖZ" },
      { property: "og:description", content: "Восстановление доступа к аккаунту TAZA KÖZ." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Пароль должен быть не короче 8 символов");
      return;
    }
    if (password !== confirm) {
      toast.error("Пароли не совпадают");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Пароль обновлён");
      navigate({ to: "/map", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось обновить пароль");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center gap-3 text-center">
          <Logo />
          <h1 className="text-2xl font-semibold">Новый пароль</h1>
        </div>
        <form onSubmit={submit} className="glass-card mt-6 space-y-4 rounded-3xl p-5">
          <div className="grid gap-1.5">
            <Label htmlFor="pw">Новый пароль</Label>
            <Input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 rounded-xl" maxLength={72} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="pw2">Повторите пароль</Label>
            <Input id="pw2" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="h-11 rounded-xl" maxLength={72} />
          </div>
          <Button
            type="submit"
            disabled={busy}
            className="bg-brand-gradient shadow-brand-glow h-12 w-full rounded-xl text-base font-semibold text-primary-foreground"
          >
            {busy ? <LoaderCircle className="size-5 animate-spin" /> : "Сохранить"}
          </Button>
        </form>
      </div>
    </main>
  );
}
