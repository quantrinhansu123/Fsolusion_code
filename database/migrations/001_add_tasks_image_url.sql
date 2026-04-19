-- Add optional image URL for tasks (run once on Supabase SQL editor if DB was created before this column)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS image_url TEXT;
