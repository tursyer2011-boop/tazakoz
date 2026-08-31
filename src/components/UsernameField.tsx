import { useEffect, useState } from "react";
import { CheckCircle2, LoaderCircle, XCircle } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { checkUsernameAvailable } from "@/lib/public.functions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isValidUsername, sanitizeUsername } from "@/lib/username";

export type UsernameState = "empty" | "invalid" | "checking" | "free" | "taken";

/** Поле @никнейма с живой проверкой уникальности. */
export function UsernameField({
  value,
  onChange,
  onStateChange,
}: {
  value: string;
  onChange: (value: string) => void;
  onStateChange?: (state: UsernameState) => void;
}) {
  const [state, setState] = useState<UsernameState>("empty");
  const checkUsername = useServerFn(checkUsernameAvailable);

  useEffect(() => {
    const clean = value.trim();
    if (!clean) {
      setState("empty");
      return;
    }
    if (!isValidUsername(clean)) {
      setState("invalid");
      return;
    }
    setState("checking");
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const result = await checkUsername({ data: { username: clean } });
        if (cancelled) return;
        setState(result.available ? "free" : "taken");
      } catch {
        if (!cancelled) setState("free");
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [value]);

  useEffect(() => {
    onStateChange?.(state);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <div className="grid gap-1.5">
      <Label htmlFor="username">Никнейм</Label>
      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">@</span>
        <Input
          id="username"
          value={value}
          onChange={(e) => onChange(sanitizeUsername(e.target.value))}
          placeholder="taza_user"
          className="h-11 rounded-xl pl-7"
          maxLength={24}
          autoCapitalize="none"
          autoComplete="off"
        />
        <span className="absolute top-1/2 right-3 -translate-y-1/2">
          {state === "checking" && <LoaderCircle className="size-4 animate-spin text-muted-foreground" />}
          {state === "free" && <CheckCircle2 className="size-4 text-primary" />}
          {(state === "taken" || state === "invalid") && <XCircle className="size-4 text-destructive" />}
        </span>
      </div>
      {state === "taken" && (
        <p className="text-xs text-destructive">Этот никнейм уже занят. Пожалуйста, выберите другой.</p>
      )}
      {state === "invalid" && (
        <p className="text-xs text-destructive">3–24 символа: латиница, цифры, «_» и «.».</p>
      )}
      {state === "empty" && (
        <p className="text-xs text-muted-foreground">Можно оставить пустым — никнейм создастся автоматически.</p>
      )}
      {state === "free" && <p className="text-xs text-primary">Никнейм свободен.</p>}
    </div>
  );
}
