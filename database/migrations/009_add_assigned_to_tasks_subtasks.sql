-- Khớp client: tasks/subtasks có assigned_to + embed users:assigned_to(full_name)

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.users(user_id) ON DELETE SET NULL;

ALTER TABLE public.subtasks
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.users(user_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_subtasks_assigned_to ON public.subtasks(assigned_to);
