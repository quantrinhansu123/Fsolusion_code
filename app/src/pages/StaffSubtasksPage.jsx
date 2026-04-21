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

            <div className="space-y-3 rounded-xl border border-[#bec8d2]/20 bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] font-bold uppercase tracking-wide text-[#3e4850]">
                  Bộ lọc
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedAssignee('all')
                    setSelectedStatus('all')
                    setSelectedProjectIds([])
                    setDeadlineFilter('all')
                  }}
                  className="text-[11px] font-semibold text-[#006591] hover:underline"
                >
                  Đặt lại bộ lọc
                </button>
              </div>

              <div>
                <p className="mb-1.5 text-[11px] font-semibold text-[#3e4850]">Theo nhân sự</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedAssignee('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                      selectedAssignee === 'all'
                        ? 'bg-[#006591] text-white border-[#006591]'
                        : 'bg-white text-[#3e4850] border-[#bec8d2]/40 hover:bg-[#f2f3ff]'
                    }`}
                  >
                    Tất cả ({subtasks.length})
                  </button>
                  {assigneeOptions.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedAssignee(p.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                        selectedAssignee === p.id
                          ? 'bg-[#006591] text-white border-[#006591]'
                          : 'bg-white text-[#3e4850] border-[#bec8d2]/40 hover:bg-[#f2f3ff]'
                      }`}
                    >
                      {p.name} ({p.count})
                    </button>
                  ))}
                </div>
              </div>

              {/* Cụm nút Chấm công (Check-in/Check-out) */}
              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200 mb-4">
                <div className="text-[13px] text-slate-600 font-medium">
                  Trạng thái ca làm việc:
                </div>
                <div className="flex items-center gap-4">
                  <button 
                    type="button"
                    onClick={handleCheckIn}
                    disabled={isWorking}
                    className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors shadow-sm ${isWorking ? 'bg-slate-300 text-white cursor-not-allowed' : 'bg-[#006591] hover:opacity-90 text-white'}`}
                  >
                    🔵 Check-in (Bắt đầu)
                  </button>
                  
                  <span className={`font-mono font-bold text-sm tracking-widest ${isWorking ? 'text-green-600' : 'text-slate-700'}`}>
                    {formatTimer(sessionTimer)}
                  </span>
                  
                  <button 
                    type="button"
                    onClick={handleCheckOut}
                    disabled={!isWorking}
                    className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors shadow-sm border ${!isWorking ? 'bg-slate-100 border-slate-300 text-slate-400 cursor-not-allowed' : 'bg-white hover:bg-red-50 text-red-600 border-red-600'}`}
                  >
                    ⏹ Check-out (Kết thúc)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <div>
                  <p className="mb-1.5 text-[11px] font-semibold text-[#3e4850]">Theo trạng thái</p>
                  <select
                    value={selectedStatus}
                    onChange={e => setSelectedStatus(e.target.value)}
                    className="w-full rounded-lg border border-[#bec8d2]/40 bg-white py-2 pl-2 pr-7 text-xs font-semibold text-[#131b2e] focus:border-[#006591] focus:outline-none focus:ring-2 focus:ring-[#006591]/20"
                  >
                    <option value="all">Tất cả trạng thái</option>
                    {STATUS_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <p className="mb-1.5 text-[11px] font-semibold text-[#3e4850]">Theo deadline</p>
                  <select
                    value={deadlineFilter}
                    onChange={e => setDeadlineFilter(e.target.value)}
                    className="w-full rounded-lg border border-[#bec8d2]/40 bg-white py-2 pl-2 pr-7 text-xs font-semibold text-[#131b2e] focus:border-[#006591] focus:outline-none focus:ring-2 focus:ring-[#006591]/20"
                  >
                    {DEADLINE_FILTER_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <p className="mb-1.5 text-[11px] font-semibold text-[#3e4850]">Theo dự án (checkbox)</p>
                <div className="max-h-36 overflow-y-auto rounded-lg border border-[#bec8d2]/20 bg-[#faf8ff] px-2 py-2">
                  {projectOptions.length === 0 ? (
                    <p className="px-1 py-1 text-[11px] italic text-[#6e7881]">Chưa có dự án.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {projectOptions.map(p => (
                        <label key={p.id} className="flex items-center justify-between gap-2 rounded-md px-2 py-1 hover:bg-white">
                          <span className="inline-flex min-w-0 items-center gap-2">
                            <input
                              type="checkbox"
                              checked={selectedProjectIds.includes(p.id)}
                              onChange={() => toggleProjectFilter(p.id)}
                              className="h-3.5 w-3.5 rounded border-[#bec8d2]/40 text-[#006591] focus:ring-[#006591]/30"
                            />
                            <span className="truncate text-[11px] text-[#131b2e]" title={p.name}>{p.name}</span>
                          </span>
                          <span className="shrink-0 rounded bg-white px-1.5 py-0.5 text-[10px] text-[#64748b]">{p.count}</span>
                        </label>
                      ))}
                    </div>
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
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {group.items.map(st => {
                      const sessions = normalizeSubtaskWorkTime(st.work_time)
                      const running = subtaskHasOpenWorkSession(sessions)
                      const taskName = st.tasks?.name || '—'
                      const featureName = st.tasks?.features?.name || '—'
                      return (
                        <div key={st.subtask_id} className="bg-white border border-[#bec8d2]/18 rounded-xl p-3 space-y-3 shadow-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-[#131b2e]">{st.name}</p>
                              <p className="text-[11px] text-[#3e4850] mt-0.5 truncate">
                                {featureName} · {taskName}
                              </p>
                              <p className="text-[11px] text-[#6e7881] mt-0.5">
                                Phụ trách: {st.users?.full_name || '—'}
                              </p>
                            </div>
                            <select
                              value={st.status || 'pending'}
                              onChange={e => updateSubtaskStatus(st.subtask_id, e.target.value)}
                              disabled={updatingStatusId === st.subtask_id}
                              className="shrink-0 rounded-lg border border-[#bec8d2]/50 bg-white py-1 pl-2 pr-7 text-[11px] font-semibold text-[#131b2e] focus:border-[#006591] focus:outline-none focus:ring-2 focus:ring-[#006591]/20 disabled:opacity-55"
                            >
                              {STATUS_OPTIONS.map(o => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                              ))}
                            </select>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#3e4850]">
                            <span className="inline-flex items-center gap-1 bg-[#f2f3ff] rounded-md px-2 py-1">
                              <span className="material-symbols-outlined text-[14px]">event</span>
                              Hạn: {formatDateTime(st.deadline)}
                            </span>
                            <span className="inline-flex items-center gap-1 bg-[#f2f3ff] rounded-md px-2 py-1">
                              <span className="material-symbols-outlined text-[14px]">schedule</span>
                              {formatSubtaskWorkTimeSummary(sessions)}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={updatingWorkTimeId === st.subtask_id || running}
                              onClick={() => updateSubtaskWorkTime(st.subtask_id, subtaskWorkTimeAfterStart(sessions))}
                              className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold bg-[#1e8e3e]/15 text-[#1e8e3e] border border-[#1e8e3e]/35 hover:bg-[#1e8e3e]/25 disabled:opacity-45 disabled:cursor-not-allowed transition-colors"
                            >
                              <span className="material-symbols-outlined text-[15px]">play_arrow</span>
                              Bắt đầu
                            </button>
                            <button
                              type="button"
                              disabled={updatingWorkTimeId === st.subtask_id || !running}
                              onClick={() => updateSubtaskWorkTime(st.subtask_id, subtaskWorkTimeAfterPause(sessions))}
                              className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold bg-[#b06000]/12 text-[#8a4a00] border border-[#b06000]/35 hover:bg-[#b06000]/20 disabled:opacity-45 disabled:cursor-not-allowed transition-colors"
                            >
                              <span className="material-symbols-outlined text-[15px]">pause</span>
                              Tạm dừng
                            </button>
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
