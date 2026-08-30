CREATE OR REPLACE FUNCTION public.can_access_thread(_thread_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_threads t
    WHERE t.id = _thread_id
      AND (t.created_by = _user_id OR t.worker_id = _user_id)
  )
$function$;

DROP POLICY IF EXISTS chat_threads_select ON public.chat_threads;
CREATE POLICY chat_threads_select ON public.chat_threads
FOR SELECT TO authenticated
USING (created_by = auth.uid() OR worker_id = auth.uid());

DROP POLICY IF EXISTS chat_threads_update ON public.chat_threads;
CREATE POLICY chat_threads_update ON public.chat_threads
FOR UPDATE TO authenticated
USING (created_by = auth.uid() OR worker_id = auth.uid())
WITH CHECK (created_by = auth.uid() OR worker_id = auth.uid());