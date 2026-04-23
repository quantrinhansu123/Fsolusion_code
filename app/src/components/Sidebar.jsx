import { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { useAuth } from '../utils/AuthContext'

export default function Sidebar() {
  const navigate = useNavigate()
  const { user, loading } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    function handleOpenSidebar() {
      setMobileOpen(true)
    }
    window.addEventListener('open-mobile-sidebar', handleOpenSidebar)
    return () => window.removeEventListener('open-mobile-sidebar', handleOpenSidebar)
  }, [])

  const role = user?.role || (loading ? 'loading' : 'employee')
  const name = user?.full_name || user?.email?.split('@')[0] || 'User'

  const ROLE_NAMES = {
    admin: 'Quản trị viên',
    manager: 'Quản lý',
    employee: 'Nhân viên',
    loading: 'Đang tải...'
  }

  const linkBase = 'flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 text-[13px]'
  const linkActive = 'bg-gradient-to-r from-[#006591] to-[#0ea5e9] text-white shadow-lg font-medium'
  const linkInactive = 'text-slate-400 hover:text-white hover:bg-white/5'
  const drawerNavClass = `fixed left-0 top-0 z-50 h-screen w-64 bg-[#131b2e] shadow-2xl transform transition-transform duration-300 ease-out ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} md:hidden`
  const desktopNavClass = 'hidden md:flex h-screen w-64 fixed left-0 top-0 flex-col bg-[#131b2e] shadow-2xl z-50'

  const closeMobileSidebar = () => setMobileOpen(false)

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  function renderSidebarBody(isMobile = false) {
    return (
      <div className="flex h-full flex-col gap-2 p-6">
        <div className="mb-8 flex items-center gap-3 px-2">
          {!isMobile && (
            <div className="w-10 h-10 rounded-xl primary-gradient flex items-center justify-center text-white shadow-lg">
              <span className="material-symbols-outlined icon-fill text-white">architecture</span>
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold tracking-tighter text-white">Project Manager</h1>
            <p className="text-xs text-slate-400">{ROLE_NAMES[role]}</p>
          </div>
          {isMobile ? (
            <button
              type="button"
              onClick={closeMobileSidebar}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-white/5 hover:text-white transition-colors md:hidden"
              aria-label="Đóng menu"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          ) : null}
        </div>

        {role !== 'employee' && (
          <button
            onClick={() => {
              navigate('/projects')
              if (isMobile) closeMobileSidebar()
            }}
            className="mb-6 w-full py-2.5 px-4 primary-gradient text-white rounded-xl shadow-lg font-medium text-[13px] hover:brightness-110 transition-all flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-base">add</span>
            Dự án mới
          </button>
        )}

        <div className="flex flex-col gap-1 flex-grow">
          <NavLink to="/dashboard" onClick={isMobile ? closeMobileSidebar : undefined} className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}>
            <span className="material-symbols-outlined">dashboard</span>
            Tổng quan
          </NavLink>
          <NavLink to="/projects" onClick={isMobile ? closeMobileSidebar : undefined} className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}>
            <span className="material-symbols-outlined">account_tree</span>
            Quản lý dự án
          </NavLink>
          <NavLink to="/staff-subtasks" onClick={isMobile ? closeMobileSidebar : undefined} className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}>
            <span className="material-symbols-outlined">view_kanban</span>
            Task theo nhân sự
          </NavLink>
          <NavLink to="/attendance" onClick={isMobile ? closeMobileSidebar : undefined} className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}>
            <span className="material-symbols-outlined">calendar_month</span>
            Chấm Công
          </NavLink>

          {(role === 'admin' || role === 'manager') && (
            <NavLink to="/progress" onClick={isMobile ? closeMobileSidebar : undefined} className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}>
              <span className="material-symbols-outlined">bar_chart</span>
              Báo cáo tiến độ
            </NavLink>
          )}

          {role === 'admin' && (
            <>
              <NavLink to="/customers" onClick={isMobile ? closeMobileSidebar : undefined} className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}>
                <span className="material-symbols-outlined">groups</span>
                Danh sách khách hàng
              </NavLink>
              <NavLink to="/users" onClick={isMobile ? closeMobileSidebar : undefined} className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}>
                <span className="material-symbols-outlined">manage_accounts</span>
                Quản lý tài khoản
              </NavLink>
            </>
          )}
        </div>

        <div className="mt-auto border-t border-white/10 pt-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full primary-gradient flex items-center justify-center text-white font-bold text-sm">
            {name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm truncate">{name}</p>
            <p className="text-slate-400 text-xs">{ROLE_NAMES[role]}</p>
          </div>
          <button
            onClick={async () => {
              await handleSignOut()
              if (isMobile) closeMobileSidebar()
            }}
            className="text-slate-400 hover:text-red-400 transition-colors"
            title="Đăng xuất"
          >
            <span className="material-symbols-outlined text-xl">logout</span>
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className={desktopNavClass}>
        {renderSidebarBody(false)}
      </div>

      <div className={drawerNavClass}>
        {renderSidebarBody(true)}
      </div>

      {mobileOpen ? (
        <button
          type="button"
          aria-label="Đóng menu"
          onClick={closeMobileSidebar}
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
        />
      ) : null}
    </>
  )
}
