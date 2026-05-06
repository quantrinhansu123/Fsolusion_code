import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 1. Lấy session hiện tại
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchProfile(session.user)
      } else {
        setLoading(false)
      }
    })

    // 2. Lắng nghe thay đổi auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        fetchProfile(session.user)
      } else {
        setUser(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(authUser) {
    try {
      // 1. Kiểm tra chính xác dữ liệu trả về
      const { data: profile, error } = await supabase
        .from('users')
        .select('*')
        .eq('user_id', authUser.id)
        .maybeSingle(); // Dùng maybeSingle để tránh báo lỗi đỏ khi không tìm thấy dòng

      if (error) {
        console.error('[AuthContext] SQL Error:', error.message);
        setUser(authUser);
        return;
      }

      if (!profile) {
        console.warn('[AuthContext] No profile found for:', authUser.email);
        setUser(authUser);
      } else {
        // Log để ông soi xem dữ liệu cũ có bị NULL chỗ nào không
        console.log('[AuthContext] Profile Loaded:', profile);

        // Đảm bảo không có password cũ gây nhiễu (vì nó luôn NULL)
        const { password, ...cleanProfile } = profile;

        setUser({ ...authUser, ...cleanProfile });
      }
    } catch (err) {
      console.error('[AuthContext] Crash:', err);
      setUser(authUser);
    } finally {
      setLoading(false);
    }
  }
  return (
    <AuthContext.Provider value={{ user, loading, refreshProfile: () => user && fetchProfile(user) }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
