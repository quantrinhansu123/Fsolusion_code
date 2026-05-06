import React from 'react'
import ThreeDotMenu from './ThreeDotMenu'
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
  onOpenDetail,
}) {
  const sessions = normalizeSubtaskWorkTime(st.work_time)
  const running = subtaskHasOpenWorkSession(sessions)
  const taskName = st.task_name || '—'
  const featureName = st.feature_name || '—'
  const timeStr = formatSubtaskWorkTimeSummary(sessions)
  const timeSummary = timeStr.includes('- tổng') ? timeStr.split('- tổng')[1].trim() : timeStr

  const handlePlayClick = () => {
    if (isUpdatingWorkTime || running) return
    onUpdateWorkTime(st.subtask_id, subtaskWorkTimeAfterStart(sessions))
  }
  const handlePauseClick = () => {
    if (isUpdatingWorkTime || !running) return
    onUpdateWorkTime(st.subtask_id, subtaskWorkTimeAfterPause(sessions))
  }
  const handleDelete = () => onDeleteClick(st.subtask_id)
  const currentStatus = STATUS_OPTIONS.find(o => o.value === (st.status || 'pending'))
  const statusColors = {
    pending: 'bg-slate-100 text-slate-600 border-slate-200',
    in_progress: 'bg-blue-50 text-blue-600 border-blue-200',
    completed: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    overdue: 'bg-rose-50 text-rose-600 border-rose-200',
  }
  const colorClass = statusColors[st.status] || statusColors.pending

  const menuItems = [
    // Đổi trạng thái luôn có cho mọi vai trò
    ...STATUS_OPTIONS.map(o => ({
      icon: o.value === (st.status || 'pending') ? 'check' : 'tune',
      label: `Trạng thái: ${o.label}`,
      onClick: () => {
        if (isUpdatingStatus) return
        onUpdateStatus(st.subtask_id, o.value)
      },
    })),
    {
      icon: 'play_arrow',
      label: 'Bắt đầu',
      onClick: handlePlayClick,
    },
    {
      icon: 'pause',
      label: 'Tạm dừng',
      onClick: handlePauseClick,
    },
    ...(userRole === 'admin' || userRole === 'manager'
      ? [{
          icon: 'delete',
          label: 'Xóa',
          danger: true,
          onClick: handleDelete,
        }]
      : []),
  ]

  const openDetail = () => onOpenDetail?.(st)

  return (
    <div className="rounded-md border border-slate-200 bg-[#fafafa] px-2 py-1.5 shadow-sm transition-colors hover:bg-[#f2f3ff]">
      <div className="flex items-start justify-between gap-2">
        <div
          role="button"
          tabIndex={0}
          onClick={openDetail}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              openDetail()
            }
          }}
          className="min-w-0 flex-1 cursor-pointer rounded text-left outline-none focus-visible:ring-2 focus-visible:ring-[#006591]/30"
        >
          <p className="line-clamp-2 text-[10px] font-bold leading-tight text-[#131b2e]" title={st.name}>{st.name}</p>
          <p className="mt-0.5 truncate text-[9px] text-slate-500">{featureName} · {taskName}</p>
          {st.solution?.trim() ? (
            <p className="mt-0.5 line-clamp-2 text-[9px] text-[#006591]" title={st.solution.trim()}>{st.solution.trim()}</p>
          ) : null}
          <p className="mt-0.5 text-[9px] text-slate-600 capitalize">{timeSummary}</p>
        </div>

        <div
          className="flex shrink-0 flex-col items-end gap-1"
          onClick={e => e.stopPropagation()}
          onMouseDown={e => e.stopPropagation()}
        >
          <span className={`px-1.5 py-0.5 rounded border text-[8px] font-bold uppercase tracking-wider ${colorClass}`}>
            {currentStatus?.label}
          </span>
          <ThreeDotMenu items={menuItems} dropUp={false} />
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
  if (prevProps.onOpenDetail !== nextProps.onOpenDetail) return false;

  return true;
})
