import { useEffect, useMemo, useState, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import TopBar from '../components/TopBar'
import Toast from '../components/Toast'
import { supabase } from '../utils/supabase'
import Modal from '../components/Modal'
import StaffSubtaskCard from '../components/StaffSubtaskCard'
import { useCallback } from 'react'
import {
  formatSubtaskWorkTimeSummary,
  normalizeSubtaskWorkTime,
  subtaskHasOpenWorkSession,
  subtaskWorkTimeAfterPause,
  subtaskWorkTimeAfterStart,
} from '../utils/subtaskWorkTime'
import { EntityFormModal } from '../components/EntityFormModal'
import { sanitizeTaskContentForSave, subtaskFormInitial } from '../utils/taskContent'
import { normalizeDeadlineForSave } from '../utils/deadline'

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Đang chờ' },
  { value: 'in_progress', label: 'Đang làm' },
  { value: 'completed', label: 'Hoàn thành' },
  { value: 'overdue', label: 'Trễ hẹn' },
]

const EVALUATION_OPTIONS = [
  { value: 'none', label: 'Chưa đánh giá', color: 'text-slate-400 bg-slate-50 border-slate-200' },
  { value: 'good', label: 'Tốt', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  { value: 'fair', label: 'Khá', color: 'text-amber-600 bg-amber-50 border-amber-200' },
  { value: 'bad', label: 'Tệ', color: 'text-rose-600 bg-rose-50 border-rose-200' },
]

const DEADLINE_FILTER_OPTIONS = [
  { value: 'all', label: 'Tất cả deadline' },
  { value: 'overdue', label: 'Đã quá hạn' },
  { value: 'today', label: 'Hôm nay' },
  { value: 'week', label: '7 ngày tới' },
  { value: 'no_deadline', label: 'Không có deadline' },
]

const KANBAN_COLUMNS = [
  { key: 'pending', title: 'Đang chờ', topBar: 'border-t-[#8b9dc3]' },
  { key: 'in_progress', title: 'Đang làm', topBar: 'border-t-[#006591]' },
  { key: 'completed', title: 'Hoàn thành', topBar: 'border-t-[#1e8e3e]' },
  { key: 'overdue', title: 'Trễ hẹn', topBar: 'border-t-[#ba1a1a]' },
]

function formatDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
}

