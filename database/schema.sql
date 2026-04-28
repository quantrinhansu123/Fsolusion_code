-- ============================================================
-- Project Manager - Supabase Schema (Safe & Idempotent)
-- ============================================================

-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Tables (Using IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS public.users (
    user_id      UUID PRIMARY KEY,
    full_name    TEXT        NOT NULL,
    email        TEXT        NOT NULL UNIQUE,
    role         TEXT        NOT NULL DEFAULT 'employee',
    department   TEXT,
    avatar_url   TEXT,
    password_updated_at TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure the role constraint is correct even if table already existed
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'manager', 'employee'));

CREATE TABLE IF NOT EXISTS customers (
    customer_id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id       UUID        NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
    name          TEXT        NOT NULL,
    email         TEXT,
    phone         TEXT,
    address       TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projects (
    project_id    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id   UUID        NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
    name          TEXT        NOT NULL,
    description   TEXT,
    pricing       NUMERIC(15, 2),
    deadline      TIMESTAMPTZ,
    status        TEXT        NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'in_progress', 'completed', 'overdue')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS features (
    feature_id    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id    UUID        NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
    name          TEXT        NOT NULL,
    description   TEXT,
    deadline      TIMESTAMPTZ,
    status        TEXT        NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'in_progress', 'completed', 'overdue')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tasks (
    task_id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    feature_id    UUID        NOT NULL REFERENCES features(feature_id) ON DELETE CASCADE,
    name          TEXT        NOT NULL,
    assigned_to   UUID        REFERENCES public.users(user_id) ON DELETE SET NULL,
    description   TEXT,
    image_url     TEXT,
    content_blocks JSONB      DEFAULT '[]'::jsonb,
    deadline      TIMESTAMPTZ,
    status        TEXT        NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'in_progress', 'completed', 'overdue')),
    completed_at  TIMESTAMPTZ,
    status_updated_at TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS task_status_history (
    history_id    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id       UUID NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
    status        TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'overdue')),
    recorded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subtasks (
    subtask_id    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id       UUID        NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
    name          TEXT        NOT NULL,
    assigned_to   UUID        REFERENCES public.users(user_id) ON DELETE SET NULL,
    description   TEXT,
    image_url     TEXT,
    content_blocks JSONB      DEFAULT '[]'::jsonb,
    deadline      TIMESTAMPTZ,
    status        TEXT        NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'in_progress', 'completed', 'overdue')),
    completed_at  TIMESTAMPTZ,
    work_time     JSONB       NOT NULL DEFAULT '[]'::jsonb,
    evaluation_rating TEXT,
    evaluation_note   TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_assignments (
    assignment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id    UUID        NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
    user_id       UUID        NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
    assigned_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(project_id, user_id)
);

-- 3. Functions & Triggers (Using OR REPLACE)
CREATE OR REPLACE FUNCTION get_user_role(check_user_id UUID)
RETURNS TEXT AS $$
    SELECT role FROM public.users WHERE user_id = check_user_id;
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
-- ... (rest of function as before)
BEGIN
    INSERT INTO public.users (user_id, full_name, email)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'Admin'),
        NEW.email
    ) ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;
CREATE TRIGGER trg_on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Re-attach update triggers safely
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_users_updated_at') THEN
        CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    -- (Repeat for others if needed, omitted for brevity but recommended)
END $$;

-- 4. RLS (Enable)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers    ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects     ENABLE ROW LEVEL SECURITY;
ALTER TABLE features     ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks        ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE subtasks     ENABLE ROW LEVEL SECURITY;

-- 5. Policies (Clean and Re-create)
-- This section ensures policies are fresh.
DO $$ 
DECLARE
    pol_name TEXT;
BEGIN
    -- Drop all relevant policies first to avoid "already exists" errors
    FOR pol_name IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol_name, (SELECT tablename FROM pg_policies WHERE policyname = pol_name AND schemaname = 'public' LIMIT 1));
    END LOOP;
END $$;

