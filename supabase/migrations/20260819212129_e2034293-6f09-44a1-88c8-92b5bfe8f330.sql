CREATE TABLE public.telegram_admin_chats (
  chat_id BIGINT PRIMARY KEY,
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.telegram_admin_chats TO service_role;
ALTER TABLE public.telegram_admin_chats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view telegram chats" ON public.telegram_admin_chats FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
GRANT SELECT ON public.telegram_admin_chats TO authenticated;