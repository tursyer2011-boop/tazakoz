import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "user" | "volunteer" | "worker" | "captain" | "moderator" | "admin";

export function useProfile() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) return null;
      const [{ data: profile }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
      ]);
      return {
        user,
        profile,
        roles: (roles ?? []).map((r) => r.role as AppRole),
      };
    },
    staleTime: 30_000,
  });
}

export function hasRole(roles: AppRole[] | undefined, ...wanted: AppRole[]) {
  return Boolean(roles?.some((r) => wanted.includes(r)));
}
