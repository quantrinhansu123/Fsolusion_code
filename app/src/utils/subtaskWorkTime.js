/**
 * work_time (jsonb): mảng các phiên { started_at: ISO string, ended_at: ISO | null }
 */

/**
 * @param {unknown} raw
 * @returns {{ started_at: string, ended_at: string | null }[]}
 */
export function normalizeSubtaskWorkTime(raw) {
  if (raw == null) return []
  let arr = raw
  if (typeof raw === 'string') {
    try {
      arr = JSON.parse(raw)
    } catch {
      return []
    }
  }
  if (!Array.isArray(arr)) return []
  return arr
    .filter(s => s && typeof s === 'object')
    .map(s => ({
      started_at: typeof s.started_at === 'string' ? s.started_at : '',
      ended_at:
        s.ended_at == null || s.ended_at === ''
          ? null
          : typeof s.ended_at === 'string'
            ? s.ended_at
            : null,
    }))
    .filter(s => s.started_at)
}

/**
 * Phiên cuối còn mở (đã bắt đầu, chưa tạm dừng).
 */
export function subtaskHasOpenWorkSession(sessions) {
  const last = sessions[sessions.length - 1]
  return !!(last && last.ended_at == null)
}

export function subtaskWorkTimeAfterStart(sessions) {
  if (subtaskHasOpenWorkSession(sessions)) return sessions
  const now = new Date().toISOString()
  return [...sessions, { started_at: now, ended_at: null }]
}

export function subtaskWorkTimeAfterPause(sessions) {
  if (sessions.length === 0 || !subtaskHasOpenWorkSession(sessions)) return sessions
  const now = new Date().toISOString()
  return sessions.map((s, i) =>
    i === sessions.length - 1 ? { ...s, ended_at: now } : s,
  )
}

/**
 * Tổng số ms của các khoảng [started_at, ended_at]; phiên mở tính đến hiện tại.
 */
export function sumWorkSessionsMs(sessions) {
  const now = Date.now()
  let ms = 0
  for (const s of sessions) {
    if (!s.started_at) continue
    const t0 = new Date(s.started_at).getTime()
    if (!Number.isFinite(t0)) continue
    const t1 = s.ended_at != null && s.ended_at !== '' ? new Date(s.ended_at).getTime() : now
    if (!Number.isFinite(t1) || t1 < t0) continue
    ms += t1 - t0
  }
  return ms
}

/** Đồng hồ tổng thời lượng: HH:MM (giờ trong ngày, có thể > 24 nếu cần) */
export function formatWorkMsAsHhMm(ms) {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return '00:00'
  const totalMin = Math.floor(ms / 60000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  const hs = h < 100 ? String(h).padStart(2, '0') : String(h)
  return `${hs}:${String(m).padStart(2, '0')}`
}

/** Tổng thời lượng phiên dạng HH:MM:SS (modal tiểu mục) */
export function formatWorkMsAsHhMmSs(ms) {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return '00:00:00'
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function formatDurationVi(ms) {
  if (ms == null || !Number.isFinite(ms) || ms <= 0) return '—'
  const totalSec = Math.floor(ms / 1000)
  const days = Math.floor(totalSec / 86400)
  const hours = Math.floor((totalSec % 86400) / 3600)
  const mins = Math.floor((totalSec % 3600) / 60)
  if (days > 0) return `${days} ngày ${hours} giờ`
  if (hours > 0) return `${hours} giờ ${mins} phút`
  if (mins > 0) return `${mins} phút`
  return '< 1 phút'
}

/** Nhãn ngắn + tổng thời lượng các phiên */
export function formatSubtaskWorkTimeSummary(sessions) {
  const closed = sessions.filter(s => s.ended_at)
  const open = subtaskHasOpenWorkSession(sessions)
  const totalMs = sumWorkSessionsMs(sessions)
  const dur = formatDurationVi(totalMs)
  const parts = []
  if (closed.length > 0) parts.push(`${closed.length} phiên đã khép`)
  if (open) parts.push('đang chạy')
  if (dur !== '—') parts.push(`tổng ${dur}`)
  if (parts.length === 0) return 'Chưa ghi thời gian'
  return parts.join(' · ')
}
