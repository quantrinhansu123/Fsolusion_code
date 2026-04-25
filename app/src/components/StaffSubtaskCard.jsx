import React from 'react'
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

function StaffSubtaskCard({
  st,
  userRole,
  isUpdatingStatus,
  isUpdatingWorkTime,
  onUpdateStatus,
  onUpdateWorkTime,
  onDeleteClick,
}) {
  const sessions = normalizeSubtaskWorkTime(st.work_time)
  const running = subtaskHasOpenWorkSession(sessions)
  const taskName = st.task_name || '—'
  const featureName = st.feature_name || '—'
  const timeStr = formatSubtaskWorkTimeSummary(sessions)
  const timeSummary = timeStr.includes('- tổng') ? timeStr.split('- tổng')[1].trim() : timeStr

  const handleStatusChange = (e) => onUpdateStatus(st.subtask_id, e.target.value)
  const handlePlayClick = () => onUpdateWorkTime(st.subtask_id, subtaskWorkTimeAfterStart(sessions))
  const handlePauseClick = () => onUpdateWorkTime(st.subtask_id, subtaskWorkTimeAfterPause(sessions))
  const handleDelete = () => onDeleteClick(st.subtask_id)

  return (
    <div className="rounded-lg border border-slate-200 bg-[#fafafa] p-2 hover:bg-[#f2f3ff] transition-all shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[11px] font-bold leading-tight text-[#131b2e]" title={st.name}>{st.name}</p>
          <p className="mt-0.5 truncate text-[10px] text-slate-500">{featureName} · {taskName}</p>
          <p className="mt-1 text-[10px] text-slate-600 capitalize">{timeSummary}</p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          {userRole === 'admin' ? (
            <>
              {(() => {
                const currentStatus = STATUS_OPTIONS.find(o => o.value === (st.status || 'pending'))
                const colors = {
                  pending: 'bg-slate-100 text-slate-600 border-slate-200',
                  in_progress: 'bg-blue-50 text-blue-600 border-blue-200',
                  completed: 'bg-emerald-50 text-emerald-600 border-emerald-200',
                  overdue: 'bg-rose-50 text-rose-600 border-rose-200',
                }
                const colorClass = colors[st.status] || colors.pending
                return (
                  <span className={`px-1.5 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wider ${colorClass}`}>
                    {currentStatus?.label}
                  </span>
                )
              })()}
              <button
                type="button"
                disabled={isUpdatingWorkTime || running}
                onClick={handlePlayClick}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1e8e3e]/10 text-[#1e8e3e] hover:bg-[#1e8e3e]/20 disabled:opacity-40 transition-all border border-[#1e8e3e]/20"
                title="Bắt đầu"
              >
                <span className="material-symbols-outlined text-[16px]">play_arrow</span>
              </button>
              <button
                type="button"
                disabled={isUpdatingWorkTime || !running}
                onClick={handlePauseClick}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-[#b06000]/10 text-[#b06000] hover:bg-[#b06000]/20 disabled:opacity-40 transition-all border border-[#b06000]/20"
                title="Tạm dừng"
              >
                <span className="material-symbols-outlined text-[16px]">pause</span>
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all border border-transparent hover:border-rose-100"
                title="Xóa"
              >
                <span className="material-symbols-outlined text-[18px]">delete</span>
              </button>
            </>
          ) : (
            <>
              <div className="relative">
                <select
                  value={st.status || 'pending'}
                  onChange={handleStatusChange}
                  disabled={isUpdatingStatus}
                  className="w-[90px] appearance-none rounded border border-slate-200 bg-white pl-2 pr-6 py-1 text-[10px] font-bold text-[#131b2e] focus:border-[#006591] focus:outline-none disabled:opacity-75"
                >
                  {STATUS_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label.toUpperCase()}</option>
                  ))}
                </select>
                <span className="material-symbols-outlined pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-[12px] text-[#94a3b8]">expand_more</span>
              </div>
              <button
                type="button"
                disabled={isUpdatingWorkTime || running}
                onClick={handlePlayClick}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1e8e3e]/10 text-[#1e8e3e] hover:bg-[#1e8e3e]/20 disabled:opacity-40 transition-all border border-[#1e8e3e]/20"
                title="Bắt đầu"
              >
                <span className="material-symbols-outlined text-[16px]">play_arrow</span>
              </button>
              <button
                type="button"
                disabled={isUpdatingWorkTime || !running}
                onClick={handlePauseClick}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-[#b06000]/10 text-[#b06000] hover:bg-[#b06000]/20 disabled:opacity-40 transition-all border border-[#b06000]/20"
                title="Tạm dừng"
              >
                <span className="material-symbols-outlined text-[16px]">pause</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default React.memo(StaffSubtaskCard, (prevProps, nextProps) => {
  // So sánh shallow object st
  if (prevProps.st !== nextProps.st) return false;
  if (prevProps.userRole !== nextProps.userRole) return false;
  if (prevProps.isUpdatingStatus !== nextProps.isUpdatingStatus) return false;
  if (prevProps.isUpdatingWorkTime !== nextProps.isUpdatingWorkTime) return false;

  // Các hàm callback phải dùng useCallback ở Component cha để giữ nguyên reference
  if (prevProps.onUpdateStatus !== nextProps.onUpdateStatus) return false;
  if (prevProps.onUpdateWorkTime !== nextProps.onUpdateWorkTime) return false;
  if (prevProps.onDeleteClick !== nextProps.onDeleteClick) return false;

  return true;
})
