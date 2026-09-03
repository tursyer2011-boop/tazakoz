/**
 * Единая проверка администратора: роль + срок действия доступа.
 * Первый (постоянный) админ имеет admin_permanent = true и не истекает.
 * Приглашённые админы получают доступ на 30 дней.
 */
export const ADMIN_ACCESS_DAYS = 30;

export async function assertActiveAdmin(
  supabase: { from: (t: string) => any },
  userId: string,
): Promise<void> {
  const { data: role } = await supabase
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!role) throw new Error("Недостаточно прав");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("admin_permanent, admin_expires_at")
    .eq("id", userId)
    .maybeSingle();

  const expiresAt = profile?.admin_expires_at ? new Date(profile.admin_expires_at).getTime() : null;
  if (!profile?.admin_permanent && expiresAt !== null && expiresAt < Date.now()) {
    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId).eq("role", "admin");
    throw new Error("Срок доступа администратора истёк (30 дней)");
  }
}

/** true — если первичная регистрация администратора ещё не использована. */
export async function isBootstrapOpen(supabaseAdmin: any): Promise<boolean> {
  const { data } = await supabaseAdmin.from("admin_bootstrap").select("used_at").eq("id", true).maybeSingle();
  return !data?.used_at;
}
