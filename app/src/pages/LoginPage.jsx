import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../utils/supabase'

export default function LoginPage() {
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      setError(signInError.message)
      setLoading(false)
    } else {
      navigate('/dashboard')
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{
        backgroundColor: '#131b2e',
        backgroundImage:
          'radial-gradient(circle at 15% 50%, rgba(14, 165, 233, 0.08), transparent 25%), radial-gradient(circle at 85% 30%, rgba(0, 101, 145, 0.12), transparent 25%)',
      }}
    >
      <main className="w-full max-w-[440px] bg-white rounded-2xl p-10 shadow-[0_48px_100px_-20px_rgba(19,27,46,0.5)] relative z-10 border border-white/10">
        {/* Header */}
        <header className="mb-10 text-center flex flex-col items-center">
          <div className="w-14 h-14 bg-[#f2f3ff] rounded-full flex items-center justify-center mb-6 shadow-sm border border-[#dae2fd]">
            <span className="material-symbols-outlined icon-fill text-[#006591] text-3xl">work</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#131b2e] mb-2">Project Manager</h1>
          <p className="text-[#3e4850] text-base font-medium">Đăng nhập để tiếp tục</p>
        </header>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl flex items-center gap-2">
            <span className="material-symbols-outlined text-lg">error</span>
            {error}
          </div>
        )}

        {/* Form */}
        <form className="space-y-6" onSubmit={handleSubmit}>
          {/* Email */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-[0.05em] text-[#3e4850] ml-1" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="name@company.com"
              className="w-full bg-[#faf8ff] text-[#131b2e] rounded-full border border-[#bec8d2]/40 px-5 py-3.5 text-base font-medium placeholder-[#bec8d2] focus:outline-none focus:border-[#006591] focus:ring-1 focus:ring-[#006591] transition-all duration-200"
              required
            />
          </div>

          {/* Password */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-[0.05em] text-[#3e4850] ml-1" htmlFor="password">
              Mật khẩu
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#faf8ff] text-[#131b2e] rounded-full border border-[#bec8d2]/40 px-5 py-3.5 pr-12 text-base font-medium placeholder-[#bec8d2] focus:outline-none focus:border-[#006591] focus:ring-1 focus:ring-[#006591] transition-all duration-200"
                required
              />
              <button
                type="button"
                aria-label="Toggle password visibility"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6e7881] hover:text-[#006591] transition-colors flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-xl">
                  {showPassword ? 'visibility' : 'visibility_off'}
                </span>
              </button>
            </div>
          </div>

          {/* Submit */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={loading}
              className={`w-full primary-gradient text-white rounded-full py-4 text-base font-bold shadow-lg transform transition-all duration-200 active:scale-[0.98] ${
                loading ? 'opacity-70 cursor-not-allowed' : 'hover:opacity-90 hover:-translate-y-0.5'
              }`}
            >
              {loading ? 'Đang xử lý...' : 'Đăng nhập'}
            </button>
          </div>

          {/* Forgot */}
          <div className="text-right mt-6">
            <a href="#" className="text-sm font-semibold text-[#006591] hover:text-[#0ea5e9] transition-colors pb-1">
              Quên mật khẩu?
            </a>
          </div>
        </form>
      </main>
    </div>
  )
}
