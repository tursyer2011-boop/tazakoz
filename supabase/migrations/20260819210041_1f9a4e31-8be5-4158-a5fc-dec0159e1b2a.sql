-- ===== Reports: cleanup workflow =====
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS address text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS water_body text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS assigned_worker_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS cleaned_photo_url text,
  ADD COLUMN IF NOT EXISTS cleaned_at timestamptz,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS worker_reward integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS reports_status_idx ON public.reports (status);
CREATE INDEX IF NOT EXISTS reports_worker_idx ON public.reports (assigned_worker_id);

-- staff can see and manage every report
CREATE POLICY reports_staff_select ON public.reports
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator') OR public.has_role(auth.uid(),'worker'));
CREATE POLICY reports_staff_update ON public.reports
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator') OR (public.has_role(auth.uid(),'worker') AND assigned_worker_id = auth.uid()))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator') OR (public.has_role(auth.uid(),'worker') AND assigned_worker_id = auth.uid()));

-- staff can read profiles (moderation, chat, admin panel)
CREATE POLICY profiles_staff_select ON public.profiles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'));
CREATE POLICY profiles_admin_update ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ===== Worker applications =====
CREATE TABLE public.worker_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  phone text NOT NULL,
  birth_date date,
  region text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  region_code text NOT NULL DEFAULT '',
  about text NOT NULL DEFAULT '',
  experience text NOT NULL DEFAULT '',
  has_transport boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending',
  review_note text NOT NULL DEFAULT '',
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  telegram_notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX worker_applications_active_idx ON public.worker_applications (user_id) WHERE status = 'pending';

GRANT SELECT, INSERT, UPDATE ON public.worker_applications TO authenticated;
GRANT ALL ON public.worker_applications TO service_role;
ALTER TABLE public.worker_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY worker_apps_insert_own ON public.worker_applications
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY worker_apps_select ON public.worker_applications
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'));
CREATE POLICY worker_apps_staff_update ON public.worker_applications
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'));

-- ===== Taza Credits ledger =====
CREATE TABLE public.credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  kind text NOT NULL,
  note text NOT NULL DEFAULT '',
  report_id uuid REFERENCES public.reports(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX credit_tx_user_idx ON public.credit_transactions (user_id, created_at DESC);

GRANT SELECT ON public.credit_transactions TO authenticated;
GRANT ALL ON public.credit_transactions TO service_role;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY credit_tx_select ON public.credit_transactions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'));
CREATE POLICY credit_tx_admin_insert ON public.credit_transactions
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ===== Chat =====
CREATE TABLE public.chat_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid REFERENCES public.reports(id) ON DELETE CASCADE,
  subject text NOT NULL DEFAULT '',
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  worker_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'open',
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.chat_threads(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX chat_messages_thread_idx ON public.chat_messages (thread_id, created_at);

GRANT SELECT, INSERT, UPDATE ON public.chat_threads TO authenticated;
GRANT ALL ON public.chat_threads TO service_role;
GRANT SELECT, INSERT ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_access_thread(_thread_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_threads t
    WHERE t.id = _thread_id
      AND (t.created_by = _user_id OR t.worker_id = _user_id
           OR public.has_role(_user_id,'admin') OR public.has_role(_user_id,'moderator'))
  )
$$;
REVOKE ALL ON FUNCTION public.can_access_thread(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_thread(uuid, uuid) TO authenticated, service_role;

CREATE POLICY chat_threads_select ON public.chat_threads
  FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR worker_id = auth.uid()
         OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'));
CREATE POLICY chat_threads_insert ON public.chat_threads
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY chat_threads_update ON public.chat_threads
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR worker_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (created_by = auth.uid() OR worker_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE POLICY chat_messages_select ON public.chat_messages
  FOR SELECT TO authenticated USING (public.can_access_thread(thread_id, auth.uid()));
CREATE POLICY chat_messages_insert ON public.chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND public.can_access_thread(thread_id, auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;