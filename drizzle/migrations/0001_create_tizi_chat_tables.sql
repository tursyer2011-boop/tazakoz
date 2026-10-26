CREATE TABLE public.tizi_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'Новый разговор',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tizi_threads TO authenticated;
GRANT ALL ON public.tizi_threads TO service_role;
ALTER TABLE public.tizi_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY tizi_threads_owner ON public.tizi_threads FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY tizi_threads_staff_read ON public.tizi_threads FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'moderator'::app_role));

CREATE TABLE public.tizi_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.tizi_threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL,
  parts jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tizi_messages_thread_idx ON public.tizi_messages (thread_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tizi_messages TO authenticated;
GRANT ALL ON public.tizi_messages TO service_role;
ALTER TABLE public.tizi_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY tizi_messages_owner ON public.tizi_messages FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY tizi_messages_staff_read ON public.tizi_messages FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'moderator'::app_role));