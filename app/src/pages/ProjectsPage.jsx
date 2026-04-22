import { useState, useEffect, useMemo } from 'react'
import Sidebar from '../components/Sidebar'
import TopBar from '../components/TopBar'
import StatusBadge from '../components/StatusBadge'
import ThreeDotMenu from '../components/ThreeDotMenu'
import {
  EntityFormModal,
  CUSTOMER_FIELDS,
  PROJECT_FIELDS,
  FEATURE_FIELDS,
  TASK_FIELDS,
  SUBTASK_FIELDS,
  STATUS_OPTIONS,
} from '../components/EntityFormModal'
import { supabase } from '../utils/supabase'
import Toast from '../components/Toast'
import Modal from '../components/Modal'
import { sanitizeTaskContentForSave, taskFormInitial, subtaskFormInitial, normalizeTaskContentBlocks } from '../utils/taskContent'
import {
  normalizeSubtaskWorkTime,
  subtaskHasOpenWorkSession,
  subtaskWorkTimeAfterStart,
  subtaskWorkTimeAfterPause,
  formatSubtaskWorkTimeSummary,
  sumWorkSessionsMs,
  formatDurationVi,
  formatWorkMsAsHhMm,
  formatWorkMsAsHhMmSs,
} from '../utils/subtaskWorkTime'
import { formatDeadlineDisplay, formatDeadlineShort, normalizeDeadlineForSave } from '../utils/deadline'
import { isHttpUrl, shouldTryImageFirst, hostBlocksIframeEmbedding } from '../utils/linkEmbed'
import IframeBlockedFallback from '../components/IframeBlockedFallback'

// ─── Helpers ──────────────────────────────────────────────────────────────────
/** ISO timestamptz → hiển thị ngày giờ (giờ địa phương) */
function formatDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
}

/** Ngày ngắn cho chân thẻ tiểu mục (vd. 18/4/26) */
function formatFooterShortDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('vi-VN', { day: 'numeric', month: 'numeric', year: '2-digit' })
}

/** Giờ:phút địa phương (như 01:48) */
function formatIsoTimeClock(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })
}

/** Ngày dạng 19/4/26 */
function formatIsoDateSlashShort(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('vi-VN', { day: 'numeric', month: 'numeric', year: '2-digit' })
}

const SUBTASK_STATUS_SELECT_STYLES = {
  pending: 'bg-slate-50 border-slate-200 text-slate-800',
  in_progress: 'bg-sky-50 border-sky-200 text-sky-900',
  completed: 'bg-emerald-50 border-emerald-200 text-emerald-900',
  overdue: 'bg-red-50 border-red-200 text-red-900',
}

/** Modal xem chi tiết một dòng nội dung + link (dùng chung cho task và tiểu mục) */
function ContentLinkDetailModal({ blockPreview, previewShowIframe, setPreviewShowIframe, subtitle, onClose }) {
  if (!blockPreview) return null
  const url = (blockPreview.image_url || '').trim()
  const contentBlock = (
    <>
      <p className="text-[10px] font-bold text-[#3e4850] uppercase tracking-wide mb-1">Nội dung</p>
      <div className="text-sm text-[#131b2e] whitespace-pre-wrap rounded-lg bg-[#faf8ff] border border-[#bec8d2]/20 p-3 min-h-[3rem]">
        {blockPreview.content.trim() ? blockPreview.content : <span className="text-[#6e7881] italic">Không có nội dung</span>}
      </div>
    </>
  )

  /** Ảnh tĩnh bên phải: data URL hoặc http đang thử <img> (chưa chuyển iframe) */
  const sideBySideImage =
    url &&
    (url.startsWith('data:image/') ||
      (isHttpUrl(url) && !hostBlocksIframeEmbedding(url) && !previewShowIframe))

  return (
    <Modal
      overlayClassName="fixed inset-0 z-[60] flex items-center justify-center bg-[#131b2e]/50 backdrop-blur-sm p-3 sm:p-4"
      maxWidthClassName={url ? 'max-w-[95vw] lg:max-w-[85vw] w-full' : 'max-w-[95vw] lg:max-w-[70vw] w-full'}
      bodyClassName="px-4 sm:px-6 py-4 space-y-4 overflow-y-auto max-h-[75vh]"
      title="Chi tiết nội dung & link"
      subtitle={subtitle}
      onClose={onClose}
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl text-sm font-medium text-white primary-gradient shadow-md hover:brightness-110 transition-all"
          >
            Đóng
          </button>
        </div>
      }
    >
      {!url ? (
        <div>{contentBlock}</div>
      ) : sideBySideImage ? (
        <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 items-start">
          <div className="flex-1 min-w-0 w-full">{contentBlock}</div>
          <div className="w-full lg:w-[min(300px,38%)] lg:max-w-[300px] shrink-0 space-y-2">
            <p className="text-[10px] font-bold text-[#3e4850] uppercase tracking-wide">Ảnh</p>
            {url.startsWith('data:image/') ? (
              <p className="text-xs text-[#6e7881] -mt-1">Đính kèm trong dữ liệu</p>
            ) : (
              <p className="text-[10px] text-[#006591] break-all line-clamp-3 max-h-16 overflow-y-auto" title={url}>
                {url.length > 200 ? `${url.slice(0, 200)}…` : url}
              </p>
            )}
            <div className="rounded-xl overflow-hidden border border-[#bec8d2]/20 bg-[#f9fafb] max-h-[min(380px,48vh)]">
              <img
                src={url}
                alt=""
                className="w-full max-h-[min(360px,46vh)] object-contain bg-[#f0f0f5]"
                onError={() => isHttpUrl(url) && setPreviewShowIframe(true)}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div>{contentBlock}</div>
          <div>
            <p className="text-[10px] font-bold text-[#3e4850] uppercase tracking-wide mb-1">Link / ảnh</p>
            {(() => {
              if (!isHttpUrl(url)) {
                return (
                  <p className="text-sm text-[#6e7881] py-2">
                    Chỉ có thể nhúng xem trước web với liên kết http hoặc https.
                  </p>
                )
              }
              if (hostBlocksIframeEmbedding(url)) {
                return <IframeBlockedFallback url={url} />
              }
              if (previewShowIframe) {
                return (
                  <div className="space-y-2">
                    <p className="text-xs text-[#006591] break-all mb-2 max-h-24 overflow-y-auto" title={url}>
                      {url.length > 400 ? `${url.slice(0, 400)}…` : url}
                    </p>
                    <iframe
                      src={url}
                      title="Xem nội dung link"
                      className="w-full min-h-[50vh] h-[min(55vh,560px)] rounded-xl border border-[#bec8d2]/30 bg-white"
                      sandbox="allow-scripts allow-forms allow-downloads"
                    />
                    <p className="text-[11px] text-[#6e7881] leading-snug">
                      Nếu khung trống, trang đích có thể chặn nhúng (chính sách trình duyệt).
                    </p>
                  </div>
                )
              }
              return null
            })()}
          </div>
        </div>
      )}
    </Modal>
  )
}

function useModal() {
  const [modal, setModal] = useState(null)    // { type, ...context }
  const [form, setForm] = useState({})
  const open = (type, ctx = {}) => {
    setModal({ type, ...ctx })
    const { initial, ...rest } = ctx
    delete rest.featureOptions
    setForm({
      ...(initial != null && typeof initial === 'object' ? initial : {}),
      ...rest,
    })
  }
  const close = () => { setModal(null); setForm({}) }
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  return { modal, form, open, close, set }
}

// ─── Task cards (modal “Xem task”) ─────────────────────────────────────────────

function collectTasksFromProject(project) {
  const out = []
  for (const f of project.features || []) {
    for (const t of f.tasks || []) {
      out.push({ feature: f, task: t })
    }
  }
  return out
}

/** Đếm task hoàn thành / tổng trong toàn dự án (Kanban) */
function countTasksInProject(project) {
  let total = 0
  let done = 0
  for (const f of project.features || []) {
    for (const t of f.tasks || []) {
      total++
      if ((t.status || '') === 'completed') done++
    }
  }
  const pct = total ? Math.round((done / total) * 100) : 0
  return { total, done, pct }
}

const MS_DAY = 86400000
const DUE_SOON_DAYS = 7

/**
 * Trạng thái hiển thị list (theo mock dashboard): active | due | late
 */
function projectDashboardKey(project) {
  const st = project.status || 'pending'
  if (st === 'completed') return 'active'
  if (st === 'overdue') return 'late'
  const dl = project.deadline ? new Date(project.deadline).getTime() : NaN
  const now = Date.now()
  if (Number.isFinite(dl)) {
    if (dl < now) return 'late'
    if ((dl - now) / MS_DAY <= DUE_SOON_DAYS) return 'due'
  }
  return 'active'
}

const CUSTOMER_AVATAR_PALETTE = [
  { bg: '#E6F1FB', fg: '#185FA5' },
  { bg: '#E1F5EE', fg: '#0F6E56' },
  { bg: '#FAEEDA', fg: '#854F0B' },
  { bg: '#F3E8FF', fg: '#6B21A8' },
]

function customerAvatarStyle(name) {
  let h = 0
  const s = String(name || 'X')
  for (let i = 0; i < s.length; i++) h = (h + s.charCodeAt(i) * (i + 1)) % 997
  return CUSTOMER_AVATAR_PALETTE[h % CUSTOMER_AVATAR_PALETTE.length]
}

const DASH_STATUS_META = {
  active: { label: 'Hoạt động', pill: 'border-emerald-200 bg-emerald-50/50 text-emerald-700', bar: '#10b981' },
  due: { label: 'Sắp hạn', pill: 'border-amber-200 bg-amber-50/50 text-amber-700', bar: '#f59e0b' },
  late: { label: 'Trễ hạn', pill: 'border-red-200 bg-red-50/50 text-red-700', bar: '#ef4444' },
}

/** 3 cột Kanban: chờ | đang làm (+ trễ) | hoàn thành */
function taskKanbanColumnKey(status) {
  const s = status || 'pending'
  if (s === 'pending') return 'pending'
  if (s === 'in_progress' || s === 'overdue') return 'active'
  if (s === 'completed') return 'done'
  return 'pending'
}

const KANBAN_COLUMNS = [
  { key: 'pending', title: 'Đang chờ', topBar: 'border-t-[#8b9dc3]' },
  { key: 'active', title: 'Đang làm', topBar: 'border-t-[#006591]' },
  { key: 'done', title: 'Hoàn thành', topBar: 'border-t-[#1e8e3e]' },
]

function groupTaskEntriesForKanban(entries) {
  const grouped = { pending: [], active: [], done: [] }
  for (const item of entries) {
    grouped[taskKanbanColumnKey(item.task.status)].push(item)
  }
  return grouped
}

/** Cập nhật một task trong cây customers (không refetch) */
function patchTaskInCustomersState(customers, taskId, patch) {
  if (!Array.isArray(customers)) return customers
  return customers.map(c => ({
    ...c,
    projects: (c.projects || []).map(p => ({
      ...p,
      features: (p.features || []).map(f => ({
        ...f,
        tasks: (f.tasks || []).map(t => (t.task_id === taskId ? { ...t, ...patch } : t)),
      })),
    })),
  }))
}

/** Cập nhật một subtask trong cây customers (không refetch) */
function patchSubtaskInCustomersState(customers, subtaskId, patch) {
  if (!Array.isArray(customers)) return customers
  return customers.map(c => ({
    ...c,
    projects: (c.projects || []).map(p => ({
      ...p,
      features: (p.features || []).map(f => ({
        ...f,
        tasks: (f.tasks || []).map(t => ({
          ...t,
          subtasks: (t.subtasks || []).map(st =>
            st.subtask_id === subtaskId ? { ...st, ...patch } : st
          ),
        })),
      })),
    })),
  }))
}

/** Xóa một subtask khỏi cây customers (không refetch) */
function removeSubtaskFromCustomersState(customers, subtaskId) {
  if (!Array.isArray(customers)) return customers
  return customers.map(c => ({
    ...c,
    projects: (c.projects || []).map(p => ({
      ...p,
      features: (p.features || []).map(f => ({
        ...f,
        tasks: (f.tasks || []).map(t => ({
          ...t,
          subtasks: (t.subtasks || []).filter(st => st.subtask_id !== subtaskId),
        })),
      })),
    })),
  }))
}

/** Ngày địa phương YYYY-MM-DD từ chuỗi ISO */
function localDateKeyFromIso(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Tiêu đề nhóm theo ngày (tiếng Việt) */
function formatSubtaskGroupDayHeading(dateKey) {
  if (dateKey === '_nodate') return 'Không xác định ngày'
  const parts = dateKey.split('-').map(Number)
  const y = parts[0]
  const mo = parts[1]
  const day = parts[2]
  if (!y || !mo || !day) return String(dateKey)
  const date = new Date(y, mo - 1, day)
  return date.toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  })
}

/**
 * Nhóm tiểu mục theo ngày: ưu tiên ngày của hạn chót; không có hạn thì theo ngày tạo (mốc giao).
 */
function groupSubtasksByDay(subtasks) {
  const list = Array.isArray(subtasks) ? [...subtasks] : []
  const buckets = new Map()
  for (const st of list) {
    const isoForDay = st.deadline || st.created_at
    const key = localDateKeyFromIso(isoForDay)
    if (!key) {
      if (!buckets.has('_nodate')) buckets.set('_nodate', [])
      buckets.get('_nodate').push(st)
      continue
    }
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key).push(st)
  }
  const sortInBucket = (a, b) => {
    const ta = new Date(a.deadline || a.created_at || 0).getTime()
    const tb = new Date(b.deadline || b.created_at || 0).getTime()
    return ta - tb
  }
  for (const arr of buckets.values()) arr.sort(sortInBucket)
  const keys = [...buckets.keys()].filter(k => k !== '_nodate').sort()
  const out = keys.map(k => ({
    dateKey: k,
    label: formatSubtaskGroupDayHeading(k),
    items: buckets.get(k),
  }))
  if (buckets.has('_nodate')) {
    out.push({
      dateKey: '_nodate',
      label: formatSubtaskGroupDayHeading('_nodate'),
      items: buckets.get('_nodate'),
    })
  }
  return out
}

/** Khoảng thời gian từ lúc giao (created_at) đến hoàn thành — chỉ khi đã hoàn thành */
function formatGiaoDenHoanThanhCell(st) {
  if (!st?.created_at || st.status !== 'completed' || !st.completed_at) return '—'
  const a = new Date(st.created_at).getTime()
  const b = new Date(st.completed_at).getTime()
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return '—'
  return formatDurationVi(b - a)
}

/**
 * Khối phiên làm việc: nhãn + tóm tắt, đồng hồ HH:MM:SS, thanh tiến độ (8h = đầy).
 */
function SubtaskModalWorkClock({ workTimeRaw, actions }) {
  const sessions = useMemo(() => normalizeSubtaskWorkTime(workTimeRaw), [workTimeRaw])
  const running = useMemo(() => subtaskHasOpenWorkSession(sessions), [sessions])
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!running) return undefined
    const id = setInterval(() => setTick(n => n + 1), 1000)
    return () => clearInterval(id)
  }, [running])
  const ms = useMemo(() => {
    void tick
    return sumWorkSessionsMs(sessions)
  }, [sessions, tick])
  const pct = Math.min(100, (ms / (8 * 60 * 60 * 1000)) * 100)
  const barW = ms <= 0 ? (running ? 8 : 0) : Math.max(pct, running ? 8 : 2)
  return (
    <div className="flex flex-col min-w-0 w-full gap-2">
      <div className="flex items-start justify-between gap-2 text-[10px] w-full">
        <span className="font-semibold uppercase tracking-wide text-[#64748b]">Phiên làm việc</span>
        <span className="truncate text-right leading-snug text-[#64748b]" title={formatSubtaskWorkTimeSummary(sessions)}>
          {formatSubtaskWorkTimeSummary(sessions)}
        </span>
      </div>
      <div className="text-[20px] lg:text-sm lg:font-mono font-bold tabular-nums tracking-tight text-[#131b2e]">
        {formatWorkMsAsHhMmSs(ms)}
      </div>
      <div className="h-[3px] lg:h-[2px] w-full overflow-hidden rounded-full bg-[#1D9E75]/20">
        <div
          className="h-full rounded-full bg-[#1D9E75] transition-[width] duration-500 ease-out"
          style={{ width: `${barW}%` }}
        />
      </div>
      {actions && (
        <div className="flex flex-nowrap gap-1.5 items-center mt-1 w-full">
          {actions}
        </div>
      )}
    </div>
  )
}

