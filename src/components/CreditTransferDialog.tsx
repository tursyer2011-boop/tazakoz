import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Coins, LoaderCircle, Search, Send } from "lucide-react";
import { toast } from "sonner";
import { findUsers, transferCredits } from "@/lib/transfer.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type FoundUser = {
  id: string;
  username: string | null;
  full_name: string;
  city: string;
  credits: number;
};

/** Перевод Taza Credits конкретному пользователю (сумма начисляется в двойном размере). */
export function CreditTransferDialog({
  reportId,
  defaultUserId,
  defaultLabel,
  triggerLabel = "Перевести кредиты",
  maxAmount = 500,
}: {
  reportId?: string;
  defaultUserId?: string | null;
  defaultLabel?: string;
  triggerLabel?: string;
  maxAmount?: number;
}) {
  const queryClient = useQueryClient();
  const search = useServerFn(findUsers);
  const send = useServerFn(transferCredits);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoundUser[]>([]);
  const [selected, setSelected] = useState<FoundUser | null>(null);
  const [amount, setAmount] = useState(10);
  const [busy, setBusy] = useState(false);
  const [searching, setSearching] = useState(false);

  const targetId = selected?.id ?? defaultUserId ?? null;

  async function runSearch() {
    if (query.trim().length < 1) return;
    setSearching(true);
    try {
      const res = await search({ data: { query: query.trim() } });
      setResults(res.users as FoundUser[]);
      if (!res.users.length) toast.error("Пользователь не найден");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка поиска");
    } finally {
      setSearching(false);
    }
  }

  async function submit() {
    if (!targetId) {
      toast.error("Выберите получателя");
      return;
    }
    setBusy(true);
    try {
      const res = await send({
        data: {
          amount,
          targetUserId: targetId,
          ...(reportId ? { reportId } : {}),
          note: reportId ? "Перевод по жалобе" : "Перевод кредитов",
        },
      });
      toast.success(`Отправлено ${res.credited} Taza Credits`);
      setOpen(false);
      setSelected(null);
      setResults([]);
      setQuery("");
      await queryClient.invalidateQueries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось отправить кредиты");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" className="h-10 w-full rounded-xl">
          <span className="flex items-center gap-2">
            <Coins className="size-4" /> {triggerLabel}
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-3xl">
        <DialogHeader>
          <DialogTitle>Перевод Taza Credits</DialogTitle>
          <DialogDescription>
            Получателю начисляется удвоенная сумма: {amount} × 2 = {amount * 2} кредитов.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {defaultUserId && !selected && (
            <p className="rounded-2xl bg-secondary/40 p-3 text-sm text-muted-foreground">
              Получатель по умолчанию: {defaultLabel || "автор жалобы"}
            </p>
          )}

          <div className="grid gap-1.5">
            <Label htmlFor="ct-search">Найти по @никнейму или ID</Label>
            <div className="flex gap-2">
              <Input
                id="ct-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void runSearch();
                }}
                placeholder="@taza_user или UUID"
                className="h-11 rounded-xl"
              />
              <Button type="button" variant="secondary" className="h-11 rounded-xl" onClick={runSearch} aria-label="Найти пользователя">
                {searching ? <LoaderCircle className="size-4 animate-spin" /> : <Search className="size-4" />}
              </Button>
            </div>
          </div>

          {results.length > 0 && (
            <div className="max-h-48 space-y-1 overflow-y-auto">
              {results.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setSelected(u)}
                  className={`w-full rounded-xl px-3 py-2 text-left text-sm transition ${
                    selected?.id === u.id ? "bg-primary text-primary-foreground" : "bg-secondary/40"
                  }`}
                >
                  <span className="block font-medium">@{u.username ?? "—"}</span>
                  <span className="block text-xs opacity-80">
                    {u.full_name || "Без имени"} · {u.city || "—"} · {u.credits} кредитов
                  </span>
                </button>
              ))}
            </div>
          )}

          <div className="grid gap-1.5">
            <Label htmlFor="ct-amount">Сумма</Label>
            <Input
              id="ct-amount"
              type="number"
              min={1}
              max={maxAmount}
              value={amount}
              onChange={(e) => setAmount(Math.max(1, Math.min(maxAmount, Number(e.target.value) || 1)))}
              className="h-11 rounded-xl"
            />
          </div>

          <Button onClick={submit} disabled={busy} className="h-11 w-full rounded-xl">
            {busy ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <span className="flex items-center gap-2">
                <Send className="size-4" /> Отправить {amount * 2} кредитов
              </span>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
