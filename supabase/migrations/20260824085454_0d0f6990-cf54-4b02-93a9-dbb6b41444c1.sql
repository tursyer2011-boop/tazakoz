REVOKE ALL ON FUNCTION public.sync_app_user(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_sync_app_user_profile() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_sync_app_user_role() FROM PUBLIC, anon, authenticated;