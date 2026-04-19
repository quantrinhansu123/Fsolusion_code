import { useState, useEffect } from 'react'
import Sidebar from '../components/Sidebar'
import TopBar from '../components/TopBar'
import ThreeDotMenu from '../components/ThreeDotMenu'
import Toast from '../components/Toast'
import { humanizeAuthError } from '../utils/authErrors'
import { supabase, supabaseAuthSignUpEphemeral } from '../utils/supabase'
import { normalizeSignInForAuth, shortDisplayForProfile } from '../utils/authSignIn'

function formatPasswordCol(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return '—'
  }
}

export default function UserManagement() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [formData, setFormData] = useState({
    full_name: '',
    login: '',
    role: 'employee',
    department: '',
    password: '',
  })
  const [toast, setToast] = useState(null)

  useEffect(() => {
    fetchUsers()
  }, [])

  async function fetchUsers() {
    setLoading(true)
    const { data, error } = await supabase.from('users').select('*').order('created_at', { ascending: false })
    if (error) console.error('Error fetching users:', error)
    else setUsers(data || [])
    setLoading(false)
  }

  /**
   * Tạo user: đăng ký Auth qua client phụ (không ghi đè session admin), rồi cập nhật bảng public.users.
   */
  async function createAccount() {
    const signInId = normalizeSignInForAuth(formData.login)
    const full_name = formData.full_name.trim()
    const { password, role } = formData
    if (!signInId || !full_name || !password || password.length < 6) {
      setToast({
        message: 'Nhập đủ họ tên, tên đăng nhập và mật khẩu (tối thiểu 6 ký tự)',
        type: 'error',
      })
      return false
    }

    const dept = formData.department?.trim() || null
    const { data: signData, error: signErr } = await supabaseAuthSignUpEphemeral.auth.signUp({
      email: signInId,
      password,
      options: {
        data: { full_name },
      },
    })

    if (signErr) {
      setToast({ message: humanizeAuthError(signErr.message), type: 'error' })
      return false
    }

    const uid = signData.user?.id
    if (!uid) {
      setToast({ message: 'Không tạo được tài khoản. Thử lại sau.', type: 'error' })
      return false
    }

    const { error: upErr } = await supabase
      .from('users')
      .update({
        role,
        department: dept,
        full_name,
      })
      .eq('user_id', uid)

    if (upErr) {
      setToast({
        message: humanizeAuthError(upErr.message),
        type: 'error',
      })
      return false
    }

    setToast({ message: 'Đã tạo tài khoản và cập nhật bảng nhân sự', type: 'success' })
    return true
  }

  async function handleSave() {
    setSaving(true)
    try {
      if (editingUser) {
        const { error } = await supabase
          .from('users')
          .update({
            full_name: formData.full_name.trim(),
            role: formData.role,
            department: formData.department?.trim() || null,
          })
          .eq('user_id', editingUser.user_id)
        if (error) {
          setToast({ message: humanizeAuthError(error.message), type: 'error' })
          return
        }
        setIsModalOpen(false)
        fetchUsers()
        setToast({ message: 'Đã cập nhật tài khoản', type: 'success' })
      } else {
        const ok = await createAccount()
        if (!ok) return
        setIsModalOpen(false)
        fetchUsers()
      }
    } finally {
      setSaving(false)
    }
  }

  async function deleteUser(id) {
    if (!window.confirm('Bạn có chắc chắn muốn xóa tài khoản này?')) return
    const { error } = await supabase.from('users').delete().eq('user_id', id)
    if (error) setToast({ message: humanizeAuthError(error.message), type: 'error' })
    else {
      fetchUsers()
      setToast({ message: 'Đã xóa tài khoản', type: 'success' })
    }
  }

  const ROLES = [
    { value: 'admin', label: 'Quản trị viên', color: 'bg-red-100 text-red-700' },
    { value: 'manager', label: 'Quản lý', color: 'bg-blue-100 text-blue-700' },
    { value: 'employee', label: 'Nhân viên', color: 'bg-slate-100 text-slate-700' },
  ]

  const emptyForm = () => ({
    full_name: '',
    login: '',
    role: 'employee',
    department: '',
    password: '',
  })

  return (
    <div className="flex h-screen overflow-hidden bg-[#faf8ff]">
      <Sidebar />

      <div className="flex-1 ml-64 flex flex-col h-screen overflow-y-auto">
        <TopBar title="Quản lý tài khoản" />

        <main className="flex-1 p-8">
          <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex justify-between items-end">
              <div>
                <h2 className="text-3xl font-bold tracking-tight text-[#131b2e] mb-1">Danh sách nhân sự</h2>
                <p className="text-[#3e4850] text-sm">
                  Danh sách từ bảng <code className="text-[#006591]">users</code>. Tạo mới sẽ thêm tài khoản đăng nhập và ghi vai trò, bộ phận. Cột «Đổi mật khẩu gần nhất» là dữ liệu tham khảo nếu có.
                </p>
              </div>
              <button
                onClick={() => {
                  setEditingUser(null)
                  setFormData(emptyForm())
                  setIsModalOpen(true)
                }}
                className="primary-gradient text-white px-5 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 shadow-lg"
              >
                <span className="material-symbols-outlined text-sm">person_add</span>
                Tạo tài khoản mới
              </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-[#bec8d2]/15 overflow-x-auto">
              <table className="w-full text-left min-w-[880px]">
                <thead className="bg-[#f9fafb] border-b border-[#bec8d2]/10">
                  <tr className="text-[11px] font-bold text-[#3e4850] uppercase tracking-wider">
                    <th className="px-6 py-4">Thành viên</th>
                    <th className="px-6 py-4">Bộ phận</th>
                    <th className="px-6 py-4">Vai trò</th>
                    <th className="px-6 py-4">Đổi mật khẩu gần nhất</th>
                    <th className="px-6 py-4">Ngày tham gia</th>
                    <th className="px-6 py-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#bec8d2]/10">
                  {users.map(u => (
                    <tr key={u.user_id} className="hover:bg-[#fafafa] transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full primary-gradient flex items-center justify-center text-white font-bold text-sm">
                            {u.full_name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-[#131b2e]">{u.full_name}</p>
                            <p className="text-xs text-[#3e4850]">{shortDisplayForProfile(u.email)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-[#131b2e] max-w-[200px]">
                        <span className="line-clamp-2" title={u.department || undefined}>
                          {u.department?.trim() ? u.department : '—'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${ROLES.find(r => r.value === u.role)?.color}`}
                        >
                          {ROLES.find(r => r.value === u.role)?.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-[#3e4850] whitespace-nowrap">
                        {formatPasswordCol(u.password_updated_at)}
                      </td>
                      <td className="px-6 py-4 text-sm text-[#3e4850]">
                        {new Date(u.created_at).toLocaleDateString('vi-VN')}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <ThreeDotMenu
                          items={[
                            {
                              icon: 'edit',
                              label: 'Sửa thông tin',
                              onClick: () => {
                                setEditingUser(u)
                                setFormData({
                                  full_name: u.full_name,
                                  login: shortDisplayForProfile(u.email),
                                  role: u.role,
                                  department: u.department ?? '',
                                  password: '',
                                })
                                setIsModalOpen(true)
                              },
                            },
                            { icon: 'delete', label: 'Xóa', onClick: () => deleteUser(u.user_id), danger: true },
                          ]}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {users.length === 0 && !loading && (
                <div className="py-20 text-center">
                  <p className="text-[#3e4850] italic">Chưa có tài khoản nào khác.</p>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="px-8 py-6 border-b border-[#bec8d2]/10 bg-[#f9fafb] shrink-0">
              <h3 className="text-xl font-bold text-[#131b2e]">
                {editingUser ? 'Chỉnh sửa tài khoản' : 'Tạo tài khoản mới'}
              </h3>
            </div>
            <div className="p-8 space-y-5 overflow-y-auto">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#3e4850] uppercase px-1">Họ và tên</label>
                <input
                  type="text"
                  className="w-full px-4 py-3 rounded-xl border border-[#bec8d2]/30 focus:border-[#006591] focus:ring-2 focus:ring-[#006591]/10 outline-none transition-all text-sm"
                  value={formData.full_name}
                  onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#3e4850] uppercase px-1">Tên đăng nhập</label>
                <input
                  type="text"
                  autoComplete="off"
                  className="w-full px-4 py-3 rounded-xl border border-[#bec8d2]/30 focus:border-[#006591] focus:ring-2 focus:ring-[#006591]/10 outline-none transition-all text-sm disabled:bg-[#f3f4f6] disabled:text-[#6e7881]"
                  value={formData.login}
                  disabled={!!editingUser}
                  onChange={e => setFormData({ ...formData, login: e.target.value })}
                  placeholder="vd. hoa"
                />
              </div>
              {!editingUser && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#3e4850] uppercase px-1">Mật khẩu đăng nhập</label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    placeholder="Tối thiểu 6 ký tự"
                    className="w-full px-4 py-3 rounded-xl border border-[#bec8d2]/30 focus:border-[#006591] focus:ring-2 focus:ring-[#006591]/10 outline-none transition-all text-sm"
                    value={formData.password}
                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#3e4850] uppercase px-1">Bộ phận</label>
                <input
                  type="text"
                  className="w-full px-4 py-3 rounded-xl border border-[#bec8d2]/30 focus:border-[#006591] focus:ring-2 focus:ring-[#006591]/10 outline-none transition-all text-sm"
                  value={formData.department}
                  onChange={e => setFormData({ ...formData, department: e.target.value })}
                  placeholder="VD: Kỹ thuật, Kinh doanh…"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#3e4850] uppercase px-1">Vai trò hệ thống</label>
                <select
                  className="w-full px-4 py-3 rounded-xl border border-[#bec8d2]/30 focus:border-[#006591] focus:ring-2 focus:ring-[#006591]/10 outline-none transition-all text-sm appearance-none bg-white"
                  value={formData.role}
                  onChange={e => setFormData({ ...formData, role: e.target.value })}
                >
                  {ROLES.map(r => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="px-8 py-6 bg-[#f9fafb] border-t border-[#bec8d2]/10 flex gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="flex-1 px-4 py-3 rounded-xl font-bold text-sm text-[#3e4850] hover:bg-[#eaedff] transition-all"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleSave}
                className="flex-1 px-4 py-3 primary-gradient text-white rounded-xl font-bold text-sm shadow-lg hover:brightness-110 transition-all disabled:opacity-60"
              >
                {saving ? 'Đang lưu...' : editingUser ? 'Lưu thay đổi' : 'Tạo tài khoản'}
              </button>
            </div>
          </div>
        </div>
      )}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
