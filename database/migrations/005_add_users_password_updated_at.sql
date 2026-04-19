-- Mật khẩu đăng nhập luôn lưu trong auth.users (Supabase Auth).
-- Cột này chỉ ghi thời điểm đổi mật khẩu lần cuối (đồng bộ từ Edge Function admin-user hoặc cập nhật thủ công).
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN public.users.password_updated_at IS 'Thời điểm cập nhật mật khẩu gần nhất (Auth); không lưu chuỗi mật khẩu trong public.users.';
