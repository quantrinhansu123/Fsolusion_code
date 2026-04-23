import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
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

  // -- STATE CHẤM CÔNG: Chỉ dùng session nếu thuộc về user đang đăng nhập --
  const [activeSessionId, setActiveSessionId] = useState(null)

  useEffect(() => {
    async function loadCurrentUser() {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) return
      // Validate session: chỉ dùng nếu session_id là của user này
      const storedSessionId = localStorage.getItem('checkin_session_id')
      const storedUserId = localStorage.getItem('checkin_user_id')
      if (storedSessionId && storedUserId === authUser.id) {
        setActiveSessionId(storedSessionId)
      }
    }
    loadCurrentUser()
  }, [])

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

  const location = useLocation()
  const isActive = location.pathname === '/staff-subtasks'

  useEffect(() => {
    if (isActive) {
      fetchData(!hasFetched) // showSpinner = true if not fetched yet
      setHasFetched(true)
    }
  }, [isActive])

  const handlePageChange = (groupKey, newPage) => {
    setGroupPages(prev => ({ ...prev, [groupKey]: newPage }))
    const section = document.getElementById(`project-section-${groupKey}`)
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  async function fetchData(showSpinner = true) {
    if (showSpinner) setLoading(true)
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
            description,
            image_url,
            content_blocks,
            users:assigned_to(user_id, full_name),
            tasks!inner(
              task_id,
              name,
              description,
              image_url,
              content_blocks,
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
                <select
                  value={selectedStatus}
                  onChange={e => { setSelectedStatus(e.target.value); }}
                  className="w-full appearance-none rounded-md border border-[#e2e8f0] bg-[#fafafa] py-1.5 pl-2.5 text-[10px] font-bold text-[#131b2e]"
                >
                  <option value="all">TẤT CẢ TRẠNG THÁI</option>
                  {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label.toUpperCase()}</option>)}
                </select>
                <select
                  value={deadlineFilter}
                  onChange={e => { setDeadlineFilter(e.target.value); }}
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
                  <button
                    key={p.id}
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

            <div className="space-y-4">
              {subtasksByProject.map(group => {
                const currentPage = groupPages[group.key] || 1
                const totalPages = Math.ceil(group.items.length / PAGE_SIZE)
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
                              <div className="min-w-0 flex-1">
                                <div className="flex items-baseline gap-2 min-w-0">
                                  <p className="text-[14px] font-bold text-[#131b2e] leading-tight truncate shrink-0 max-w-[65%]">{st.name}</p>
                                  <p className="text-[11px] text-slate-500 font-medium truncate flex-1 min-w-0">
                                    {st.users?.full_name ? `${st.users.full_name.split(' ').slice(-2).join(' ')} · ` : ''}
                                    {featureName} · {taskName}
                                  </p>
                                </div>

                                <div className="mt-1.5 flex flex-wrap items-center justify-between gap-4">
                                  <div className="flex flex-wrap items-center gap-4">
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

                                  <div className="flex items-center gap-2 shrink-0">
                                    <div className="relative">
                                      <select
                                        value={st.status || 'pending'}
                                        onChange={e => updateSubtaskStatus(st.subtask_id, e.target.value)}
                                        disabled={updatingStatusId === st.subtask_id}
                                        className="w-[100px] appearance-none rounded border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-[#131b2e] focus:border-[#006591] focus:outline-none disabled:opacity-55"
                                      >
                                        {STATUS_OPTIONS.map(o => (
                                          <option key={o.value} value={o.value}>{o.label.toUpperCase()}</option>
                                        ))}
                                      </select>
                                      <span className="material-symbols-outlined pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-[12px] text-[#94a3b8]">expand_more</span>
                                    </div>

                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        disabled={updatingWorkTimeId === st.subtask_id || running}
                                        onClick={() => updateSubtaskWorkTime(st.subtask_id, subtaskWorkTimeAfterStart(sessions))}
                                        className="flex h-7 w-7 items-center justify-center rounded bg-[#1e8e3e]/10 text-[#1e8e3e] hover:bg-[#1e8e3e]/20 disabled:opacity-40 transition-colors border border-[#1e8e3e]/20"
                                      >
                                        <span className="material-symbols-outlined text-[16px]">play_arrow</span>
                                      </button>
                                      <button
                                        type="button"
                                        disabled={updatingWorkTimeId === st.subtask_id || !running}
                                        onClick={() => updateSubtaskWorkTime(st.subtask_id, subtaskWorkTimeAfterPause(sessions))}
                                        className="flex h-7 w-7 items-center justify-center rounded bg-[#b06000]/10 text-[#b06000] hover:bg-[#b06000]/20 disabled:opacity-40 transition-colors border border-[#b06000]/20"
                                      >
                                        <span className="material-symbols-outlined text-[16px]">pause</span>
                                      </button>
                                    </div>
                                  </div>
                                </div>

                                {(() => {
                                  const displayBlocks = Array.isArray(st.content_blocks) && st.content_blocks.length > 0
                                    ? st.content_blocks
                                    : (st.description || st.image_url
                                      ? [{ content: st.description, image_url: st.image_url }]
                                      : (st.tasks?.content_blocks || [{ content: st.tasks?.description, image_url: st.tasks?.image_url }]))

                                  const validBlocks = displayBlocks.filter(b => (b.content && b.content.trim()) || (b.image_url && b.image_url.trim()))
                                  if (validBlocks.length === 0) return null

                                  return (
                                    <div className="mt-3 space-y-2 border-t border-slate-100 pt-2">
                                      {validBlocks.map((block, bIdx) => (
                                        <div key={bIdx} className="flex gap-3 items-start group/block">
                                          {block.image_url && block.image_url.trim() && (
                                            <div
                                              className="relative shrink-0 cursor-pointer"
                                              onClick={() => setLightboxUrl(block.image_url)}
                                            >
                                              <img
                                                src={block.image_url}
                                                alt="Subtask attachment"
                                                className="w-12 h-12 object-cover rounded-lg border border-slate-200 shadow-sm group-hover/block:border-blue-400 transition-all"
                                              />
                                              <div className="absolute inset-0 bg-black/5 group-hover/block:bg-transparent rounded-lg transition-all" />
                                            </div>
                                          )}
                                          {block.content && (
                                            <p className="text-[11px] text-slate-500 leading-relaxed italic flex-1 py-0.5">
                                              {block.content}
                                            </p>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )
                                })()}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>

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
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
