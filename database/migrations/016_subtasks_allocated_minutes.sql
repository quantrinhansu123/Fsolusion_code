-- Legacy (app không còn dùng để tính deadline). Ưu tiên dùng plan_target_at (017).
ALTER TABLE public.subtasks ADD COLUMN IF NOT EXISTS allocated_minutes INTEGER;

COMMENT ON COLUMN public.subtasks.allocated_minutes IS 'Không dùng trong app — mốc so sánh dùng plan_target_at';