/** Tổng thời lượng phiên (đếm live khi có phiên đang mở) */
function SubtaskLiveSessionTotal({ workTimeRaw }) {
  const sessions = useMemo(() => normalizeSubtaskWorkTime(workTimeRaw), [workTimeRaw])
  const running = useMemo(() => subtaskHasOpenWorkSession(sessions), [sessions])
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!running) return undefined
    const id = setInterval(() => setTick(n => n + 1), 1000)
    return () => clearInterval(id)
  }, [running])
  const ms = useMemo(() => {
    void tick
    return sumWorkSessionsMs(sessions)
  }, [sessions, tick])
  return (
    <span
      className="inline-flex items-center gap-1 font-semibold tabular-nums text-[#006591]"
      title="Cộng các khoảng giữa Bắt đầu và Tạm dừng; phiên đang chạy tính đến giây hiện tại"
    >
      {formatDurationVi(ms)}
      {running ? (
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[#1e8e3e]" title="Đang đếm" />
      ) : null}
    </span>
  )
}

/** Mô tả ngắn dưới tiêu đề thẻ Kanban */
function taskCardSubtitle(task) {
  const d = (task.description || '').trim()
  if (d) return d.length > 200 ? `${d.slice(0, 197)}…` : d
  const blocks = normalizeTaskContentBlocks(task)
  for (const b of blocks) {
    if (b.content?.trim()) {
      const t = b.content.trim()
      return t.length > 200 ? `${t.slice(0, 197)}…` : t
    }
  }
  return ''
}

function userInitials(fullName) {
  if (!fullName || typeof fullName !== 'string') return '?'
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return fullName.trim().slice(0, 2).toUpperCase() || '?'
}

/** Tiến độ tiểu mục: số đã Hoàn thành / tổng số */
function subtaskCompletionStats(subtasks) {
  const list = Array.isArray(subtasks) ? subtasks : []
  const total = list.length
  const done = list.filter(s => (s.status || '') === 'completed').length
  const pct = total ? Math.round((done / total) * 100) : 0
  return { done, total, pct }
}

const TASK_STATUS_SET = new Set(['pending', 'in_progress', 'completed', 'overdue'])

/** Nút trạng thái tiểu mục trong modal (nhãn ngắn theo mockup) */
const SUBTASK_STATUS_PILLS = [
  { value: 'pending', label: 'Chờ' },
  { value: 'in_progress', label: 'Đang làm' },
  { value: 'completed', label: 'Hoàn thành' },
  { value: 'overdue', label: 'Trễ hạn' },
]

