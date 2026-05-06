-- Mốc ngày giờ dự kiến — chỉ nhập tay, để so sánh sau; không gắn với deadline hay timer.
ALTER TABLE public.subtasks ADD COLUMN IF NOT EXISTS plan_target_at TIMESTAMPTZ;

COMMENT ON COLUMN public.subtasks.plan_target_at IS 'Mốc dự kiến (ngày giờ phút) — tham chiếu/so sánh, độc lập deadline';
