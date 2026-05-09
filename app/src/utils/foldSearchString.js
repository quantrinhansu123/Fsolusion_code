/** Chuỗi tìm kiếm: thường + bỏ dấu (đ→d) để khớp khi gõ không dấu */
export function foldSearchString(s) {
  if (s == null || s === '') return ''
  return String(s)
    .toLowerCase()
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}
