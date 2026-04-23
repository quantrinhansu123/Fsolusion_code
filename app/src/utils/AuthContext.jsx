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
      const { data: profile, error } = await supabase
        .from('users')
        .select('*')
        .eq('user_id', authUser.id)
        .single()

      if (error) {
        console.error('[AuthContext] Profile fetch error:', error)
        setUser(authUser) // Vẫn giữ thông tin auth cơ bản
      } else {
        console.log('[AuthContext] Role:', profile.role)
        setUser({ ...authUser, ...profile })
      }
    } catch (err) {
      console.error('[AuthContext] System error:', err)
      setUser(authUser)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, refreshProfile: () => user && fetchProfile(user) }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
