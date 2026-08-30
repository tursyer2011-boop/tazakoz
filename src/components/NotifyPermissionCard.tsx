import { useEffect, useState } from "react";
import { Bell, BellOff, BellRing } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { notifyPermission, requestNotifyPermission, type NotifyPermission } from "@/lib/notify";

/** Запрос разрешения на уведомления сайта (новые жалобы, сообщения в чате). */
export function NotifyPermissionCard({ text }: { text: string }) {
  const [state, setState] = useState<NotifyPermission>("default");

  useEffect(() => {
    setState(notifyPermission());
  }, []);

  if (state === "unsupported" || state === "granted") return null;

  return (
    <div className="glass-card flex items-center gap-3 rounded-3xl p-4">
      <span className="bg-brand-gradient flex size-10 shrink-0 items-center justify-center rounded-2xl">
        {state === "denied" ? (
          <BellOff className="size-5 text-primary-foreground" strokeWidth={1.6} />
        ) : (
          <BellRing className="size-5 text-primary-foreground" strokeWidth={1.6} />
        )}
      </span>
      <div className="flex-1">
        <p className="text-sm font-medium">Уведомления</p>
        <p className="text-xs text-muted-foreground">
          {state === "denied"
            ? "Уведомления заблокированы в браузере. Разрешите их в настройках сайта."
            : text}
        </p>
      </div>
      {state !== "denied" && (
        <Button
          size="sm"
          className="rounded-xl"
          onClick={async () => {
            const res = await requestNotifyPermission();
            setState(res);
            if (res === "granted") toast.success("Уведомления включены");
            if (res === "denied") toast.error("Уведомления запрещены в браузере");
          }}
        >
          <Bell className="size-4" /> Включить
        </Button>
      )}
    </div>
  );
}
