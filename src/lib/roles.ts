/**
 * Проверка роли пользователя без публичной RPC.
 * Читает public.user_roles от имени самого пользователя (RLS разрешает свои строки).
 */
export async function hasRole(
  supabase: { from: (t: string) => any },
  userId: string,
  role: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", role)
    .maybeSingle();
  return Boolean(data);
}
