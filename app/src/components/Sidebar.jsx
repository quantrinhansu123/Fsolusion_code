import { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../utils/supabase'

export default function Sidebar() {
  const navigate = useNavigate()
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

  const ROLE_NAMES = {
    admin: 'Quản trị viên',
    manager: 'Quản lý',
    employee: 'Nhân viên'
  }

  return (
    <nav className="h-screen w-64 fixed left-0 top-0 flex flex-col bg-[#131b2e] shadow-2xl z-50">
      <div className="flex flex-col gap-2 p-6 h-full">
        {/* Brand */}
        <div className="flex items-center gap-3 mb-8 px-2">
          <div className="w-10 h-10 rounded-xl primary-gradient flex items-center justify-center text-white shadow-lg">
            <span className="material-symbols-outlined icon-fill text-white">architecture</span>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tighter text-white">Project Manager</h1>
            <p className="text-xs text-slate-400">{ROLE_NAMES[role]}</p>
          </div>
        </div>

        {/* CTA - Hidden for Employees? User didn't specify, but usually Yes */}
        {role !== 'employee' && (
          <button
            onClick={() => navigate('/projects')}
            className="mb-6 w-full py-3 px-4 primary-gradient text-white rounded-xl shadow-lg font-medium hover:brightness-110 transition-all flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            Dự án mới
          </button>
        )}

        {/* Nav links */}
        <div className="flex flex-col gap-1 flex-grow">
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              isActive
                ? 'bg-gradient-to-r from-[#006591] to-[#0ea5e9] text-white rounded-xl shadow-lg flex items-center gap-3 px-4 py-3 font-medium text-sm'
                : 'text-slate-400 hover:text-white flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-all duration-200 rounded-xl text-sm'
            }
          >
            <span className="material-symbols-outlined">dashboard</span>
            Tổng quan
          </NavLink>

          <NavLink
            to="/projects"
            className={({ isActive }) =>
              isActive
                ? 'bg-gradient-to-r from-[#006591] to-[#0ea5e9] text-white rounded-xl shadow-lg flex items-center gap-3 px-4 py-3 font-medium text-sm'
                : 'text-slate-400 hover:text-white flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-all duration-200 rounded-xl text-sm'
            }
          >
            <span className="material-symbols-outlined">account_tree</span>
            Quản lý dự án
          </NavLink>

          <NavLink
            to="/staff-subtasks"
            className={({ isActive }) =>
              isActive
                ? 'bg-gradient-to-r from-[#006591] to-[#0ea5e9] text-white rounded-xl shadow-lg flex items-center gap-3 px-4 py-3 font-medium text-sm'
                : 'text-slate-400 hover:text-white flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-all duration-200 rounded-xl text-sm'
            }
          >
            <span className="material-symbols-outlined">view_kanban</span>
            Task theo nhân sự
          </NavLink>

          {(role === 'admin' || role === 'manager') && (
            <NavLink
              to="/progress"
              className={({ isActive }) =>
                isActive
                  ? 'bg-gradient-to-r from-[#006591] to-[#0ea5e9] text-white rounded-xl shadow-lg flex items-center gap-3 px-4 py-3 font-medium text-sm'
                  : 'text-slate-400 hover:text-white flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-all duration-200 rounded-xl text-sm'
              }
            >
              <span className="material-symbols-outlined">bar_chart</span>
              Báo cáo tiến độ
            </NavLink>
          )}

          {/* Admin Only */}
          {role === 'admin' && (
            <>
              <NavLink
                to="/customers"
                className={({ isActive }) =>
                  isActive
                    ? 'bg-gradient-to-r from-[#006591] to-[#0ea5e9] text-white rounded-xl shadow-lg flex items-center gap-3 px-4 py-3 font-medium text-sm'
                    : 'text-slate-400 hover:text-white flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-all duration-200 rounded-xl text-sm'
                }
              >
                <span className="material-symbols-outlined">groups</span>
                Danh sách khách hàng
              </NavLink>

              <NavLink
                to="/users"
                className={({ isActive }) =>
                  isActive
                    ? 'bg-gradient-to-r from-[#006591] to-[#0ea5e9] text-white rounded-xl shadow-lg flex items-center gap-3 px-4 py-3 font-medium text-sm'
                    : 'text-slate-400 hover:text-white flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-all duration-200 rounded-xl text-sm'
                }
              >
                <span className="material-symbols-outlined">manage_accounts</span>
                Quản lý tài khoản
              </NavLink>
            </>
          )}
        </div>

        {/* User profile */}
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
              await supabase.auth.signOut()
              navigate('/login')
            }}
            className="text-slate-400 hover:text-red-400 transition-colors"
            title="Đăng xuất"
          >
            <span className="material-symbols-outlined text-xl">logout</span>
          </button>
        </div>
      </div>
    </nav>
  )
}
