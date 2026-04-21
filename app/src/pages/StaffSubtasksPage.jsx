import { useEffect, useMemo, useState } from 'react'
import Sidebar from '../components/Sidebar'
import TopBar from '../components/TopBar'
import Toast from '../components/Toast'
import { supabase } from '../utils/supabase'
import {
  formatSubtaskWorkTimeSummary,
  normalizeSubtaskWorkTime,
  subtaskHasOpenWorkSession,
  subtaskWorkTimeAfterPause,
  subtaskWorkTimeAfterStart,
} from '../utils/subtaskWorkTime'

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Đang chờ' },
  { value: 'in_progress', label: 'Đang làm' },
  { value: 'completed', label: 'Hoàn thành' },
  { value: 'overdue', label: 'Trễ hẹn' },
]

const DEADLINE_FILTER_OPTIONS = [
  { value: 'all', label: 'Tất cả deadline' },
  { value: 'overdue', label: 'Đã quá hạn' },
  { value: 'today', label: 'Hôm nay' },
  { value: 'week', label: '7 ngày tới' },
  { value: 'no_deadline', label: 'Không có deadline' },
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

  // -- STATE CHẤM CÔNG --
  const [activeSessionId, setActiveSessionId] = useState(null)
  const [isWorking, setIsWorking] = useState(false)
  const [sessionTimer, setSessionTimer] = useState(0)
  const [sessionStartTime, setSessionStartTime] = useState(null)
  
  // -- RESPONSIVE LOGIC (JS) --
  const [isMobileScreen, setIsMobileScreen] = useState(window.innerWidth < 1024)
  useEffect(() => {
    const handleResize = () => setIsMobileScreen(window.innerWidth < 1024)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // -- STATE PHÂN TRANG --
  const PAGE_SIZE = 3
  const [groupPages, setGroupPages] = useState({}) // { project_id: currentPage }

  useEffect(() => {
    fetchData()
  }, [])

  // --- LOGIC CHẤM CÔNG ---
  useEffect(() => {
    let interval = null
    if (isWorking && sessionStartTime) {
      interval = setInterval(() => {
        setSessionTimer(Math.floor((Date.now() - sessionStartTime) / 1000))
      }, 1000)
    } else {
      clearInterval(interval)
    }
    return () => clearInterval(interval)
  }, [isWorking, sessionStartTime])

  function formatTimer(seconds) {
    const h = String(Math.floor(seconds / 3600)).padStart(2, '0')
    const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')
    const s = String(seconds % 60).padStart(2, '0')
    return `${h}:${m}:${s}`
  }

  async function handleCheckIn() {
    // Lấy ID từ bộ lọc nhân sự trên giao diện
    if (!selectedAssignee || selectedAssignee === 'all') {
      setToast({ message: 'Vui lòng chọn một nhân sự cụ thể để Check-in!', type: 'error' })
      return
    }

    try {
      const today = new Date().toISOString().split('T')[0]

      // Truyền selectedAssignee vào user_id (thay vì lấy user.id từ token)
      const { data, error } = await supabase
        .from('work_sessions')
        .insert({
          user_id: selectedAssignee,
          work_date: today,
          status: 'working'
        })
        .select('*')
        .single()

      if (error) throw error

      setActiveSessionId(data.session_id)
      setIsWorking(true)
      setSessionStartTime(Date.now())
      setSessionTimer(0)
      setToast({ message: 'Đã Check-in thành công!', type: 'success' })
    } catch (err) {
      console.error(err)
      setToast({ message: err.message || 'Lỗi check-in', type: 'error' })
    }
  }

  async function handleCheckOut() {
    if (!activeSessionId) return
    try {
      const { error } = await supabase
        .from('work_sessions')
        .update({
          check_out_time: new Date().toISOString(),
          status: 'completed'
        })
        .eq('session_id', activeSessionId)

      if (error) throw error

      setActiveSessionId(null)
      setIsWorking(false)
      setSessionStartTime(null)
      setToast({ message: 'Đã Check-out kết thúc ca', type: 'success' })
    } catch (err) {
      console.error(err)
      setToast({ message: err.message || 'Lỗi check-out', type: 'error' })
    }
  }

  const handlePageChange = (groupKey, newPage) => {
    setGroupPages(prev => ({ ...prev, [groupKey]: newPage }))
    // Cuộn mượt lên đầu section của dự án đó
    const section = document.getElementById(`project-section-${groupKey}`)
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }
  // -------------------------

  async function fetchData() {
    setLoading(true)
    try {
      const [{ data: usersData, error: usersErr }, { data: subtasksData, error: subtasksErr }] = await Promise.all([
        supabase
          .from('users')
          .select('user_id, full_name')
          .order('full_name', { ascending: true }),
        supabase
          .from('subtasks')
          .select(`
            subtask_id,
            name,
            status,
            deadline,
            completed_at,
            assigned_to,
            work_time,
            users:assigned_to(user_id, full_name),
            tasks!inner(
              task_id,
              name,
              features!inner(
                feature_id,
                name,
                projects!inner(
                  project_id,
                  name
                )
              )
            )
          `)
          .not('assigned_to', 'is', null)
          .order('updated_at', { ascending: false }),
      ])

      if (usersErr) throw usersErr
      if (subtasksErr) throw subtasksErr
      setStaffUsers(usersData || [])
      setSubtasks(subtasksData || [])
    } catch (err) {
      console.error(err)
      setToast({ message: err.message || 'Không tải được danh sách subtask', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

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
      const p = st.tasks?.features?.projects
      if (!p?.project_id) continue
      const cur = map.get(p.project_id) || { id: p.project_id, name: p.name || 'Chưa có dự án', count: 0 }
      cur.count += 1
      map.set(p.project_id, cur)
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'vi'))
  }, [subtasks])

  const filteredSubtasks = useMemo(() => (
    subtasks.filter(st => {
      const passAssignee = selectedAssignee === 'all' || st.assigned_to === selectedAssignee
      const passStatus = selectedStatus === 'all' || (st.status || 'pending') === selectedStatus
      const projectId = st.tasks?.features?.projects?.project_id
      const passProject = selectedProjectIds.length === 0 || selectedProjectIds.includes(projectId)
      const passDeadline = matchesDeadlineFilter(st, deadlineFilter)
      return passAssignee && passStatus && passProject && passDeadline
    })
  ), [selectedAssignee, selectedStatus, selectedProjectIds, deadlineFilter, subtasks])

  const subtasksByProject = useMemo(() => {
    const map = new Map()
    for (const st of filteredSubtasks) {
      const p = st.tasks?.features?.projects
      const key = p?.project_id || 'unknown'
      const name = p?.name || 'Chưa có dự án'
      if (!map.has(key)) map.set(key, { key, name, items: [] })
      map.get(key).items.push(st)
    }
    const toTs = x => {
      if (!x?.deadline) return Number.POSITIVE_INFINITY
      const t = new Date(x.deadline).getTime()
      return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY
    }
    return Array.from(map.values())
      .map(group => ({
        ...group,
        items: [...group.items].sort((a, b) => toTs(a) - toTs(b)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'))
  }, [filteredSubtasks])

  function toggleProjectFilter(projectId) {
    setSelectedProjectIds(prev => (
      prev.includes(projectId)
        ? prev.filter(id => id !== projectId)
        : [...prev, projectId]
    ))
  }

  async function updateSubtaskStatus(subtaskId, status) {
    setUpdatingStatusId(subtaskId)
    try {
      const patch = { status }
      if (status === 'completed') {
        patch.completed_at = new Date().toISOString()
        if (activeSessionId) {
          patch.session_id = activeSessionId
        }
      } else {
        patch.completed_at = null
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
  }

  async function updateSubtaskWorkTime(subtaskId, nextWorkTime) {
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
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#faf8ff]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#006591]" />
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
              <button
                type="button"
                onClick={fetchData}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#dae2fd] text-[#006591] px-2.5 py-1.5 lg:px-4 lg:py-2 text-[11px] lg:text-xs font-bold hover:bg-[#c9d4fc] transition-colors shadow-sm"
              >
                <span className="material-symbols-outlined text-[16px] lg:text-[18px]">refresh</span>
                <span>Làm mới</span>
              </button>
            </div>

            {/* ── COMPACT FILTER TOOLBAR ── */}
            {/* ── MOBILE TOOLBAR: 3 TẦNG TỐI ƯU (Chỉ hiện trên mobile) ── */}
            <div className="lg:hidden rounded-xl border border-[#e2e8f0] bg-white p-2 space-y-3 shadow-sm">
              {/* Tầng 1: Check-in/Out & Timer */}
              <div className="flex items-center justify-between gap-1.5 px-0.5">
                <button
                  type="button"
                  onClick={handleCheckIn}
                  disabled={isWorking}
                  className={`flex flex-col items-center justify-center gap-0.5 min-w-[75px] h-[42px] rounded-lg text-[10px] font-bold transition-all active:scale-95 ${isWorking
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : 'bg-[#006591] text-white shadow-sm'
                    }`}
                >
                  <span className="material-symbols-outlined text-[18px]">login</span>
                  Check-in
                </button>

                <div className={`flex-1 flex flex-col items-center justify-center h-[42px] rounded-lg border border-slate-100 bg-slate-50/50 ${isWorking ? 'text-emerald-600' : 'text-slate-400'}`}>
                  <span className="text-[9px] font-bold uppercase tracking-wider mb-0.5 opaticy-70">Thời gian làm</span>
                  <span className="font-mono text-[14px] font-bold tracking-widest leading-none">
                    {formatTimer(sessionTimer)}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleCheckOut}
                  disabled={!isWorking}
                  className={`flex flex-col items-center justify-center gap-0.5 min-w-[75px] h-[42px] rounded-lg text-[10px] font-bold border transition-all active:scale-95 ${!isWorking
                    ? 'bg-slate-50 border-slate-100 text-slate-400 cursor-not-allowed'
                    : 'bg-white border-red-200 text-red-600 shadow-sm'
                    }`}
                >
                  <span className="material-symbols-outlined text-[18px]">logout</span>
                  Check-out
                </button>

                <button
                  type="button"
                  onClick={() => { setSelectedAssignee('all'); setSelectedStatus('all'); setSelectedProjectIds([]); setDeadlineFilter('all'); }}
                  className="flex items-center justify-center w-9 h-9 text-[#006591] hover:bg-[#f2f3ff] rounded-full transition-colors shrink-0"
                  title="Đặt lại"
                >
                  <span className="material-symbols-outlined text-[22px]">restart_alt</span>
                </button>
              </div>

              {/* Tầng 2: Nhân sự - Grid 3 cột (như Dashboard sếp thích) */}
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => { setSelectedAssignee('all'); setSubtaskPage(1); }}
                  className={`px-2 py-2 rounded-lg text-[10px] font-bold border transition-all truncate ${selectedAssignee === 'all' ? 'bg-[#006591] text-white border-[#006591]' : 'bg-white text-[#3e4850] border-[#e2e8f0]'}`}
                >
                  TẤT CẢ ({subtasks.length})
                </button>
                {assigneeOptions.filter(p => p.count > 0).map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => { setSelectedAssignee(p.id); setSubtaskPage(1); }}
                    className={`px-2 py-2 rounded-lg text-[10px] font-bold border transition-all truncate ${selectedAssignee === p.id ? 'bg-[#006591] text-white border-[#006591]' : 'bg-white text-[#3e4850] border-[#e2e8f0]'}`}
                  >
                    {p.name.split(' ').pop().toUpperCase()} ({p.count})
                  </button>
                ))}
              </div>

              {/* Tầng 3: Dropdowns lọc - Xếp chồng dọc */}
              <div className="flex flex-col gap-2">
                <select
                  value={selectedStatus}
                  onChange={e => { setSelectedStatus(e.target.value); setSubtaskPage(1); }}
                  className="w-full appearance-none rounded-md border border-[#e2e8f0] bg-[#fafafa] py-1.5 pl-2.5 text-[10px] font-bold text-[#131b2e]"
                >
                  <option value="all">TẤT CẢ TRẠNG THÁI</option>
                  {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label.toUpperCase()}</option>)}
                </select>
                <select
                  value={deadlineFilter}
                  onChange={e => { setDeadlineFilter(e.target.value); setSubtaskPage(1); }}
                  className="w-full appearance-none rounded-md border border-[#e2e8f0] bg-[#fafafa] py-1.5 pl-2.5 text-[10px] font-bold text-[#131b2e]"
                >
                  {DEADLINE_FILTER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label.toUpperCase()}</option>)}
                </select>
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

            {/* ── DESKTOP TOOLBAR: GIỮ NGUYÊN BỐ CỤC CŨ (Chỉ hiện trên desktop) ── */}
            <div className="hidden lg:block rounded-xl border border-[#bec8d2]/15 bg-white px-3 py-2 space-y-2 shadow-sm">
              {/* Row 1: Nhân sự cuộn ngang + Check-in cluster + Reset */}
              <div className="flex items-center gap-3 min-h-[32px]">
                <div className="flex-1 overflow-x-auto scrollbar-hide min-w-0">
                  <div className="flex items-center gap-1.5 w-max">
                    <button
                      type="button"
                      onClick={() => { setSelectedAssignee('all'); setSubtaskPage(1); }}
                      className={`shrink-0 px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-colors whitespace-nowrap ${selectedAssignee === 'all' ? 'bg-[#006591] text-white border-[#006591]' : 'bg-white text-[#3e4850] border-[#e2e8f0] hover:bg-[#f2f3ff]'}`}
                    >
                      Tất cả ({subtasks.length})
                    </button>
                    {assigneeOptions.filter(p => p.count > 0).map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => { setSelectedAssignee(p.id); setSubtaskPage(1); }}
                        className={`shrink-0 px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-colors whitespace-nowrap ${selectedAssignee === p.id ? 'bg-[#006591] text-white border-[#006591]' : 'bg-white text-[#3e4850] border-[#e2e8f0] hover:bg-[#f2f3ff]'}`}
                      >
                        {p.name} ({p.count})
                      </button>
                    ))}
                  </div>
                </div>

                <div className="shrink-0 h-6 w-px bg-[#e2e8f0]" />

                <div className="shrink-0 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCheckIn}
                    disabled={isWorking}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${isWorking ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-[#006591] text-white hover:bg-[#00536f]'}`}
                  >
                    <span className="material-symbols-outlined text-[13px]">login</span>
                    Check-in
                  </button>
                  <span className={`font-mono text-[12px] font-bold tracking-widest px-2 py-0.5 rounded ${isWorking ? 'text-emerald-600 bg-emerald-50' : 'text-slate-400 bg-slate-50'}`}>
                    {formatTimer(sessionTimer)}
                  </span>
                  <button
                    type="button"
                    onClick={handleCheckOut}
                    disabled={!isWorking}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-colors ${!isWorking ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed' : 'bg-white border-red-400 text-red-600 hover:bg-red-50'}`}
                  >
                    <span className="material-symbols-outlined text-[13px]">logout</span>
                    Check-out
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => { setSelectedAssignee('all'); setSelectedStatus('all'); setSelectedProjectIds([]); setDeadlineFilter('all'); }}
                  className="shrink-0 text-[10.5px] font-semibold text-[#006591] hover:underline"
                >
                  Đặt lại
                </button>
              </div>

              {/* Row 2: Dropdowns - Grid 3 cột thanh thoát */}
              <div className="grid grid-cols-3 gap-2">
                <div className="relative">
                  <select
                    value={selectedStatus}
                    onChange={e => { setSelectedStatus(e.target.value); setSubtaskPage(1); }}
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
                    onChange={e => { setDeadlineFilter(e.target.value); setSubtaskPage(1); }}
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

                  {/* Popup dropdown — z-50 để không bị đè */}
                  {showProjectDropdown && (
                    <>
                      {/* Backdrop trong suốt để click ngoài đóng */}
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

            <div className="space-y-4">
              {subtasksByProject.map(group => {
                const currentPage = groupPages[group.key] || 1
                const totalPages = Math.ceil(group.items.length / PAGE_SIZE)
                // Chỉ slice (cắt mảng) khi ở trên màn hình Mobile
                const displayedItems = isMobileScreen
                  ? group.items.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
                  : group.items

                return (
                  <section 
                    key={group.key} 
                    id={`project-section-${group.key}`}
                    className="bg-white border border-[#bec8d2]/18 rounded-xl p-3 shadow-sm scroll-mt-24 transition-all"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-bold text-[#131b2e]">{group.name}</h3>
                      <span className="text-[11px] font-semibold px-2 py-1 rounded-md bg-[#f2f3ff] text-[#3e4850]">
                        {group.items.length} subtask
                      </span>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 border border-[#e2e8f0] rounded-[10px] p-3 shadow-sm bg-slate-50/20">
                      {displayedItems.map((st, idx) => {
                        const sessions = normalizeSubtaskWorkTime(st.work_time)
                        const running = subtaskHasOpenWorkSession(sessions)
                        const taskName = st.tasks?.name || '—'
                        const featureName = st.tasks?.features?.name || '—'
                        const timeStr = formatSubtaskWorkTimeSummary(sessions)
                        const timeSummary = timeStr.includes('- tổng') ? timeStr.split('- tổng')[1].trim() : timeStr

                        return (
                          <div
                            key={st.subtask_id}
                            className="rounded-lg border border-slate-200 bg-[#fafafa] p-3 hover:bg-[#f2f3ff] transition-all shadow-sm"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                              {/* CỘT TRÁI: THÔNG TIN (TIÊU ĐỀ + CHI TIẾT + METADATA) */}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-baseline gap-2 min-w-0">
                                  <p className="text-[14px] font-bold text-[#131b2e] leading-tight truncate shrink-0 max-w-[65%]">{st.name}</p>
                                  <p className="text-[11px] text-slate-500 font-medium truncate flex-1 min-w-0">
                                    {st.users?.full_name ? `${st.users.full_name.split(' ').slice(-2).join(' ')} · ` : ''}
                                    {featureName} · {taskName}
                                  </p>
                                </div>
                                
                                <div className="mt-1.5 flex flex-wrap items-center gap-4">
                                  <div className="flex items-center gap-1.5 text-[11px] text-slate-600 font-medium" title="Hạn chót">
                                    <span className="material-symbols-outlined text-[15px] text-slate-400">event</span>
                                    <span>
                                      {st.deadline ? new Date(st.deadline).toLocaleDateString('vi-VN', { day: 'numeric', month: 'numeric' }) : '—'}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5 text-[11px] text-slate-600 font-medium" title="Tổng thời gian">
                                    <span className="material-symbols-outlined text-[15px] text-slate-400">schedule</span>
                                    <span className="capitalize">{timeSummary}</span>
                                  </div>
                                </div>
                              </div>

                              {/* CỘT PHẢI: THAO TÁC (DROPDOWN + BUTTONS) */}
                              <div className="flex items-center gap-2 shrink-0">
                                <div className="relative">
                                  <select
                                    value={st.status || 'pending'}
                                    onChange={e => updateSubtaskStatus(st.subtask_id, e.target.value)}
                                    disabled={updatingStatusId === st.subtask_id}
                                    className="w-[115px] appearance-none rounded border border-slate-200 bg-white px-2 py-1.5 pr-7 text-[10.5px] font-bold text-[#131b2e] focus:border-[#006591] focus:outline-none focus:ring-1 focus:ring-[#006591]/10 disabled:opacity-55"
                                  >
                                    {STATUS_OPTIONS.map(o => (
                                      <option key={o.value} value={o.value}>{o.label.toUpperCase()}</option>
                                    ))}
                                  </select>
                                  <span className="material-symbols-outlined pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[14px] text-[#94a3b8]">expand_more</span>
                                </div>

                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    disabled={updatingWorkTimeId === st.subtask_id || running}
                                    onClick={() => updateSubtaskWorkTime(st.subtask_id, subtaskWorkTimeAfterStart(sessions))}
                                    className="flex h-8 w-8 items-center justify-center rounded bg-[#1e8e3e]/10 text-[#1e8e3e] hover:bg-[#1e8e3e]/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors border border-[#1e8e3e]/20"
                                    title="Bắt đầu"
                                  >
                                    <span className="material-symbols-outlined text-[18px]">play_arrow</span>
                                  </button>
                                  <button
                                    type="button"
                                    disabled={updatingWorkTimeId === st.subtask_id || !running}
                                    onClick={() => updateSubtaskWorkTime(st.subtask_id, subtaskWorkTimeAfterPause(sessions))}
                                    className="flex h-8 w-8 items-center justify-center rounded bg-[#b06000]/10 text-[#b06000] hover:bg-[#b06000]/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors border border-[#b06000]/20"
                                    title="Dừng/Tạm dừng"
                                  >
                                    <span className="material-symbols-outlined text-[18px]">pause</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* BỘ ĐIỀU KHIỂN PHÂN TRANG (Chỉ hiện trên Mobile khi cần) */}
                    {totalPages > 1 && isMobileScreen && (
                      <div className="mt-4 flex items-center justify-center gap-3 border-t border-slate-100 pt-3 lg:hidden">
                        <button
                          type="button"
                          onClick={() => handlePageChange(group.key, currentPage - 1)}
                          disabled={currentPage === 1}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-bold bg-white border border-[#e2e8f0] text-[#131b2e] hover:bg-[#f2f3ff] disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 shadow-sm"
                        >
                          <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                          <span>TRƯỚC</span>
                        </button>

                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#f2f3ff] text-[#006591] text-[12px] font-black border border-[#dce4ff]">
                          <span>TRANG</span>
                          <span className="bg-[#006591] text-white w-5 h-5 flex items-center justify-center rounded-sm text-[11px]">{currentPage}</span>
                          <span className="text-[#94a3b8]">/</span>
                          <span>{totalPages}</span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handlePageChange(group.key, currentPage + 1)}
                          disabled={currentPage === totalPages}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-bold bg-white border border-[#e2e8f0] text-[#131b2e] hover:bg-[#f2f3ff] disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 shadow-sm"
                        >
                          <span>SAU</span>
                          <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                        </button>
                      </div>
                    )}
                  </section>
                )
              })}

            </div>

            {filteredSubtasks.length === 0 && (
              <div className="bg-white border border-[#bec8d2]/20 rounded-xl p-8 text-center">
                <p className="text-sm text-[#3e4850] italic">
                  Không có subtask nào khớp với bộ lọc hiện tại.
                </p>
              </div>
            )}
          </div>
        </main>
      </div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
