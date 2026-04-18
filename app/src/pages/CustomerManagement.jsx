import { useState, useEffect } from 'react'
import Sidebar from '../components/Sidebar'
import TopBar from '../components/TopBar'
import { supabase } from '../utils/supabase'
import ThreeDotMenu from '../components/ThreeDotMenu'
import Toast from '../components/Toast'
import { EntityFormModal, CUSTOMER_FIELDS } from '../components/EntityFormModal'

export default function CustomerManagement() {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState(null)
  const [formData, setFormData] = useState({})
  const [toast, setToast] = useState(null)

  useEffect(() => {
    fetchCustomers()
  }, [])

  async function fetchCustomers() {
    setLoading(true)
    const { data, error } = await supabase.from('customers').select('*, projects(count)').order('name')
    if (error) console.error('Error fetching customers:', error)
    else setCustomers(data || [])
    setLoading(false)
  }

  async function handleSave() {
    if (editingCustomer) {
      const { error } = await supabase.from('customers').update(formData).eq('customer_id', editingCustomer.customer_id)
      if (error) setToast({ message: error.message, type: 'error' })
      else {
        setIsModalOpen(false)
        fetchCustomers()
        setToast({ message: 'Đã cập nhật thông tin khách hàng', type: 'success' })
      }
    } else {
      const { data: userData } = await supabase.auth.getUser()
      const { error } = await supabase.from('customers').insert({ ...formData, user_id: userData.user.id })
      if (error) setToast({ message: error.message, type: 'error' })
      else {
        setIsModalOpen(false)
        fetchCustomers()
        setToast({ message: 'Đã thêm khách hàng mới thành công', type: 'success' })
      }
    }
  }

  async function deleteCustomer(id) {
    if (!window.confirm('Xóa khách hàng sẽ xóa toàn bộ dự án liên quan. Bạn có chắc không?')) return
    const { error } = await supabase.from('customers').delete().eq('customer_id', id)
    if (error) setToast({ message: error.message, type: 'error' })
    else {
      fetchCustomers()
      setToast({ message: 'Đã xóa khách hàng', type: 'success' })
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#faf8ff]">
      <Sidebar />

      <div className="flex-1 ml-64 flex flex-col h-screen overflow-y-auto">
        <TopBar title="Quản lý khách hàng" />

        <main className="flex-1 p-8">
          <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex justify-between items-end">
              <div>
                <h2 className="text-3xl font-bold tracking-tight text-[#131b2e] mb-1">Cơ sở khách hàng</h2>
                <p className="text-[#3e4850] text-sm">Xem và quản lý thông tin các đối tác, khách hàng của agency.</p>
              </div>
              <button
                onClick={() => { setEditingCustomer(null); setFormData({}); setIsModalOpen(true) }}
                className="primary-gradient text-white px-5 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 shadow-lg"
              >
                <span className="material-symbols-outlined text-sm">person_add</span>
                Thêm khách hàng
              </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-[#bec8d2]/15">
              <table className="w-full text-left">
                <thead className="bg-[#f9fafb] border-b border-[#bec8d2]/10">
                  <tr className="text-[11px] font-bold text-[#3e4850] uppercase tracking-wider">
                    <th className="px-6 py-4">Tên khách hàng</th>
                    <th className="px-6 py-4">Liên hệ</th>
                    <th className="px-6 py-4">Địa chỉ</th>
                    <th className="px-6 py-4 text-center">Dự án</th>
                    <th className="px-6 py-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#bec8d2]/10">
                  {customers.map(c => (
                    <tr key={c.customer_id} className="hover:bg-[#fafafa] transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#dae2fd] text-[#006591] flex items-center justify-center font-bold text-sm">
                            {c.name.charAt(0)}
                          </div>
                          <span className="text-sm font-semibold text-[#131b2e]">{c.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-0.5">
                          <p className="text-xs text-[#131b2e] font-medium">{c.email}</p>
                          <p className="text-[11px] text-[#3e4850]">{c.phone}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-xs text-[#3e4850] truncate max-w-xs">{c.address || '—'}</p>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-sm font-bold text-[#131b2e] bg-[#f2f3ff] px-3 py-1 rounded-lg">
                          {c.projects?.[0]?.count || 0}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <ThreeDotMenu items={[
                          { icon: 'edit',   label: 'Chỉnh sửa', onClick: () => { setEditingCustomer(c); setFormData(c); setIsModalOpen(true) } },
                          { icon: 'delete', label: 'Xóa',        onClick: () => deleteCustomer(c.customer_id), danger: true },
                        ]} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {customers.length === 0 && !loading && (
                <div className="py-20 text-center">
                  <p className="text-[#3e4850] italic">Chưa có khách hàng nào trong hệ thống.</p>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {isModalOpen && (
        <EntityFormModal
          title={editingCustomer ? 'Chỉnh sửa khách hàng' : 'Thêm khách hàng mới'}
          fields={CUSTOMER_FIELDS}
          data={formData}
          onChange={(k, v) => setFormData(f => ({ ...f, [k]: v }))}
          onSave={handleSave}
          onClose={() => setIsModalOpen(false)}
        />
      )}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
