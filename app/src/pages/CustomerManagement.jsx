import { useState, useEffect } from 'react'
import Sidebar from '../components/Sidebar'
import TopBar from '../components/TopBar'
import { supabase } from '../utils/supabase'
import ThreeDotMenu from '../components/ThreeDotMenu'
import Toast from '../components/Toast'
import { EntityFormModal, CUSTOMER_FIELDS, PROJECT_FIELDS } from '../components/EntityFormModal'
import Modal from '../components/Modal'
import StatusBadge from '../components/StatusBadge'
import { formatDeadlineDisplay, normalizeDeadlineForSave } from '../utils/deadline'

export default function CustomerManagement() {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState(null)
  const [formData, setFormData] = useState({})
  const [toast, setToast] = useState(null)
  const [projectsModalCustomer, setProjectsModalCustomer] = useState(null)
  const [projectsForModal, setProjectsForModal] = useState([])
  const [projectsModalLoading, setProjectsModalLoading] = useState(false)
  const [userRole, setUserRole] = useState('employee')
  const [isAddProjectOpen, setIsAddProjectOpen] = useState(false)
  const [addProjectFormData, setAddProjectFormData] = useState({})
  const [currentPage, setCurrentPage] = useState(1)
  const PAGE_SIZE = 5

  useEffect(() => {
    fetchCustomers()
  }, [])

  useEffect(() => {
    async function loadRole() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase.from('users').select('role').eq('user_id', user.id).single()
      setUserRole(profile?.role || 'employee')
    }
    loadRole()
  }, [])

  async function fetchCustomers() {
    setLoading(true)
    const { data: rows, error } = await supabase.from('customers').select('*').order('name')
    if (error) {
      console.error('Error fetching customers:', error)
      setToast({ message: error.message, type: 'error' })
      setCustomers([])
      setLoading(false)
      return
    }
    const { data: projectLinks } = await supabase.from('projects').select('customer_id')
    const countByCustomer = {}
    for (const r of projectLinks || []) {
      const id = r.customer_id
      if (id) countByCustomer[id] = (countByCustomer[id] || 0) + 1
    }
    setCustomers(
      (rows || []).map(c => ({
        ...c,
        project_count: countByCustomer[c.customer_id] || 0,
      }))
    )
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

  async function loadProjectsForCustomerModal(customerId) {
    setProjectsModalLoading(true)
    const { data, error } = await supabase
      .from('projects')
      .select('project_id, name, description, pricing, deadline, status')
      .eq('customer_id', customerId)
      .order('name')
    setProjectsModalLoading(false)
    if (error) {
      console.error('Error fetching projects:', error)
      setToast({ message: error.message, type: 'error' })
      return false
    }
    setProjectsForModal(data || [])
    return true
  }

  async function openProjectsModal(customer) {
    setProjectsModalCustomer(customer)
    setProjectsForModal([])
    const ok = await loadProjectsForCustomerModal(customer.customer_id)
    if (!ok) setProjectsModalCustomer(null)
  }

  async function handleSaveNewProject() {
    const raw = { ...addProjectFormData }
    delete raw.projects
    delete raw.project_count
    const clean = { ...raw }
    Object.keys(clean).forEach(k => {
      if (clean[k] === '') delete clean[k]
    })
    if (Object.prototype.hasOwnProperty.call(clean, 'deadline')) {
      clean.deadline = normalizeDeadlineForSave(clean.deadline)
    }
    if (!clean.customer_id) {
      setToast({ message: 'Vui lòng chọn khách hàng', type: 'error' })
      return
    }
    if (!clean.name?.trim()) {
      setToast({ message: 'Vui lòng nhập tên dự án', type: 'error' })
      return
    }
    const { error } = await supabase.from('projects').insert(clean)
    if (error) setToast({ message: error.message, type: 'error' })
    else {
      setIsAddProjectOpen(false)
      setAddProjectFormData({})
      setToast({ message: 'Đã thêm dự án', type: 'success' })
      await fetchCustomers()
      if (projectsModalCustomer) {
        await loadProjectsForCustomerModal(projectsModalCustomer.customer_id)
      }
    }
  }

  const projectFormFields = PROJECT_FIELDS.map(f =>
    f.name === 'customer_id'
      ? { ...f, options: customers.map(c => ({ value: c.customer_id, label: c.name })) }
      : f
  )

  async function deleteCustomer(id) {
    if (!window.confirm('Xóa khách hàng sẽ xóa toàn bộ dự án liên quan. Bạn có chắc không?')) return
    const { error } = await supabase.from('customers').delete().eq('customer_id', id)
    if (error) setToast({ message: error.message, type: 'error' })
    else {
      fetchCustomers()
      setToast({ message: 'Đã xóa khách hàng', type: 'success' })
    }
  }

  const totalPages = Math.ceil(customers.length / PAGE_SIZE)
  const displayedCustomers = customers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  return (
    <div className="flex h-screen overflow-hidden bg-[#faf8ff]">
      <Sidebar />

      <div className="flex-1 md:ml-64 flex flex-col h-screen overflow-y-auto">
        <TopBar title="Quản lý khách hàng" />

        <main className="flex-1 px-6 md:px-10 py-8">
          <div className="w-full space-y-6">
            <div className="flex flex-row items-center justify-between gap-3 lg:items-end lg:gap-0">
              <div className="min-w-0">
                <h2 className="text-xl lg:text-3xl font-bold tracking-tight text-[#131b2e] lg:mb-1 truncate">
                  <span className="lg:hidden">Khách hàng</span>
                  <span className="hidden lg:inline">Cơ sở khách hàng</span>
                </h2>
                <p className="text-[#3e4850] text-sm hidden lg:block">Xem và quản lý thông tin các đối tác, khách hàng của agency.</p>
              </div>
              <button
                onClick={() => { setEditingCustomer(null); setFormData({}); setIsModalOpen(true) }}
                className="primary-gradient text-white px-3 py-1.5 lg:px-5 lg:py-2.5 rounded-xl font-semibold text-xs lg:text-sm flex items-center gap-2 shadow-lg shrink-0"
              >
                <span className="material-symbols-outlined text-[16px] lg:text-sm">person_add</span>
                Thêm khách hàng
              </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-[#bec8d2]/15 overflow-hidden">
              {/* VIEW DESKTOP: Bảng giữ nguyên hiện trạng */}
              <div className="hidden lg:block overflow-x-auto">
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
                          <p className="text-xs text-[#131b2e] font-medium">
                            {[c.phone, c.email].filter(Boolean).join(' · ') || '—'}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-xs text-[#3e4850] truncate max-w-xs">{c.address || '—'}</p>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-sm font-bold text-[#131b2e] bg-[#f2f3ff] px-3 py-1 rounded-lg tabular-nums inline-block">
                            {c.project_count ?? 0}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => openProjectsModal(c)}
                              className="text-xs font-semibold text-[#006591] bg-[#dae2fd] hover:bg-[#c9d4fc] px-2.5 py-1.5 rounded-lg transition-colors inline-flex items-center gap-1 shrink-0"
                              title="Xem dự án"
                            >
                              <span className="material-symbols-outlined text-[18px]">visibility</span>
                              Xem
                            </button>
                            <ThreeDotMenu items={[
                              { icon: 'edit', label: 'Chỉnh sửa', onClick: () => { setEditingCustomer(c); setFormData(c); setIsModalOpen(true) } },
                              { icon: 'delete', label: 'Xóa', onClick: () => deleteCustomer(c.customer_id), danger: true },
                            ]} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* VIEW MOBILE: Danh sách nén gọn 3 hàng */}
              <div className="lg:hidden divide-y divide-[#bec8d2]/10">
                {displayedCustomers.map(c => (
                  <div key={c.customer_id} className="p-2.5 space-y-1.5">
                    {/* Hàng 1: Avatar -> Tên -> Badge */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-[#dae2fd] text-[#006591] flex items-center justify-center font-bold text-[10px] shrink-0">
                          {c.name.charAt(0)}
                        </div>
                        <span className="text-xs font-bold text-[#131b2e] truncate">{c.name}</span>
                      </div>
                      <span className="text-[9px] font-bold text-[#131b2e] bg-[#f2f3ff] px-1.5 py-0.5 rounded tabular-nums whitespace-nowrap">
                        {c.project_count ?? 0} dự án
                      </span>
                    </div>

                    {/* Hàng 2: Thông tin liên hệ */}
                    {(c.phone && c.phone !== '—' || c.email && c.email !== '—') && (
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[9px] text-[#3e4850] font-medium opacity-80">
                        {c.phone && c.phone !== '—' && (
                          <div className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-[10px] text-[#006591]">call</span>
                            {c.phone}
                          </div>
                        )}
                        {c.email && c.email !== '—' && (
                          <div className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-[10px] text-[#006591]">mail</span>
                            <span className="truncate max-w-[140px]">{c.email}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Hàng 3: Các nút thao tác (Siêu nén) */}
                    <div className="flex items-center justify-between gap-1 pt-1">
                      <button
                        type="button"
                        onClick={() => openProjectsModal(c)}
                        className="text-[9px] font-bold text-[#006591] bg-[#dae2fd] px-2 py-1 rounded-md transition-colors flex items-center gap-1 active:scale-95"
                      >
                        <span className="material-symbols-outlined text-[12px]">visibility</span>
                        XEM
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => { setEditingCustomer(c); setFormData(c); setIsModalOpen(true) }}
                          className="text-[9px] font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-md transition-colors flex items-center gap-1 active:scale-95 border border-slate-200/50"
                        >
                          <span className="material-symbols-outlined text-[12px]">edit</span>
                          SỬA
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteCustomer(c.customer_id)}
                          className="text-[9px] font-bold text-red-600 bg-red-50 px-2 py-1 rounded-md transition-colors flex items-center gap-1 active:scale-95 border border-red-100/50"
                        >
                          <span className="material-symbols-outlined text-[12px]">delete</span>
                          XÓA
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* PHÂN TRANG MOBILE */}
              {totalPages > 1 && (
                <div className="lg:hidden flex items-center justify-center gap-4 py-4 border-t border-[#bec8d2]/10 bg-[#f9fafb]/50">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-[#bec8d2]/20 text-[#3e4850] disabled:opacity-30 active:scale-90 transition-all shadow-sm"
                  >
                    <span className="material-symbols-outlined text-base">chevron_left</span>
                  </button>
                  <span className="text-xs font-bold text-[#3e4850]">
                    Trang {currentPage}/{totalPages}
                  </span>
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-[#bec8d2]/20 text-[#3e4850] disabled:opacity-30 active:scale-90 transition-all shadow-sm"
                  >
                    <span className="material-symbols-outlined text-base">chevron_right</span>
                  </button>
                </div>
              )}

              {customers.length === 0 && !loading && (
                <div className="py-20 text-center">
                  <p className="text-[#3e4850] italic">Chưa có khách hàng nào trong hệ thống.</p>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {projectsModalCustomer && (
        <Modal
          maxWidthClassName="max-w-[95vw] lg:max-w-[95vw] w-full"
          overlayClassName="fixed inset-0 z-50 flex items-center justify-center bg-[#131b2e]/40 backdrop-blur-sm p-3 sm:p-4"
          bodyClassName="px-4 sm:px-6 lg:px-8 py-4 sm:py-5 space-y-5 overflow-y-auto max-h-[80vh] min-h-[280px]"
          title={`Dự án — ${projectsModalCustomer.name}`}
          subtitle="Danh sách đầy đủ các dự án thuộc khách hàng này"
          headerActions={
            userRole === 'admin' ? (
              <button
                type="button"
                onClick={() => {
                  setAddProjectFormData({ customer_id: projectsModalCustomer.customer_id })
                  setIsAddProjectOpen(true)
                }}
                className="primary-gradient text-white px-4 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 shadow-lg hover:brightness-110 transition-all whitespace-nowrap"
              >
                <span className="material-symbols-outlined text-[18px]">add_circle</span>
                Thêm dự án
              </button>
            ) : null
          }
          onClose={() => {
            setProjectsModalCustomer(null)
            setProjectsForModal([])
          }}
          footer={
            <button
              type="button"
              onClick={() => {
                setProjectsModalCustomer(null)
                setProjectsForModal([])
              }}
              className="px-6 py-2.5 rounded-xl text-sm font-medium text-white primary-gradient shadow-md hover:brightness-110 transition-all"
            >
              Đóng
            </button>
          }
        >
          {projectsModalLoading ? (
            <p className="text-sm text-[#3e4850] py-8 text-center">Đang tải dự án…</p>
          ) : projectsForModal.length === 0 ? (
            <p className="text-sm text-[#3e4850] py-8 text-center italic">Chưa có dự án nào cho khách hàng này.</p>
          ) : (
            <div className="space-y-3">
              {projectsForModal.map(p => (
                <div
                  key={p.project_id}
                  className="rounded-xl border border-[#bec8d2]/20 bg-[#faf8ff]/80 p-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-sm font-bold text-[#131b2e]">{p.name}</p>
                    <p className="text-xs text-[#3e4850] line-clamp-3 whitespace-pre-wrap">{p.description || '—'}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[#3e4850] pt-1">
                      <span>
                        <span className="font-semibold text-[#131b2e]">Ngân sách:</span>{' '}
                        {p.pricing != null && p.pricing !== ''
                          ? `${Number(p.pricing).toLocaleString('vi-VN')} ₫`
                          : '—'}
                      </span>
                      <span>
                        <span className="font-semibold text-[#131b2e]">Hạn chót:</span>{' '}
                        {formatDeadlineDisplay(p.deadline)}
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0">
                    <StatusBadge status={p.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}

      {isAddProjectOpen && (
        <EntityFormModal
          title="Dự án mới"
          fields={projectFormFields}
          data={addProjectFormData}
          onChange={(k, v) => setAddProjectFormData(f => ({ ...f, [k]: v }))}
          onSave={handleSaveNewProject}
          onClose={() => {
            setIsAddProjectOpen(false)
            setAddProjectFormData({})
          }}
        />
      )}

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
