DROP POLICY reports_staff_select ON public.reports;

CREATE POLICY reports_staff_select ON public.reports
FOR SELECT TO authenticated
USING (
  private.has_role(auth.uid(), 'admin'::app_role)
  OR private.has_role(auth.uid(), 'moderator'::app_role)
  OR (private.has_role(auth.uid(), 'worker'::app_role) AND assigned_worker_id = auth.uid())
);