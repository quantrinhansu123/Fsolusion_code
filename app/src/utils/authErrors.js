/**
 * Chuỗi lỗi từ supabase.auth / PostgREST → thông báo ngắn (vi), không nhắc tới mail hay cấu hình máy chủ.
 */
export function humanizeAuthError(message) {
  if (!message || typeof message !== 'string') return 'Có lỗi xảy ra. Thử lại.'
  const m = message.toLowerCase()

  if (m.includes('invalid login credentials') || m.includes('invalid_credentials')) {
    return 'Sai tên đăng nhập hoặc mật khẩu.'
  }

  if (m.includes('user already registered') || m.includes('already been registered')) {
    return 'Tài khoản này đã tồn tại.'
  }

  if (m.includes('rate') && (m.includes('limit') || m.includes('exceeded'))) {
    return 'Thao tác quá nhiều lần. Thử lại sau.'
  }

  if (m.includes('email')) {
    return 'Thao tác thất bại. Thử lại.'
  }

  return message
}