-- Re-create all policies
CREATE POLICY "users_view_profiles" ON public.users FOR SELECT USING (auth.uid() = user_id OR get_user_role(auth.uid()) = 'admin');
CREATE POLICY "users_admin_manage" ON public.users FOR ALL USING (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "customers_access" ON customers FOR SELECT USING (get_user_role(auth.uid()) = 'admin' OR EXISTS (SELECT 1 FROM project_assignments pa JOIN projects p ON p.project_id = pa.project_id WHERE pa.user_id = auth.uid() AND p.customer_id = customers.customer_id));
CREATE POLICY "customers_admin_modify" ON customers FOR ALL USING (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "projects_access" ON projects FOR ALL USING (get_user_role(auth.uid()) = 'admin' OR EXISTS (SELECT 1 FROM project_assignments pa WHERE pa.project_id = projects.project_id AND pa.user_id = auth.uid()));

CREATE POLICY "assignments_access" ON project_assignments FOR ALL USING (get_user_role(auth.uid()) IN ('admin', 'manager'));

CREATE POLICY "features_access" ON features FOR ALL USING (get_user_role(auth.uid()) = 'admin' OR EXISTS (SELECT 1 FROM project_assignments pa WHERE pa.project_id = features.project_id AND pa.user_id = auth.uid()));

CREATE POLICY "tasks_view_all" ON tasks FOR SELECT USING (get_user_role(auth.uid()) = 'admin' OR EXISTS (SELECT 1 FROM project_assignments pa JOIN features f ON f.project_id = pa.project_id WHERE f.feature_id = tasks.feature_id AND pa.user_id = auth.uid()));
CREATE POLICY "tasks_modify_manager_admin" ON tasks FOR ALL USING (get_user_role(auth.uid()) IN ('admin', 'manager'));
CREATE POLICY "tasks_update_project_member" ON tasks FOR UPDATE USING (EXISTS (SELECT 1 FROM project_assignments pa INNER JOIN features f ON f.project_id = pa.project_id WHERE f.feature_id = tasks.feature_id AND pa.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM project_assignments pa INNER JOIN features f ON f.project_id = pa.project_id WHERE f.feature_id = tasks.feature_id AND pa.user_id = auth.uid()));

CREATE POLICY "subtasks_select" ON subtasks FOR SELECT USING (get_user_role(auth.uid()) IN ('admin', 'manager') OR EXISTS (SELECT 1 FROM project_assignments pa JOIN features f ON f.project_id = pa.project_id JOIN tasks t ON t.feature_id = f.feature_id WHERE t.task_id = subtasks.task_id AND pa.user_id = auth.uid()));
CREATE POLICY "subtasks_insert" ON subtasks FOR INSERT WITH CHECK (get_user_role(auth.uid()) IN ('admin', 'manager') OR EXISTS (SELECT 1 FROM project_assignments pa JOIN features f ON f.project_id = pa.project_id JOIN tasks t ON t.feature_id = f.feature_id WHERE t.task_id = subtasks.task_id AND pa.user_id = auth.uid()));
CREATE POLICY "subtasks_update" ON subtasks FOR UPDATE USING (get_user_role(auth.uid()) IN ('admin', 'manager') OR EXISTS (SELECT 1 FROM project_assignments pa JOIN features f ON f.project_id = pa.project_id JOIN tasks t ON t.feature_id = f.feature_id WHERE t.task_id = subtasks.task_id AND pa.user_id = auth.uid())) WITH CHECK (get_user_role(auth.uid()) IN ('admin', 'manager') OR EXISTS (SELECT 1 FROM project_assignments pa JOIN features f ON f.project_id = pa.project_id JOIN tasks t ON t.feature_id = f.feature_id WHERE t.task_id = subtasks.task_id AND pa.user_id = auth.uid()));
CREATE POLICY "subtasks_delete" ON subtasks FOR DELETE USING (get_user_role(auth.uid()) IN ('admin', 'manager') OR EXISTS (SELECT 1 FROM project_assignments pa JOIN features f ON f.project_id = pa.project_id JOIN tasks t ON t.feature_id = f.feature_id WHERE t.task_id = subtasks.task_id AND pa.user_id = auth.uid()));

CREATE POLICY "task_status_history_select" ON task_status_history FOR SELECT USING (get_user_role(auth.uid()) = 'admin' OR EXISTS (SELECT 1 FROM project_assignments pa JOIN features f ON f.project_id = pa.project_id JOIN tasks t ON t.feature_id = f.feature_id WHERE t.task_id = task_status_history.task_id AND pa.user_id = auth.uid()));
CREATE POLICY "task_status_history_insert" ON task_status_history FOR INSERT WITH CHECK (get_user_role(auth.uid()) = 'admin' OR EXISTS (SELECT 1 FROM project_assignments pa JOIN features f ON f.project_id = pa.project_id JOIN tasks t ON t.feature_id = f.feature_id WHERE t.task_id = task_status_history.task_id AND pa.user_id = auth.uid()));

-- Upgrade existing databases (safe if column already exists)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.users(user_id) ON DELETE SET NULL;
ALTER TABLE subtasks ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.users(user_id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMPTZ;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS content_blocks JSONB DEFAULT '[]'::jsonb;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE subtasks ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE subtasks ADD COLUMN IF NOT EXISTS content_blocks JSONB DEFAULT '[]'::jsonb;
ALTER TABLE subtasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Ensure the role constraint is correct even if table already existed
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'manager', 'employee'));

CREATE TABLE IF NOT EXISTS customers (
    customer_id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id       UUID        NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
    name          TEXT        NOT NULL,
    email         TEXT,
    phone         TEXT,
    address       TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projects (
    project_id    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id   UUID        NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
    name          TEXT        NOT NULL,
    description   TEXT,
    pricing       NUMERIC(15, 2),
    deadline      TIMESTAMPTZ,
    status        TEXT        NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'in_progress', 'completed', 'overdue')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS features (
    feature_id    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id    UUID        NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
    name          TEXT        NOT NULL,
    description   TEXT,
    deadline      TIMESTAMPTZ,
    status        TEXT        NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'in_progress', 'completed', 'overdue')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tasks (
    task_id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    feature_id    UUID        NOT NULL REFERENCES features(feature_id) ON DELETE CASCADE,
    name          TEXT        NOT NULL,
    assigned_to   UUID        REFERENCES public.users(user_id) ON DELETE SET NULL,
    description   TEXT,
    image_url     TEXT,
    content_blocks JSONB      DEFAULT '[]'::jsonb,
    deadline      TIMESTAMPTZ,
    status        TEXT        NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'in_progress', 'completed', 'overdue')),
    completed_at  TIMESTAMPTZ,
    status_updated_at TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS task_status_history (
    history_id    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id       UUID NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
    status        TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'overdue')),
    recorded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subtasks (
    subtask_id    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id       UUID        NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
    name          TEXT        NOT NULL,
    assigned_to   UUID        REFERENCES public.users(user_id) ON DELETE SET NULL,
    description   TEXT,
    image_url     TEXT,
    content_blocks JSONB      DEFAULT '[]'::jsonb,
    deadline      TIMESTAMPTZ,
    status        TEXT        NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'in_progress', 'completed', 'overdue')),
    completed_at  TIMESTAMPTZ,
    work_time     JSONB       NOT NULL DEFAULT '[]'::jsonb,
    evaluation_rating TEXT,
    evaluation_note   TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_assignments (
    assignment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id    UUID        NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
    user_id       UUID        NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
    assigned_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(project_id, user_id)
);

