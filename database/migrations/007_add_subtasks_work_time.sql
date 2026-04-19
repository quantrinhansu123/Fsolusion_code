-- Thời gian làm việc tiểu mục: mảng JSON [{ "started_at": ISO8601, "ended_at": ISO8601 | null }, ...]
ALTER TABLE public.subtasks ADD COLUMN IF NOT EXISTS work_time JSONB NOT NULL DEFAULT '[]'::jsonb;
