import { useState, useEffect } from 'react'
import { shouldTryImageFirst, hostBlocksIframeEmbedding } from '../utils/linkEmbed'
import { resolveLinkPreviewImage } from '../utils/linkPreviewResolve'

/**
 * Trang chặn iframe: thử ảnh trực tiếp → (prnt.sc) resolve og:image như Zalo → fallback mở tab.
 */
export default function IframeBlockedFallback({ url }) {
  const [imgFailed, setImgFailed] = useState(false)
  const [resolvedUrl, setResolvedUrl] = useState(null)
  const [resolveDone, setResolveDone] = useState(false)
  const [resolvedImgFailed, setResolvedImgFailed] = useState(false)

  const tryDirectImg = shouldTryImageFirst(url)

  useEffect(() => {
    let cancelled = false
    if (!url) return
    if (tryDirectImg && !imgFailed) return
    if (!hostBlocksIframeEmbedding(url)) {
      setResolveDone(true)
      return
    }

    setResolvedUrl(null)
    setResolveDone(false)
    ;(async () => {
      const u = await resolveLinkPreviewImage(url)
      if (cancelled) return
      setResolvedUrl(u)
      setResolveDone(true)
    })()
    return () => {
      cancelled = true
    }
  }, [url, tryDirectImg, imgFailed])

  if (tryDirectImg && !imgFailed) {
    return (
      <div className="rounded-xl overflow-hidden border border-[#bec8d2]/20 bg-[#f9fafb] max-h-[50vh]">
        <img
          src={url}
          alt=""
          className="w-full max-h-[48vh] object-contain bg-[#f0f0f5]"
          onError={() => setImgFailed(true)}
        />
      </div>
    )
  }

  if (!resolveDone) {
    return (
      <div className="rounded-xl border border-[#bec8d2]/25 bg-[#faf8ff] px-4 py-8 flex flex-col items-center justify-center gap-2 text-[#3e4850]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#006591] border-t-transparent" />
        <p className="text-sm">Đang lấy ảnh xem trước (og:image)…</p>
      </div>
    )
  }

  if (resolvedUrl && !resolvedImgFailed) {
    return (
      <div className="rounded-xl overflow-hidden border border-[#bec8d2]/20 bg-[#f9fafb] max-h-[50vh]">
        <img
          src={resolvedUrl}
          alt=""
          className="w-full max-h-[48vh] object-contain bg-[#f0f0f5]"
          onError={() => setResolvedImgFailed(true)}
        />
        <p className="text-[11px] text-[#6e7881] px-2 py-1.5 border-t border-[#bec8d2]/15">
          Ảnh lấy từ trang nguồn (Open Graph). Nếu sai, dùng nút mở link bên dưới.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-[#bec8d2]/25 bg-[#faf8ff] p-4 space-y-3">
      <p className="text-sm text-[#3e4850] leading-snug">
        Không lấy được ảnh xem trước tự động. Bạn có thể mở link trên trang gốc.
      </p>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-[#006591] bg-[#eae8ff] hover:bg-[#dae2fd] transition-colors"
      >
        <span className="material-symbols-outlined text-[18px]">open_in_new</span>
        Mở trên trang gốc
      </a>
    </div>
  )
}
