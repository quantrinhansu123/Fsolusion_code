import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing Supabase env vars. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in the project root .env or app/.env.local (Supabase Dashboard → Project Settings → API), then restart the dev server.'
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
