import { useState, useEffect, useCallback, useMemo } from 'react'
import Sidebar from '../components/Sidebar'
import TopBar from '../components/TopBar'
import Toast from '../components/Toast'
import { supabase } from '../utils/supabase'
import { EntityFormModal } from '../components/EntityFormModal'
import { sanitizeTaskContentForSave } from '../utils/taskContent'
import { normalizeDeadlineForSave } from '../utils/deadline'

export default function WorkSchedulePage() {
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date()
    const local = new Date(now.getTime() - (now.getTimezoneOffset() * 60000))
    return local.toISOString().split('T')[0]
  })
  const [toast, setToast] = useState(null)

  // -- DỮ LIỆU THẬT TỪ DATABASE --
  const [realSchedules, setRealSchedules] = useState([])
  const [loadingReal, setLoadingReal] = useState(false)

  // -- MODAL GIAO VIỆC --
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [assignForm, setAssignForm] = useState({})
  const [assignProjects, setAssignProjects] = useState([])
  const [assignTasks, setAssignTasks] = useState([])
  const [staffUsers, setStaffUsers] = useState([])
  const [loadingAssignData, setLoadingAssignData] = useState(false)
  const [savingAssign, setSavingAssign] = useState(false)

  // -- MODAL SỬA VIỆC --
  const [showEditModal, setShowEditModal] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [editProjects, setEditProjects] = useState([])
  const [editTasks, setEditTasks] = useState([])
  const [editStaffUsers, setEditStaffUsers] = useState([])
  const [loadingEditData, setLoadingEditData] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)

  // -- MODAL XÓA --
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteScheduleId, setDeleteScheduleId] = useState(null)
  const [deletingSchedule, setDeletingSchedule] = useState(false)

  // -- XEM ẢNH PHÓNG TO --
  const [previewImage, setPreviewImage] = useState(null)

  const fetchRealSchedules = useCallback(async () => {
    setLoadingReal(true)
    try {
      const startOfDay = `${selectedDate}T00:00:00.000`
      const endOfDay = `${selectedDate}T23:59:59.999`
      const { data, error } = await supabase
        .from('work_schedules')
        .select(`
          schedule_id, title, description, image_urls, deadline, scheduled_at, status, assigned_to,
          user:assigned_to (full_name),
          project:project_id (project_id, name),
          task:task_id (task_id, name)
        `)
        .gte('scheduled_at', startOfDay)
        .lte('scheduled_at', endOfDay)
        .order('scheduled_at', { ascending: true })

      if (error) throw error
      setRealSchedules(data || [])
    } catch (err) {
      console.error('Fetch error:', err)
    } finally {
      setLoadingReal(false)
    }
  }, [selectedDate])

  useEffect(() => {
    fetchRealSchedules()
  }, [fetchRealSchedules])

  const loadFormData = async (isEdit = false) => {
    if (isEdit) setLoadingEditData(true)
    else setLoadingAssignData(true)
    try {
      const [projRes, taskRes, userRes] = await Promise.all([
        supabase.from('projects').select('project_id, name').order('name'),
        supabase.from('tasks').select('task_id, name, features(project_id)').order('name'),
        supabase.from('users').select('user_id, full_name').order('full_name')
      ])
      if (isEdit) {
        setEditProjects(projRes.data || [])
        setEditTasks(taskRes.data || [])
        setEditStaffUsers(userRes.data || [])
      } else {
        setAssignProjects(projRes.data || [])
        setAssignTasks(taskRes.data || [])
        setStaffUsers(userRes.data || [])
      }
    } catch (err) {
      console.error(err)
      setToast({ message: 'Lỗi tải dữ liệu', type: 'error' })
    } finally {
      if (isEdit) setLoadingEditData(false)
      else setLoadingAssignData(false)
    }
  }

  const handleAssignClick = () => {
    setShowAssignModal(true)
    setAssignForm({
      project_id: '',
      task_id: '',
      new_task_name: '',
      assigned_to: '',
      name: '',
      content_blocks: [{ content: '', image_urls: [] }],
      deadline: `${selectedDate}T17:00`,
      plan_target_at: `${selectedDate}T08:00`,
      status: 'pending'
    })
    loadFormData(false)
  }

  const handleAssignSave = async () => {
    if (!assignForm.project_id || (!assignForm.task_id && !assignForm.new_task_name) || !assignForm.assigned_to || !assignForm.name) {
      return setToast({ message: 'Vui lòng điền đầy đủ thông tin!', type: 'error' })
    }
    setSavingAssign(true)
    try {
      let finalTaskId = assignForm.task_id
      if (!finalTaskId && assignForm.new_task_name) {
        let { data: features } = await supabase.from('features').select('feature_id').eq('project_id', assignForm.project_id).limit(1)
        let featureId = features?.[0]?.feature_id
        if (!featureId) {
          const { data: newFeat, error: featErr } = await supabase.from('features').insert([{ project_id: assignForm.project_id, name: 'Công việc chung' }]).select().single()
          if (featErr) throw featErr
          featureId = newFeat.feature_id
        }
        const { data: newTask, error: taskErr } = await supabase.from('tasks').insert([{ feature_id: featureId, name: assignForm.new_task_name.trim() }]).select().single()
        if (taskErr) throw taskErr
        finalTaskId = newTask.task_id
      }
      const payload = {
        project_id: assignForm.project_id,
        task_id: finalTaskId,
        assigned_to: assignForm.assigned_to,
        title: assignForm.name.trim(),
        description: assignForm.content_blocks?.map(b => b.content).filter(Boolean).join('\n'),
        image_urls: assignForm.content_blocks?.flatMap(b => b.image_urls || []).filter(Boolean),
        scheduled_at: normalizeDeadlineForSave(assignForm.plan_target_at),
        deadline: normalizeDeadlineForSave(assignForm.deadline),
        status: assignForm.status || 'pending'
      }
      const { error } = await supabase.from('work_schedules').insert([payload])
      if (error) throw error
      setToast({ message: 'Đã lưu lịch trình thành công!', type: 'success' })
      setShowAssignModal(false)
      fetchRealSchedules()
    } catch (err) {
      console.error(err)
      setToast({ message: err.message || 'Lỗi khi lưu', type: 'error' })
    } finally {
      setSavingAssign(false)
    }
  }

  const handleEditClick = async (wsReal) => {
    setEditForm({
      schedule_id: wsReal.schedule_id,
      project_id: wsReal.project_id || '',
      task_id: wsReal.task_id || '',
      assigned_to: wsReal.assigned_to || '',
      name: wsReal.title || '',
      content_blocks: [{ content: wsReal.description || '', image_urls: wsReal.image_urls || [] }],
      deadline: wsReal.deadline || `${selectedDate}T17:00`,
      plan_target_at: wsReal.scheduled_at || `${selectedDate}T08:00`,
      status: wsReal.status || 'pending'
    })
    setShowEditModal(true)
    await loadFormData(true)
  }

  const handleEditSave = async () => {
    if (!editForm.assigned_to || !editForm.name) {
      return setToast({ message: 'Vui lòng điền đầy đủ thông tin!', type: 'error' })
    }
    setSavingEdit(true)
    try {
      const payload = {
        assigned_to: editForm.assigned_to,
        title: editForm.name.trim(),
        description: editForm.content_blocks?.map(b => b.content).filter(Boolean).join('\n'),
        image_urls: editForm.content_blocks?.flatMap(b => b.image_urls || []).filter(Boolean),
        scheduled_at: normalizeDeadlineForSave(editForm.plan_target_at),
        deadline: normalizeDeadlineForSave(editForm.deadline),
        status: editForm.status || 'pending'
      }
      const { error } = await supabase.from('work_schedules').update(payload).eq('schedule_id', editForm.schedule_id)
      if (error) throw error
      setToast({ message: 'Cập nhật lịch trình thành công!', type: 'success' })
      setShowEditModal(false)
      fetchRealSchedules()
    } catch (err) {
      console.error(err)
      setToast({ message: err.message || 'Lỗi khi cập nhật', type: 'error' })
    } finally {
      setSavingEdit(false)
    }
  }

  const handleDeleteClick = (scheduleId) => {
    setDeleteScheduleId(scheduleId)
    setShowDeleteModal(true)
  }

  const handleDeleteConfirm = async () => {
    if (!deleteScheduleId) return
    setDeletingSchedule(true)
    try {
      const { error } = await supabase.from('work_schedules').delete().eq('schedule_id', deleteScheduleId)
      if (error) throw error
      setToast({ message: 'Xóa lịch trình thành công!', type: 'success' })
      setShowDeleteModal(false)
      setDeleteScheduleId(null)
      fetchRealSchedules()
    } catch (err) {
      console.error(err)
      setToast({ message: err.message || 'Lỗi khi xóa', type: 'error' })
    } finally {
      setDeletingSchedule(false)
    }
  }

  const handleDeleteCancel = () => {
    setShowDeleteModal(false)
    setDeleteScheduleId(null)
  }

  const changeDate = (days) => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + days)
    setSelectedDate(d.toISOString().split('T')[0])
  }

  const assignFields = useMemo(() => {
    const projOptions = assignProjects.map(p => ({ value: p.project_id, label: p.name }))
    const filteredTasks = assignForm.project_id ? assignTasks.filter(t => t.features?.project_id === assignForm.project_id) : []
    const taskOptions = filteredTasks.map(t => ({ value: t.task_id, label: t.name }))
    const staffOptions = staffUsers.map(u => ({ value: u.user_id, label: u.full_name }))
    return [
      { name: 'project_id', label: 'Dự án', type: 'searchable_select', options: projOptions },
      {
        name: 'task_selection', type: 'grid', children: [
          { name: 'task_id', label: 'Chọn Task có sẵn', type: 'select', options: taskOptions },
          { name: 'new_task_name', label: 'HOẶC Tên Task mới', placeholder: 'Nếu chưa có...' },
        ]
      },
      { name: 'assigned_to', label: 'Người thực hiện', type: 'searchable_select', options: staffOptions },
      { name: 'name', label: 'Tên việc chi tiết', placeholder: 'VD: Vẽ layout' },
      { name: 'content_blocks', label: 'Mô tả & Ảnh', type: 'content_image_pairs' },
      {
        name: 'meta', type: 'grid', children: [
          { name: 'plan_target_at', label: 'Bắt đầu', type: 'datetime-local' },
          { name: 'deadline', label: 'Hạn chót', type: 'datetime-local' },
        ]
      }
    ]
  }, [assignProjects, assignTasks, staffUsers, assignForm.project_id])

  const editFields = useMemo(() => {
    const projOptions = editProjects.map(p => ({ value: p.project_id, label: p.name }))
    const filteredTasks = editForm.project_id ? editTasks.filter(t => t.features?.project_id === editForm.project_id) : []
    const taskOptions = filteredTasks.map(t => ({ value: t.task_id, label: t.name }))
    const staffOptions = editStaffUsers.map(u => ({ value: u.user_id, label: u.full_name }))
    return [
      { name: 'project_id', label: 'Dự án', type: 'searchable_select', options: projOptions, disabled: true },
      {
        name: 'task_selection', type: 'grid', children: [
          { name: 'task_id', label: 'Task', type: 'select', options: taskOptions },
        ]
      },
      { name: 'assigned_to', label: 'Người thực hiện', type: 'searchable_select', options: staffOptions },
      { name: 'name', label: 'Tên việc chi tiết', placeholder: 'VD: Vẽ layout' },
      { name: 'content_blocks', label: 'Mô tả & Ảnh (Hỗ trợ xuống dòng)', type: 'content_image_pairs' },
      {
        name: 'meta', type: 'grid', children: [
          { name: 'plan_target_at', label: 'Bắt đầu', type: 'datetime-local' },
          { name: 'deadline', label: 'Hạn chót', type: 'datetime-local' },
        ]
      }
    ]
  }, [editProjects, editTasks, editStaffUsers, editForm.project_id])

  const formatTime = (iso) => {
    if (!iso) return '--:--'
    return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })
  }

  const displaySchedules = useMemo(() => {
    if (!realSchedules || realSchedules.length === 0) return []
    return realSchedules.map(ws => ({
      subtask_id: ws.schedule_id,
      name: ws.title,
      description: ws.description,
      plan_target_at: ws.scheduled_at,
      deadline: ws.deadline,
      proj_name: ws.project?.name || 'Dự án khác',
      task_name: ws.task?.name || 'Task chung',
      user_name: ws.user?.full_name || 'Chưa rõ',
      images: ws.image_urls || [],
      wsReal: ws
    }))
  }, [realSchedules])

  return (
    <div className="flex h-screen overflow-hidden bg-[#faf8ff]">
      <Sidebar />
      <div className="flex-1 md:ml-64 flex flex-col h-screen overflow-y-auto">
        <TopBar title="Lịch trình giao việc" />

        <main className="flex-1 p-4 lg:p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between bg-white p-4 px-6 rounded-2xl border border-[#bec8d2]/20 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-[#f2f3ff] text-[#006591] rounded-xl">
                  <span className="material-symbols-outlined text-[28px]">calendar_month</span>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-[#131b2e]">Lịch trình hàng ngày</h2>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <button onClick={() => changeDate(-1)} className="p-0.5 hover:bg-slate-100 rounded-md transition-colors text-slate-400 hover:text-[#006591]"><span className="material-symbols-outlined text-[20px]">chevron_left</span></button>
                    <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="text-[13px] font-bold text-[#006591] bg-transparent border-none p-0 cursor-pointer focus:ring-0" />
                    <button onClick={() => changeDate(1)} className="p-0.5 hover:bg-slate-100 rounded-md transition-colors text-slate-400 hover:text-[#006591]"><span className="material-symbols-outlined text-[20px]">chevron_right</span></button>
                    <button onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])} className="ml-2 px-2 py-0.5 bg-[#eef4ff] text-[#006591] text-[10px] font-bold rounded-md hover:bg-[#006591] hover:text-white transition-all">Hôm nay</button>
                  </div>
                </div>
              </div>
              <button onClick={handleAssignClick} className="inline-flex items-center gap-2 px-6 py-3 primary-gradient text-white rounded-xl text-[15px] font-bold shadow-lg hover:brightness-110 active:scale-95 transition-all">
                <span className="material-symbols-outlined text-[20px]">add_task</span>
                Giao việc mới
              </button>
            </div>

            <div className="space-y-4 pb-20">
              {loadingReal ? (
                <div className="py-20 text-center"><span className="material-symbols-outlined animate-spin text-[#006591] text-3xl">progress_activity</span></div>
              ) : displaySchedules.map((st) => (
                <div key={st.subtask_id} className="group relative flex gap-6 bg-white p-5 rounded-2xl border border-[#bec8d2]/20 shadow-sm hover:border-[#006591]/40 transition-all">
                  <div className="flex flex-col items-center justify-center border-r border-[#e2e8f0] pr-6 min-w-[90px]">
                    <span className="text-xl font-extrabold text-[#131b2e]">{formatTime(st.plan_target_at)}</span>
                    <span className="text-[11px] font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full mt-2 whitespace-nowrap">DL: {formatTime(st.deadline)}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[10px] font-bold text-[#006591] bg-[#eef4ff] px-2 py-0.5 rounded uppercase tracking-wider">{st.proj_name}</span>
                      <span className="text-[11px] text-[#64748b] font-medium italic opacity-70">{st.task_name}</span>
                    </div>
                    <div className="flex items-start justify-between gap-6">
                      <div className="flex-1">
                        <h4 className="text-[17px] font-bold text-[#131b2e] flex items-center flex-wrap gap-3">
                          {st.name}
                          <div className="flex items-center gap-2 px-2.5 py-1 bg-[#f8faff] rounded-full border border-[#e2e8f0]">
                            <div className="w-5 h-5 rounded-full bg-[#006591] text-white text-[9px] flex items-center justify-center font-bold">{st.user_name?.charAt(0)}</div>
                            <span className="text-[11px] font-bold text-[#475569]">{st.user_name}</span>
                          </div>
                        </h4>
                        <pre className="mt-3 text-[13px] text-[#3e4850] font-sans whitespace-pre-wrap leading-relaxed opacity-90">{st.description}</pre>
                      </div>
                      {st.images && st.images.length > 0 && (
                        <div className="shrink-0 flex flex-wrap gap-2 max-w-[200px] justify-end">
                          {st.images.map((img, idx) => (
                            <div 
                              key={idx} 
                              onClick={() => setPreviewImage(img)} 
                              className="w-14 h-14 rounded-lg overflow-hidden border border-[#bec8d2]/20 shadow-sm cursor-zoom-in hover:scale-105 transition-transform"
                            >
                              <img src={img} className="w-full h-full object-cover" alt="" />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all pl-2 justify-center">
                    <button onClick={() => st.wsReal && handleEditClick(st.wsReal)} className="p-2 text-slate-400 hover:text-[#006591] hover:bg-[#f2f3ff] rounded-xl transition-all"><span className="material-symbols-outlined text-[20px]">edit</span></button>
                    <button onClick={() => st.subtask_id && handleDeleteClick(st.subtask_id)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"><span className="material-symbols-outlined text-[20px]">delete</span></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>

      {showAssignModal && (
        <EntityFormModal title="Giao việc lịch trình" subtitle="Tạo kế hoạch công việc theo ngày" fields={assignFields} data={assignForm} onChange={(name, val) => setAssignForm(prev => ({ ...prev, [name]: val }))} onSave={handleAssignSave} onClose={() => setShowAssignModal(false)} isLoading={savingAssign || loadingAssignData} />
      )}
      {showEditModal && (
        <EntityFormModal title="Sửa việc lịch trình" subtitle="Cập nhật thông tin công việc" fields={editFields} data={editForm} onChange={(name, val) => setEditForm(prev => ({ ...prev, [name]: val }))} onSave={handleEditSave} onClose={() => setShowEditModal(false)} isLoading={savingEdit || loadingEditData} />
      )}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md mx-4 shadow-2xl">
            <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 rounded-full bg-rose-100">
              <span className="material-symbols-outlined text-rose-600">delete_outline</span>
            </div>
            <h3 className="text-lg font-bold text-center text-[#131b2e] mb-2">Xác nhận xóa</h3>
            <p className="text-center text-[#64748b] text-sm mb-6">Bạn chắc chắn muốn xóa lịch trình này? Hành động này không thể hoàn tác.</p>
            <div className="flex gap-3">
              <button onClick={handleDeleteCancel} disabled={deletingSchedule} className="flex-1 px-4 py-2.5 border border-[#e2e8f0] text-[#475569] rounded-xl font-bold hover:bg-slate-50 transition-all disabled:opacity-50">Hủy</button>
              <button onClick={handleDeleteConfirm} disabled={deletingSchedule} className="flex-1 px-4 py-2.5 bg-rose-500 text-white rounded-xl font-bold hover:bg-rose-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {deletingSchedule ? <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span> : <span className="material-symbols-outlined text-[18px]">delete</span>}
                {deletingSchedule ? 'Đang xóa...' : 'Xóa'}
              </button>
            </div>
          </div>
        </div>
      )}
      {previewImage && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4 cursor-zoom-out" onClick={() => setPreviewImage(null)}>
          <div className="relative max-w-5xl w-full h-full flex items-center justify-center">
            <img src={previewImage} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl transition-all duration-300" alt="Preview" />
            <button className="absolute top-4 right-4 text-white bg-white/20 p-2 rounded-full hover:bg-white/40 transition-all">
              <span className="material-symbols-outlined text-[30px]">close</span>
            </button>
          </div>
        </div>
      )}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
