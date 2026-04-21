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

      <div className="flex-1 ml-64 flex flex-col h-screen overflow-y-auto">
        <TopBar title="Task theo nhân sự" />

        <main className="flex-1 p-8">
          <div className="max-w-7xl mx-auto space-y-5 pb-20">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-3xl font-bold tracking-tight text-[#131b2e]">Task theo nhân sự</h2>
                <p className="text-[#3e4850] text-sm mt-1">
                  Lọc theo nhân sự, trạng thái, dự án và deadline để thao tác nhanh các subtask phụ trách.
                </p>
              </div>
              <button
                type="button"
                onClick={fetchData}
                className="inline-flex items-center gap-1 rounded-lg bg-[#dae2fd] text-[#006591] px-3 py-2 text-xs font-semibold hover:bg-[#c9d4fc] transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">refresh</span>
                Làm mới
              </button>
            </div>

            {/* ── COMPACT FILTER TOOLBAR ── */}
            <div className="rounded-xl border border-[#e2e8f0] bg-white px-3 py-2 space-y-2">
              {/* HÀNG 1: Nhân sự (scroll ngang) + Check-in cụm mini (bên phải) */}
              <div className="flex items-center gap-3 min-h-[32px]">
                {/* Nhân sự - scroll ngang */}
                <div className="flex-1 overflow-x-auto scrollbar-hide min-w-0">
                  <div className="flex items-center gap-1.5 w-max">
                    <button
                      type="button"
                      onClick={() => setSelectedAssignee('all')}
                      className={`shrink-0 px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-colors whitespace-nowrap ${selectedAssignee === 'all'
                          ? 'bg-[#006591] text-white border-[#006591]'
                          : 'bg-white text-[#3e4850] border-[#e2e8f0] hover:bg-[#f2f3ff]'
                        }`}
                    >
                      Tất cả ({subtasks.length})
                    </button>
                    {assigneeOptions.filter(p => p.count > 0).map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSelectedAssignee(p.id)}
                        className={`shrink-0 px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-colors whitespace-nowrap ${selectedAssignee === p.id
                            ? 'bg-[#006591] text-white border-[#006591]'
                            : 'bg-white text-[#3e4850] border-[#e2e8f0] hover:bg-[#f2f3ff]'
                          }`}
                      >
                        {p.name} ({p.count})
                      </button>
                    ))}
                  </div>
                </div>

                {/* Divider */}
                <div className="shrink-0 h-6 w-px bg-[#e2e8f0]" />

                {/* Cụm Check-in mini */}
                <div className="shrink-0 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCheckIn}
                    disabled={isWorking}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${isWorking
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        : 'bg-[#006591] text-white hover:bg-[#00536f]'
                      }`}
                  >
                    <span className="material-symbols-outlined text-[13px]">login</span>
                    Check-in
                  </button>

                  <span className={`font-mono text-[12px] font-bold tracking-widest px-2 py-0.5 rounded ${isWorking ? 'text-emerald-600 bg-emerald-50' : 'text-slate-400 bg-slate-50'
                    }`}>
                    {formatTimer(sessionTimer)}
                  </span>

                  <button
                    type="button"
                    onClick={handleCheckOut}
                    disabled={!isWorking}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-colors ${!isWorking
                        ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
                        : 'bg-white border-red-400 text-red-600 hover:bg-red-50'
                      }`}
                  >
                    <span className="material-symbols-outlined text-[13px]">logout</span>
                    Check-out
                  </button>
                </div>

                {/* Nút đặt lại */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedAssignee('all')
                    setSelectedStatus('all')
                    setSelectedProjectIds([])
                    setDeadlineFilter('all')
                  }}
                  className="shrink-0 text-[10.5px] font-semibold text-[#006591] hover:underline whitespace-nowrap"
                >
                  Đặt lại
                </button>
              </div>

              {/* HÀNG 2: 3 cột - Trạng thái | Deadline | Dự án */}
              <div className="grid grid-cols-3 gap-2">
                {/* Cột 1: Trạng thái */}
                <div className="relative">
                  <select
                    value={selectedStatus}
                    onChange={e => setSelectedStatus(e.target.value)}
                    className="w-full appearance-none rounded-md border border-[#e2e8f0] bg-[#fafafa] py-1.5 pl-2.5 pr-7 text-[11.5px] font-medium text-[#131b2e] focus:border-[#006591] focus:outline-none focus:ring-1 focus:ring-[#006591]/20"
                  >
                    <option value="all">Tất cả trạng thái</option>
                    {STATUS_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[14px] text-[#94a3b8]">expand_more</span>
                </div>

                {/* Cột 2: Deadline */}
                <div className="relative">
                  <select
                    value={deadlineFilter}
                    onChange={e => setDeadlineFilter(e.target.value)}
                    className="w-full appearance-none rounded-md border border-[#e2e8f0] bg-[#fafafa] py-1.5 pl-2.5 pr-7 text-[11.5px] font-medium text-[#131b2e] focus:border-[#006591] focus:outline-none focus:ring-1 focus:ring-[#006591]/20"
                  >
                    {DEADLINE_FILTER_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[14px] text-[#94a3b8]">expand_more</span>
                </div>

                {/* Cột 3: Dự án — Custom Multi-select */}
                <div className="relative">
                  {/* Trigger button */}
                  <button
                    type="button"
                    onClick={() => setShowProjectDropdown(v => !v)}
                    className="w-full flex items-center justify-between gap-1 rounded-md border border-[#e2e8f0] bg-[#fafafa] py-1.5 pl-2.5 pr-2 text-[11.5px] font-medium text-[#131b2e] hover:border-[#006591] focus:outline-none focus:ring-1 focus:ring-[#006591]/20 transition-colors"
                  >
                    <span className={selectedProjectIds.length === 0 ? 'text-[#94a3b8]' : 'text-[#131b2e] font-semibold truncate'}>
                      {selectedProjectIds.length === 0
                        ? 'Tất cả dự án'
                        : `${selectedProjectIds.length} dự án`}
                    </span>
                    <span className="flex items-center gap-1 shrink-0">
                      {selectedProjectIds.length > 0 && (
                        <span
                          role="button"
                          tabIndex={-1}
                          onClick={e => { e.stopPropagation(); setSelectedProjectIds([]) }}
                          className="rounded bg-[#006591] px-1.5 py-0.5 text-[10px] font-bold text-white cursor-pointer"
                        >
                          {selectedProjectIds.length} ✕
                        </span>
                      )}
                      <span className="material-symbols-outlined text-[14px] text-[#94a3b8]">{showProjectDropdown ? 'expand_less' : 'expand_more'}</span>
                    </span>
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
              {subtasksByProject.map(group => (
                <section key={group.key} className="bg-white border border-[#bec8d2]/18 rounded-xl p-3 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-[#131b2e]">{group.name}</h3>
                    <span className="text-[11px] font-semibold px-2 py-1 rounded-md bg-[#f2f3ff] text-[#3e4850]">
                      {group.items.length} subtask
                    </span>
                  </div>
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 border border-[#e2e8f0] rounded-[10px] p-3 shadow-sm">
                    {group.items.map(st => {
                      const sessions = normalizeSubtaskWorkTime(st.work_time)
                      const running = subtaskHasOpenWorkSession(sessions)
                      const taskName = st.tasks?.name || '—'
                      const featureName = st.tasks?.features?.name || '—'
                      const timeStr = formatSubtaskWorkTimeSummary(sessions)
                      const timeSummary = timeStr.includes('- tổng') ? timeStr.split('- tổng')[1].trim() : timeStr

                      return (
                        <div
                          key={st.subtask_id}
                          className="rounded-md border border-slate-200 bg-slate-50/50 px-2 py-1.5 hover:bg-blue-50/50 transition-colors"
                        >
                          <div className="flex flex-col gap-1 xl:flex-row xl:items-center xl:justify-between xl:gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex min-w-0 items-center gap-1.5">
                                <p className="truncate text-sm font-bold leading-tight text-[#131b2e]">{st.name}</p>
                                <span className="truncate text-[10.5px] text-[#64748b]">
                                  {st.users?.full_name ? `${st.users.full_name.split(' ').slice(-2).join(' ')} · ` : ''}
                                  {featureName} · {taskName}
                                </span>
                              </div>
                              <div className="mt-0.5 flex min-w-0 items-center gap-2 text-[10.5px] text-[#475569]">
                                <span className="inline-flex min-w-0 items-center gap-1" title="Hạn chót">
                                  <span className="material-symbols-outlined text-[12px] text-[#94a3b8]">event</span>
                                  <span className="truncate">{st.deadline ? new Date(st.deadline).toLocaleDateString('vi-VN', { day: 'numeric', month: 'numeric' }) : '—'}</span>
                                </span>
                                <span className="inline-flex min-w-0 items-center gap-1" title="Tổng thời gian">
                                  <span className="material-symbols-outlined text-[12px] text-[#94a3b8]">schedule</span>
                                  <span className="truncate">Tổng: {timeSummary}</span>
                                </span>
                              </div>
                            </div>

                            <div className="flex shrink-0 items-center justify-end gap-1">
                              <select
                                value={st.status || 'pending'}
                                onChange={e => updateSubtaskStatus(st.subtask_id, e.target.value)}
                                disabled={updatingStatusId === st.subtask_id}
                                className="w-[96px] rounded border border-slate-200 bg-white px-1 py-0.5 text-[10px] font-semibold text-[#131b2e] focus:outline-none focus:ring-1 focus:ring-[#006591]/25 disabled:opacity-55"
                              >
                                {STATUS_OPTIONS.map(o => (
                                  <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                              </select>

                              <button
                                type="button"
                                disabled={updatingWorkTimeId === st.subtask_id || running}
                                onClick={() => updateSubtaskWorkTime(st.subtask_id, subtaskWorkTimeAfterStart(sessions))}
                                className="inline-flex h-6 w-6 items-center justify-center rounded bg-[#1e8e3e]/10 text-[#1e8e3e] hover:bg-[#1e8e3e]/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                title="Bắt đầu tính giờ"
                              >
                                <span className="material-symbols-outlined text-[13px]">play_arrow</span>
                              </button>
                              <button
                                type="button"
                                disabled={updatingWorkTimeId === st.subtask_id || !running}
                                onClick={() => updateSubtaskWorkTime(st.subtask_id, subtaskWorkTimeAfterPause(sessions))}
                                className="inline-flex h-6 w-6 items-center justify-center rounded bg-[#b06000]/10 text-[#b06000] hover:bg-[#b06000]/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                title="Tạm dừng"
                              >
                                <span className="material-symbols-outlined text-[13px]">stop</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
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
          </div>
        </main>
      </div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
