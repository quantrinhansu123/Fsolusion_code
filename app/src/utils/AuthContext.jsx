import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

const AuthContext = createContext({})
const AUTH_USER_KEY = 'pm_auth_user_id'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const storedUserId = localStorage.getItem(AUTH_USER_KEY)
    if (!storedUserId) {
      setLoading(false)
      return
    }
    fetchProfileById(storedUserId)
  }, [])

  async function signInLocal(userId) {
    localStorage.setItem(AUTH_USER_KEY, userId)
    await fetchProfileById(userId)
  }

  function signOutLocal() {
    localStorage.removeItem(AUTH_USER_KEY)
    setUser(null)
    setLoading(false)
  }

  async function fetchProfileById(userId) {
    try {
      // 1. Kiểm tra chính xác dữ liệu trả về
      const { data: profile, error } = await supabase
        .from('users')
        .select('*')
<<<<<<< HEAD
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
=======
        .eq('user_id', userId)
        .single()

      if (error) {
        console.error('[AuthContext] Profile fetch error:', error)
        setUser(null)
        localStorage.removeItem(AUTH_USER_KEY)
      } else {
        setUser(profile)
      }
    } catch (err) {
      console.error('[AuthContext] System error:', err)
      setUser(null)
      localStorage.removeItem(AUTH_USER_KEY)
>>>>>>> b4348e6fc9f0bbc70789f2265e6d4aa1bb96c380
    } finally {
      setLoading(false);
    }
  }
  return (
    <AuthContext.Provider value={{
      user,
      loading,
      signInLocal,
      signOutLocal,
      refreshProfile: () => user?.user_id && fetchProfileById(user.user_id),
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
