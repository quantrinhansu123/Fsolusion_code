-- Cột này ghi thời điểm đổi mật khẩu gần nhất trong cơ chế đăng nhập nội bộ.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN public.users.password_updated_at IS 'Thời điểm cập nhật mật khẩu gần nhất.';
