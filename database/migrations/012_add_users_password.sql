ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password TEXT;

COMMENT ON COLUMN public.users.password IS 'Mat khau dang nhap noi bo (tam thoi dang luu plain text).';
