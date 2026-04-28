-- Internal-auth mode (no Supabase Auth session):
-- open RLS for anon/authenticated so frontend can read/write directly.

-- Ensure RLS is enabled (policies below will allow access).
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subtasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_sessions ENABLE ROW LEVEL SECURITY;

-- Remove old auth.uid()-based policies.
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

-- Broad policies for internal mode.
CREATE POLICY users_open_all ON public.users FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY customers_open_all ON public.customers FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY projects_open_all ON public.projects FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY project_assignments_open_all ON public.project_assignments FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY features_open_all ON public.features FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY tasks_open_all ON public.tasks FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY subtasks_open_all ON public.subtasks FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY task_status_history_open_all ON public.task_status_history FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY work_sessions_open_all ON public.work_sessions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Ensure role privileges exist (required alongside RLS).
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated;
