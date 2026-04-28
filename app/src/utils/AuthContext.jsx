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
      const { data: profile, error } = await supabase
        .from('users')
        .select('*')
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
    } finally {
      setLoading(false)
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
