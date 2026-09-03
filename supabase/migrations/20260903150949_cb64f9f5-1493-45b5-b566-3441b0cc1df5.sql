-- 1. Сброс всех администраторов
DELETE FROM public.user_roles WHERE role = 'admin';
DELETE FROM public.admin_invites;
UPDATE public.profiles
  SET admin_region = '', admin_region_code = '', admin_city = '', admin_activated_at = NULL;

-- 2. Постоянный/временный админ
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS admin_permanent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS admin_expires_at timestamptz;

-- 3. Скрытие заявок из панели (решение сохраняется)
ALTER TABLE public.worker_applications
  ADD COLUMN IF NOT EXISTS hidden_at timestamptz;

-- 4. Одноразовая первичная регистрация администратора
CREATE TABLE IF NOT EXISTS public.admin_bootstrap (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  used_at timestamptz,
  used_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.admin_bootstrap TO service_role;
ALTER TABLE public.admin_bootstrap ENABLE ROW LEVEL SECURITY;

INSERT INTO public.admin_bootstrap (id, used_at) VALUES (true, NULL)
ON CONFLICT (id) DO UPDATE SET used_at = NULL, used_by = NULL, updated_at = now();