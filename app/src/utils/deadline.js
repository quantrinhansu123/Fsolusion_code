/**
 * Hạn chót: hiển thị & form datetime-local ↔ ISO (TIMESTAMPTZ trên Supabase).
 */

/** Giá trị DB hoặc form → hiển thị ngày + giờ (vi-VN) */
export function formatDeadlineDisplay(value) {
  if (value == null || value === '') return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
}

/** Ngày ngắn kiểu 18/4/26 (thẻ danh sách) */
export function formatDeadlineShort(value) {
  if (value == null || value === '') return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('vi-VN', { day: 'numeric', month: 'numeric', year: '2-digit' })
}

/** DB ISO / DATE cũ / chuỗi datetime-local → giá trị cho input[type=datetime-local] */
export function deadlineToFormValue(value) {
  if (value == null || value === '') return ''
  const s = String(value).trim()
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) return s
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s}T00:00`
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return ''
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Giá trị form datetime-local → ISO lưu DB */
export function normalizeDeadlineForSave(value) {
  if (value == null || value === '') return null
  const d = new Date(String(value).trim())
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}
