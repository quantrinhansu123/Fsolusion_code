export function isHttpUrl(urlStr) {
  try {
    const u = new URL(urlStr.trim())
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

/** URL có đuôi ảnh → thử <img> trước; trang web thường → nhúng iframe ngay */
export function shouldTryImageFirst(urlStr) {
  try {
    const u = new URL(urlStr.trim())
    if (!/^https?:$/i.test(u.protocol)) return false
    return /\.(jpe?g|png|gif|webp|svg|bmp|ico)(\?|$)/i.test(u.pathname)
  } catch {
    return false
  }
}

/** Host trả X-Frame-Options / CSP — iframe báo «refused to connect» (prnt.sc, Lightshot, …) */
export function hostBlocksIframeEmbedding(urlStr) {
  try {
    const h = new URL(urlStr.trim()).hostname.toLowerCase()
    return (
      h === 'prnt.sc' ||
      h.endsWith('.prnt.sc') ||
      h === 'prntscr.com' ||
      h.endsWith('.prntscr.com') ||
      h === 'lightshot.com' ||
      h.endsWith('.lightshot.com')
    )
  } catch {
    return false
  }
}
