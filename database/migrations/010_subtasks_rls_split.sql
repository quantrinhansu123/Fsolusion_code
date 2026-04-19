-- Tách RLS subtasks: INSERT có WITH CHECK rõ ràng (tránh lệch hành vi FOR ALL trên một số bản Postgres / PostgREST).
-- Idempotent: xóa mọi policy tên cũ/mới trước khi tạo lại (chạy lại an toàn).

DROP POLICY IF EXISTS "subtasks_access" ON public.subtasks;
DROP POLICY IF EXISTS "subtasks_select" ON public.subtasks;
DROP POLICY IF EXISTS "subtasks_insert" ON public.subtasks;
DROP POLICY IF EXISTS "subtasks_update" ON public.subtasks;
DROP POLICY IF EXISTS "subtasks_delete" ON public.subtasks;

CREATE POLICY "subtasks_select" ON public.subtasks
FOR SELECT
USING (
  get_user_role(auth.uid()) IN ('admin', 'manager')
  OR EXISTS (
    SELECT 1
    FROM public.project_assignments pa
    INNER JOIN public.features f ON f.project_id = pa.project_id
    INNER JOIN public.tasks t ON t.feature_id = f.feature_id
    WHERE t.task_id = subtasks.task_id AND pa.user_id = auth.uid()
  )
);

CREATE POLICY "subtasks_insert" ON public.subtasks
FOR INSERT
WITH CHECK (
  get_user_role(auth.uid()) IN ('admin', 'manager')
  OR EXISTS (
    SELECT 1
    FROM public.project_assignments pa
    INNER JOIN public.features f ON f.project_id = pa.project_id
    INNER JOIN public.tasks t ON t.feature_id = f.feature_id
    WHERE t.task_id = subtasks.task_id AND pa.user_id = auth.uid()
  )
);

CREATE POLICY "subtasks_update" ON public.subtasks
FOR UPDATE
USING (
  get_user_role(auth.uid()) IN ('admin', 'manager')
  OR EXISTS (
    SELECT 1
    FROM public.project_assignments pa
    INNER JOIN public.features f ON f.project_id = pa.project_id
    INNER JOIN public.tasks t ON t.feature_id = f.feature_id
    WHERE t.task_id = subtasks.task_id AND pa.user_id = auth.uid()
  )
)
WITH CHECK (
  get_user_role(auth.uid()) IN ('admin', 'manager')
  OR EXISTS (
    SELECT 1
    FROM public.project_assignments pa
    INNER JOIN public.features f ON f.project_id = pa.project_id
    INNER JOIN public.tasks t ON t.feature_id = f.feature_id
    WHERE t.task_id = subtasks.task_id AND pa.user_id = auth.uid()
  )
);

CREATE POLICY "subtasks_delete" ON public.subtasks
FOR DELETE
USING (
  get_user_role(auth.uid()) IN ('admin', 'manager')
  OR EXISTS (
    SELECT 1
    FROM public.project_assignments pa
    INNER JOIN public.features f ON f.project_id = pa.project_id
    INNER JOIN public.tasks t ON t.feature_id = f.feature_id
    WHERE t.task_id = subtasks.task_id AND pa.user_id = auth.uid()
  )
);
