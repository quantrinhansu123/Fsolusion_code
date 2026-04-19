-- Thời điểm hoàn thành task (ghi khi bấm Hoàn thành hoặc đặt trạng thái Hoàn thành trong form)
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Thành viên được phân công dự án có thể cập nhật task (vd. đánh dấu hoàn thành)
DROP POLICY IF EXISTS "tasks_update_project_member" ON public.tasks;
CREATE POLICY "tasks_update_project_member" ON public.tasks
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.project_assignments pa
    INNER JOIN public.features f ON f.project_id = pa.project_id
    WHERE f.feature_id = tasks.feature_id AND pa.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.project_assignments pa
    INNER JOIN public.features f ON f.project_id = pa.project_id
    WHERE f.feature_id = tasks.feature_id AND pa.user_id = auth.uid()
  )
);
