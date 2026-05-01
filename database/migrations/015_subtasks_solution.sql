-- Giải pháp / hướng xử lý cho tiểu mục (hiển thị cột trên bảng dự án, form, v.v.)
ALTER TABLE public.subtasks ADD COLUMN IF NOT EXISTS solution TEXT;

COMMENT ON COLUMN public.subtasks.solution IS 'Mô tả giải pháp cho tiểu mục';

-- Nếu có view staff_subtasks_view liệt kê cột tường minh (không phải subtasks.*),
-- cần thêm solution vào SELECT hoặc tạo lại view.