-- 3. Functions & Triggers (Using OR REPLACE)
CREATE OR REPLACE FUNCTION get_user_role(check_user_id UUID)
RETURNS TEXT AS $$
    SELECT role FROM public.users WHERE user_id = check_user_id;
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
-- ... (rest of function as before)
BEGIN
    INSERT INTO public.users (user_id, full_name, email)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'Admin'),
        NEW.email
    ) ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;
CREATE TRIGGER trg_on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Re-attach update triggers safely
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_users_updated_at') THEN
        CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    -- (Repeat for others if needed, omitted for brevity but recommended)
END $$;

-- 4. RLS (Enable)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers    ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects     ENABLE ROW LEVEL SECURITY;
ALTER TABLE features     ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks        ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE subtasks     ENABLE ROW LEVEL SECURITY;

-- 5. Policies (Clean and Re-create)
-- This section ensures policies are fresh.
DO $$ 
DECLARE
    pol_name TEXT;
BEGIN
    -- Drop all relevant policies first to avoid "already exists" errors
    FOR pol_name IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol_name, (SELECT tablename FROM pg_policies WHERE policyname = pol_name AND schemaname = 'public' LIMIT 1));
    END LOOP;
END $$;

-- Re-create all policies
CREATE POLICY "users_view_profiles" ON public.users FOR SELECT USING (auth.uid() = user_id OR get_user_role(auth.uid()) = 'admin');
CREATE POLICY "users_admin_manage" ON public.users FOR ALL USING (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "customers_access" ON customers FOR SELECT USING (get_user_role(auth.uid()) = 'admin' OR EXISTS (SELECT 1 FROM project_assignments pa JOIN projects p ON p.project_id = pa.project_id WHERE pa.user_id = auth.uid() AND p.customer_id = customers.customer_id));
CREATE POLICY "customers_admin_modify" ON customers FOR ALL USING (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "projects_access" ON projects FOR ALL USING (get_user_role(auth.uid()) = 'admin' OR EXISTS (SELECT 1 FROM project_assignments pa WHERE pa.project_id = projects.project_id AND pa.user_id = auth.uid()));

CREATE POLICY "assignments_access" ON project_assignments FOR ALL USING (get_user_role(auth.uid()) IN ('admin', 'manager'));

CREATE POLICY "features_access" ON features FOR ALL USING (get_user_role(auth.uid()) = 'admin' OR EXISTS (SELECT 1 FROM project_assignments pa WHERE pa.project_id = features.project_id AND pa.user_id = auth.uid()));

CREATE POLICY "tasks_view_all" ON tasks FOR SELECT USING (get_user_role(auth.uid()) = 'admin' OR EXISTS (SELECT 1 FROM project_assignments pa JOIN features f ON f.project_id = pa.project_id WHERE f.feature_id = tasks.feature_id AND pa.user_id = auth.uid()));
CREATE POLICY "tasks_modify_manager_admin" ON tasks FOR ALL USING (get_user_role(auth.uid()) IN ('admin', 'manager'));
CREATE POLICY "tasks_update_project_member" ON tasks FOR UPDATE USING (EXISTS (SELECT 1 FROM project_assignments pa INNER JOIN features f ON f.project_id = pa.project_id WHERE f.feature_id = tasks.feature_id AND pa.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM project_assignments pa INNER JOIN features f ON f.project_id = pa.project_id WHERE f.feature_id = tasks.feature_id AND pa.user_id = auth.uid()));

CREATE POLICY "subtasks_select" ON subtasks FOR SELECT USING (get_user_role(auth.uid()) IN ('admin', 'manager') OR EXISTS (SELECT 1 FROM project_assignments pa JOIN features f ON f.project_id = pa.project_id JOIN tasks t ON t.feature_id = f.feature_id WHERE t.task_id = subtasks.task_id AND pa.user_id = auth.uid()));
CREATE POLICY "subtasks_insert" ON subtasks FOR INSERT WITH CHECK (get_user_role(auth.uid()) IN ('admin', 'manager') OR EXISTS (SELECT 1 FROM project_assignments pa JOIN features f ON f.project_id = pa.project_id JOIN tasks t ON t.feature_id = f.feature_id WHERE t.task_id = subtasks.task_id AND pa.user_id = auth.uid()));
CREATE POLICY "subtasks_update" ON subtasks FOR UPDATE USING (get_user_role(auth.uid()) IN ('admin', 'manager') OR EXISTS (SELECT 1 FROM project_assignments pa JOIN features f ON f.project_id = pa.project_id JOIN tasks t ON t.feature_id = f.feature_id WHERE t.task_id = subtasks.task_id AND pa.user_id = auth.uid())) WITH CHECK (get_user_role(auth.uid()) IN ('admin', 'manager') OR EXISTS (SELECT 1 FROM project_assignments pa JOIN features f ON f.project_id = pa.project_id JOIN tasks t ON t.feature_id = f.feature_id WHERE t.task_id = subtasks.task_id AND pa.user_id = auth.uid()));
CREATE POLICY "subtasks_delete" ON subtasks FOR DELETE USING (get_user_role(auth.uid()) IN ('admin', 'manager') OR EXISTS (SELECT 1 FROM project_assignments pa JOIN features f ON f.project_id = pa.project_id JOIN tasks t ON t.feature_id = f.feature_id WHERE t.task_id = subtasks.task_id AND pa.user_id = auth.uid()));

CREATE POLICY "task_status_history_select" ON task_status_history FOR SELECT USING (get_user_role(auth.uid()) = 'admin' OR EXISTS (SELECT 1 FROM project_assignments pa JOIN features f ON f.project_id = pa.project_id JOIN tasks t ON t.feature_id = f.feature_id WHERE t.task_id = task_status_history.task_id AND pa.user_id = auth.uid()));
CREATE POLICY "task_status_history_insert" ON task_status_history FOR INSERT WITH CHECK (get_user_role(auth.uid()) = 'admin' OR EXISTS (SELECT 1 FROM project_assignments pa JOIN features f ON f.project_id = pa.project_id JOIN tasks t ON t.feature_id = f.feature_id WHERE t.task_id = task_status_history.task_id AND pa.user_id = auth.uid()));

-- Upgrade existing databases (safe if column already exists)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.users(user_id) ON DELETE SET NULL;
ALTER TABLE subtasks ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.users(user_id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMPTZ;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS content_blocks JSONB DEFAULT '[]'::jsonb;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE subtasks ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE subtasks ADD COLUMN IF NOT EXISTS content_blocks JSONB DEFAULT '[]'::jsonb;
ALTER TABLE subtasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE subtasks ADD COLUMN IF NOT EXISTS work_time JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password_updated_at TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password TEXT;

-- ============================================================
-- 6. TỰ ĐỘNG CẤP QUYỀN KHI ĐƯỢC GÁN TASK/SUBTASK (An toàn - Chống đệ quy)
-- ============================================================

-- 6.1 Tạo hàm kiểm tra ngầm (Bypass RLS để chống đệ quy vòng lặp)
CREATE OR REPLACE FUNCTION check_task_access_via_subtask(check_task_id UUID, check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM subtasks s WHERE s.task_id = check_task_id AND s.assigned_to = check_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION check_feature_access_via_task(check_feature_id UUID, check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM tasks t 
    LEFT JOIN subtasks s ON s.task_id = t.task_id 
    WHERE t.feature_id = check_feature_id 
    AND (t.assigned_to = check_user_id OR s.assigned_to = check_user_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION check_project_access_via_task(check_project_id UUID, check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM features f 
    JOIN tasks t ON t.feature_id = f.feature_id 
    LEFT JOIN subtasks s ON s.task_id = t.task_id 
    WHERE f.project_id = check_project_id 
    AND (t.assigned_to = check_user_id OR s.assigned_to = check_user_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6.2 Cấp quyền an toàn
CREATE POLICY "subtasks_select_assigned" ON subtasks FOR SELECT USING (assigned_to = auth.uid());
CREATE POLICY "subtasks_update_assigned" ON subtasks FOR UPDATE USING (assigned_to = auth.uid());

CREATE POLICY "tasks_select_assigned" ON tasks FOR SELECT USING (
  assigned_to = auth.uid() OR check_task_access_via_subtask(task_id, auth.uid())
);

CREATE POLICY "features_select_assigned" ON features FOR SELECT USING (
  check_feature_access_via_task(feature_id, auth.uid())
);

CREATE POLICY "projects_select_assigned" ON projects FOR SELECT USING (
  check_project_access_via_task(project_id, auth.uid())
);

-- ============================================================
-- Internal-auth mode (no Supabase Auth session)
-- ============================================================
-- Keep RLS enabled but open policies for anon/authenticated roles.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'users',
        'customers',
        'projects',
        'project_assignments',
        'features',
        'tasks',
        'subtasks',
        'task_status_history',
        'work_sessions'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

CREATE POLICY users_open_all ON public.users FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY customers_open_all ON public.customers FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY projects_open_all ON public.projects FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY project_assignments_open_all ON public.project_assignments FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY features_open_all ON public.features FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY tasks_open_all ON public.tasks FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY subtasks_open_all ON public.subtasks FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY task_status_history_open_all ON public.task_status_history FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY work_sessions_open_all ON public.work_sessions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated;
