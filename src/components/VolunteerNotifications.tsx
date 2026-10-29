import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Bell, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { hasRole, useProfile } from "@/hooks/useProfile";
import { pushNotify, requestNotifyPermission } from "@/lib/notify";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function VolunteerNotifications() {
  const { data: me } = useProfile();
  const userId = me?.user.id;
  const volunteer = hasRole(me?.roles, "volunteer", "worker", "captain");
  const queryClient = useQueryClient();
  const seen = useRef(new Set<string>());
  const [marking, setMarking] = useState(false);
  const inbox = useQuery({
    queryKey: ["volunteer-notifications", userId],
    enabled: !!userId && volunteer,
    refetchInterval: 10_000,
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase.from("volunteer_notifications")
        .select("id, report_id, created_at, read_at")
        .eq("user_id", userId).is("read_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  useEffect(() => { seen.current = new Set(); }, [userId]);
  useEffect(() => {
    for (const item of inbox.data ?? []) {
      if (seen.current.has(item.id)) continue;
      seen.current.add(item.id);
      toast.info("Новая жалоба о загрязнении", {
        id: item.id,
        action: { label: "Задания", onClick: () => { window.location.href = "/worker"; } },
      });
      pushNotify("Новая жалоба о загрязнении", { body: "Проверьте задания вашего пункта.", tag: item.id, url: "/worker" });
      void queryClient.invalidateQueries({ queryKey: ["worker-board"] });
    }
  }, [inbox.data, queryClient]);
  if (!volunteer || !userId) return null;

  async function markRead() {
    if (!userId) return;
    setMarking(true);
    try {
      const { error } = await supabase.from("volunteer_notifications")
        .update({ read_at: new Date().toISOString() }).eq("user_id", userId).is("read_at", null);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["volunteer-notifications", userId] });
    } catch { toast.error("Не удалось отметить уведомления"); }
    finally { setMarking(false); }
  }
  return <Popover>
    <PopoverTrigger asChild>
      <Button variant="ghost" size="icon" className="relative shrink-0" aria-label={`Уведомления: ${inbox.data?.length ?? 0}`}>
        <Bell className="size-5" />
        {!!inbox.data?.length && <span className="absolute top-0 right-0 rounded-full bg-primary px-1 text-[10px] text-primary-foreground">{inbox.data.length}</span>}
      </Button>
    </PopoverTrigger>
    <PopoverContent align="end" className="z-[1300] max-w-[calc(100vw-2rem)]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-semibold">Уведомления</h2>
        <Button size="icon" variant="ghost" disabled={marking || !inbox.data?.length} onClick={() => void markRead()} aria-label="Отметить всё прочитанным">
          {marking ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
        </Button>
      </div>
      {inbox.isError ? <p className="text-sm text-destructive">Не удалось загрузить уведомления</p> : <div className="max-h-64 space-y-3 overflow-y-auto">
        {(inbox.data ?? []).map(item => <Link key={item.id} to="/worker" className="block border-b border-border pb-2 text-sm">
          <p>Новая жалоба о загрязнении</p><time className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString("ru-RU")}</time>
        </Link>)}
        {!inbox.data?.length && <p className="text-sm text-muted-foreground">Новых уведомлений нет</p>}
      </div>}
      <Button variant="outline" className="mt-3 w-full" onClick={async () => {
        try {
          const result = await requestNotifyPermission();
          if (result === "granted") toast.success("Уведомления браузера включены");
          else toast.info("Уведомления доступны здесь; разрешение браузера можно включить в настройках сайта.");
        } catch { toast.info("Откройте сайт в отдельной вкладке для разрешения уведомлений."); }
      }}>Включить уведомления браузера</Button>
    </PopoverContent>
  </Popover>;
}