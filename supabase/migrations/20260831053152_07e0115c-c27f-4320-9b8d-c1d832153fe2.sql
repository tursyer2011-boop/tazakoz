
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, anon, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION private.can_access_thread(_thread_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_threads t
    WHERE t.id = _thread_id AND (t.created_by = _user_id OR t.worker_id = _user_id)
  )
$$;

CREATE OR REPLACE FUNCTION private.is_team_member(_team_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members m WHERE m.team_id = _team_id AND m.user_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.teams t WHERE t.id = _team_id AND t.captain_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION private.get_leaderboard(_limit integer DEFAULT 100)
RETURNS TABLE(id uuid, full_name text, city text, total_credits integer, approved_count integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.full_name, p.city, p.total_credits, p.approved_count
  FROM public.profiles p
  WHERE NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = p.id AND ur.role IN ('admin','moderator')
  )
  ORDER BY p.total_credits DESC
  LIMIT LEAST(GREATEST(COALESCE(_limit, 100), 1), 100)
$$;

CREATE OR REPLACE FUNCTION private.username_available(_username text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN _username IS NULL OR btrim(_username) = '' THEN false
    WHEN _username !~ '^[a-zA-Z0-9_.]{3,24}$' THEN false
    ELSE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE lower(p.username) = lower(btrim(_username)))
  END
$$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.can_access_thread(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_team_member(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.get_leaderboard(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.username_available(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.can_access_thread(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_team_member(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.get_leaderboard(integer) TO service_role;
GRANT EXECUTE ON FUNCTION private.username_available(text) TO service_role;

DROP POLICY "profiles_admin_update" ON public.profiles;
CREATE POLICY "profiles_admin_update" ON public.profiles FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));

DROP POLICY "profiles_staff_select" ON public.profiles;
CREATE POLICY "profiles_staff_select" ON public.profiles FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'moderator'));

DROP POLICY "user_roles_select_own" ON public.user_roles;
CREATE POLICY "user_roles_select_own" ON public.user_roles FOR SELECT TO authenticated
  USING ((auth.uid() = user_id) OR private.has_role(auth.uid(), 'admin'));

DROP POLICY "user_roles_admin_manage" ON public.user_roles;
CREATE POLICY "user_roles_admin_manage" ON public.user_roles FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));

DROP POLICY "reports_staff_select" ON public.reports;
CREATE POLICY "reports_staff_select" ON public.reports FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'moderator') OR private.has_role(auth.uid(), 'worker'));

DROP POLICY "reports_staff_update" ON public.reports;
CREATE POLICY "reports_staff_update" ON public.reports FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'moderator') OR (private.has_role(auth.uid(), 'worker') AND assigned_worker_id = auth.uid()))
  WITH CHECK (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'moderator') OR (private.has_role(auth.uid(), 'worker') AND assigned_worker_id = auth.uid()));

DROP POLICY "worker_apps_select" ON public.worker_applications;
CREATE POLICY "worker_apps_select" ON public.worker_applications FOR SELECT TO authenticated
  USING ((auth.uid() = user_id) OR private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'moderator'));

DROP POLICY "worker_apps_staff_update" ON public.worker_applications;
CREATE POLICY "worker_apps_staff_update" ON public.worker_applications FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'moderator'))
  WITH CHECK (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'moderator'));

DROP POLICY "credit_tx_select" ON public.credit_transactions;
CREATE POLICY "credit_tx_select" ON public.credit_transactions FOR SELECT TO authenticated
  USING ((auth.uid() = user_id) OR private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'moderator'));

DROP POLICY "credit_tx_admin_insert" ON public.credit_transactions;
CREATE POLICY "credit_tx_admin_insert" ON public.credit_transactions FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'));

DROP POLICY "chat_messages_select" ON public.chat_messages;
CREATE POLICY "chat_messages_select" ON public.chat_messages FOR SELECT TO authenticated
  USING (private.can_access_thread(thread_id, auth.uid()));

DROP POLICY "chat_messages_insert" ON public.chat_messages;
CREATE POLICY "chat_messages_insert" ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND private.can_access_thread(thread_id, auth.uid()));

DROP POLICY "Admins can view telegram chats" ON public.telegram_admin_chats;
CREATE POLICY "Admins can view telegram chats" ON public.telegram_admin_chats FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));

DROP POLICY "email_delivery_log_admin_select" ON public.email_delivery_log;
CREATE POLICY "email_delivery_log_admin_select" ON public.email_delivery_log FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));

DROP POLICY "credit_requests_select" ON public.credit_requests;
CREATE POLICY "credit_requests_select" ON public.credit_requests FOR SELECT TO authenticated
  USING ((requested_by = auth.uid()) OR private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'moderator'));

DROP POLICY "Staff can view all users" ON public.app_users;
CREATE POLICY "Staff can view all users" ON public.app_users FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'moderator'));

DROP POLICY "worker_docs_select" ON storage.objects;
CREATE POLICY "worker_docs_select" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'worker-docs'
    AND ((storage.foldername(name))[1] = (auth.uid())::text
      OR private.has_role(auth.uid(), 'admin')
      OR private.has_role(auth.uid(), 'moderator'))
  );

DROP POLICY "team_members_select" ON public.team_members;
CREATE POLICY "team_members_select" ON public.team_members FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR private.is_team_member(team_id, auth.uid())
    OR private.has_role(auth.uid(), 'admin')
    OR private.has_role(auth.uid(), 'moderator')
  );

DROP POLICY "team_positions_select" ON public.team_positions;
CREATE POLICY "team_positions_select" ON public.team_positions FOR SELECT TO authenticated
  USING (
    private.is_team_member(team_id, auth.uid())
    OR private.has_role(auth.uid(), 'admin')
    OR private.has_role(auth.uid(), 'moderator')
  );

DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
DROP FUNCTION IF EXISTS public.can_access_thread(uuid, uuid);
DROP FUNCTION IF EXISTS public.get_leaderboard(integer);
DROP FUNCTION IF EXISTS public.username_available(text);
