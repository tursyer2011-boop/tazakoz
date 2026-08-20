import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/callback")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Вход — TAZA KÖZ" },
      { name: "description", content: "Завершаем вход в TAZA KÖZ и открываем карту загрязнений." },
      { property: "og:title", content: "Вход — TAZA KÖZ" },
      { property: "og:description", content: "Завершение подтверждения почты в TAZA KÖZ." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthCallback,
});

function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function finish() {
      const url = new URL(window.location.href);
      const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
      const tokenHash = url.searchParams.get("token_hash");
      const code = url.searchParams.get("code");
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");

      try {
        if (accessToken && refreshToken) {
          const { error: err } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (err) throw err;
        } else if (tokenHash) {
          const type = (url.searchParams.get("type") ?? "signup") as "signup" | "magiclink" | "recovery" | "email";
          const { error: err } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
          if (err) throw err;
        } else if (code) {
          const { error: err } = await supabase.auth.exchangeCodeForSession(code);
          if (err) throw err;
        }

        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        if (data.session) {
          navigate({ to: "/map", replace: true });
        } else {
          navigate({ to: "/auth", replace: true });
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Ссылка недействительна");
      }
    }

    void finish();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-6 text-center">
      {error ? (
        <>
          <h1 className="text-lg font-semibold text-foreground">Не удалось подтвердить</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
          <button
            className="mt-2 text-sm text-primary underline"
            onClick={() => navigate({ to: "/auth", replace: true })}
          >
            Вернуться ко входу
          </button>
        </>
      ) : (
        <>
          <LoaderCircle className="size-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Входим в аккаунт…</p>
        </>
      )}
    </main>
  );
}