function ModalTaskCard({
  feature,
  task,
  userRole,
  m,
  deleteEntity,
  onDeleteSubtask = null,
  onTaskStatusChange,
  updatingTaskId = null,
  onSubtaskStatusChange,
  updatingSubtaskId = null,
  onSubtaskWorkTimeSave,
  updatingSubtaskWorkTimeId = null,
  onToast,
  compact = false,
  hideStatusBadge = false,
  /** Kanban: chọn trạng thái + meta cùng hàng với «Xem tiểu mục» ở đáy thẻ */
  statusActionsOutside = false,
}) {
  const [blockPreview, setBlockPreview] = useState(null)
  /** true = đang hiển thị iframe (hoặc sau khi ảnh lỗi) */
  const [previewShowIframe, setPreviewShowIframe] = useState(false)
  const [subBlockPreview, setSubBlockPreview] = useState(null)
  const [subPreviewShowIframe, setSubPreviewShowIframe] = useState(false)
  const [showSubtasksModal, setShowSubtasksModal] = useState(false)
  /** Kanban: modal xem toàn bộ dòng nội dung chi tiết task */
  const [showTaskDetailModal, setShowTaskDetailModal] = useState(false)
  /** Phóng to ảnh (thumbnail task / tiểu mục) */
  const [imageLightboxUrl, setImageLightboxUrl] = useState(null)
  /** subtask_id → mở ghi chú trong modal tiểu mục */
  const [subtaskNotesExpanded, setSubtaskNotesExpanded] = useState({})
  const [selectedTaskIds, setSelectedTaskIds] = useState([])
  const [showPrintModal, setShowPrintModal] = useState(false)
  const canModify = userRole !== 'employee'

  useEffect(() => {
    if (showSubtasksModal) {
      setSubtaskNotesExpanded({})
      setSelectedTaskIds([])
    }
  }, [showSubtasksModal])

  useEffect(() => {
    if (!imageLightboxUrl) return
    const onKey = e => {
      if (e.key === 'Escape') setImageLightboxUrl(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [imageLightboxUrl])
  const subs = task.subtasks || []
  const groupedSubs = useMemo(() => {
    // Auto-hide on completion: Lọc bỏ các tiểu mục đã hoàn thành khỏi danh sách hiển thị
    const visibleSubs = subs.filter(s => (s.status || 'pending') !== 'completed')
    return groupSubtasksByDay(visibleSubs)
  }, [subs])
  /** Luôn dùng cỡ chữ đọc được trong modal tiểu mục (không phụ thuộc compact của thẻ Kanban) */
  const subModal = {
    blockWrap: 'space-y-2',
    blockInner: 'rounded-md border border-[#bec8d2]/15 bg-[#faf8ff]/40 p-2 space-y-1.5',
    bodyText: 'text-[11px] leading-snug',
  }
  // compact ≈ 2/3 kích thước so với bản compact trước (Kanban)
  const showFeatureLabel = feature.name && String(feature.name).trim() !== 'Chung'
  const c = compact
    ? {
      wrap: 'rounded border border-[#bec8d2]/40 bg-white p-1 shadow-sm flex flex-col gap-0.5 hover:border-[#006591]/45 transition-colors',
      feat: 'text-[7px] font-semibold normal-case tracking-normal text-[#006591]/90',
      title: 'text-[11px] font-bold leading-snug',
      blockWrap: 'space-y-0.5',
      blockInner: 'rounded border border-[#bec8d2]/12 bg-[#faf8ff]/40 p-0.5 space-y-0.5',
      bodyText: 'text-[8px] leading-tight',
      imgWrap: 'max-h-9',
      imgH: 'h-6',
      meta: 'text-[8px] gap-0.5',
      icon: 'text-[10px]',
    }
    : {
      wrap: 'rounded-lg border border-[#bec8d2]/30 bg-white p-2.5 shadow-sm flex flex-col gap-1.5 hover:border-[#006591]/40 transition-colors',
      feat: 'text-[10px] font-semibold normal-case tracking-normal text-[#006591]/90',
      title: 'text-base font-bold leading-snug',
      blockWrap: 'space-y-2',
      blockInner: 'rounded-md border border-[#bec8d2]/15 bg-[#faf8ff]/40 p-2 space-y-1.5',
      bodyText: 'text-[11px] leading-snug',
      imgWrap: 'max-h-28',
      imgH: 'h-20',
      meta: 'text-[10px] gap-1.5',
      icon: 'text-[13px]',
    }

  const displayBlocks = normalizeTaskContentBlocks(task).filter(
    b => (b.content && b.content.trim()) || (b.image_url && b.image_url.trim())
  )
  const subtitleLine = statusActionsOutside ? taskCardSubtitle(task) : ''
  const subProgress = statusActionsOutside ? subtaskCompletionStats(subs) : null

  const cardInterior = (
    <>
      {statusActionsOutside ? (
        <>
          <div className="flex min-w-0 w-full flex-wrap lg:flex-nowrap items-start gap-2 pb-0.5 sm:gap-3">
            {onTaskStatusChange ? (
              <div className="mt-0.5 shrink-0 flex flex-col gap-0.5 w-[calc(50%-4px)] lg:w-auto lg:max-w-[9.5rem]">
                <span className="text-[9px] font-bold uppercase tracking-wide text-[#64748b]">Trạng thái</span>
                <select
                  aria-label="Trạng thái nhiệm vụ"
                  value={task.status || 'pending'}
                  disabled={updatingTaskId === task.task_id}
                  onChange={e => onTaskStatusChange(task.task_id, e.target.value)}
                  className="w-full rounded-lg border border-[#bec8d2]/50 bg-white py-1 pl-1.5 pr-6 text-[11px] font-semibold text-[#131b2e] shadow-sm focus:border-[#006591] focus:outline-none focus:ring-2 focus:ring-[#006591]/20 disabled:opacity-55 disabled:cursor-not-allowed"
                >
                  {STATUS_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                {task.status_updated_at ? (
                  <span
                    className="text-[8px] leading-tight text-[#6e7881] truncate"
                    title={`Cập nhật trạng thái: ${formatDateTime(task.status_updated_at)}`}
                  >
                    Cập nhật: {formatDateTime(task.status_updated_at)}
                  </span>
                ) : null}
              </div>
            ) : (
              <div className="mt-0.5 h-8 w-8 shrink-0 rounded-full border-2 border-[#eef1f6]" aria-hidden />
            )}
            <div className="min-w-0 w-full lg:w-auto lg:flex-1 order-last lg:order-none mt-1 lg:mt-0">
              <p className="text-sm font-semibold leading-snug text-[#131b2e]">{task.name}</p>
              {subtitleLine ? (
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[#64748b]">{subtitleLine}</p>
              ) : null}
              {showFeatureLabel ? (
                <p className="mt-1 text-[10px] font-semibold text-[#006591]/90">{feature.name}</p>
              ) : null}
            </div>
            <div className="flex w-auto flex-1 lg:flex-none min-w-0 lg:shrink-0 flex-col items-end gap-1">
              <div className="flex max-w-full flex-nowrap items-center justify-end gap-x-2 gap-y-1 text-[11px] text-[#475569] sm:gap-x-3">
                <span className="shrink-0 tabular-nums text-[#334155]" title={formatDeadlineDisplay(task.deadline)}>
                  {formatDeadlineShort(task.deadline)}
                </span>
                {subs.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setShowSubtasksModal(true)}
                    className="shrink-0 font-semibold text-[#006591] hover:underline"
                  >
                    {subs.length} mục
                  </button>
                ) : (
                  <span className="shrink-0 text-[#94a3b8]">0 mục</span>
                )}
                {task.users?.full_name ? (
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#5b8fd8] to-[#3d6fb0] text-[11px] font-bold text-white shadow-sm"
                    title={task.users.full_name}
                  >
                    {userInitials(task.users.full_name)}
                  </span>
                ) : (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e8edf4] text-[10px] font-bold text-[#94a3b8]">
                    —
                  </span>
                )}
              </div>
            </div>
          </div>
          {subProgress ? (
            <div
              className="mt-2 w-full min-w-0"
              title={
                subProgress.total > 0
                  ? `${subProgress.done}/${subProgress.total} tiểu mục hoàn thành. Chọn «Hoàn thành» trên tiểu mục → lưu thời điểm completed_at. Thời gian làm việc (phiên): Bắt đầu / Tạm dừng trong modal tiểu mục.`
                  : 'Chưa có tiểu mục — thêm từ nút Tiểu mục.'
              }
            >
              <div className="mb-0.5 flex items-center justify-between gap-2 text-[9px] text-[#64748b]">
                <span className="font-semibold uppercase tracking-wide">Tiến độ tiểu mục</span>
                <span className="tabular-nums font-bold text-[#334155]">
                  {subProgress.total > 0 ? `${subProgress.done}/${subProgress.total} · ${subProgress.pct}%` : '—'}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#e2e8f0]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#5b8fd8] to-[#1e8e3e] transition-[width] duration-300 ease-out"
                  style={{ width: `${subProgress.total ? subProgress.pct : 0}%` }}
                />
              </div>
            </div>
          ) : null}
          {displayBlocks.length > 0 || canModify ? (
            <>
              <div className="mt-2 rounded-lg border border-[#e8edf4] bg-[#f8fafc] px-2 py-1.5 space-y-1.5 sm:space-y-0 sm:flex sm:flex-nowrap sm:items-center sm:justify-between sm:gap-2">
                {/* Label: Nội dung chi tiết */}
                <button
                  type="button"
                  onClick={() => setShowTaskDetailModal(true)}
                  className="inline-flex w-full sm:w-auto min-w-0 items-center gap-1.5 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-[#eef2f7]"
                >
                  <span className="material-symbols-outlined shrink-0 text-[16px] text-[#94a3b8]">notes</span>
                  <span className="text-[10px] font-bold uppercase tracking-wide text-[#64748b]">
                    Nội dung chi tiết ({displayBlocks.length})
                  </span>
                </button>
                {/* Action Buttons */}
                {canModify ? (
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      title="Thêm tiểu mục"
                      onClick={() => m.open('add_subtask', { taskId: task.task_id })}
                      className="inline-flex items-center gap-0.5 rounded-lg border border-[#bec8d2]/40 bg-white px-2 py-1 text-[9px] font-semibold text-[#006591] shadow-sm hover:bg-[#eae8ff]"
                    >
                      <span className="material-symbols-outlined text-[16px]">add_circle</span>
                      Tiểu mục
                    </button>
                    <button
                      type="button"
                      title="Chỉnh sửa"
                      onClick={() => {
                        setShowTaskDetailModal(false)
                        m.open('edit_task', { id: task.task_id, initial: taskFormInitial(task) })
                      }}
                      className="inline-flex items-center gap-0.5 rounded-lg border border-[#bec8d2]/40 bg-white px-2 py-1 text-[9px] font-semibold text-[#131b2e] shadow-sm hover:bg-[#f2f3ff]"
                    >
                      <span className="material-symbols-outlined text-[16px]">edit</span>
                      Sửa
                    </button>
                    <button
                      type="button"
                      title="Xóa"
                      onClick={() => {
                        setShowTaskDetailModal(false)
                        deleteEntity('tasks', 'task_id', task.task_id)
                      }}
                      className="inline-flex items-center gap-0.5 rounded-lg border border-[#fecaca] bg-[#fff5f5] px-2 py-1 text-[9px] font-semibold text-[#b91c1c] shadow-sm hover:bg-[#ffe4e4]"
                    >
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                      Xóa
                    </button>
                  </div>
                ) : null}
              </div>
              {showTaskDetailModal ? (
                <Modal
                  overlayClassName="fixed inset-0 z-[58] flex items-center justify-center bg-[#131b2e]/50 backdrop-blur-sm p-3 sm:p-4"
                  maxWidthClassName="max-w-[95vw] lg:max-w-[80vw] w-full"
                  bodyClassName="px-4 sm:px-5 lg:px-7 py-4 space-y-3 overflow-y-auto max-h-[min(85vh,720px)]"
                  title="Nội dung chi tiết"
                  subtitle={`${feature.name} · ${task.name}`}
                  onClose={() => setShowTaskDetailModal(false)}
                  footer={
                    <button
                      type="button"
                      onClick={() => setShowTaskDetailModal(false)}
                      className="px-6 py-2.5 rounded-xl text-sm font-medium text-white primary-gradient shadow-md hover:brightness-110 transition-all"
                    >
                      Đóng
                    </button>
                  }
                >
                  {displayBlocks.length === 0 ? (
                    <p className="text-sm text-[#6e7881]">Chưa có nội dung chi tiết.</p>
                  ) : (
                    <div className={subModal.blockWrap}>
                      {displayBlocks.map((b, i) => (
                        <div key={i} className={subModal.blockInner}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              {b.content.trim() ? (
                                <p className={`text-[#3e4850] whitespace-pre-wrap ${subModal.bodyText}`}>{b.content}</p>
                              ) : (
                                <p className={`text-[#6e7881] italic ${subModal.bodyText}`}>—</p>
                              )}
                            </div>
                            {b.image_url.trim() ? (
                              <button
                                type="button"
                                title="Nhấn để phóng to ảnh"
                                onClick={() => setImageLightboxUrl(b.image_url)}
                                className="shrink-0 rounded-lg overflow-hidden border-2 border-[#bec8d2]/35 bg-[#f9fafb] w-16 h-16 sm:w-[72px] sm:h-[72px] cursor-zoom-in focus:outline-none focus:ring-2 focus:ring-[#006591]/35 shadow-sm"
                              >
                                <img
                                  src={b.image_url}
                                  alt=""
                                  className="w-full h-full object-cover pointer-events-none"
                                  loading="lazy"
                                  onError={e => {
                                    e.currentTarget.style.display = 'none'
                                  }}
                                />
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => {
                                const u = (b.image_url || '').trim()
                                setPreviewShowIframe(
                                  !!(u && isHttpUrl(u) && !shouldTryImageFirst(u) && !hostBlocksIframeEmbedding(u))
                                )
                                setBlockPreview({
                                  content: b.content || '',
                                  image_url: b.image_url || '',
                                  lineIndex: i + 1,
                                })
                              }}
                              className="shrink-0 inline-flex items-center gap-0.5 rounded-md bg-[#dae2fd] px-2 py-1 text-[10px] font-semibold text-[#006591] hover:bg-[#c9d4fc]"
                            >
                              <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                              Xem link
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Modal>
              ) : null}
            </>
          ) : null}
        </>
      ) : (
        <>
          <div className={`flex items-start justify-between gap-1 ${compact ? '' : 'gap-1.5'}`}>
            <div className="min-w-0 flex-1 pr-1">
              <p className={`text-[#131b2e] ${c.title}`}>{task.name}</p>
              {showFeatureLabel ? (
                <p className={`mt-0.5 ${c.feat}`}>{feature.name}</p>
              ) : null}
            </div>
            <div className={`flex shrink-0 items-center ${compact ? 'gap-0.5' : 'gap-1'}`}>
              {!hideStatusBadge && (
                <div className={`${compact ? 'scale-[0.58] origin-center' : 'scale-[0.72] origin-center'}`}>
                  <StatusBadge status={task.status} />
                </div>
              )}
              {canModify && (
                <>
                  <button
                    type="button"
                    title="Nhập tiểu mục"
                    onClick={() => m.open('add_subtask', { taskId: task.task_id })}
                    className={`inline-flex shrink-0 items-center justify-center gap-0.5 rounded border border-[#bec8d2]/30 bg-[#eae8ff] font-semibold text-[#006591] transition-colors hover:bg-[#dae2fd] ${compact ? 'px-1 py-px text-[7px]' : 'px-1.5 py-0.5 text-[8px]'
                      }`}
                  >
                    <span className={`material-symbols-outlined ${compact ? 'text-[11px]' : 'text-[13px]'}`}>add_circle</span>
                    <span className={compact ? 'hidden min-[380px]:inline' : ''}>Tiểu mục</span>
                  </button>
                  <button
                    type="button"
                    title="Chỉnh sửa"
                    onClick={() => m.open('edit_task', { id: task.task_id, initial: taskFormInitial(task) })}
                    className={`inline-flex shrink-0 items-center justify-center gap-0.5 rounded border border-[#bec8d2]/30 bg-white font-semibold text-[#131b2e] transition-colors hover:bg-[#f2f3ff] ${compact ? 'px-1 py-px text-[7px]' : 'px-1.5 py-0.5 text-[8px]'
                      }`}
                  >
                    <span className={`material-symbols-outlined ${compact ? 'text-[11px]' : 'text-[13px]'}`}>edit</span>
                    <span className={compact ? 'hidden min-[380px]:inline' : ''}>Sửa</span>
                  </button>
                  <button
                    type="button"
                    title="Xóa"
                    onClick={() => deleteEntity('tasks', 'task_id', task.task_id)}
                    className={`inline-flex shrink-0 items-center justify-center gap-0.5 rounded border border-[#fecaca] bg-[#fff8f8] font-semibold text-[#b91c1c] transition-colors hover:bg-[#ffecec] ${compact ? 'px-1 py-px text-[7px]' : 'px-1.5 py-0.5 text-[8px]'
                      }`}
                  >
                    <span className={`material-symbols-outlined ${compact ? 'text-[11px]' : 'text-[13px]'}`}>delete</span>
                    <span className={compact ? 'hidden min-[380px]:inline' : ''}>Xóa</span>
                  </button>
                </>
              )}
            </div>
          </div>
          {displayBlocks.length === 0 ? (
            <p className={compact ? 'text-[8px] text-[#3e4850]' : 'text-[11px] text-[#3e4850]'}>—</p>
          ) : (
            <div className={c.blockWrap}>
              {displayBlocks.map((b, i) => (
                <div key={i} className={c.blockInner}>
                  <div className="flex items-start justify-between gap-1.5">
                    <div className="min-w-0 flex-1">
                      {b.content.trim() ? (
                        <p
                          className={`whitespace-pre-wrap text-[#3e4850] ${c.bodyText} ${compact ? 'line-clamp-2' : 'line-clamp-3'
                            }`}
                        >
                          {b.content}
                        </p>
                      ) : (
                        <p className={`text-[#6e7881] italic ${c.bodyText}`}>—</p>
                      )}
                    </div>
                    {b.image_url.trim() ? (
                      <button
                        type="button"
                        title="Nhấn để phóng to ảnh"
                        onClick={() => setImageLightboxUrl(b.image_url)}
                        className={`shrink-0 cursor-zoom-in overflow-hidden rounded-lg border border-[#bec8d2]/30 bg-[#f9fafb] focus:outline-none focus:ring-2 focus:ring-[#006591]/35 ${compact ? 'h-10 w-10' : 'h-12 w-12 sm:h-14 sm:w-14'
                          }`}
                      >
                        <img
                          src={b.image_url}
                          alt=""
                          className="pointer-events-none h-full w-full object-cover"
                          loading="lazy"
                          onError={e => {
                            e.currentTarget.style.display = 'none'
                          }}
                        />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        const u = (b.image_url || '').trim()
                        setPreviewShowIframe(
                          !!(u && isHttpUrl(u) && !shouldTryImageFirst(u) && !hostBlocksIframeEmbedding(u))
                        )
                        setBlockPreview({ content: b.content || '', image_url: b.image_url || '', lineIndex: i + 1 })
                      }}
                      className={`inline-flex shrink-0 items-center gap-0.5 rounded-md bg-[#dae2fd] font-semibold text-[#006591] transition-colors hover:bg-[#c9d4fc] ${compact ? 'px-1.5 py-0.5 text-[8px]' : 'px-2 py-1 text-[10px]'
                        }`}
                    >
                      <span className={`material-symbols-outlined ${compact ? 'text-[12px]' : 'text-[14px]'}`}>
                        open_in_new
                      </span>
                      Xem link
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      <ContentLinkDetailModal
        blockPreview={blockPreview}
        previewShowIframe={previewShowIframe}
        setPreviewShowIframe={setPreviewShowIframe}
        subtitle={
          blockPreview ? `${feature.name} · ${task.name} · Dòng ${blockPreview.lineIndex}` : ''
        }
        onClose={() => {
          setBlockPreview(null)
          setPreviewShowIframe(false)
        }}
      />
      <ContentLinkDetailModal
        blockPreview={subBlockPreview}
        previewShowIframe={subPreviewShowIframe}
        setPreviewShowIframe={setSubPreviewShowIframe}
        subtitle={
          subBlockPreview
            ? `${feature.name} · ${task.name} · ${subBlockPreview.subName} · Dòng ${subBlockPreview.lineIndex}`
            : ''
        }
        onClose={() => {
          setSubBlockPreview(null)
          setSubPreviewShowIframe(false)
        }}
      />
      {!statusActionsOutside ? (
        <div className={`flex flex-wrap items-center text-[#3e4850] ${c.meta}`}>
          <span className="inline-flex items-center gap-0.5">
            <span className={`material-symbols-outlined text-[#6e7881] ${c.icon}`}>event</span>
            {formatDeadlineDisplay(task.deadline)}
          </span>
          {task.users?.full_name && (
            <span
              className={`inline-flex items-center gap-0.5 rounded-full bg-[#dae2fd] text-[#006591] font-medium truncate ${compact
                ? 'px-0.5 py-px text-[8px] max-w-[100px]'
                : 'px-1.5 py-0.5 text-[10px] max-w-[120px]'
                }`}
            >
              <span className={`material-symbols-outlined shrink-0 ${compact ? 'text-[9px]' : 'text-[11px]'}`}>person</span>
              {task.users.full_name}
            </span>
          )}
          {onTaskStatusChange ? (
            <span className={`inline-flex flex-col gap-0.5 ${compact ? 'max-w-[min(100%,11rem)]' : ''}`}>
              <span className={`font-bold text-[#3e4850] uppercase tracking-wide ${compact ? 'text-[6px]' : 'text-[9px]'}`}>
                Trạng thái
              </span>
              <select
                aria-label="Trạng thái nhiệm vụ"
                value={task.status || 'pending'}
                disabled={updatingTaskId === task.task_id}
                onChange={e => onTaskStatusChange(task.task_id, e.target.value)}
                className={`w-full max-w-[11rem] rounded-lg border border-[#bec8d2]/50 bg-white font-semibold text-[#131b2e] shadow-sm focus:border-[#006591] focus:outline-none focus:ring-2 focus:ring-[#006591]/20 disabled:opacity-55 disabled:cursor-not-allowed ${compact ? 'py-0.5 pl-1 pr-5 text-[8px]' : 'py-1 pl-1.5 pr-6 text-[10px]'
                  }`}
              >
                {STATUS_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              {task.status_updated_at ? (
                <span
                  className={`text-[#6e7881] ${compact ? 'text-[6px]' : 'text-[9px]'}`}
                  title={`Cập nhật trạng thái: ${formatDateTime(task.status_updated_at)}`}
                >
                  Cập nhật: {formatDateTime(task.status_updated_at)}
                </span>
              ) : null}
            </span>
          ) : null}
        </div>
      ) : null}
      {!statusActionsOutside && subs.length > 0 && (
        <div className={compact ? 'pt-0.5' : 'pt-1'}>
          <button
            type="button"
            onClick={() => setShowSubtasksModal(true)}
            className={`w-full inline-flex items-center justify-center gap-1 font-semibold text-[#006591] bg-[#eae8ff] hover:bg-[#dae2fd] rounded-md border border-[#bec8d2]/25 transition-colors ${compact ? 'py-1 px-2 text-[8px]' : 'py-1.5 px-3 text-[10px]'
              }`}
          >
            <span className={`material-symbols-outlined ${compact ? 'text-[12px]' : 'text-[14px]'}`}>checklist</span>
            Xem tiểu mục
            <span className="opacity-80">({subs.length})</span>
          </button>
        </div>
      )}
      {showSubtasksModal && subs.length > 0 && (
        <Modal
          overlayClassName="fixed inset-0 z-[55] flex items-center justify-center bg-[#131b2e]/50 backdrop-blur-sm p-2 sm:p-3 lg:p-4"
          maxWidthClassName="max-w-[95vw] lg:max-w-[95vw] w-full mx-auto"
          bodyClassName="bg-[#f8fafc] px-3 sm:px-4 lg:px-6 py-3 sm:py-3.5 space-y-3 overflow-y-auto max-h-[min(82vh,640px)]"
          headerChildren={
            <div>
              <p className="mb-1 flex flex-wrap items-center gap-x-1 gap-y-0 text-[11px] leading-snug text-[#64748b]">
                <span>{showFeatureLabel ? String(feature.name).trim() : 'Chung'}</span>
                <span aria-hidden>›</span>
                <span className="font-medium text-[#131b2e]">{task.name}</span>
                <span aria-hidden>›</span>
                <span>Nhóm theo ngày</span>
              </p>
              <div className="flex items-center justify-between pr-4 mt-1">
                <h3 className="text-base font-medium tracking-tight text-[#131b2e]">Tiểu mục</h3>
                <button
                  type="button"
                  disabled={selectedTaskIds.length === 0}
                  onClick={() => setShowPrintModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#006591] bg-[#eef4ff] px-3 py-1.5 text-xs font-bold text-[#006591] hover:bg-[#dae2fd] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Giao việc {selectedTaskIds.length > 0 && `(${selectedTaskIds.length})`}
                </button>
              </div>
            </div>
          }
          onClose={() => setShowSubtasksModal(false)}
          footer={
            <button
              type="button"
              onClick={() => setShowSubtasksModal(false)}
              className="rounded-lg border border-sky-200 bg-sky-50 px-[18px] py-1.5 text-[12px] font-medium text-sky-900 hover:bg-sky-100/90"
            >
              Đóng
            </button>
          }
          footerClassName="justify-end"
        >
          <div className="space-y-3">
            {groupedSubs.map(group => (
              <section key={group.dateKey} className="space-y-2">
                <div className="flex items-center justify-between rounded-md border border-[#f0f0f0] bg-white px-3 py-1.5 shadow-sm">
                  <span className="text-[12px] font-semibold capitalize text-[#131b2e]">{group.label}</span>
                  <span className="rounded-full border border-[#f0f0f0] bg-[#f8fafc] px-2 py-0.5 text-[11px] font-medium text-[#64748b]">
                    {group.items.length} tiểu mục
                  </span>
                </div>

                {/* HEADER BẢNG - Ẩn trên Mobile */}
                <div className="hidden lg:grid grid-cols-[30px_200px_minmax(200px,_1fr)_80px_140px_220px_80px] lg:gap-2 px-0 lg:py-1.5 pb-3 text-[10px] uppercase tracking-wider text-[#64748b] font-semibold border-b border-slate-200 mt-2 w-full">
                  <div className="flex items-center justify-center">
                    <input
                      type="checkbox"
                      className="cursor-pointer w-4 h-4 rounded border-slate-300 text-[#006591] focus:ring-[#006591]"
                      checked={false}
                      onChange={async (e) => {
                        if (e.target.checked && window.confirm('Đánh dấu hoàn thành toàn bộ nhóm tiểu mục này?')) {
                          for (const st of group.items) {
                            if (st.status !== 'completed') {
                              await onSubtaskStatusChange(st.subtask_id, 'completed')
                            }
                          }
                        }
                      }}
                      title="Hoàn thành toàn bộ nhóm"
                    />
                  </div>
                  <div>Tiểu mục & Trạng thái</div>
                  <div>Ghi chú & Hướng dẫn</div>
                  <div className="text-center">Đính kèm</div>
                  <div>Thống kê thời gian</div>
                  <div>Theo dõi tiến độ</div>
                  <div className="text-right">Thao tác</div>
                </div>
                <ul className="space-y-0">
                  {group.items.map(st => {
                    const workSessions = normalizeSubtaskWorkTime(st.work_time)
                    const workRunning = subtaskHasOpenWorkSession(workSessions)
                    const subDisplayBlocks = normalizeTaskContentBlocks(st).filter(
                      b => (b.content && b.content.trim()) || (b.image_url && b.image_url.trim())
                    )
                    const busy =
                      updatingSubtaskWorkTimeId === st.subtask_id || updatingSubtaskId === st.subtask_id
                    const stSel = st.status || 'pending'
                    const selCls = SUBTASK_STATUS_SELECT_STYLES[stSel] || SUBTASK_STATUS_SELECT_STYLES.pending

                    const firstMedia = subDisplayBlocks.find(b => b.image_url?.trim())
                    const mediaUrl = firstMedia ? firstMedia.image_url.trim() : null
                    const isMediaImg = mediaUrl ? (mediaUrl.startsWith('data:image/') || (isHttpUrl(mediaUrl) && shouldTryImageFirst(mediaUrl))) : false

                    const isSelected = selectedTaskIds.includes(st.subtask_id)
                    const isCompleted = stSel === 'completed'

                    {/* CẤU TRÚC: Card (Mobile) | Grid (Desktop) */ }
                    return (
                      <li key={st.subtask_id} className={`flex flex-col lg:grid lg:grid-cols-[30px_200px_minmax(200px,_1fr)_80px_140px_220px_80px] gap-3 lg:gap-2 items-start border-b border-slate-200 py-4 lg:py-2 min-w-0 w-full transition-colors ${isSelected ? 'bg-blue-50/50' : ''}`}>

                        {/* 1. Hàng đầu Mobile: Checkbox + Tên + Badge Trạng thái */}
                        <div className="flex items-start gap-2 w-full lg:contents">
                          {/* Checkbox (Cột 1 Desktop) */}
                          <div className="flex items-center justify-center pt-1 lg:h-full">
                            <input
                              type="checkbox"
                              className="cursor-pointer w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                              checked={isCompleted}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  onSubtaskStatusChange(st.subtask_id, 'completed')
                                }
                              }}
                              title="Đánh dấu hoàn thành"
                            />
                          </div>

                          {/* Thông tin chính (Cột 2 Desktop) */}
                          <div className="flex flex-col lg:gap-1.5 gap-2 min-w-0 flex-1 lg:h-full">
                            <span className={`text-sm lg:text-sm font-bold lg:font-semibold leading-snug break-words ${isCompleted ? 'line-through text-slate-400' : 'text-[#131b2e]'}`}>
                              {st.name}
                            </span>
                            <div className="flex flex-wrap items-center gap-2">
                              {onSubtaskStatusChange ? (
                                <select
                                  aria-label="Trạng thái tiểu mục"
                                  value={stSel}
                                  disabled={busy}
                                  onChange={e => onSubtaskStatusChange(st.subtask_id, e.target.value)}
                                  className={`w-fit lg:w-auto lg:h-7 lg:text-xs max-w-full cursor-pointer rounded-md border py-1 lg:py-0 pl-2 pr-6 text-[11px] font-medium shadow-sm focus:border-[#006591] focus:outline-none focus:ring-1 focus:ring-[#006591]/25 disabled:cursor-not-allowed disabled:opacity-45 ${selCls}`}
                                  style={{ backgroundPosition: 'right 6px center', backgroundSize: '10px' }}
                                >
                                  {SUBTASK_STATUS_PILLS.filter(opt => opt.value !== 'completed').map(opt => (
                                    <option key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <StatusBadge status={st.status} />
                              )}
                              {/* Người gán (Chỉ hiện trên mobile ở đây) */}
                              <div className="lg:hidden text-[11px] text-slate-500 flex items-center gap-1 min-w-0 truncate">
                                <span className="truncate">{st.users?.full_name ? `${userInitials(st.users.full_name)} ${st.users.full_name}` : 'Chưa gán'}</span>
                                <span className="shrink-0">- {formatIsoDateSlashShort(st.created_at)}</span>
                              </div>
                            </div>
                            {/* Người gán (Desktop) */}
                            <div className="hidden lg:flex text-[11px] text-slate-500 mt-auto items-center gap-1 min-w-0 truncate">
                              <span className="truncate">{st.users?.full_name ? `${userInitials(st.users.full_name)} ${st.users.full_name}` : 'Chưa gán'}</span>
                              <span className="shrink-0">- {formatIsoDateSlashShort(st.created_at)}</span>
                            </div>
                          </div>
                        </div>

                        {/* 2. Ghi chú (Cột 3 Desktop) */}
                        <div className="flex flex-col min-w-0 w-full lg:h-full pl-6 lg:pl-0">
                          {subDisplayBlocks.filter(b => b.content?.trim()).length > 0 ? (
                            <div className="bg-slate-50 p-2.5 lg:p-1.5 rounded-md text-[13px] lg:text-[11px] whitespace-pre-wrap break-words w-full text-[#131b2e]">
                              <ul className="list-inside list-disc marker:text-[#006591] lg:space-y-0.5 space-y-1">
                                {subDisplayBlocks.filter(b => b.content?.trim()).map((b, idx) => {
                                  const lines = b.content.trim().split('\n').filter(l => l.trim())
                                  return lines.map((line, lIndex) => {
                                    const cleanLine = line.replace(/^-\s*/, '').replace(/^\d+\.\s*/, '')
                                    return <li key={`${idx}-${lIndex}`} className="break-words max-w-full">{cleanLine}</li>
                                  })
                                })}
                              </ul>
                            </div>
                          ) : (
                            <div className="bg-slate-50 p-2.5 lg:p-1.5 rounded-md text-[13px] lg:text-[11px] whitespace-pre-wrap break-words w-full text-slate-400 italic lg:block hidden">
                              Không có ghi chú
                            </div>
                          )}
                        </div>

                        {/* 3. Ảnh đính kèm (Cột 4 Desktop) */}
                        <div className="flex lg:items-center lg:justify-center pt-1 min-w-0 w-auto pl-6 lg:pl-0 lg:w-full">
                          {isMediaImg ? (
                            <img
                              src={mediaUrl}
                              alt="Minh chứng"
                              onClick={() => setImageLightboxUrl(mediaUrl)}
                              className="w-14 h-14 lg:w-12 lg:h-12 object-cover rounded-lg shadow-sm border border-slate-200 cursor-pointer hover:opacity-80 transition-opacity"
                            />
                          ) : mediaUrl ? (
                            <a href={mediaUrl} target="_blank" rel="noreferrer" title="Mở file đính kèm" className="w-14 h-14 lg:w-12 lg:h-12 flex flex-col items-center justify-center rounded-lg shadow-sm border border-slate-200 bg-white cursor-pointer hover:bg-slate-50 transition-colors">
                              <span className="material-symbols-outlined text-[24px] text-[#006591]">attach_file</span>
                              <span className="lg:hidden text-[9px] font-bold text-slate-400 uppercase mt-0.5">Mở file</span>
                            </a>
                          ) : (
                            <button
                              type="button"
                              onClick={() => m.open('edit_subtask', { id: st.subtask_id, initial: subtaskFormInitial(st) })}
                              className="w-14 h-14 lg:w-12 lg:h-12 bg-slate-50 rounded-lg border border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-300 hover:border-[#006591] hover:text-[#006591] transition-all group"
                              title="Nhấn để đính kèm file"
                            >
                              <span className="material-symbols-outlined text-[20px] group-hover:scale-110 transition-transform">add_photo_alternate</span>
                              <span className="lg:hidden text-[9px] font-bold text-slate-400 uppercase mt-0.5">Đính kèm</span>
                            </button>
                          )}
                        </div>

                        {/* 4. Thống kê & Bộ đếm (Cột 5, 6 Desktop) — Grid 2 cột trên Mobile */}
                        <div className="flex flex-col lg:contents w-full pl-6 lg:pl-0 gap-4">
                          {/* Thống kê (Cột 5 Desktop) */}
                          <div className="grid grid-cols-2 lg:flex lg:flex-col lg:gap-1 gap-3 min-w-0 bg-[#f8fafc] lg:bg-transparent p-3 lg:p-0 rounded-lg border border-slate-100 lg:border-none shadow-sm lg:shadow-none">
                            {/* Khối 1 */}
                            <div>
                              <div className="text-[10px] uppercase text-slate-400 font-semibold mb-0.5 tracking-wide">Giao: <span className="tabular-nums text-[#131b2e] text-[12px] lg:text-[11px] font-medium">{formatIsoTimeClock(st.created_at)}</span></div>
                              <div className="text-[10px] text-slate-400 font-normal leading-tight">
                                ({formatIsoDateSlashShort(st.created_at)})
                              </div>
                            </div>
                            {/* Khối 2 */}
                            <div>
                              <div className="text-[10px] uppercase text-slate-400 font-semibold mb-0.5 tracking-wide">
                                Xong: <span className="tabular-nums text-[#131b2e] text-[12px] lg:text-[11px] font-medium">{st.completed_at ? formatIsoTimeClock(st.completed_at) : '—'}</span>
                              </div>
                              <div className="text-[10px] text-slate-400 font-normal leading-tight">
                                {st.completed_at ? `(${formatIsoDateSlashShort(st.completed_at)})` : '—'}
                              </div>
                            </div>
                            {/* Khối 3 (Desktop Only) */}
                            {st.completed_at && (
                              <div className="hidden lg:block">
                                <div className="text-[10px] uppercase text-slate-400 font-semibold mb-0.5 tracking-wide">
                                  Giao {'->'} Xong: <span className="font-medium text-emerald-700 text-[12px] lg:text-[11px]">{formatGiaoDenHoanThanhCell(st)}</span>
                                </div>
                              </div>
                            )}
                            {/* Khối 4 Mobile Full row */}
                            <div className="col-span-2 lg:col-span-1 border-t border-slate-100 pt-2 lg:border-none lg:pt-0">
                              <div className="text-[10px] lg:text-[9px] uppercase text-slate-400 font-semibold mb-0.5 tracking-wide flex items-baseline gap-1">
                                Tổng phiên: <div className="text-[12px] lg:text-[11px] font-medium text-[#131b2e]"><SubtaskLiveSessionTotal workTimeRaw={st.work_time} /></div>
                              </div>
                            </div>
                          </div>

                          {/* Bộ đếm (Timer) (Cột 6 Desktop) */}
                          <div className="flex flex-col gap-1 min-w-0 justify-start w-full bg-[#f0f9ff]/40 lg:bg-transparent p-3 lg:p-0 rounded-lg border border-sky-100 lg:border-none">
                            {onSubtaskWorkTimeSave ? (
                              <SubtaskModalWorkClock workTimeRaw={st.work_time} actions={
                                <>
                                  {!workRunning ? (
                                    <button
                                      type="button"
                                      disabled={busy}
                                      onClick={async () => {
                                        const cur = normalizeSubtaskWorkTime(st.work_time)
                                        if (subtaskHasOpenWorkSession(cur)) return
                                        await onSubtaskWorkTimeSave(st.subtask_id, subtaskWorkTimeAfterStart(cur))
                                      }}
                                      className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-[#e2e8f0] bg-white px-3 py-2 lg:px-2 lg:py-1 text-xs lg:text-[11px] font-bold text-[#131b2e] hover:bg-[#f8fafc] disabled:opacity-45 shadow-sm transition-colors"
                                    >
                                      <span className="material-symbols-outlined text-[16px] lg:text-[14px]">play_arrow</span>
                                      Bắt đầu
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      disabled={busy || !workRunning}
                                      onClick={async () => {
                                        const cur = normalizeSubtaskWorkTime(st.work_time)
                                        if (!subtaskHasOpenWorkSession(cur)) return
                                        await onSubtaskWorkTimeSave(st.subtask_id, subtaskWorkTimeAfterPause(cur))
                                      }}
                                      className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 lg:px-2 lg:py-1 text-xs lg:text-[11px] font-bold text-amber-900 hover:bg-amber-100 disabled:opacity-45 shadow-sm transition-colors"
                                    >
                                      <span className="material-symbols-outlined text-[16px] lg:text-[14px]">pause</span>
                                      Tạm dừng
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    disabled={busy || (!st.work_time && !workRunning)}
                                    onClick={async () => {
                                      if (confirm('Bạn có chắc muốn đặt lại toàn bộ thời gian làm việc của tiểu mục này?')) {
                                        await onSubtaskWorkTimeSave(st.subtask_id, null)
                                      }
                                    }}
                                    className="inline-flex items-center justify-center gap-1 rounded-md border border-[#bec8d2]/40 bg-white px-3 py-2 lg:px-2 lg:py-1 text-xs lg:text-[11px] font-bold text-[#64748b] hover:bg-[#f8fafc] disabled:opacity-45 shadow-sm transition-colors"
                                    title="Đặt lại phiên làm việc"
                                  >
                                    <span className="material-symbols-outlined text-[16px] lg:text-[14px]">replay</span>
                                    <span className="lg:hidden ml-1">Đặt lại</span>
                                  </button>
                                </>
                              } />
                            ) : (
                              <div className="text-[11px] text-slate-400 italic">Time tracking vô hiệu</div>
                            )}
                          </div>
                        </div>

                        {/* 5. Thao tác (Cột 7 Desktop) */}
                        <div className="grid grid-cols-2 lg:flex lg:flex-col lg:items-end lg:justify-end lg:self-stretch gap-2 lg:gap-1.5 w-full pt-2 lg:pt-0 border-t border-slate-100 lg:border-none pl-6 lg:pl-0">
                          {canModify && (
                            <>
                              <div className="flex items-center gap-1 col-span-1 lg:col-span-auto">
                                <button
                                  type="button"
                                  onClick={() => m.open('edit_subtask', { id: st.subtask_id, initial: subtaskFormInitial(st) })}
                                  className="p-2.5 lg:p-1.5 rounded-md lg:rounded-lg border border-[#bec8d2]/40 bg-white text-[#131b2e] hover:bg-[#f2f3ff] transition-colors flex items-center justify-center gap-1 shadow-sm"
                                  title="Sửa tiểu mục"
                                >
                                  <span className="material-symbols-outlined text-[18px] lg:text-[16px]">edit</span>
                                  <span className="lg:hidden text-xs font-bold uppercase tracking-tight">Sửa</span>
                                </button>
                                {onDeleteSubtask ? (
                                  <button
                                    type="button"
                                    onClick={() => onDeleteSubtask(st.subtask_id)}
                                    className="p-2.5 lg:px-2 lg:py-1 rounded-md lg:rounded-lg border border-[#fecaca] bg-[#fff5f5] text-[#b91c1c] hover:bg-[#ffe4e4] transition-colors flex items-center justify-center gap-1 shadow-sm"
                                    title="Xóa tiểu mục"
                                  >
                                    <span className="material-symbols-outlined text-[18px] lg:text-[16px]">delete</span>
                                    <span className="lg:hidden text-xs font-bold uppercase tracking-tight">Xóa</span>
                                  </button>
                                ) : (
                                  <div className="lg:hidden" />
                                )}
                              </div>

                              {/* Nút Xong (Quick Action) - Đặt xuống dưới và căn lề với nút Bắt đầu */}
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => onSubtaskStatusChange(st.subtask_id, 'completed')}
                                className="hidden lg:flex h-7 items-center gap-0.5 rounded border border-emerald-200 bg-emerald-50 px-2 text-[9px] font-bold text-emerald-700 hover:bg-emerald-100 shadow-sm transition-all"
                                title="Đánh dấu hoàn thành"
                              >
                                <span className="material-symbols-outlined text-[12px]">check_circle</span>
                                Hoàn thành
                              </button>
                            </>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}
          </div>
        </Modal>
      )}
    </>
  )

  const taskCardWrapClass = statusActionsOutside
    ? 'rounded-xl border border-[#e5e8ef] bg-white p-3 shadow-sm transition-all duration-200 hover:border-[#cfd6e6] hover:shadow-md'
    : c.wrap

  return (
    <>
      <div className={taskCardWrapClass}>{cardInterior}</div>
      {imageLightboxUrl ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Xem ảnh phóng to"
          className="fixed inset-0 z-[70] flex items-center justify-center bg-[#131b2e]/88 backdrop-blur-sm p-4"
          onClick={() => setImageLightboxUrl(null)}
        >
          <button
            type="button"
            className="absolute top-3 right-3 sm:top-4 sm:right-4 rounded-full bg-white/95 text-[#131b2e] p-2 shadow-lg hover:bg-white z-10"
            aria-label="Đóng"
            onClick={e => {
              e.stopPropagation()
              setImageLightboxUrl(null)
            }}
          >
            <span className="material-symbols-outlined text-[22px] leading-none block">close</span>
          </button>
          <img
            src={imageLightboxUrl}
            alt=""
            className="max-w-full max-h-[min(92vh,920px)] w-auto h-auto object-contain rounded-lg shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
        </div>
      ) : null}

      {/* MODAL IN ẤN / XEM TRƯỚC ĐỂ CHỤP ẢNH */}
      {showPrintModal && (
        <div className="fixed inset-0 z-[120] bg-slate-100/60 overflow-y-auto backdrop-blur-sm">
          {/* NÚT ĐÓNG BÁM DÍNH TRÊN CÙNG MÀN HÌNH */}
          <button
            onClick={() => setShowPrintModal(false)}
            className="fixed top-6 right-8 z-[130] bg-white/95 hover:bg-slate-100 border border-slate-200 text-slate-500 hover:text-slate-900 rounded-full w-12 h-12 flex items-center justify-center shadow-lg backdrop-blur-sm transition-all"
            title="Đóng chế độ xem trước"
          >
            <span className="material-symbols-outlined text-[26px]">close</span>
          </button>

          {/* CONTENT CHÍNH */}
          <div className="max-w-[1300px] mx-auto py-12 px-6">
            <div className="bg-white rounded-[24px] shadow-2xl border border-slate-200 overflow-hidden">

              {/* HEADER THEO PHONG CÁCH GIẤY A4 */}
              <div className="w-full px-10 pt-10 pb-6 border-b border-slate-100 bg-white">
                <h1 className="text-[24px] font-bold text-slate-800 tracking-tight">DANH SÁCH CÔNG VIỆC CẦN XỬ LÝ</h1>
                <p className="text-sm text-slate-500 mt-2">Dự án: {feature.name || 'Chung'} • Khối lượng: {selectedTaskIds.length} việc</p>
              </div>

              {/* LIST TASK CARDS */}
              <div className="p-10 space-y-6 bg-[#f8fbff]">
                {subs.filter(st => selectedTaskIds.includes(st.subtask_id)).map((st) => {
                  const isCompleted = st.status === 'completed'
                  const subDisplayBlocks = normalizeTaskContentBlocks(st).filter(
                    b => (b.content && b.content.trim()) || (b.image_url && b.image_url.trim())
                  )
                  const firstMedia = subDisplayBlocks.find(b => b.image_url?.trim())
                  const mediaUrl = firstMedia ? firstMedia.image_url.trim() : null
                  const isMediaImg = mediaUrl ? (mediaUrl.startsWith('data:image/') || (isHttpUrl(mediaUrl) && shouldTryImageFirst(mediaUrl))) : false

                  return (
                    <div key={st.subtask_id} className="bg-white rounded-[20px] shadow-[0_2px_12px_rgba(0,0,0,0.03)] border border-slate-100 p-7 flex flex-col lg:flex-row gap-8 items-stretch">

                      {/* CỘT 1: TIÊU ĐỀ & TRẠNG THÁI */}
                      <div className="w-full lg:w-[35%] shrink-0 flex items-start gap-4">
                        {/* Icon Vòng tròn Check */}
                        <div className="mt-1 shrink-0">
                          {isCompleted ? (
                            <div className="w-[22px] h-[22px] rounded-full bg-[#1b64ff] flex items-center justify-center shadow-sm">
                              <span className="material-symbols-outlined text-white text-[14px] font-bold">check</span>
                            </div>
                          ) : (
                            <div className="w-[22px] h-[22px] rounded-full border-2 border-[#1b64ff] flex items-center justify-center bg-white shadow-sm"></div>
                          )}
                        </div>

                        {/* Title & Tags */}
                        <div className="flex flex-col gap-2 min-w-0 h-full">
                          <h2 className={`text-[16px] font-bold leading-snug tracking-tight break-words ${isCompleted ? 'line-through text-slate-400' : 'text-[#3e4850]'}`}>
                            {st.name}
                          </h2>

                          <div className="flex flex-wrap gap-2 mt-auto pt-3">
                            <span className="px-2.5 py-1 bg-[#f1f5f9] text-slate-600 rounded text-[9px] uppercase font-bold tracking-wider opacity-90">
                              {feature.name && feature.name !== 'Chung' ? feature.name : 'DATABASE'}
                            </span>
                            {st.deadline && (
                              <span className="px-2.5 py-1 bg-[#eff6ff] text-[#1b64ff] rounded text-[9px] uppercase font-bold tracking-wider">
                                PRIORITY HIGH
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* CỘT 2: GHI CHÚ & HƯỚNG DẪN */}
                      <div className="w-full lg:w-[35%] flex-1">
                        <div className={`h-full lg:border-l lg:border-slate-100 lg:pl-8 flex flex-col justify-center ${isCompleted ? 'opacity-60' : ''}`}>
                          <ul className={`list-outside ml-4 space-y-3 text-[13.5px] leading-relaxed text-[#3e4850] marker:text-[#6e7881] ${isCompleted ? 'line-through text-slate-400' : ''}`} style={{ listStyleType: 'disc' }}>
                            {subDisplayBlocks.filter(b => b.content?.trim()).map((b, bIdx) => {
                              const lines = b.content.trim().split('\n').filter(l => l.trim())
                              return lines.map((line, lIndex) => {
                                const cleanLine = line.replace(/^-\s*/, '').replace(/^\d+\.\s*/, '')
                                return <li key={`${bIdx}-${lIndex}`}>{cleanLine}</li>
                              })
                            })}
                          </ul>
                          {subDisplayBlocks.filter(b => b.content?.trim()).length === 0 && (
                            <p className="italic text-slate-400 text-[13px]">Chưa có ghi chú hướng dẫn.</p>
                          )}
                        </div>
                      </div>

                      {/* CỘT 3: HÌNH ẢNH MINH HỌA */}
                      <div className="w-full lg:w-[240px] shrink-0 flex flex-col justify-center items-center">
                        {isMediaImg && mediaUrl ? (
                          <>
                            <div className="w-full rounded-[12px] overflow-hidden shadow-sm border border-slate-200 bg-slate-50 aspect-[4/3] flex items-center justify-center">
                              <img src={mediaUrl} alt="Preview" className="w-full h-full object-cover" />
                            </div>
                            <div className="mt-2.5 text-[10px] text-slate-400 italic text-center w-full truncate px-2">
                              {userInitials(st.users?.full_name)} {st.users?.full_name ? st.users.full_name.split(' ').slice(-2).join(' ') : 'Chưa gán'} — Preview
                            </div>
                          </>
                        ) : (
                          <div className="w-full rounded-[12px] bg-slate-50 border border-slate-100 aspect-[4/3] flex flex-col items-center justify-center gap-2 text-slate-300">
                            <span className="material-symbols-outlined text-[32px]">image</span>
                            <span className="text-[9px] uppercase font-bold tracking-wider">No preview available</span>
                          </div>
                        )}
                      </div>

                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/** Modal phân công nhiều người: checkbox trong panel sổ xuống / thu gọn */
function AssignTeamModal({ allUsers, selectedIds, onToggle, onSave, onClose, saving }) {
  const [listOpen, setListOpen] = useState(false)
  const selectedSet = new Set(selectedIds || [])
  const count = selectedIds?.length ?? 0

  return (
    <Modal
      overlayClassName="fixed inset-0 z-[100] flex items-center justify-center bg-[#131b2e]/50 backdrop-blur-sm p-3 sm:p-4"
      maxWidthClassName="max-w-[95vw] lg:max-w-md w-full"
      bodyClassName="px-4 sm:px-6 py-4 space-y-3 overflow-y-auto max-h-[min(80vh,560px)]"
      title="Phân công nhân sự"
      subtitle="Chọn thành viên tham gia dự án (có thể chọn nhiều người)"
      onClose={onClose}
      footer={
        <div className="flex flex-wrap justify-end gap-2 w-full">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-sm font-medium text-[#006591] hover:bg-[#f2f3ff] transition-colors"
          >
            Hủy
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={onSave}
            className="px-6 py-2.5 rounded-xl text-sm font-medium text-white primary-gradient shadow-md hover:brightness-110 transition-all disabled:opacity-60"
          >
            {saving ? 'Đang lưu...' : 'Lưu phân công'}
          </button>
        </div>
      }
    >
      <button
        type="button"
        onClick={() => setListOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border border-[#bec8d2]/35 bg-[#faf8ff] text-left text-sm font-semibold text-[#131b2e] hover:bg-[#f0f2fa] transition-colors"
      >
        <span className="inline-flex items-center gap-2 min-w-0">
          <span className="material-symbols-outlined text-[#006591] shrink-0">checklist</span>
          <span className="truncate">
            Danh sách nhân sự
            <span className="font-normal text-[#3e4850]"> · {count} người đã chọn</span>
          </span>
        </span>
        <span className="material-symbols-outlined text-[#6e7881] shrink-0">{listOpen ? 'expand_less' : 'expand_more'}</span>
      </button>
      {listOpen && (
        <div className="max-h-56 overflow-y-auto rounded-xl border border-[#bec8d2]/20 bg-white shadow-sm">
          {allUsers.length === 0 ? (
            <p className="px-3 py-6 text-sm text-[#6e7881] text-center">Chưa có nhân sự (cần quyền quản trị để tải danh sách).</p>
          ) : (
            <ul className="divide-y divide-[#bec8d2]/10">
              {allUsers.map(u => (
                <li key={u.user_id}>
                  <label className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-[#faf8ff]">
                    <input
                      type="checkbox"
                      className="rounded border-[#bec8d2] text-[#006591] w-4 h-4 focus:ring-[#006591]"
                      checked={selectedSet.has(u.user_id)}
                      onChange={() => onToggle(u.user_id)}
                    />
                    <span className="text-sm text-[#131b2e] flex-1 truncate">{u.full_name}</span>
                    <span className="text-[10px] uppercase font-bold text-[#6e7881] shrink-0">{u.role}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Modal>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ProjectsPage() {
  const [customers, setCustomers] = useState([])
  const [projectsModalCustomerId, setProjectsModalCustomerId] = useState(null)
  const [projectTasksViewId, setProjectTasksViewId] = useState(null)
  const [modalProjectPage, setModalProjectPage] = useState(1)
  const PAGE_SIZE_MODAL = 3

  useEffect(() => {
    setModalProjectPage(1)
  }, [projectsModalCustomerId])

  const projectsModalCustomer = useMemo(() => {
    if (!projectsModalCustomerId) return null
    return customers.find(c => c.customer_id === projectsModalCustomerId) || null
  }, [projectsModalCustomerId, customers])

  const totalPagesModal = projectsModalCustomer
    ? Math.ceil(projectsModalCustomer.projects.length / PAGE_SIZE_MODAL)
    : 0
  const paginatedModalProjects = projectsModalCustomer
    ? projectsModalCustomer.projects.slice((modalProjectPage - 1) * PAGE_SIZE_MODAL, modalProjectPage * PAGE_SIZE_MODAL)
    : []

  const [userRole, setUserRole] = useState('employee')
  const [allUsers, setAllUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [memberRowOpen, setMemberRowOpen] = useState({})
  const [savingAssign, setSavingAssign] = useState(false)
  const [savingProject, setSavingProject] = useState(false)
  const [savingSubtask, setSavingSubtask] = useState(false)
  const [savingTask, setSavingTask] = useState(false)
  const [savingFeature, setSavingFeature] = useState(false)
  const [toast, setToast] = useState(null)
  const [updatingTaskId, setUpdatingTaskId] = useState(null)
  const [updatingSubtaskId, setUpdatingSubtaskId] = useState(null)
  const [updatingSubtaskWorkTimeId, setUpdatingSubtaskWorkTimeId] = useState(null)
  /** Lọc nhanh dự án trên trang /projects */
  const [projectSearch, setProjectSearch] = useState('')
  /** Tất cả | Đang làm (active) | Sắp hạn (due) — theo mock dashboard */
  const [projectListFilter, setProjectListFilter] = useState('all')
  /** customer_id → true = đang thu gọn danh sách dự án */
  const [collapsedCustomerIds, setCollapsedCustomerIds] = useState({})
  const [openProjectMenuId, setOpenProjectMenuId] = useState(null)
  const m = useModal()

  // -- PHÂN TRANG MOBILE --
  const PAGE_SIZE_MAIN = 3
  const [currentPageMain, setCurrentPageMain] = useState(1)
  const [isMobileScreen, setIsMobileScreen] = useState(window.innerWidth < 1024)

  useEffect(() => {
    const handleResize = () => setIsMobileScreen(window.innerWidth < 1024)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    setCurrentPageMain(1)
  }, [projectSearch, projectListFilter])


  const projectInTasksView = projectTasksViewId && projectsModalCustomer
    ? projectsModalCustomer.projects?.find(p => p.project_id === projectTasksViewId)
    : null

  useEffect(() => {
    if (!projectsModalCustomerId) return
    if (!customers.some(c => c.customer_id === projectsModalCustomerId)) {
      setProjectsModalCustomerId(null)
      setProjectTasksViewId(null)
    }
  }, [customers, projectsModalCustomerId])

  useEffect(() => {
    setProjectTasksViewId(null)
  }, [projectsModalCustomerId])

  useEffect(() => {
    if (!projectsModalCustomer || !projectTasksViewId) return
    const exists = projectsModalCustomer.projects?.some(p => p.project_id === projectTasksViewId)
    if (!exists) setProjectTasksViewId(null)
  }, [projectsModalCustomer, projectTasksViewId])

  useEffect(() => {
    init()
  }, [])

  useEffect(() => {
    const onDoc = e => {
      if (!e.target.closest?.('[data-project-dd]')) setOpenProjectMenuId(null)
    }
    document.addEventListener('click', onDoc)
    return () => document.removeEventListener('click', onDoc)
  }, [])

  async function init() {
    setLoading(true)
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (authUser) {
      const { data: profile } = await supabase.from('users').select('role').eq('user_id', authUser.id).single()
      setUserRole(profile?.role || 'employee')

      if (profile?.role !== 'employee') {
        const { data: usersData } = await supabase.from('users').select('user_id, full_name, role')
        setAllUsers(usersData || [])
      }
    }
    await fetchData()
  }

  async function fetchData(silent = false) {
    if (!silent) setLoading(true)
    const { data, error } = await supabase
      .from('customers')
      .select(`
        *,
        projects (*, 
          project_assignments(*, users(full_name)), 
          features (*, 
            tasks (*, users:assigned_to(full_name), 
              subtasks (*, users:assigned_to(full_name))
            )
          )
        )
      `)

    if (error) console.error('Error fetching data:', error)
    else setCustomers(data || [])
    if (!silent) setLoading(false)
  }

  function formatSaveError(err) {
    if (!err) return 'Không thể lưu dữ liệu'
    const msg = err.message || String(err)
    const detail = err.details || err.hint
    return detail ? `${msg} (${detail})` : msg
  }

  async function handleSave() {
    const modal = m.modal
    if (!modal?.type) {
      setToast({ message: 'Không có form đang mở — hãy thử lại.', type: 'error' })
      return
    }
    const { type, customerId, projectId, featureId, id } = modal
    /** task_id liên kết khi thêm tiểu mục — lấy cả từ form (sau merge initial) */
    const taskId =
      modal.taskId ?? modal.task_id ?? m.form?.taskId ?? m.form?.task_id
    const data = { ...m.form }

    try {
      // Clean data: removing empty strings to avoid 400 errors on numeric columns
      const cleanData = { ...data }
      // Remove modal management noise to avoid column-not-found errors in Supabase
      delete cleanData.id
      delete cleanData.type
      delete cleanData.projectId
      delete cleanData.customerId
      delete cleanData.featureId
      delete cleanData.taskId
      delete cleanData.task_id

      // Remove nested relationship objects from fetch results
      delete cleanData.subtasks
      delete cleanData.tasks
      delete cleanData.features
      delete cleanData.projects
      delete cleanData.users
      delete cleanData.project_assignments
      delete cleanData.customers
      delete cleanData.user_ids
      delete cleanData.featureOptions

      Object.keys(cleanData).forEach(key => {
        if (cleanData[key] === '') delete cleanData[key]
      })

      if (Object.prototype.hasOwnProperty.call(cleanData, 'deadline')) {
        cleanData.deadline = normalizeDeadlineForSave(cleanData.deadline)
      }

      let res = { error: null }

      if (type === 'add_customer') {
        const { data: userData } = await supabase.auth.getUser()
        res = await supabase.from('customers').insert({ ...cleanData, user_id: userData.user.id })
      } else if (type === 'edit_customer') {
        res = await supabase.from('customers').update(cleanData).eq('customer_id', id)
      } else if (type === 'add_project') {
        if (!cleanData.customer_id) throw new Error('Vui lòng chọn khách hàng')
        if (!cleanData.name) throw new Error('Vui lòng nhập tên dự án')

        setSavingProject(true)
        try {
          // Thêm .select() để lấy dữ liệu vừa tạo về (nếu cần dùng trực tiếp, dù đã có fetchData)
          res = await supabase.from('projects').insert(cleanData).select()

          if (res?.error) throw res.error

          // ✅ Cập nhật dữ liệu ngầm cho toàn bộ trang
          await fetchData(true)

          // ✅ Reset form: Clear các field nhập liệu, Keep phân loại (Khách hàng & Trạng thái)
          m.set('name', '')
          m.set('description', '')
          m.set('pricing', '')
          m.set('deadline', '')

          // ✅ Thông báo thành công
          setToast({
            message: `Đã tạo dự án thành công!`,
            type: 'success'
          })
        } finally {
          setSavingProject(false)
        }
        m.close()
        return // Dừng lại ở đây (Save & Stay) — Không chạy xuống m.close() bên dưới.
      } else if (type === 'edit_project') {
        setSavingProject(true)
        try {
          res = await supabase.from('projects').update(cleanData).eq('project_id', id)
          if (res?.error) throw res.error
          await fetchData(true)
          setToast({ message: 'Đã cập nhật dự án thành công!', type: 'success' })
        } finally {
          setSavingProject(false)
        }
        m.close()
        return // Save & Stay
      } else if (type === 'add_feature') {
        res = await supabase.from('features').insert({ ...cleanData, project_id: projectId })
      } else if (type === 'edit_feature') {
        setSavingFeature(true)
        try {
          res = await supabase.from('features').update(cleanData).eq('feature_id', id)
          if (res?.error) throw res.error
          await fetchData(true)
          setToast({ message: 'Đã cập nhật tính năng thành công!', type: 'success' })
        } finally {
          setSavingFeature(false)
        }
        m.close()
        return // Save & Stay
      } else if (type === 'add_task') {
        let fid = cleanData.feature_id ?? featureId
        delete cleanData.feature_id
        if (!fid) throw new Error('Vui lòng chọn tính năng')

        setSavingTask(true)
        try {
          const sanitized = sanitizeTaskContentForSave(cleanData.content_blocks)
          Object.assign(cleanData, sanitized)
          res = await supabase.from('tasks').insert({ ...cleanData, feature_id: fid })
          if (res?.error) throw res.error

          // ✅ Cập nhật dữ liệu ngầm cho trang
          await fetchData(true)

          // ✅ Reset form theo yêu cầu: Xóa Tên Task, Nội dung & Ảnh. Giữ Người phụ trách.
          m.set('name', '')
          m.set('content_blocks', [{ content: '', image_url: '' }])

          setToast({ message: 'Đã thêm nhiệm vụ thành công!', type: 'success' })
        } finally {
          setSavingTask(false)
        }
        m.close()
        return // Dừng lại ở đây (Save & Stay)
      } else if (type === 'edit_task') {
        setSavingTask(true)
        try {
          const sanitized = sanitizeTaskContentForSave(cleanData.content_blocks)
          Object.assign(cleanData, sanitized)
          if (cleanData.status !== 'completed') {
            cleanData.completed_at = null
          } else if (!cleanData.completed_at) {
            cleanData.completed_at = new Date().toISOString()
          }
          res = await supabase.from('tasks').update(cleanData).eq('task_id', id)
          if (res?.error) throw res.error
          await fetchData(true)
          setToast({ message: 'Đã cập nhật nhiệm vụ thành công!', type: 'success' })
        } finally {
          setSavingTask(false)
        }
        m.close()
        return // Save & Stay
      } else if (type === 'add_subtask') {
        if (!taskId) throw new Error('Thiếu liên kết nhiệm vụ — hãy đóng và mở lại form thêm tiểu mục.')
        if (!String(cleanData.name ?? '').trim()) throw new Error('Vui lòng nhập tên tiểu mục')

        setSavingSubtask(true)
        try {
          const sanitized = sanitizeTaskContentForSave(cleanData.content_blocks)
          const row = {
            task_id: taskId,
            name: String(cleanData.name).trim(),
            ...sanitized,
            status: cleanData.status || 'pending',
            work_time: [],
          }
          if (cleanData.deadline != null && cleanData.deadline !== '') row.deadline = cleanData.deadline
          if (cleanData.assigned_to) row.assigned_to = cleanData.assigned_to

          res = await supabase.from('subtasks').insert(row)
          if (res?.error) throw res.error

          // ✅ Cập nhật dữ liệu ngầm cho trang
          await fetchData(true)

          // ✅ Reset form theo yêu cầu: Xóa Tên, Nội dung & Ảnh. Giữ Người phụ trách.
          m.set('name', '')
          m.set('content_blocks', [{ content: '', image_url: '' }])

          setToast({ message: 'Đã thêm tiểu mục thành công!', type: 'success' })
        } finally {
          setSavingSubtask(false)
        }
        m.close()
        return // Dừng lại ở đây (Save & Stay)
      } else if (type === 'edit_subtask') {
        if (!id) throw new Error('Thiếu mã tiểu mục')
        if (!String(cleanData.name ?? '').trim()) throw new Error('Vui lòng nhập tên tiểu mục')

        setSavingSubtask(true)
        try {
          const sanitized = sanitizeTaskContentForSave(cleanData.content_blocks)
          const patch = {
            name: String(cleanData.name).trim(),
            ...sanitized,
            status: cleanData.status || 'pending',
          }
          if (cleanData.deadline != null && cleanData.deadline !== '') patch.deadline = cleanData.deadline
          else patch.deadline = null
          if (cleanData.assigned_to) patch.assigned_to = cleanData.assigned_to
          if (patch.status !== 'completed') {
            patch.completed_at = null
          } else {
            patch.completed_at = cleanData.completed_at || new Date().toISOString()
          }
          res = await supabase.from('subtasks').update(patch).eq('subtask_id', id)
          if (res?.error) throw res.error
          await fetchData(true)
          setToast({ message: 'Đã cập nhật tiểu mục thành công!', type: 'success' })
        } finally {
          setSavingSubtask(false)
        }
        m.close()
        return // Save & Stay
      } else {
        throw new Error(`Loại form không được hỗ trợ: ${String(type)}`)
      }

      if (res?.error) throw res.error

      m.close()
      fetchData()
    } catch (err) {
      console.error('Error saving:', err)
      setSavingProject(false)
      setToast({ message: formatSaveError(err), type: 'error' })
    }
  }

  async function deleteEntity(table, column, id) {
    if (!window.confirm('Bạn có chắc chắn muốn xóa?')) return
    const { error } = await supabase.from(table).delete().eq(column, id)
    if (error) setToast({ message: error.message, type: 'error' })
    else {
      fetchData(true)
      setToast({ message: 'Đã xóa dữ liệu thành công', type: 'success' })
    }
  }

  async function deleteSubtask(subtaskId) {
    if (!window.confirm('Xóa tiểu mục này?')) return
    const { error } = await supabase.from('subtasks').delete().eq('subtask_id', subtaskId)
    if (error) {
      setToast({ message: error.message, type: 'error' })
      return
    }
    setCustomers(prev => removeSubtaskFromCustomersState(prev, subtaskId))
    setToast({ message: 'Đã xóa tiểu mục', type: 'success' })
  }

  async function updateTaskStatus(taskId, status) {
    if (!TASK_STATUS_SET.has(status)) return
    setUpdatingTaskId(taskId)
    const now = new Date().toISOString()
    const patch = {
      status,
      status_updated_at: now,
      completed_at: status === 'completed' ? now : null,
    }
    const { error } = await supabase.from('tasks').update(patch).eq('task_id', taskId)
    if (error) {
      setUpdatingTaskId(null)
      setToast({ message: error.message || 'Không thể cập nhật trạng thái', type: 'error' })
      return
    }
    const { error: histErr } = await supabase.from('task_status_history').insert({
      task_id: taskId,
      status,
      recorded_at: now,
    })
    setUpdatingTaskId(null)
    setCustomers(prev =>
      patchTaskInCustomersState(prev, taskId, {
        status,
        status_updated_at: now,
        completed_at: status === 'completed' ? now : null,
      })
    )
    if (histErr) {
      setToast({
        message: histErr.message || 'Đã lưu trạng thái nhưng không ghi được lịch sử',
        type: 'error',
      })
      return
    }
    setToast({ message: 'Đã cập nhật trạng thái', type: 'success' })
  }

  async function updateSubtaskStatus(subtaskId, status) {
    const allowed = new Set(['pending', 'in_progress', 'completed', 'overdue'])
    if (!allowed.has(status)) return
    setUpdatingSubtaskId(subtaskId)
    const patch = { status }
    if (status === 'completed') {
      patch.completed_at = new Date().toISOString()
    } else {
      patch.completed_at = null
    }
    const { error } = await supabase.from('subtasks').update(patch).eq('subtask_id', subtaskId)
    setUpdatingSubtaskId(null)
    if (error) {
      setToast({ message: error.message || 'Không thể cập nhật trạng thái tiểu mục', type: 'error' })
      return
    }
    setCustomers(prev => patchSubtaskInCustomersState(prev, subtaskId, patch))

    // --- Auto-trigger: tìm task cha từ snapshot TRƯỚC khi setCustomers render ---
    // (customersRef.current = snapshot PRE-update, dùng để simulate kết quả SAU update)
    let parentTask = null
    let parentTaskId = null
    const snapshot = customersRef.current
    outer: for (const c of snapshot) {
      for (const p of c.projects || []) {
        for (const f of p.features || []) {
          for (const t of f.tasks || []) {
            if ((t.subtasks || []).some(s => s.subtask_id === subtaskId)) {
              parentTask = t
              parentTaskId = t.task_id
              break outer
            }
          }
        }
      }
    }

    if (parentTask && parentTaskId) {
      const allSubs = parentTask.subtasks || []
      const total = allSubs.length
      if (total > 0) {
        // Simulate trạng thái SAU khi subtask này được cập nhật
        const simulated = allSubs.map(s =>
          s.subtask_id === subtaskId ? { ...s, ...patch } : s
        )
        const done = simulated.filter(s => s.status === 'completed').length
        const pct = Math.round((done / total) * 100)

        if (pct === 100 && parentTask.status !== 'completed') {
          // 🎉 Đạt 100%: fade-out 500ms rồi chuyển cột sang Hoàn thành
          setFadingTaskIds(prev => new Set([...prev, parentTaskId]))
          setTimeout(async () => {
            await updateTaskStatus(parentTaskId, 'completed')
            setFadingTaskIds(prev => { const n = new Set(prev); n.delete(parentTaskId); return n })
          }, 500)
          setToast({ message: '✅ Toàn bộ tiểu mục xong! Task chuyển → Hoàn thành', type: 'success' })
          return
        } else if (pct < 100 && parentTask.status === 'completed') {
          // Bỏ tích → quay lại Đang làm
          await updateTaskStatus(parentTaskId, 'in_progress')
          setToast({ message: 'Tiến độ chưa đủ 100% — Task quay về Đang làm', type: 'success' })
          return
        }
      }
    }

    setToast({ message: 'Đã cập nhật trạng thái tiểu mục', type: 'success' })
  }

  async function saveSubtaskWorkTime(subtaskId, workTime) {
    setUpdatingSubtaskWorkTimeId(subtaskId)
    try {
      const { error } = await supabase.from('subtasks').update({ work_time: workTime }).eq('subtask_id', subtaskId)
      if (error) throw error
      setToast({ message: 'Đã ghi nhận thời gian làm việc', type: 'success' })
      setCustomers(prev => patchSubtaskInCustomersState(prev, subtaskId, { work_time: workTime }))
    } catch (err) {
      console.error(err)
      setToast({ message: err.message || 'Không lưu được thời gian làm việc', type: 'error' })
    } finally {
      setUpdatingSubtaskWorkTimeId(null)
    }
  }

  async function removeAssignment(projectId, userId) {
    if (!window.confirm('Xóa nhân viên khỏi dự án này?')) return
    const { error } = await supabase.from('project_assignments').delete().match({ project_id: projectId, user_id: userId })
    if (error) setToast({ message: error.message, type: 'error' })
    else {
      fetchData(true)
      setToast({ message: 'Đã gỡ nhân sự khỏi dự án', type: 'success' })
    }
  }

  function toggleAssignTeamUser(userId) {
    const cur = [...(m.form.user_ids || [])]
    const i = cur.indexOf(userId)
    if (i >= 0) cur.splice(i, 1)
    else cur.push(userId)
    m.set('user_ids', cur)
  }

  async function saveProjectAssignments() {
    const projectId = m.modal?.projectId
    if (!projectId) return
    setSavingAssign(true)
    try {
      const selected = new Set(m.form.user_ids || [])
      const { data: rows, error: fetchErr } = await supabase
        .from('project_assignments')
        .select('user_id')
        .eq('project_id', projectId)
      if (fetchErr) throw fetchErr
      const current = new Set((rows || []).map(r => r.user_id))
      const toAdd = [...selected].filter(id => !current.has(id))
      const toRemove = [...current].filter(id => !selected.has(id))
      for (const uid of toRemove) {
        const { error } = await supabase.from('project_assignments').delete().match({ project_id: projectId, user_id: uid })
        if (error) throw error
      }
      for (const uid of toAdd) {
        const { error } = await supabase.from('project_assignments').insert({ project_id: projectId, user_id: uid })
        if (error) throw error
      }
      m.close()
      await fetchData(true)
      setToast({ message: 'Đã cập nhật phân công nhân sự', type: 'success' })
    } catch (err) {
      console.error(err)
      setToast({ message: err.message || 'Không thể lưu phân công', type: 'error' })
    } finally {
      setSavingAssign(false)
    }
  }

  async function openAddTaskFromProjectTasksModal() {
    const proj = projectInTasksView
    if (!proj) return
    let features = proj.features || []

    if (features.length === 0) {
      const { data: row, error } = await supabase
        .from('features')
        .insert({
          project_id: proj.project_id,
          name: 'Chung',
          description: 'Nhóm mặc định — tạo tự động khi thêm nhiệm vụ lần đầu',
          status: 'pending',
        })
        .select('feature_id, name')
        .single()
      if (error) {
        setToast({ message: error.message, type: 'error' })
        return
      }
      features = [row]
      await fetchData(true)
    }

    const featureOptions = features.map(f => ({ value: f.feature_id, label: f.name }))
    const emptyBlocks = { content_blocks: [{ content: '', image_url: '' }] }
    if (features.length === 1) {
      m.open('add_task', { featureId: features[0].feature_id, initial: emptyBlocks })
    } else {
      m.open('add_task', {
        featureId: features[0].feature_id,
        featureOptions,
        initial: { feature_id: features[0].feature_id, ...emptyBlocks },
      })
    }
  }

  function modalConfig() {
    const t = m.modal?.type
    if (t === 'add_customer' || t === 'edit_customer') return { title: t === 'add_customer' ? 'Thêm khách hàng' : 'Sửa khách hàng', fields: CUSTOMER_FIELDS }
    if (t === 'add_project' || t === 'edit_project') {
      const pFields = PROJECT_FIELDS.map(f =>
        f.name === 'customer_id'
          ? { ...f, options: customers.map(c => ({ value: c.customer_id, label: c.name })) }
          : f
      )
      return { title: t === 'add_project' ? 'Dự án mới' : 'Sửa dự án', fields: pFields }
    }
    if (t === 'add_feature' || t === 'edit_feature') return { title: t === 'add_feature' ? 'Tính năng mới' : 'Sửa tính năng', fields: FEATURE_FIELDS }
    if (t === 'add_task' || t === 'edit_task') {
      let flds = TASK_FIELDS.map(f =>
        f.name === 'assigned_to'
          ? { ...f, options: allUsers.map(u => ({ value: u.user_id, label: u.full_name })) }
          : f
      )
      if (t === 'add_task' && m.modal?.featureOptions?.length > 1) {
        flds = [
          { name: 'feature_id', label: 'Tính năng', type: 'select', options: m.modal.featureOptions },
          ...flds,
        ]
      }
      return { title: t === 'add_task' ? 'Nhiệm vụ mới' : 'Sửa nhiệm vụ', fields: flds }
    }
    if (t === 'add_subtask' || t === 'edit_subtask') {
      const flds = SUBTASK_FIELDS.map(f =>
        f.name === 'assigned_to'
          ? { ...f, options: allUsers.map(u => ({ value: u.user_id, label: u.full_name })) }
          : f
      )
      return { title: t === 'add_subtask' ? 'Tiểu mục mới' : 'Sửa tiểu mục', fields: flds }
    }
    return null
  }

  const cfg = m.modal ? modalConfig() : null
  const projectTasksModalEntries = projectInTasksView ? collectTasksFromProject(projectInTasksView) : []
  const taskKanbanGrouped = projectInTasksView ? groupTaskEntriesForKanban(projectTasksModalEntries) : null

  const displayedCustomerProjects = useMemo(() => {
    const ql = projectSearch.trim().toLowerCase()
    const projectMatches = p => {
      const n = (p.name || '').toLowerCase()
      const d = (p.description || '').toLowerCase()
      return n.includes(ql) || d.includes(ql)
    }
    const now = Date.now()
    const keyMatches = p => {
      if (projectListFilter === 'all') return true
      const st = p.status || 'pending'
      const isCompleted = st === 'completed'
      if (projectListFilter === 'active') return !isCompleted
      if (projectListFilter === 'due') {
        const dl = p.deadline ? new Date(p.deadline).getTime() : NaN
        return !isCompleted && Number.isFinite(dl) && dl > now && (dl - now) / 86400000 <= 7
      }
      return true
    }
    return customers
      .filter(c => (c.projects?.length ?? 0) > 0)
      .map(c => {
        if (!ql) {
          const projects = (c.projects || []).filter(keyMatches)
          return { customer: c, projects }
        }
        const customerNameMatch = (c.name || '').toLowerCase().includes(ql)
        const projects = customerNameMatch
          ? (c.projects || []).filter(keyMatches)
          : (c.projects || []).filter(p => projectMatches(p) && keyMatches(p))
        return { customer: c, projects }
      })
      .filter(({ projects }) => projects.length > 0)
  }, [customers, projectSearch, projectListFilter])

  const totalPagesMain = Math.ceil(displayedCustomerProjects.length / PAGE_SIZE_MAIN)
  const paginatedCustomerProjects = (isMobileScreen && !projectTasksViewId)
    ? displayedCustomerProjects.slice((currentPageMain - 1) * PAGE_SIZE_MAIN, currentPageMain * PAGE_SIZE_MAIN)
    : displayedCustomerProjects

  /** Stats luôn tính từ TOÀN BỘ dữ liệu, không bị ảnh hưởng bởi filter đang chọn */
  const projectListStats = useMemo(() => {
    let total = 0
    let active = 0   // Đang hoạt động = status khác 'completed'
    let due = 0      // Sắp đến hạn = không completed + deadline trong 7 ngày tới
    const now = Date.now()
    for (const c of customers) {
      for (const p of c.projects || []) {
        total++
        const st = p.status || 'pending'
        const isCompleted = st === 'completed'
        if (!isCompleted) {
          active++
          const dl = p.deadline ? new Date(p.deadline).getTime() : NaN
          if (Number.isFinite(dl) && dl > now && (dl - now) / 86400000 <= 7) due++
        }
      }
    }
    return { total, active, due }
  }, [customers])

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-[#faf8ff]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#006591]"></div>
    </div>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-[#faf8ff]">
      <Sidebar />
      <div className="flex-1 md:ml-64 flex flex-col h-screen overflow-y-auto">
        <TopBar
          title={
            projectTasksViewId && projectInTasksView
              ? projectInTasksView.name
              : 'Quản lý dự án'
          }
          subtitle={
            projectTasksViewId && projectInTasksView && projectsModalCustomer
              ? `Khách hàng: ${projectsModalCustomer.name} · Kanban nhiệm vụ`
              : 'Theo dõi tiến độ và quản lý phân công công việc'
          }
        />
        <main className="flex-1 px-3 py-4 sm:px-8 sm:py-8">
          <div className="mx-auto w-full max-w-5xl space-y-5 pb-20">
            <div className={`grid gap-2.5 sm:gap-3 ${userRole === 'admin' ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-3'}`}>
              <div className="flex items-center gap-2 rounded-lg border border-[#f1f5f9] bg-white p-2 shadow-sm">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-600">
                  <span className="material-symbols-outlined text-[16px]">folder</span>
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-[#64748b] leading-tight">Tổng dự án</div>
                  <div className="text-[15px] font-bold tabular-nums text-[#131b2e] leading-snug">{projectListStats.total}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-[#f1f5f9] bg-white p-2 shadow-sm">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-600">
                  <span className="material-symbols-outlined text-[16px]">play_arrow</span>
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-[#64748b] leading-tight">Đang hoạt động</div>
                  <div className="text-[15px] font-bold tabular-nums text-emerald-700 leading-snug">{projectListStats.active}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-[#f1f5f9] bg-white p-2 shadow-sm">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-amber-50 text-amber-600">
                  <span className="material-symbols-outlined text-[16px]">warning</span>
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-[#64748b] leading-tight">Sắp đến hạn</div>
                  <div className="text-[15px] font-bold tabular-nums text-amber-700 leading-snug">{projectListStats.due}</div>
                </div>
              </div>
              {userRole === 'admin' && (
                <button
                  type="button"
                  onClick={() => m.open('add_project')}
                  className="inline-flex h-full min-h-[52px] items-center justify-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-[12px] font-medium text-sky-800 shadow-sm hover:bg-sky-100/90"
                >
                  <span className="material-symbols-outlined text-[16px] text-sky-700">add</span>
                  Dự án mới
                </button>
              )}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
              <div className="relative min-w-0 flex-1">
                <span className="material-symbols-outlined pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[18px] text-[#94a3b8]">
                  search
                </span>
                <input
                  type="search"
                  value={projectSearch}
                  onChange={e => setProjectSearch(e.target.value)}
                  placeholder="Tìm dự án theo tên, mô tả hoặc tên khách hàng..."
                  autoComplete="off"
                  className="w-full rounded-lg border border-[#e2e8f0] bg-white py-2 pl-9 pr-9 text-[13px] text-[#131b2e] placeholder:text-[#94a3b8] focus:border-[#006591] focus:outline-none focus:ring-1 focus:ring-[#006591]/25"
                  aria-label="Tìm dự án"
                />
                {projectSearch.trim() ? (
                  <button
                    type="button"
                    onClick={() => setProjectSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-[#94a3b8] hover:bg-slate-100 hover:text-[#131b2e]"
                    aria-label="Xóa tìm kiếm"
                  >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                {[
                  { id: 'all', label: 'Tất cả' },
                  { id: 'active', label: 'Đang làm' },
                  { id: 'due', label: 'Sắp hạn' },
                ].map(f => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setProjectListFilter(f.id)}
                    className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors ${projectListFilter === f.id
                      ? 'border border-sky-200 bg-sky-50 text-sky-900'
                      : 'border border-transparent text-[#64748b] hover:bg-slate-100'
                      }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {displayedCustomerProjects.length === 0 ? (
                <p className="text-sm text-[#64748b] text-center py-10 rounded-xl border border-dashed border-[#e2e8f0] bg-white/80">
                  {projectSearch.trim() || projectListFilter !== 'all'
                    ? 'Không có dự án nào khớp — thử bộ lọc hoặc từ khóa khác.'
                    : 'Chưa có dự án nào.'}
                </p>
              ) : null}
              {paginatedCustomerProjects.flatMap(({ customer: c, projects: projectsFiltered }) =>
                projectsFiltered.map(p => {
                  const { total: taskTotal, done: taskDone, pct } = countTasksInProject(p)
                  const dashKey = projectDashboardKey(p)
                  const sm = DASH_STATUS_META[dashKey]
                  const isMgr = userRole === 'admin' || userRole === 'manager'
                  const assignments = p.project_assignments || []
                  const memberChips = assignments.slice(0, 3).map((a, idx) => {
                    const nm = a.users?.full_name || allUsers.find(u => u.user_id === a.user_id)?.full_name || '?'
                    const ini = userInitials(nm)
                    return (
                      <div
                        key={a.user_id}
                        className="flex h-[22px] w-[22px] items-center justify-center rounded-full border-2 border-white bg-[#e0e7ff] text-[9px] font-semibold text-[#4338ca]"
                        style={{ marginLeft: idx ? -6 : 0, zIndex: 10 - idx }}
                        title={nm}
                      >
                        {ini.slice(0, 2)}
                      </div>
                    )
                  })

                  return (
                    <div
                      key={p.project_id}
                      onClick={() => {
                        setProjectsModalCustomerId(c.customer_id)
                        setProjectTasksViewId(p.project_id)
                      }}
                      className="rounded-xl border border-[#e8ecf0] bg-white shadow-sm cursor-pointer hover:bg-blue-50/30 hover:border-blue-100 transition-all"
                    >
                      {/* ─── Hàng 1: Tên + Avatars + Badge + Menu ─── */}
                      <div className="flex items-center gap-2 px-4 pt-3 pb-1">
                        <span className="flex-1 min-w-0 truncate text-[14px] font-bold text-[#131b2e]" title={p.name}>
                          {p.name}
                        </span>

                        {/* Avatars */}
                        {memberChips.length > 0 && (
                          <div className="flex items-center shrink-0">
                            {memberChips}
                          </div>
                        )}

                        {/* Status badge */}
                        <div className="shrink-0">
                          <StatusBadge status={p.status} />
                        </div>

                        {/* 3-dot menu */}
                        {isMgr && (
                          <div
                            className="relative shrink-0"
                            data-project-dd
                            onClick={e => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation()
                                setOpenProjectMenuId(cur => cur === p.project_id ? null : p.project_id)
                              }}
                              className="inline-flex h-[24px] w-[24px] items-center justify-center rounded-md text-[#94a3b8] hover:bg-slate-100 hover:text-[#475569] transition-colors"
                              aria-label="Thao tác dự án"
                            >
                              <span className="material-symbols-outlined text-[18px]">more_horiz</span>
                            </button>
                            {openProjectMenuId === p.project_id && (
                              <div className="absolute right-0 top-7 z-40 min-w-[168px] rounded-xl border border-[#e2e8f0] bg-white py-1 shadow-lg">
                                <button type="button" className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] text-[#131b2e] hover:bg-[#f8fafc]"
                                  onClick={() => { setOpenProjectMenuId(null); setProjectsModalCustomerId(c.customer_id); setProjectTasksViewId(null) }}>
                                  <span className="material-symbols-outlined text-[15px] text-[#64748b]">info</span>Chi tiết
                                </button>
                                <button type="button" className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] text-[#131b2e] hover:bg-[#f8fafc]"
                                  onClick={() => { setOpenProjectMenuId(null); m.open('edit_project', { id: p.project_id, ...p }) }}>
                                  <span className="material-symbols-outlined text-[15px] text-[#64748b]">edit</span>Chỉnh sửa
                                </button>
                                <button type="button" className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] text-[#131b2e] hover:bg-[#f8fafc]"
                                  onClick={() => { setOpenProjectMenuId(null); setProjectsModalCustomerId(c.customer_id); setProjectTasksViewId(p.project_id) }}>
                                  <span className="material-symbols-outlined text-[15px] text-[#64748b]">view_kanban</span>Kanban
                                </button>
                                <div className="my-1 h-px bg-[#e2e8f0]" />
                                <button type="button" className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] text-red-700 hover:bg-red-50"
                                  onClick={() => { setOpenProjectMenuId(null); deleteEntity('projects', 'project_id', p.project_id) }}>
                                  <span className="material-symbols-outlined text-[15px]">delete</span>Xoá dự án
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* ─── Hàng 2: Ngày | % text | Progress bar | % | Task count ─── */}
                      <div className="flex items-center gap-3 px-4 pb-3 text-[11px] text-[#94a3b8]">
                        {/* Deadline */}
                        <div className="flex items-center gap-1 shrink-0 min-w-[90px]">
                          <span className="material-symbols-outlined text-[12px]">schedule</span>
                          <span className="tabular-nums">{formatDeadlineDisplay(p.deadline)}</span>
                        </div>

                        {/* % text */}
                        <span className="tabular-nums text-[#94a3b8]">{pct}%</span>

                        {/* Progress bar */}
                        <div className="flex-1 h-[4px] overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${pct}%`, background: sm.bar }}
                          />
                        </div>

                        {/* % right */}
                        <span className="tabular-nums font-semibold text-[#475569]">{pct}%</span>

                        {/* Task count */}
                        <span className="tabular-nums shrink-0">{taskDone}/{taskTotal}</span>
                      </div>
                    </div>
                  )
                })
              )}


              {/* PHÂN TRANG MOBILE */}

              {/* PHÂN TRANG MOBILE */}
              {isMobileScreen && totalPagesMain > 1 && !projectTasksViewId && (
                <div className="mt-4 flex items-center justify-center gap-3 py-2">
                  <button
                    type="button"
                    disabled={currentPageMain === 1}
                    onClick={() => {
                      setCurrentPageMain(p => p - 1)
                      window.scrollTo({ top: 0, behavior: 'smooth' })
                    }}
                    className="flex h-9 items-center gap-1 rounded-lg border border-[#e2e8f0] bg-white px-3 text-[12px] font-bold text-[#131b2e] shadow-sm disabled:opacity-40 transition-all active:scale-95"
                  >
                    <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                    TRƯỚC
                  </button>
                  <div className="flex h-9 items-center gap-1 rounded-lg border border-sky-100 bg-sky-50 px-3 text-[12px] font-black text-sky-900 shadow-sm">
                    <span>{currentPageMain}</span>
                    <span className="text-sky-300">/</span>
                    <span>{totalPagesMain}</span>
                  </div>
                  <button
                    type="button"
                    disabled={currentPageMain === totalPagesMain}
                    onClick={() => {
                      setCurrentPageMain(p => p + 1)
                      window.scrollTo({ top: 0, behavior: 'smooth' })
                    }}
                    className="flex h-9 items-center gap-1 rounded-lg border border-[#e2e8f0] bg-white px-3 text-[12px] font-bold text-[#131b2e] shadow-sm disabled:opacity-40 transition-all active:scale-95"
                  >
                    SAU
                    <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {projectsModalCustomer && (
        <Modal
          maxWidthClassName={
            projectTasksViewId && projectInTasksView
              ? 'w-[min(112rem,calc(100vw-1rem))]'
              : 'w-[min(96rem,calc(100vw-1rem))]'
          }
          bodyClassName={
            projectTasksViewId && projectInTasksView
              ? 'px-6 sm:px-10 py-5 overflow-y-auto max-h-[88vh] min-h-[280px]'
              : 'px-6 py-4 overflow-y-auto max-h-[82vh] min-h-[200px]'
          }
          title={
            projectTasksViewId && projectInTasksView
              ? `Nhiệm vụ — ${projectInTasksView.name}`
              : `Dự án — ${projectsModalCustomer.name}`
          }
          subtitle={
            projectTasksViewId && projectInTasksView
              ? 'Ba cột theo trạng thái — thẻ task gọn (Kanban)'
              : 'Danh sách dự án — bấm Xem để mở thẻ nhiệm vụ (task)'
          }
          headerActions={
            projectTasksViewId ? (
              <div className="flex items-center gap-2 flex-wrap justify-end">
                <button
                  type="button"
                  onClick={() => setProjectTasksViewId(null)}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-[#006591] bg-[#eae8ff] hover:bg-[#dae2fd] transition-colors whitespace-nowrap"
                >
                  <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                  Quay lại
                </button>
                {(userRole === 'admin' || userRole === 'manager') && (
                  <button
                    type="button"
                    onClick={openAddTaskFromProjectTasksModal}
                    className="primary-gradient text-white px-4 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 shadow-lg hover:brightness-110 transition-all whitespace-nowrap"
                  >
                    <span className="material-symbols-outlined text-[18px]">assignment_add</span>
                    Thêm task
                  </button>
                )}
              </div>
            ) : userRole === 'admin' ? (
              <button
                type="button"
                onClick={() => m.open('add_project', { initial: { customer_id: projectsModalCustomer.customer_id } })}
                className="primary-gradient text-white px-4 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 shadow-lg hover:brightness-110 transition-all whitespace-nowrap"
              >
                <span className="material-symbols-outlined text-[18px]">add_circle</span>
                Thêm dự án
              </button>
            ) : null
          }
          onClose={() => {
            setProjectsModalCustomerId(null)
            setProjectTasksViewId(null)
          }}
          footer={
            <button
              type="button"
              onClick={() => {
                setProjectsModalCustomerId(null)
                setProjectTasksViewId(null)
              }}
              className="px-6 py-2.5 rounded-xl text-sm font-medium text-white primary-gradient shadow-md hover:brightness-110 transition-all"
            >
              Đóng
            </button>
          }
        >
          {projectTasksViewId && projectInTasksView ? (
            projectTasksModalEntries.length === 0 ? (
              <p className="text-sm text-[#3e4850] py-12 text-center italic">Chưa có task trong dự án này.</p>
            ) : (
              taskKanbanGrouped && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full">
                  {KANBAN_COLUMNS.map(col => (
                    <div
                      key={col.key}
                      className={`flex flex-col min-h-[140px] rounded-xl border border-[#bec8d2]/25 bg-[#f4f6fc]/90 border-t-[3px] ${col.topBar} shadow-sm`}
                    >
                      <div className="flex items-center justify-between gap-2 px-2.5 py-2.5 border-b border-[#e8ecf0] bg-white rounded-t-[10px]">
                        <div className="flex min-w-0 items-center gap-2">
                          <p className="text-sm font-bold tracking-tight text-[#131b2e]">{col.title}</p>
                          <span className="shrink-0 rounded-full bg-[#eef1f6] px-2 py-0.5 text-[11px] font-bold tabular-nums text-[#475569]">
                            {taskKanbanGrouped[col.key].length}
                          </span>
                        </div>
                      </div>
                      <div className="flex-1 p-1 space-y-1 overflow-y-auto max-h-[min(62vh,480px)]">
                        {taskKanbanGrouped[col.key].map(({ feature, task }) => (
                          <ModalTaskCard
                            key={task.task_id}
                            compact
                            hideStatusBadge
                            statusActionsOutside
                            feature={feature}
                            task={task}
                            userRole={userRole}
                            m={m}
                            deleteEntity={deleteEntity}
                            onDeleteSubtask={deleteSubtask}
                            onTaskStatusChange={updateTaskStatus}
                            updatingTaskId={updatingTaskId}
                            onSubtaskStatusChange={updateSubtaskStatus}
                            updatingSubtaskId={updatingSubtaskId}
                            onSubtaskWorkTimeSave={saveSubtaskWorkTime}
                            updatingSubtaskWorkTimeId={updatingSubtaskWorkTimeId}
                            onToast={(msg, type) => setToast({ message: msg, type })}
                          />
                        ))}
                        {taskKanbanGrouped[col.key].length === 0 && (
                          <p className="text-[10px] text-[#6e7881] italic text-center py-3">Trống</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )
            )
          ) : (
            <div className="space-y-4">
              {/* MOBILE ONLY: PAGINATION TOP (Optional, but sếp said "ở cuối danh sách") */}

              {(window.innerWidth < 1024 ? paginatedModalProjects : projectsModalCustomer.projects).map(p => {
                const isManagerOrAdmin = userRole === 'admin' || userRole === 'manager'
                const hasBudget = p.pricing != null && p.pricing !== ''
                return (
                  <div key={p.project_id}>
                    {/* DESKTOP VIEW: Legacy Card Style */}
                    <div className="hidden lg:block rounded-xl border border-[#bec8d2]/20 bg-[#faf8ff]/50 p-4 space-y-3">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 flex-1 space-y-1">
                          <p className="text-sm font-bold text-[#131b2e]">{p.name}</p>
                          <p className="text-xs text-[#3e4850] line-clamp-2">{p.description || '—'}</p>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[#3e4850]">
                            <span>
                              Ngân sách:{' '}
                              {hasBudget ? `${Number(p.pricing).toLocaleString('vi-VN')} ₫` : '—'}
                            </span>
                            <span>Hạn: {formatDeadlineDisplay(p.deadline)}</span>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          <StatusBadge status={p.status} />
                          <button
                            type="button"
                            onClick={() => setProjectTasksViewId(p.project_id)}
                            className="text-xs font-semibold text-[#006591] bg-[#dae2fd] hover:bg-[#c9d4fc] px-3 py-2 rounded-lg inline-flex items-center gap-1 transition-colors"
                          >
                            <span className="material-symbols-outlined text-[18px]">visibility</span>
                            Xem
                          </button>
                          {isManagerOrAdmin && (
                            <ThreeDotMenu
                              items={[
                                { icon: 'edit', label: 'Chỉnh sửa', onClick: () => m.open('edit_project', { id: p.project_id, ...p }) },
                                {
                                  icon: 'group_add',
                                  label: 'Phân công nhân sự',
                                  onClick: () =>
                                    m.open('assign_team', {
                                      projectId: p.project_id,
                                      initial: { user_ids: (p.project_assignments || []).map(a => a.user_id) },
                                    }),
                                  primary: true,
                                },
                                { icon: 'add_circle', label: 'Thêm tính năng mới', onClick: () => m.open('add_feature', { projectId: p.project_id }), primary: true },
                                { icon: 'delete', label: 'Xóa', onClick: () => deleteEntity('projects', 'project_id', p.project_id), danger: true },
                              ]}
                            />
                          )}
                        </div>
                      </div>
                      {isManagerOrAdmin && (
                        <div className="border-t border-[#bec8d2]/15 pt-2">
                          <button
                            type="button"
                            onClick={() => setMemberRowOpen(s => ({ ...s, [p.project_id]: !s[p.project_id] }))}
                            className="flex w-full items-center justify-between gap-2 text-left rounded-lg px-1 py-1 hover:bg-[#f0f2fa]/80 transition-colors"
                          >
                            <span className="text-[10px] font-bold text-[#3e4850] uppercase tracking-wide">
                              Nhân sự
                              {(p.project_assignments || []).length > 0 && (
                                <span className="font-semibold text-[#006591]">
                                  {' '}
                                  · {(p.project_assignments || []).length} người
                                </span>
                              )}
                            </span>
                            <span className="material-symbols-outlined text-[#6e7881] text-[18px] shrink-0">
                              {memberRowOpen[p.project_id] ? 'expand_less' : 'expand_more'}
                            </span>
                          </button>
                          {memberRowOpen[p.project_id] && (
                            <div className="mt-2 flex flex-wrap items-center gap-2 pl-0.5">
                              {(p.project_assignments || []).map(a => {
                                const u = allUsers.find(x => x.user_id === a.user_id)
                                return (
                                  <div key={a.user_id} className="flex items-center gap-1 bg-[#f9fafb] border border-[#bec8d2]/20 px-2 py-0.5 rounded-full text-[10px]">
                                    {u?.full_name || a.users?.full_name || '...'}
                                    <button
                                      type="button"
                                      onClick={() => removeAssignment(p.project_id, a.user_id)}
                                      className="text-[#6e7881] hover:text-red-500 ml-0.5"
                                      title="Gỡ khỏi dự án"
                                    >
                                      <span className="material-symbols-outlined text-[12px]">close</span>
                                    </button>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* MOBILE VIEW: Ultra-Compact List Item */}
                    <div className="lg:hidden border-b border-[#bec8d2]/15 pb-4 last:border-b-0 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[13px] font-bold text-[#131b2e] truncate grow">{p.name}</p>
                        {isManagerOrAdmin && (
                          <ThreeDotMenu
                            items={[
                              { icon: 'edit', label: 'Chỉnh sửa', onClick: () => m.open('edit_project', { id: p.project_id, ...p }) },
                              {
                                icon: 'group_add',
                                label: 'Phân công nhân sự',
                                onClick: () => m.open('assign_team', {
                                  projectId: p.project_id,
                                  initial: { user_ids: (p.project_assignments || []).map(a => a.user_id) },
                                }),
                                primary: true,
                              },
                              { icon: 'add_circle', label: 'Thêm tính năng mới', onClick: () => m.open('add_feature', { projectId: p.project_id }), primary: true },
                              { icon: 'delete', label: 'Xóa dự án', onClick: () => deleteEntity('projects', 'project_id', p.project_id), danger: true },
                            ]}
                          />
                        )}
                      </div>

                      {/* Row 2: Info & Actions */}
                      <div className="flex flex-row items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1 text-[10px] text-[#3e4850] bg-slate-100 px-1.5 py-0.5 rounded">
                            <span className="material-symbols-outlined text-[12px]">event</span>
                            {formatDeadlineDisplay(p.deadline)}
                          </div>
                          <StatusBadge status={p.status} />
                          {hasBudget && (
                            <span className="text-[10px] text-emerald-700 font-medium">
                              {Number(p.pricing).toLocaleString('vi-VN')} ₫
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => setProjectTasksViewId(p.project_id)}
                          className="text-[11px] font-bold text-[#006591] bg-[#dae2fd] active:scale-95 px-3 py-1 rounded-md transition-all uppercase tracking-tighter"
                        >
                          Xem
                        </button>
                      </div>

                      {/* Staff Dropdown (Mobile Optimized) */}
                      {isManagerOrAdmin && (
                        <div className="mt-1">
                          <button
                            type="button"
                            onClick={() => setMemberRowOpen(s => ({ ...s, [p.project_id]: !s[p.project_id] }))}
                            className="flex h-8 w-full items-center justify-between gap-2 text-left rounded-lg px-2 bg-slate-50/50 border border-slate-100"
                          >
                            <span className="text-[10px] font-bold text-[#3e4850] uppercase tracking-tighter">
                              NHÂN SỰ {(p.project_assignments || []).length > 0 && `· ${(p.project_assignments || []).length}`}
                            </span>
                            <span className="material-symbols-outlined text-[#6e7881] text-[16px]">
                              {memberRowOpen[p.project_id] ? 'expand_less' : 'expand_more'}
                            </span>
                          </button>
                          {memberRowOpen[p.project_id] && (
                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                              {(p.project_assignments || []).map(a => {
                                const u = allUsers.find(x => x.user_id === a.user_id)
                                return (
                                  <div key={a.user_id} className="flex items-center gap-1 bg-white border border-[#bec8d2]/20 px-2 py-0.5 rounded-full text-[9px] font-medium text-[#131b2e]">
                                    {u?.full_name || a.users?.full_name || '...'}
                                    <button type="button" onClick={() => removeAssignment(p.project_id, a.user_id)} className="text-slate-400">
                                      <span className="material-symbols-outlined text-[10px]">close</span>
                                    </button>
                                  </div>
                                )
                              })}
                              <button
                                type="button"
                                onClick={() => m.open('assign_team', { projectId: p.project_id, initial: { user_ids: (p.project_assignments || []).map(z => z.user_id) } })}
                                className="w-6 h-6 flex items-center justify-center rounded-full bg-[#dae2fd] text-[#006591] border border-white"
                              >
                                <span className="material-symbols-outlined text-[14px]">add</span>
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}

              {/* MOBILE ONLY: MINI PAGINATION CONTROLS */}
              {totalPagesModal > 1 && (
                <div className="lg:hidden flex items-center justify-center gap-4 pt-2 pb-1 border-t border-[#bec8d2]/10">
                  <button
                    disabled={modalProjectPage === 1}
                    onClick={() => setModalProjectPage(prev => Math.max(1, prev - 1))}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-slate-200 text-[#006591] disabled:opacity-30 active:scale-95 transition-all shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[20px]">chevron_left</span>
                  </button>
                  <p className="text-[11px] font-bold text-[#131b2e] tracking-widest tabular-nums">
                    TRANG {modalProjectPage} / {totalPagesModal}
                  </p>
                  <button
                    disabled={modalProjectPage === totalPagesModal}
                    onClick={() => setModalProjectPage(prev => Math.min(totalPagesModal, prev + 1))}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-slate-200 text-[#006591] disabled:opacity-30 active:scale-95 transition-all shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[20px]">chevron_right</span>
                  </button>
                </div>
              )}
            </div>
          )}

        </Modal>
      )}

      {m.modal?.type === 'assign_team' && (
        <AssignTeamModal
          allUsers={allUsers}
          selectedIds={m.form.user_ids || []}
          onToggle={toggleAssignTeamUser}
          onSave={saveProjectAssignments}
          onClose={m.close}
          saving={savingAssign}
        />
      )}
      {m.modal && cfg && (
        <EntityFormModal
          title={cfg.title}
          fields={cfg.fields}
          data={m.form}
          onChange={m.set}
          onSave={handleSave}
          onClose={m.close}
          isLoading={
            ((m.modal?.type === 'add_project' || m.modal?.type === 'edit_project') && savingProject) ||
            ((m.modal?.type === 'add_subtask' || m.modal?.type === 'edit_subtask') && savingSubtask) ||
            ((m.modal?.type === 'add_task' || m.modal?.type === 'edit_task') && savingTask) ||
            ((m.modal?.type === 'add_feature' || m.modal?.type === 'edit_feature') && savingFeature)
          }
        />
      )}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
