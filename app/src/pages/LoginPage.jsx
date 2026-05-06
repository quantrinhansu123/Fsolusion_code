import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { useAuth } from '../utils/AuthContext'
import { normalizeSignInForAuth } from '../utils/authSignIn'

export default function LoginPage() {
  const navigate = useNavigate()
  const { signInLocal } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const signInId = normalizeSignInForAuth(login)
    console.log('[LoginPage] --- Debug Login ---')
    console.log('[LoginPage] Raw input:', login)
    console.log('[LoginPage] Normalized ID (Email):', signInId)

    if (!signInId) {
      setError('Nhập tên đăng nhập.')
      setLoading(false)
      return
    }

    try {
      const { data: profile, error: signInError } = await supabase
        .from('users')
        .select('user_id')
        .eq('email', signInId)
        .eq('password', password)
        .maybeSingle()

<<<<<<< HEAD
    if (signInError) {
      console.error('[LoginPage] Login failed:', signInError)
      setError(humanizeAuthError(signInError.message))
      setLoading(false)
    } else {
      setLoading(false)
=======
      if (signInError || !profile?.user_id) {
        setError('Sai tên đăng nhập hoặc mật khẩu.')
        return
      }

      await signInLocal(profile.user_id)
>>>>>>> b4348e6fc9f0bbc70789f2265e6d4aa1bb96c380
      navigate('/dashboard')
    } catch (err) {
      console.error('[LoginPage] Sign-in request failed:', err)
      setError('Không thể kết nối máy chủ. Kiểm tra mạng hoặc cấu hình Supabase rồi thử lại.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex bg-[#0f172a] overflow-hidden relative font-['Inter']">
      {/* Background Decorative Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 rounded-full blur-[120px] animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-600/20 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }}></div>
      
      {/* Left Side: Hero/Branding (Hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 relative items-center justify-center p-12 overflow-hidden border-r border-white/5">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-br from-[#1e293b] to-[#0f172a]"></div>
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(#334155 1px, transparent 1px)', backgroundSize: '30px 30px' }}></div>
        </div>
        
        <div className="relative z-10 max-w-lg text-center">
          <div className="w-24 h-24 bg-white/10 backdrop-blur-xl rounded-3xl flex items-center justify-center mx-auto mb-10 shadow-2xl border border-white/20 transform hover:rotate-6 transition-transform duration-500">
            <span className="material-symbols-outlined icon-fill text-5xl text-blue-400">rocket_launch</span>
          </div>
          <h2 className="text-5xl font-black text-white mb-6 leading-tight tracking-tight">
            Nâng tầm <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">Hiệu suất</span> Công việc
          </h2>
          <p className="text-slate-400 text-lg leading-relaxed mb-8">
            Hệ thống quản lý dự án thông minh giúp đội ngũ của bạn cộng tác hiệu quả và đạt được mục tiêu nhanh hơn.
          </p>
          
          <div className="flex gap-4 justify-center">
            <div className="bg-white/5 backdrop-blur-md border border-white/10 px-6 py-3 rounded-2xl flex items-center gap-3">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-ping"></span>
              <span className="text-sm font-semibold text-slate-300">Hệ thống đang hoạt động</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side: Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 relative z-10">
        <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-8 duration-700">
          {/* Mobile Logo (Visible only on mobile) */}
          <div className="lg:hidden flex flex-col items-center mb-10">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-xl shadow-blue-500/20">
              <span className="material-symbols-outlined icon-fill text-3xl text-white">rocket_launch</span>
            </div>
            <h1 className="text-2xl font-bold text-white">Project Manager</h1>
          </div>

          <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 p-8 sm:p-10 rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
            {/* Subtle light effect on hover */}
            <div className="absolute -inset-full bg-gradient-to-r from-transparent via-white/5 to-transparent skew-x-[-30deg] group-hover:left-full transition-all duration-1000"></div>
            
            <header className="mb-10 text-left">
              <h1 className="text-4xl font-bold text-white mb-3 tracking-tight">Đăng nhập</h1>
              <p className="text-slate-400 font-medium">Chào mừng trở lại! Vui lòng nhập thông tin.</p>
            </header>

            {error && (
              <div className="mb-8 p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-2xl flex items-start gap-3 animate-in fade-in zoom-in duration-300">
                <span className="material-symbols-outlined text-lg shrink-0">error</span>
                <span className="font-medium">{error}</span>
              </div>
            )}

            <form className="space-y-7" onSubmit={handleSubmit}>
              {/* Username/Email */}
              <div className="space-y-2.5">
                <label className="block text-sm font-bold text-slate-300 ml-1" htmlFor="login">
                  Tên đăng nhập
                </label>
                <div className="relative group">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-500 group-focus-within:text-blue-400 transition-colors">person</span>
                  <input
                    id="login"
                    type="text"
                    name="username"
                    autoComplete="username"
                    value={login}
                    onChange={e => setLogin(e.target.value)}
                    placeholder="Nhập tên đăng nhập..."
                    className="w-full bg-white/[0.05] text-white rounded-2xl border border-white/10 pl-12 pr-5 py-4 text-base font-medium placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all duration-300"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-2.5">
                <div className="flex justify-between items-center ml-1">
                  <label className="text-sm font-bold text-slate-300" htmlFor="password">
                    Mật khẩu
                  </label>
                  <button type="button" className="text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors">
                    Quên mật khẩu?
                  </button>
                </div>
                <div className="relative group">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-500 group-focus-within:text-blue-400 transition-colors">lock</span>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-white/[0.05] text-white rounded-2xl border border-white/10 pl-12 pr-12 py-4 text-base font-medium placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all duration-300"
                    required
                  />
                  <button
                    type="button"
                    aria-label="Toggle password visibility"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-blue-400 transition-colors flex items-center justify-center"
                  >
                    <span className="material-symbols-outlined text-xl">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Remember Me */}
              <div className="flex items-center gap-2 ml-1">
                <input 
                  type="checkbox" 
                  id="remember" 
                  className="w-5 h-5 rounded-md bg-white/10 border-white/10 text-blue-600 focus:ring-blue-500/20 focus:ring-offset-0"
                />
                <label htmlFor="remember" className="text-sm font-medium text-slate-400 cursor-pointer select-none">Ghi nhớ đăng nhập</label>
              </div>

              {/* Submit */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full relative group overflow-hidden bg-blue-600 text-white rounded-2xl py-4 text-base font-extrabold shadow-xl shadow-blue-600/20 transition-all duration-300 active:scale-[0.98] hover:bg-blue-500 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                >
                  <div className="relative z-10 flex items-center justify-center gap-2">
                    {loading ? (
                      <>
                        <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                        <span>Đang đăng nhập...</span>
                      </>
                    ) : (
                      <>
                        <span>Tiếp tục</span>
                        <span className="material-symbols-outlined text-xl group-hover:translate-x-1 transition-transform">arrow_forward</span>
                      </>
                    )}
                  </div>
                </button>
              </div>
            </form>

            <footer className="mt-10 text-center">
              <p className="text-slate-500 text-sm font-medium">
                © 2026 F-Solution. Bản quyền được bảo lưu.
              </p>
            </footer>
          </div>
        </div>
      </div>
    </div>
  )
}
