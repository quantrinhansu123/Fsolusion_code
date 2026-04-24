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

const EVALUATION_OPTIONS = [
  { value: 'none', label: 'Chưa đánh giá', color: 'text-slate-400 bg-slate-50 border-slate-200' },
  { value: 'good', label: 'Tốt', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  { value: 'fair', label: 'Khá', color: 'text-amber-600 bg-amber-50 border-amber-200' },
  { value: 'bad', label: 'Tệ', color: 'text-rose-600 bg-rose-50 border-rose-200' },
]

function StaffSubtaskCard({
  st,
  userRole,
  isUpdatingStatus,
  isUpdatingWorkTime,
  onUpdateStatus,
  onUpdateWorkTime,
  onSetLightboxUrl,
  onDeleteClick,
  onUpdateEvaluation,
}) {
  const sessions = normalizeSubtaskWorkTime(st.work_time)
  const running = subtaskHasOpenWorkSession(sessions)
  const taskName = st.tasks?.name || '—'
  const featureName = st.tasks?.features?.name || '—'
  const timeStr = formatSubtaskWorkTimeSummary(sessions)
  const timeSummary = timeStr.includes('- tổng') ? timeStr.split('- tổng')[1].trim() : timeStr

  const handleStatusChange = (e) => onUpdateStatus(st.subtask_id, e.target.value)
  const handlePlayClick = () => onUpdateWorkTime(st.subtask_id, subtaskWorkTimeAfterStart(sessions))
  const handlePauseClick = () => onUpdateWorkTime(st.subtask_id, subtaskWorkTimeAfterPause(sessions))
  const handleDelete = () => onDeleteClick(st.subtask_id)

  return (
    <div className="rounded-lg border border-slate-200 bg-[#fafafa] p-2 hover:bg-[#f2f3ff] transition-all shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 min-w-0">
            <p className="text-[13px] font-bold text-[#131b2e] leading-tight truncate shrink-0 max-w-[65%]">{st.name}</p>
            <p className="text-[10px] text-slate-500 font-medium truncate flex-1 min-w-0">
              {st.users?.full_name ? `${st.users.full_name.split(' ').slice(-2).join(' ')} · ` : ''}
              {featureName} · {taskName}
            </p>
          </div>

          <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1 text-[10px] text-slate-600 font-medium" title="Hạn chót">
                <span className="material-symbols-outlined text-[14px] text-slate-400">event</span>
                <span>
                  {st.deadline ? new Date(st.deadline).toLocaleDateString('vi-VN', { day: 'numeric', month: 'numeric' }) : '—'}
                </span>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-slate-600 font-medium" title="Tổng thời gian">
                <span className="material-symbols-outlined text-[14px] text-slate-400">schedule</span>
                <span className="capitalize">{timeSummary}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
                {userRole === 'admin' ? (
                  <div className="flex items-center gap-1.5">
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
                        <span className={`px-2 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wider ${colorClass}`}>
                          {currentStatus?.label}
                        </span>
                      )
                    })()}
                    <button
                      type="button"
                      onClick={handleDelete}
                      className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                      title="Xóa subtask"
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <select
                        value={st.status || 'pending'}
                        onChange={handleStatusChange}
                        disabled={isUpdatingStatus}
                        className="w-[100px] appearance-none rounded border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-[#131b2e] focus:border-[#006591] focus:outline-none disabled:opacity-75"
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
                        disabled={isUpdatingWorkTime || running}
                        onClick={handlePlayClick}
                        className="flex h-7 w-7 items-center justify-center rounded bg-[#1e8e3e]/10 text-[#1e8e3e] hover:bg-[#1e8e3e]/20 disabled:opacity-40 transition-colors border border-[#1e8e3e]/20"
                      >
                        <span className="material-symbols-outlined text-[16px]">play_arrow</span>
                      </button>
                      <button
                        type="button"
                        disabled={isUpdatingWorkTime || !running}
                        onClick={handlePauseClick}
                        className="flex h-7 w-7 items-center justify-center rounded bg-[#b06000]/10 text-[#b06000] hover:bg-[#b06000]/20 disabled:opacity-40 transition-colors border border-[#b06000]/20"
                      >
                        <span className="material-symbols-outlined text-[16px]">pause</span>
                      </button>
                    </div>
                  </>
                )}
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
              <div className="mt-1.5 space-y-1.5 border-t border-slate-100 pt-1.5">
                {validBlocks.map((block, bIdx) => (
                  <div key={bIdx} className="flex gap-3 items-start group/block">
                    {(() => {
                      const urls = []
                      if (block.image_url?.trim()) urls.push(block.image_url.trim())
                      if (Array.isArray(block.image_urls)) {
                        block.image_urls.forEach(u => u?.trim() && !urls.includes(u.trim()) && urls.push(u.trim()))
                      }
                      if (urls.length === 0) return null
                      return (
                        <div className="flex flex-col gap-1 shrink-0">
                          {urls.map((url, uIdx) => (
                            <div
                              key={uIdx}
                              className="relative cursor-pointer group/img"
                              onClick={() => onSetLightboxUrl(url)}
                            >
                              <img
                                src={url}
                                alt="Subtask attachment"
                                className="w-12 h-12 object-cover rounded-lg border border-slate-200 shadow-sm group-hover/img:border-blue-400 transition-all"
                              />
                              <div className="absolute inset-0 bg-black/5 group-hover/img:bg-transparent rounded-lg transition-all" />
                            </div>
                          ))}
                        </div>
                      )
                    })()}
                    {block.content && (
                      <p className="text-[11px] text-slate-500 leading-relaxed italic flex-1 py-0.5 whitespace-pre-wrap">
                        {block.content}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )
          })()}

          {/* ── EVALUATION ROW ── */}
          <div className="mt-2 -mx-2 -mb-2 bg-gray-50/80 px-2 py-1 border-t border-slate-100 flex items-center gap-2 rounded-b-lg">
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Đánh giá:</span>
              <div className="relative">
                <select
                  value={st.evaluation_rating || 'none'}
                  onChange={(e) => onUpdateEvaluation(st.subtask_id, 'evaluation_rating', e.target.value)}
                  className={`appearance-none rounded px-1.5 py-0.5 text-[9px] font-bold border transition-all cursor-pointer focus:outline-none ${
                    EVALUATION_OPTIONS.find(o => o.value === (st.evaluation_rating || 'none'))?.color || EVALUATION_OPTIONS[0].color
                  }`}
                >
                  {EVALUATION_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex-1">
              <input
                type="text"
                placeholder="Ghi chú đánh giá..."
                defaultValue={st.evaluation_note || ''}
                onBlur={(e) => {
                  if (e.target.value !== (st.evaluation_note || '')) {
                    onUpdateEvaluation(st.subtask_id, 'evaluation_note', e.target.value)
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.target.blur()
                  }
                }}
                className="w-full bg-transparent border-none focus:ring-0 text-[9px] text-slate-600 placeholder:text-slate-400 p-0 h-4"
              />
            </div>
          </div>
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
  if (prevProps.onSetLightboxUrl !== nextProps.onSetLightboxUrl) return false;
  if (prevProps.onDeleteClick !== nextProps.onDeleteClick) return false;
  if (prevProps.onUpdateEvaluation !== nextProps.onUpdateEvaluation) return false;

  return true;
})
