-- Lịch sử đổi trạng thái nhiệm vụ + thời điểm cập nhật gần nhất trên tasks

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.task_status_history (
  history_id    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id       UUID NOT NULL REFERENCES public.tasks(task_id) ON DELETE CASCADE,
  status        TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'overdue')),
  recorded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_status_history_task_id ON public.task_status_history(task_id);
CREATE INDEX IF NOT EXISTS idx_task_status_history_recorded_at ON public.task_status_history(recorded_at DESC);

ALTER TABLE public.task_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_status_history_select" ON public.task_status_history FOR SELECT
USING (
  get_user_role(auth.uid()) = 'admin'
  OR EXISTS (
    SELECT 1
    FROM public.tasks t
    INNER JOIN public.features f ON f.feature_id = t.feature_id
    INNER JOIN public.project_assignments pa ON pa.project_id = f.project_id AND pa.user_id = auth.uid()
    WHERE t.task_id = task_status_history.task_id
  )
);

CREATE POLICY "task_status_history_insert" ON public.task_status_history FOR INSERT
WITH CHECK (
  get_user_role(auth.uid()) = 'admin'
  OR EXISTS (
    SELECT 1
    FROM public.tasks t
    INNER JOIN public.features f ON f.feature_id = t.feature_id
    INNER JOIN public.project_assignments pa ON pa.project_id = f.project_id AND pa.user_id = auth.uid()
    WHERE t.task_id = task_status_history.task_id
  )
);

COMMENT ON TABLE public.task_status_history IS 'Mỗi lần đổi trạng thái task (từ app) ghi một dòng kèm thời gian.';
COMMENT ON COLUMN public.tasks.status_updated_at IS 'Thời điểm đổi trạng thái gần nhất (đồng bộ với bản ghi history mới nhất).';
