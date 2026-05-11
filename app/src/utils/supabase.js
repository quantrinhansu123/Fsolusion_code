import { createClient } from '@supabase/supabase-js';

const pickEnv = (...values) => {
  for (const v of values) {
    if (typeof v === 'string' && v.trim() !== '') return v.trim();
  }
  return undefined;
};

const supabaseUrl = pickEnv(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.NEXT_PUBLIC_SUPABASE_URL
);
const supabaseKey = pickEnv(
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
);

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing Supabase env vars. For local dev: create .env at the repo root (same folder as package.json workspace root) with VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY from Supabase → Project Settings → API, then restart the dev server. For production: set the same VITE_* names in your host (e.g. Vercel Environment Variables) and redeploy so `vite build` can embed them. See root .env.example.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Dùng cho signUp tạo user khác khi admin đã đăng nhập: không lưu session vào storage mặc định,
 * tránh ghi đè / đăng xuất phiên admin.
 */
export const supabaseAuthSignUpEphemeral = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});
