import { useState, useEffect } from 'react'
import Sidebar from '../components/Sidebar'
import TopBar from '../components/TopBar'
import { supabase } from '../utils/supabase'
import ThreeDotMenu from '../components/ThreeDotMenu'
import Toast from '../components/Toast'

export default function UserManagement() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [formData, setFormData] = useState({ full_name: '', email: '', role: 'employee' })
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

  async function handleSave() {
    if (editingUser) {
      const { error } = await supabase.from('users').update(formData).eq('user_id', editingUser.user_id)
      if (error) setToast({ message: error.message, type: 'error' })
      else {
        setIsModalOpen(false)
        fetchUsers()
        setToast({ message: 'Đã cập nhật tài khoản thành công', type: 'success' })
      }
    } else {
      // For demo, we just create the profile. 
      // In a real app, this would involve auth.admin.createUser
      setToast({ message: 'Trong bản demo này, vui lòng sử dụng đăng ký hoặc tạo tài khoản trực tiếp trong Supabase Auth.', type: 'error' })
    }
  }

  async function deleteUser(id) {
    if (!window.confirm('Bạn có chắc chắn muốn xóa tài khoản này?')) return
    const { error } = await supabase.from('users').delete().eq('user_id', id)
    if (error) setToast({ message: error.message, type: 'error' })
    else {
      fetchUsers()
      setToast({ message: 'Đã xóa tài khoản', type: 'success' })
    }
  }

  const ROLES = [
    { value: 'admin',    label: 'Quản trị viên', color: 'bg-red-100 text-red-700' },
    { value: 'manager',  label: 'Quản lý',       color: 'bg-blue-100 text-blue-700' },
    { value: 'employee', label: 'Nhân viên',     color: 'bg-slate-100 text-slate-700' },
  ]

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
                <p className="text-[#3e4850] text-sm">Quản lý phân quyền và thông tin thành viên trong hệ thống.</p>
              </div>
              <button
                onClick={() => { setEditingUser(null); setFormData({ full_name: '', email: '', role: 'employee' }); setIsModalOpen(true) }}
                className="primary-gradient text-white px-5 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 shadow-lg"
              >
                <span className="material-symbols-outlined text-sm">person_add</span>
                Tạo tài khoản mới
              </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-[#bec8d2]/15">
              <table className="w-full text-left">
                <thead className="bg-[#f9fafb] border-b border-[#bec8d2]/10">
                  <tr className="text-[11px] font-bold text-[#3e4850] uppercase tracking-wider">
                    <th className="px-6 py-4">Thành viên</th>
                    <th className="px-6 py-4">Vai trò</th>
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
                            <p className="text-xs text-[#3e4850]">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${ROLES.find(r => r.value === u.role)?.color}`}>
                          {ROLES.find(r => r.value === u.role)?.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-[#3e4850]">
                        {new Date(u.created_at).toLocaleDateString('vi-VN')}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <ThreeDotMenu items={[
                          { icon: 'edit',   label: 'Sửa quyền', onClick: () => { setEditingUser(u); setFormData({ full_name: u.full_name, email: u.email, role: u.role }); setIsModalOpen(true) } },
                          { icon: 'delete', label: 'Xóa',        onClick: () => deleteUser(u.user_id), danger: true },
                        ]} />
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

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-8 py-6 border-b border-[#bec8d2]/10 bg-[#f9fafb]">
              <h3 className="text-xl font-bold text-[#131b2e]">
                {editingUser ? 'Chỉnh sửa tài khoản' : 'Tạo tài khoản mới'}
              </h3>
            </div>
            <div className="p-8 space-y-5">
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
                <label className="text-xs font-bold text-[#3e4850] uppercase px-1">Email</label>
                <input
                  type="email"
                  className="w-full px-4 py-3 rounded-xl border border-[#bec8d2]/30 focus:border-[#006591] focus:ring-2 focus:ring-[#006591]/10 outline-none transition-all text-sm"
                  value={formData.email}
                  disabled={!!editingUser}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#3e4850] uppercase px-1">Vai trò hệ thống</label>
                <select
                  className="w-full px-4 py-3 rounded-xl border border-[#bec8d2]/30 focus:border-[#006591] focus:ring-2 focus:ring-[#006591]/10 outline-none transition-all text-sm appearance-none bg-white"
                  value={formData.role}
                  onChange={e => setFormData({ ...formData, role: e.target.value })}
                >
                  {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
            </div>
            <div className="px-8 py-6 bg-[#f9fafb] border-t border-[#bec8d2]/10 flex gap-3">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="flex-1 px-4 py-3 rounded-xl font-bold text-sm text-[#3e4850] hover:bg-[#eaedff] transition-all"
              >
                Hủy bỏ
              </button>
              <button 
                onClick={handleSave}
                className="flex-1 px-4 py-3 primary-gradient text-white rounded-xl font-bold text-sm shadow-lg hover:brightness-110 transition-all"
              >
                Lưu thay đổi
              </button>
            </div>
          </div>
        </div>
      )}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
