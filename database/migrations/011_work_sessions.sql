-- 1. Tạo bảng work_sessions
CREATE TABLE IF NOT EXISTS public.work_sessions (
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
    work_date DATE NOT NULL,
    check_in_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    check_out_time TIMESTAMPTZ,
    total_hours NUMERIC(5,2),
    completed_tasks JSONB DEFAULT '[]'::jsonb,
    status VARCHAR(20) DEFAULT 'working' CHECK (status IN ('working', 'completed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger cập nhật updated_at
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_work_sessions_updated_at') THEN
        CREATE TRIGGER trg_work_sessions_updated_at 
        BEFORE UPDATE ON public.work_sessions 
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- 2. Đánh Index (Tối ưu tốc độ)
CREATE INDEX IF NOT EXISTS idx_work_sessions_work_date ON public.work_sessions(work_date);
CREATE INDEX IF NOT EXISTS idx_work_sessions_user_id ON public.work_sessions(user_id);

-- 3. Cập nhật bảng subtasks cũ
ALTER TABLE public.subtasks ADD COLUMN IF NOT EXISTS session_id UUID;

-- Thêm Foreign Key riêng lẻ đảm bảo tương thích nếu cột đã tồn tại
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_subtasks_session') THEN
        ALTER TABLE public.subtasks
        ADD CONSTRAINT fk_subtasks_session
        FOREIGN KEY (session_id) REFERENCES public.work_sessions(session_id)
        ON DELETE SET NULL;
    END IF;
END $$;

-- 4. Bật bảo mật RLS cho work_sessions
ALTER TABLE public.work_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "work_sessions_select" ON public.work_sessions;
CREATE POLICY "work_sessions_select" ON public.work_sessions
FOR SELECT USING (get_user_role(auth.uid()) IN ('admin', 'manager') OR user_id = auth.uid());

DROP POLICY IF EXISTS "work_sessions_insert" ON public.work_sessions;
CREATE POLICY "work_sessions_insert" ON public.work_sessions
FOR INSERT WITH CHECK (user_id = auth.uid() OR get_user_role(auth.uid()) IN ('admin', 'manager'));

DROP POLICY IF EXISTS "work_sessions_update" ON public.work_sessions;
CREATE POLICY "work_sessions_update" ON public.work_sessions
FOR UPDATE USING (user_id = auth.uid() OR get_user_role(auth.uid()) IN ('admin', 'manager'))
WITH CHECK (user_id = auth.uid() OR get_user_role(auth.uid()) IN ('admin', 'manager'));
