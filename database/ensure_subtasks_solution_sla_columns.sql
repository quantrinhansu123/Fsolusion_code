-- =============================================================================
-- Chạy trên Supabase: Dashboard → SQL Editor → New query → Run
-- Sửa: "Could not find the 'solution' column of 'subtasks' in the schema cache"
-- =============================================================================

ALTER TABLE public.subtasks ADD COLUMN IF NOT EXISTS solution TEXT;
COMMENT ON COLUMN public.subtasks.solution IS 'Phương án giải quyết cho tiểu mục';

ALTER TABLE public.subtasks ADD COLUMN IF NOT EXISTS allocated_minutes INTEGER;
COMMENT ON COLUMN public.subtasks.allocated_minutes IS 'Legacy — app không còn dùng để tính deadline';

ALTER TABLE public.subtasks ADD COLUMN IF NOT EXISTS plan_target_at TIMESTAMPTZ;
COMMENT ON COLUMN public.subtasks.plan_target_at IS 'Mốc dự kiến (ngày giờ) — so sánh, không tự cộng deadline';

NOTIFY pgrst, 'reload schema';

-- staff_subtasks_view: thêm solution, plan_target_at (và allocated_minutes nếu cần) nếu view liệt kê cột tường minh.
