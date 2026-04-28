-- Remove dependency on Supabase Auth so users can be created internally.
ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_user_id_fkey;
