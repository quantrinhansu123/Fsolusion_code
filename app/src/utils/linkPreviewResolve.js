import { supabase } from './supabase'

/**
 * Lấy URL ảnh xem trước cho trang chặn iframe (prnt.sc, …): giống Zalo — đọc og:image / HTML phía server.
 * 1) Edge Function `resolve-link-preview` (khuyến nghị, cần deploy)
 * 2) Microlink API công khai (dự phòng, có thể giới hạn tần suất)
 */
export async function resolveLinkPreviewImage(url) {
  if (!url || typeof url !== 'string') return null

  try {
    const { data, error } = await supabase.functions.invoke('resolve-link-preview', {
      body: { url: url.trim() },
    })
    if (!error && data?.imageUrl && typeof data.imageUrl === 'string') {
      return data.imageUrl
    }
  } catch {
    // Chưa deploy function hoặc lỗi mạng
  }

  try {
    const r = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url.trim())}`)
    if (!r.ok) return null
    const j = await r.json()
    const u = j?.data?.image?.url
    return typeof u === 'string' && u.startsWith('http') ? u : null
  } catch {
    return null
  }
}
