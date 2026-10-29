DROP POLICY reports_select_approved_or_own ON public.reports;
CREATE POLICY reports_select_own ON public.reports FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.volunteer_notifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL,
 report_id uuid NOT NULL,
 read_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (user_id, report_id)
);
GRANT SELECT ON public.volunteer_notifications TO authenticated;
GRANT UPDATE (read_at) ON public.volunteer_notifications TO authenticated;
GRANT ALL ON public.volunteer_notifications TO service_role;
ALTER TABLE public.volunteer_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY notifications_read_own ON public.volunteer_notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY notifications_mark_own ON public.volunteer_notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX volunteer_notifications_inbox ON public.volunteer_notifications (user_id, created_at DESC);
CREATE FUNCTION public.notify_volunteers_new_report() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 INSERT INTO public.volunteer_notifications(user_id, report_id)
 SELECT DISTINCT user_id, NEW.id FROM public.user_roles WHERE role IN ('volunteer', 'worker', 'captain')
 ON CONFLICT (user_id, report_id) DO NOTHING;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_volunteers_new_report() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER notify_volunteers_report_insert AFTER INSERT ON public.reports FOR EACH ROW EXECUTE FUNCTION public.notify_volunteers_new_report();