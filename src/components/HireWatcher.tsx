import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { pushNotify } from "@/lib/notify";

/**
 * Следит за одобрением заявки на работу и присылает уведомление от самого сайта
 * («Вы приняты на работу»). Клик по уведомлению открывает кабинет работника.
 */
export function HireWatcher() {
  const notified = useRef(false);

  useEffect(() => {
    let stop = false;

    async function check() {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user || stop) return;

      const key = `taza-hired-notified-${user.id}`;
      if (notified.current || localStorage.getItem(key)) return;

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .in("role", ["worker", "captain"]);
      if (stop || !roles?.length) return;

      notified.current = true;
      localStorage.setItem(key, "1");
      pushNotify("Вы приняты на работу!", {
        body: "Откройте кабинет работника — там ваш ID и пункт назначения.",
        tag: "taza-hired",
        url: "/worker",
      });
    }

    void check();
    const timer = window.setInterval(() => void check(), 20_000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, []);

  return null;
}
