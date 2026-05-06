/** Miền nội bộ gắn vào tên đăng nhập ngắn (chỉ khi không có ký tự @). */
const INTERNAL_LOGIN_DOMAIN = 'login.pm'

/**
 * Chuẩn hoá ô nhập đăng nhập thành định dạng email nội bộ để dùng trong bảng users.
 * @param {string} raw
 */
export function normalizeSignInForAuth(raw) {
  const s = String(raw || '').trim()
  if (!s) return ''
  if (s.includes('@')) return s.toLowerCase()
  const local = s.replace(/\s+/g, '').toLowerCase()
  if (!local) return ''
  return `${local}@${INTERNAL_LOGIN_DOMAIN}`
}

/**
 * Hiển thị trong bảng / form: rút gọn nếu trùng miền nội bộ.
 * @param {string} stored
 */
export function shortDisplayForProfile(stored) {
  if (!stored || typeof stored !== 'string') return ''
  const trimmed = stored.trim()
  const suffix = `@${INTERNAL_LOGIN_DOMAIN}`
  const lower = trimmed.toLowerCase()
  if (lower.endsWith(suffix)) {
    return trimmed.slice(0, lower.length - suffix.length)
  }
  return trimmed
}