function localDateKey(value) {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function matchesDeadlineFilter(st, deadlineFilter) {
  const dl = st.deadline
  if (deadlineFilter === 'all') return true
  if (deadlineFilter === 'no_deadline') return !dl
  if (!dl) return false

  const now = Date.now()
  const t = new Date(dl).getTime()
  if (!Number.isFinite(t)) return false
  if (deadlineFilter === 'overdue') return t < now

  const todayKey = localDateKey(now)
  const dlKey = localDateKey(dl)
  if (deadlineFilter === 'today') return dlKey != null && dlKey === todayKey
  if (deadlineFilter === 'week') return t >= now && t - now <= 7 * 24 * 60 * 60 * 1000
  return true
}

export default function StaffSubtasksPage() {
  const [loading, setLoading] = useState(true)
  const [hasFetched, setHasFetched] = useState(false)
  const [staffUsers, setStaffUsers] = useState([])
  const [subtasks, setSubtasks] = useState([])
  const [selectedAssignee, setSelectedAssignee] = useState('all')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [selectedProjectIds, setSelectedProjectIds] = useState([])
  const [deadlineFilter, setDeadlineFilter] = useState('all')
  const [showProjectDropdown, setShowProjectDropdown] = useState(false)
  const [updatingStatusId, setUpdatingStatusId] = useState(null)
  const [updatingWorkTimeId, setUpdatingWorkTimeId] = useState(null)
  const [toast, setToast] = useState(null)
  const [lightboxUrl, setLightboxUrl] = useState(null)
  const [userRole, setUserRole] = useState(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

  // -- MODAL GIAO VIỆC --
  const [assignModal, setAssignModal] = useState(null)
  const [assignForm, setAssignForm] = useState({})
  const [assignProjects, setAssignProjects] = useState([])
  const [assignTasks, setAssignTasks] = useState([])
  const [loadingAssignData, setLoadingAssignData] = useState(false)
  const [savingAssign, setSavingAssign] = useState(false)

  // -- RESPONSIVE LOGIC (JS) --
  const [isMobileScreen, setIsMobileScreen] = useState(window.innerWidth < 1024)
  useEffect(() => {
    const handleResize = () => setIsMobileScreen(window.innerWidth < 1024)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const location = useLocation()
  const isActive = location.pathname === '/staff-subtasks'

  // -- PERFORMANCE REFACTOR: CACHING & STABILIZATION --
  const authCache = useRef({ role: null, employeeUserId: null, initialized: false })
  const lastFiltersRef = useRef(null)

  const loadData = useCallback(async (silent = false) => {
    if (!isActive) return
    console.time('Fetch Subtasks (View)')
    if (!silent) setLoading(true)

    try {
      const currentEmployeeUserId = authCache.current.employeeUserId
      const effectiveAssignee = currentEmployeeUserId || selectedAssignee

      const currentFilters = JSON.stringify({ effectiveAssignee, selectedStatus, deadlineFilter })

      // QUERY FROM FLAT VIEW (Much faster)
      let query = supabase
        .from('staff_subtasks_view')
        .select('*')
        .not('assigned_to', 'is', null)

      // Apply server-side filters
      if (effectiveAssignee !== 'all') query = query.eq('assigned_to', effectiveAssignee)
      if (selectedStatus !== 'all') query = query.eq('status', selectedStatus)

      // Deadline filters server-side
      const now = new Date()
      if (deadlineFilter === 'overdue') query = query.lt('deadline', now.toISOString())
      if (deadlineFilter === 'no_deadline') query = query.is('deadline', null)
      if (deadlineFilter === 'today') {
        const start = new Date(now); start.setHours(0, 0, 0, 0)
        const end = new Date(now); end.setHours(23, 59, 59, 999)
        query = query.gte('deadline', start.toISOString()).lte('deadline', end.toISOString())
      }
      if (deadlineFilter === 'week') {
        const start = now.toISOString()
        const end = new Date(now); end.setDate(end.getDate() + 7)
        query = query.gte('deadline', start).lte('deadline', end.toISOString())
      }

      const { data: subtasksData, error: subtasksErr } = await query
        .order('updated_at', { ascending: false })
        .limit(300)

      if (subtasksErr) throw subtasksErr

      setSubtasks(subtasksData || [])
      setHasFetched(true)
      lastFiltersRef.current = currentFilters
    } catch (err) {
      console.error('Load subtasks error:', err)
      setToast({ message: 'Không tải được dữ liệu từ View', type: 'error' })
    } finally {
      console.timeEnd('Fetch Subtasks (View)')
      setLoading(false)
    }
  }, [isActive, selectedAssignee, selectedStatus, deadlineFilter])

  // -- INITIALIZATION: PARALLEL LOADING --
  useEffect(() => {
    if (!isActive || authCache.current.initialized) return

    const initialize = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const authUser = session?.user

        const { data: usersData, error: usersErr } = await supabase
          .from('users')
          .select('user_id, full_name, role')
          .order('full_name', { ascending: true })

        if (usersErr) throw usersErr
        setStaffUsers(usersData || [])

        let currentRole = null
        let currentEmployeeUserId = null

        if (authUser) {
          const profile = (usersData || []).find(u => u.user_id === authUser.id)
          currentRole = profile?.role || null

          if (currentRole === 'employee') {
            currentEmployeeUserId = authUser.id
            setSelectedAssignee(authUser.id)
          }
          setUserRole(currentRole)
        }

        authCache.current = {
          role: currentRole,
          employeeUserId: currentEmployeeUserId,
          initialized: true
        }

        // Trigger load immediately
        loadData(false)
      } catch (err) {
        console.error('Init error:', err)
      }
    }

    initialize()
  }, [isActive, loadData])

  // Fetch subtasks when filters change (with stabilization)
  useEffect(() => {
    if (!isActive || !authCache.current.initialized) return

    const effectiveAssignee = (authCache.current.role === 'employee') ? authCache.current.employeeUserId : selectedAssignee
    const currentFilters = JSON.stringify({ effectiveAssignee, selectedStatus, deadlineFilter })

    if (hasFetched && lastFiltersRef.current === currentFilters) return

    loadData(hasFetched)
  }, [isActive, selectedAssignee, selectedStatus, deadlineFilter, hasFetched, loadData])


  const assigneeOptions = useMemo(() => {
    const countMap = new Map()
    for (const st of subtasks) {
      const id = st.assigned_to
      if (!id) continue
      countMap.set(id, (countMap.get(id) || 0) + 1)
    }
    return (staffUsers || []).map(u => ({
      id: u.user_id,
      name: u.full_name || 'Chưa rõ tên',
      count: countMap.get(u.user_id) || 0,
    }))
  }, [staffUsers, subtasks])

  const projectOptions = useMemo(() => {
    const map = new Map()
    for (const st of subtasks) {
      if (!st.project_id) continue
      const cur = map.get(st.project_id) || { id: st.project_id, name: st.project_name || 'Chưa có dự án', count: 0 }
      cur.count += 1
      map.set(st.project_id, cur)
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'vi'))
  }, [subtasks])


  // Filter client-side for projects only
  const filteredSubtasks = useMemo(() => (
    subtasks.filter(st => {
      const projectId = st.project_id
      return selectedProjectIds.length === 0 || selectedProjectIds.includes(projectId)
    })
  ), [selectedProjectIds, subtasks])


  const subtasksByStatus = useMemo(() => {
    const grouped = {
      pending: [],
      in_progress: [],
      completed: [],
      overdue: [],
    }
    const toDeadlineTime = st => {
      if (!st?.deadline) return Number.MAX_SAFE_INTEGER
      const t = new Date(st.deadline).getTime()
      return Number.isFinite(t) ? t : Number.MAX_SAFE_INTEGER
    }
    for (const st of filteredSubtasks) {
      const key = (st.status || 'pending')
      if (!grouped[key]) grouped.pending.push(st)
      else grouped[key].push(st)
    }
    for (const key of Object.keys(grouped)) {
      grouped[key] = grouped[key].sort((a, b) => toDeadlineTime(a) - toDeadlineTime(b))
    }
    return grouped
  }, [filteredSubtasks])



  const updateSubtaskStatus = useCallback(async (subtaskId, status) => {
    setUpdatingStatusId(subtaskId)
    try {
      const patch = { status }
      if (status === 'completed') {
        patch.completed_at = new Date().toISOString()
        const storedSessionId = localStorage.getItem('checkin_session_id')
        if (storedSessionId) patch.session_id = storedSessionId
      } else {
        patch.completed_at = null
        patch.session_id = null
      }

      const { error } = await supabase
        .from('subtasks')
        .update(patch)
        .eq('subtask_id', subtaskId)
      if (error) throw error

      setSubtasks(prev => prev.map(st => (
        st.subtask_id === subtaskId ? { ...st, ...patch } : st
      )))
      setToast({ message: 'Đã cập nhật trạng thái', type: 'success' })
    } catch (err) {
      console.error(err)
      setToast({ message: err.message || 'Không cập nhật được trạng thái', type: 'error' })
    } finally {
      setUpdatingStatusId(null)
    }
  }, [])

  const updateSubtaskWorkTime = useCallback(async (subtaskId, nextWorkTime) => {
    setUpdatingWorkTimeId(subtaskId)
    try {
      const { error } = await supabase
        .from('subtasks')
        .update({ work_time: nextWorkTime })
        .eq('subtask_id', subtaskId)
      if (error) throw error

      setSubtasks(prev => prev.map(st => (
        st.subtask_id === subtaskId ? { ...st, work_time: nextWorkTime } : st
      )))
      setToast({ message: 'Đã ghi nhận thời gian làm việc', type: 'success' })
    } catch (err) {
      console.error(err)
      setToast({ message: err.message || 'Không lưu được thời gian làm việc', type: 'error' })
    } finally {
      setUpdatingWorkTimeId(null)
    }
  }, [])

  const updateSubtaskEvaluation = useCallback(async (subtaskId, field, value) => {
    setSubtasks(prev => prev.map(st => (
      st.subtask_id === subtaskId ? { ...st, [field]: value } : st
    )))

    try {
      const { error } = await supabase
        .from('subtasks')
        .update({ [field]: value })
        .eq('subtask_id', subtaskId)

      if (error) throw error
    } catch (err) {
      console.error('Update evaluation error:', err)
      setToast({ message: 'Không thể lưu nhận xét: ' + err.message, type: 'error' })
    }
  }, [])

  const handleDeleteClick = useCallback((id) => setConfirmDeleteId(id), [])
  const handleSetLightboxUrl = useCallback((url) => setLightboxUrl(url), [])

  async function deleteSubtask(subtaskId) {
    setConfirmDeleteId(null)
    try {
      const { error } = await supabase.from('subtasks').delete().eq('subtask_id', subtaskId)
      if (error) throw error
      setSubtasks(prev => prev.filter(st => st.subtask_id !== subtaskId))
      setToast({ message: 'Đã xóa subtask', type: 'success' })
    } catch (err) {
      console.error('Delete subtask error:', err)
      setToast({ message: err.message || 'Không thể xóa subtask', type: 'error' })
    }
  }

  const handleAssignClick = async () => {
    setAssignModal(true)
    setAssignForm({
      status: 'pending',
      name: '',
      content_blocks: [{ content: '', image_urls: [] }],
      description: '',
      image_url: '',
      project_id: '',
      task_id: '',
      assigned_to: ''
    })
    setLoadingAssignData(true)
    try {
      const { data: projectsData, error: projErr } = await supabase
        .from('projects')
        .select('project_id, name')
        .order('name', { ascending: true })
      if (projErr) throw projErr

      const { data: tasksData, error: tasksErr } = await supabase
        .from('tasks')
        .select('task_id, name, feature_id, features(project_id)')
        .order('name', { ascending: true })
      if (tasksErr) throw tasksErr

      setAssignProjects(projectsData || [])
      setAssignTasks(tasksData || [])
    } catch (err) {
      console.error(err)
      setToast({ message: 'Không thể tải danh sách dự án/task', type: 'error' })
      setAssignModal(null)
    } finally {
      setLoadingAssignData(false)
    }
  }

  const handleAssignSave = useCallback(async () => {
    if (!assignForm.project_id) return setToast({ message: 'Vui lòng chọn Dự án', type: 'error' })
    if (!assignForm.task_id) return setToast({ message: 'Vui lòng chọn Task', type: 'error' })
    if (!assignForm.assigned_to) return setToast({ message: 'Vui lòng chọn Người thực hiện', type: 'error' })
    if (!assignForm.name?.trim()) return setToast({ message: 'Vui lòng nhập tên tiểu mục', type: 'error' })

    setSavingAssign(true)
    try {
      const payload = {
        task_id: assignForm.task_id,
        name: assignForm.name.trim(),
        assigned_to: assignForm.assigned_to,
        content_blocks: sanitizeTaskContentForSave(assignForm.content_blocks),
        deadline: normalizeDeadlineForSave(assignForm.deadline),
        status: assignForm.status || 'pending',
      }

      const { error } = await supabase.from('subtasks').insert([payload])
      if (error) throw error

      setToast({ message: 'Đã giao việc thành công', type: 'success' })
      setAssignModal(false)
      loadData(true)
    } catch (err) {
      console.error(err)
      setToast({ message: err.message || 'Lỗi khi giao việc', type: 'error' })
    } finally {
      setSavingAssign(false)
    }
  }, [assignForm, loadData])


  const assignSubtaskFields = useMemo(() => {
    const projectOptions = assignProjects.map(p => ({ value: p.project_id, label: p.name }))
    const filteredTasks = assignForm.project_id
      ? assignTasks.filter(t => t.features?.project_id === assignForm.project_id)
      : []
    const taskOptions = filteredTasks.map(t => ({ value: t.task_id, label: t.name }))
    const staffOptions = staffUsers.map(u => ({ value: u.user_id, label: u.full_name }))

    return [
      { name: 'project_id', label: 'Dự án', type: 'searchable_select', options: projectOptions },
      { name: 'task_id', label: 'Task thuộc dự án', type: 'select', options: taskOptions },
      { name: 'assigned_to', label: 'Người thực hiện', type: 'searchable_select', options: staffOptions },
      { name: 'name', label: 'Tên tiểu mục', placeholder: 'VD: Line chart widget' },
      {
        name: 'content_blocks',
        label: 'Nội dung & ảnh',
        type: 'content_image_pairs',
        placeholderContent: 'Chi tiết tiểu mục...',
      },
      {
        name: 'meta', type: 'grid', children: [
          { name: 'deadline', label: 'Hạn chót (ngày & giờ)', type: 'datetime-local' },
          { name: 'status', label: 'Trạng thái', type: 'select' }
        ]
      },
    ]
  }, [assignProjects, assignTasks, assignForm.project_id])

  if (loading) {
    return (
      <div className="flex h-screen overflow-hidden bg-[#faf8ff]">
        <Sidebar />
        <div className="flex-1 md:ml-64 flex flex-col h-screen overflow-y-auto">
          <TopBar title="Task theo nhân sự" />
          <main className="flex-1 p-8">
            <div className="max-w-7xl mx-auto space-y-5 pb-20">
              <div className="flex items-center justify-between py-2 lg:py-6 border-b lg:border-none border-[#bec8d2]/10 mb-2 lg:mb-0">
                <div>
                  <h2 className="text-lg lg:text-3xl font-bold tracking-tight text-[#131b2e]">Task theo nhân sự</h2>
                  <p className="hidden lg:block text-[#3e4850] text-sm mt-1">
                    Lọc theo nhân sự, trạng thái, dự án và deadline để thao tác nhanh các subtask phụ trách.
                  </p>
                </div>
              </div>
              <div className="space-y-4 mt-4">
                <div className="h-32 bg-[#e2e8f0] animate-pulse rounded-xl border border-[#bec8d2]/20"></div>
                <div className="h-32 bg-[#e2e8f0] animate-pulse rounded-xl border border-[#bec8d2]/20"></div>
                <div className="h-32 bg-[#e2e8f0] animate-pulse rounded-xl border border-[#bec8d2]/20"></div>
              </div>
            </div>
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#faf8ff]">
      <Sidebar />

      <div className="flex-1 md:ml-64 flex flex-col h-screen overflow-y-auto">
        <TopBar title="Task theo nhân sự" />

        <main className="flex-1 p-8">
          <div className="max-w-7xl mx-auto space-y-5 pb-20">
            <div className="flex items-center justify-between py-2 lg:py-6 border-b lg:border-none border-[#bec8d2]/10 mb-2 lg:mb-0">
              <div>
                <h2 className="text-lg lg:text-3xl font-bold tracking-tight text-[#131b2e]">Task theo nhân sự</h2>
                <p className="hidden lg:block text-[#3e4850] text-sm mt-1">
                  Lọc theo nhân sự, trạng thái, dự án và deadline để thao tác nhanh các subtask phụ trách.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => loadData()}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#dae2fd] text-[#006591] px-2.5 py-1.5 lg:px-4 lg:py-2 text-[11px] lg:text-xs font-bold hover:bg-[#c9d4fc] transition-colors shadow-sm"
                >
                  <span className="material-symbols-outlined text-[16px] lg:text-[18px]">refresh</span>
                  <span>Làm mới</span>
                </button>
                {(userRole === 'admin' || userRole === 'manager') && (
                  <button
                    type="button"
                    onClick={handleAssignClick}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg primary-gradient text-white px-2.5 py-1.5 lg:px-4 lg:py-2 text-[11px] lg:text-xs font-bold hover:brightness-110 transition-all shadow-md active:scale-95"
                  >
                    <span className="material-symbols-outlined text-[16px] lg:text-[18px]">add_task</span>
                    <span>Giao việc</span>
                  </button>
                )}
              </div>
            </div>

            {/* ── COMPACT FILTER TOOLBAR ── */}
            <div className="lg:hidden rounded-xl border border-[#e2e8f0] bg-white p-2 space-y-3 shadow-sm">
              <div className="flex items-center justify-between gap-1.5 px-0.5">
                <div className="flex-1 text-[11px] font-bold text-[#006591] bg-[#f2f3ff] h-9 flex items-center px-3 rounded-lg border border-[#dce4ff]">
                  DANH SÁCH SUBTASK THEO NHÂN SỰ
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => { setSelectedAssignee('all'); }}
                  className={`px-2 py-2 rounded-lg text-[10px] font-bold border transition-all truncate ${selectedAssignee === 'all' ? 'bg-[#006591] text-white border-[#006591]' : 'bg-white text-[#3e4850] border-[#e2e8f0]'}`}
                >
                  TẤT CẢ ({subtasks.length})
                </button>
                {assigneeOptions.filter(p => p.count > 0).map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => { setSelectedAssignee(p.id); }}
                    className={`px-2 py-2 rounded-lg text-[10px] font-bold border transition-all truncate ${selectedAssignee === p.id ? 'bg-[#006591] text-white border-[#006591]' : 'bg-white text-[#3e4850] border-[#e2e8f0]'}`}
                  >
                    {p.name.split(' ').pop().toUpperCase()} ({p.count})
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-2">
                {/* Icon cho ô Trạng thái (Bộ lọc mobile) */}
                <div className="relative">
                  <select
                    value={selectedStatus}
                    onChange={e => { setSelectedStatus(e.target.value); }}
                    className="w-full appearance-none rounded-md border border-[#e2e8f0] bg-[#fafafa] py-2 pl-2.5 pr-8 text-[10px] font-bold text-[#131b2e]"
                  >
                    <option value="all">TẤT CẢ TRẠNG THÁI</option>
                    {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label.toUpperCase()}</option>)}
                  </select>
                  <span className="material-symbols-outlined pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[16px] text-[#94a3b8]">expand_more</span>
                </div>

                {/* Icon cho ô Deadline (Bộ lọc mobile) */}
                <div className="relative">
                  <select
                    value={deadlineFilter}
                    onChange={e => { setDeadlineFilter(e.target.value); }}
                    className="w-full appearance-none rounded-md border border-[#e2e8f0] bg-[#fafafa] py-2 pl-2.5 pr-8 text-[10px] font-bold text-[#131b2e]"
                  >
                    {DEADLINE_FILTER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label.toUpperCase()}</option>)}
                  </select>
                  <span className="material-symbols-outlined pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[16px] text-[#94a3b8]">expand_more</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowProjectDropdown(v => !v)}
                  className="w-full flex items-center justify-between rounded-md border border-[#e2e8f0] bg-[#fafafa] py-1.5 px-2.5 text-[10px] font-bold text-[#131b2e]"
                >
                  <span className="truncate">{selectedProjectIds.length === 0 ? 'TẤT CẢ DỰ ÁN' : `${selectedProjectIds.length} DỰ ÁN`}</span>
                  <span className="material-symbols-outlined text-[16px] text-[#94a3b8]">expand_more</span>
                </button>
              </div>
            </div>

            <div className="hidden lg:block rounded-xl border border-[#bec8d2]/15 bg-white px-3 py-2 space-y-2 shadow-sm">
              <div className="flex flex-wrap items-center gap-1.5 min-h-[32px] pb-1">
                <button
                  type="button"
                  onClick={() => { setSelectedAssignee('all'); }}
                  className={`shrink-0 px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-colors whitespace-nowrap ${selectedAssignee === 'all' ? 'bg-[#006591] text-white border-[#006591]' : 'bg-white text-[#3e4850] border-[#e2e8f0] hover:bg-[#f2f3ff]'}`}
                >
                  Tất cả ({subtasks.length})
                </button>
                {assigneeOptions.filter(p => p.count > 0).map(p => (
                  <button key={p.id}
                    type="button"
                    onClick={() => { setSelectedAssignee(p.id); }}
                    className={`shrink-0 px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-colors whitespace-nowrap ${selectedAssignee === p.id ? 'bg-[#006591] text-white border-[#006591]' : 'bg-white text-[#3e4850] border-[#e2e8f0] hover:bg-[#f2f3ff]'}`}
                  >
                    {p.name} ({p.count})
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="relative">
                  <select
                    value={selectedStatus}
                    onChange={e => { setSelectedStatus(e.target.value); }}
                    className="w-full appearance-none rounded-md border border-[#bec8d2]/30 bg-white py-1.5 pl-2.5 pr-7 text-[11.5px] font-medium text-[#131b2e] focus:border-[#006591] focus:outline-none"
                  >
                    <option value="all">Tất cả trạng thái</option>
                    {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <span className="material-symbols-outlined pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[14px] text-[#94a3b8]">expand_more</span>
                </div>
                <div className="relative">
                  <select
                    value={deadlineFilter}
                    onChange={e => { setDeadlineFilter(e.target.value); }}
                    className="w-full appearance-none rounded-md border border-[#bec8d2]/30 bg-white py-1.5 pl-2.5 pr-7 text-[11.5px] font-medium text-[#131b2e] focus:border-[#006591] focus:outline-none"
                  >
                    {DEADLINE_FILTER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <span className="material-symbols-outlined pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[14px] text-[#94a3b8]">expand_more</span>
                </div>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowProjectDropdown(v => !v)}
                    className="w-full flex items-center justify-between rounded-md border border-[#bec8d2]/30 bg-white py-1.5 px-2.5 text-[11.5px] font-medium text-[#131b2e] hover:border-[#006591]"
                  >
                    <span className="truncate">{selectedProjectIds.length === 0 ? 'Tất cả dự án' : `${selectedProjectIds.length} dự án`}</span>
                    <span className="material-symbols-outlined text-[14px] text-[#94a3b8]">expand_more</span>
                  </button>

                  {showProjectDropdown && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowProjectDropdown(false)} />
                      <div className="absolute left-0 top-full mt-1 z-50 w-full min-w-[200px] max-h-52 overflow-y-auto rounded-lg border border-[#e2e8f0] bg-white shadow-lg py-1">
                        {projectOptions.length === 0 ? (
                          <p className="px-3 py-2 text-[11px] italic text-[#94a3b8]">Chưa có dự án</p>
                        ) : (
                          projectOptions.map(p => {
                            const checked = selectedProjectIds.includes(p.id)
                            return (
                              <label
                                key={p.id}
                                className="flex items-center justify-between gap-2 px-3 py-1.5 hover:bg-[#f2f3ff] cursor-pointer"
                              >
                                <span className="inline-flex items-center gap-2 min-w-0">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => {
                                      setSelectedProjectIds(prev =>
                                        checked ? prev.filter(id => id !== p.id) : [...prev, p.id]
                                      )
                                    }}
                                    className="h-3.5 w-3.5 rounded text-[#006591]"
                                  />
                                  <span className="text-[11.5px] text-[#131b2e] truncate">{p.name}</span>
                                </span>
                                <span className="shrink-0 text-[10px] text-[#64748b] bg-[#f8fafc] rounded px-1.5 py-0.5">{p.count}</span>
                              </label>
                            )
                          })
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 xl:grid-cols-4">
              {KANBAN_COLUMNS.map(col => (
                <section
                  key={col.key}
                  className={`flex min-h-[260px] flex-col rounded-xl border border-[#bec8d2]/20 border-t-[3px] ${col.topBar} bg-white shadow-sm`}
                >
                  <div className="flex items-center justify-between border-b border-[#eef2f7] px-3 py-2.5">
                    <h3 className="text-sm font-bold text-[#131b2e]">{col.title}</h3>
                    <span className="rounded-full bg-[#f2f3ff] px-2 py-0.5 text-[11px] font-bold text-[#475569]">
                      {subtasksByStatus[col.key]?.length || 0}
                    </span>
                  </div>
                  <div className="flex-1 space-y-2 overflow-y-auto p-2.5 custom-scrollbar">
                    {(subtasksByStatus[col.key] || []).map(st => (
                      <StaffSubtaskCard
                        key={st.subtask_id}
                        st={st}
                        userRole={userRole}
                        isUpdatingStatus={updatingStatusId === st.subtask_id}
                        isUpdatingWorkTime={updatingWorkTimeId === st.subtask_id}
                        onUpdateStatus={updateSubtaskStatus}
                        onUpdateWorkTime={updateSubtaskWorkTime}
                        onSetLightboxUrl={handleSetLightboxUrl}
                        onDeleteClick={handleDeleteClick}
                        onUpdateEvaluation={updateSubtaskEvaluation}
                      />
                    ))}
                    {(subtasksByStatus[col.key] || []).length === 0 && (
                      <p className="py-8 text-center text-[11px] italic text-[#94a3b8]">Trống</p>
                    )}
                  </div>
                </section>
              ))}
            </div>

            {filteredSubtasks.length === 0 && (
              <div className="bg-white border border-[#bec8d2]/20 rounded-xl p-8 text-center">
                <p className="text-sm text-[#3e4850] italic">
                  Không có subtask nào khớp với bộ lọc hiện tại.
                </p>
              </div>
            )}

            {lightboxUrl && (
              <div
                className="fixed inset-0 z-[999] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300"
                onClick={() => setLightboxUrl(null)}
              >
                <button
                  className="absolute top-6 right-6 text-white/70 hover:text-white transition-colors"
                  onClick={() => setLightboxUrl(null)}
                >
                  <span className="material-symbols-outlined text-[32px]">close</span>
                </button>
                <img
                  src={lightboxUrl}
                  alt="Full size"
                  className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-300"
                />
              </div>
            )}
          </div>
        </main>
      </div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} duration={2000} />}

      {confirmDeleteId && (
        <Modal
          title="Xác nhận xóa"
          onClose={() => setConfirmDeleteId(null)}
          maxWidthClassName="max-w-sm"
          footer={
            <>
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="px-4 py-2 rounded-lg text-sm font-bold text-[#3e4850] hover:bg-slate-100 transition-colors"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => deleteSubtask(confirmDeleteId)}
                className="px-4 py-2 rounded-lg text-sm font-bold bg-rose-600 text-white hover:bg-rose-700 transition-colors shadow-sm"
              >
                Xác nhận xóa
              </button>
            </>
          }
        >
          <div className="py-4 text-center">
            <span className="material-symbols-outlined text-[48px] text-rose-500 mb-2">warning</span>
            <p className="text-sm text-[#131b2e] font-medium leading-relaxed">
              Bạn có chắc chắn muốn xóa subtask này không? <br />
              Hành động này <span className="text-rose-600 font-bold underline decoration-rose-200">không thể hoàn tác</span>.
            </p>
          </div>
        </Modal>
      )}

      {assignModal && (
        <EntityFormModal
          title={`Giao việc mới`}
          fields={assignSubtaskFields}
          data={assignForm}
          onChange={(field, value) => {
            setAssignForm(prev => {
              const next = { ...prev, [field]: value }
              if (field === 'project_id') next.task_id = ''
              return next
            })
          }}
          onSave={handleAssignSave}
          onClose={() => setAssignModal(null)}
          isLoading={savingAssign || loadingAssignData}
        />
      )}
    </div>
  )
}
