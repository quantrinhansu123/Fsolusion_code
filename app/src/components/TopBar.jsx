import { useState, useEffect } from 'react'
import { supabase } from '../utils/supabase'

export default function TopBar({ title, subtitle }) {
  const [user, setUser] = useState(null)

  useEffect(() => {
    fetchProfile()
  }, [])

  async function fetchProfile() {
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (authUser) {
      const { data: profile } = await supabase.from('users').select('*').eq('user_id', authUser.id).single()
      setUser({ ...authUser, ...profile })
    }
  }

  const role = user?.role || 'employee'
  const name = user?.full_name || 'User'
  const initial = name.charAt(0).toUpperCase()

  const ROLE_NAMES = {
    admin: 'Quản trị viên',
    manager: 'Quản lý',
    employee: 'Nhân viên'
  }

  function openMobileSidebar() {
    window.dispatchEvent(new Event('open-mobile-sidebar'))
  }

  return (
    <>
      <header className="sticky top-0 z-20 flex h-16 w-full items-center justify-between border-b border-[#bec8d2]/15 bg-white px-4 md:hidden">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={openMobileSidebar}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-[#f2f3ff] hover:text-[#0ea5e9] transition-colors"
            aria-label="Mở menu"
          >
            <span className="material-symbols-outlined">menu</span>
          </button>
          <div className="flex min-w-0 items-center gap-2">
            <div className="w-8 h-8 rounded-lg primary-gradient flex items-center justify-center text-white shadow-lg">
              <span className="material-symbols-outlined icon-fill text-[18px] text-white">architecture</span>
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-bold tracking-tight text-[#131b2e]">Project Manager</h2>
              <p className="truncate text-[10px] text-[#3e4850]">{ROLE_NAMES[role]}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button className="relative text-slate-400 hover:text-[#0ea5e9] transition-colors p-1">
            <span className="material-symbols-outlined text-[22px]">notifications</span>
            <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[#ba1a1a]" />
          </button>
          <div className="w-7 h-7 rounded-full primary-gradient flex items-center justify-center text-white font-bold text-[10px] ml-1">
            {initial}
          </div>
        </div>
      </header>

      <header className="hidden h-20 w-full sticky top-0 z-10 bg-[#faf8ff]/90 backdrop-blur-xl md:flex items-center justify-between px-10 border-b border-[#bec8d2]/15">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold tracking-tight text-[#131b2e] truncate">{title}</h2>
          {subtitle ? (
            <p className="text-sm text-[#3e4850] mt-0.5 truncate">{subtitle}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4">
            <button className="text-slate-500 hover:text-[#0ea5e9] transition-colors relative">
              <span className="material-symbols-outlined">notifications</span>
              <span className="absolute top-0 right-0 w-2 h-2 bg-[#ba1a1a] rounded-full"></span>
            </button>
            <button className="text-slate-500 hover:text-[#0ea5e9] transition-colors">
              <span className="material-symbols-outlined">settings</span>
            </button>
          </div>
          <div className="w-px h-8 bg-[#bec8d2]/20"></div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden md:block">
              <p className="text-sm font-semibold text-[#131b2e]">{name}</p>
              <p className="text-xs text-[#3e4850]">{ROLE_NAMES[role]}</p>
            </div>
            <div className="w-9 h-9 rounded-full primary-gradient flex items-center justify-center text-white font-bold text-sm">
              {initial}
            </div>
          </div>
        </div>
      </header>
    </>
  )
}
