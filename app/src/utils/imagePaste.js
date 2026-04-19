/**
 * Ảnh từ clipboard / file → data URL (JPEG nén, giới hạn cạnh dài) để lưu vào image_url.
 */
const MAX_EDGE = 1600
const JPEG_Q = 0.85

export async function imageFileToDataUrl(file) {
  if (!file || !file.type.startsWith('image/')) return ''
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result
      if (typeof dataUrl !== 'string') {
        resolve('')
        return
      }
      const img = new Image()
      img.onload = () => {
        try {
          let { width, height } = img
          if (width > MAX_EDGE || height > MAX_EDGE) {
            if (width >= height) {
              height = Math.round((height * MAX_EDGE) / width)
              width = MAX_EDGE
            } else {
              width = Math.round((width * MAX_EDGE) / height)
              height = MAX_EDGE
            }
          }
          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            resolve(dataUrl)
            return
          }
          ctx.drawImage(img, 0, 0, width, height)
          resolve(canvas.toDataURL('image/jpeg', JPEG_Q))
        } catch {
          resolve(dataUrl)
        }
      }
      img.onerror = () => resolve(dataUrl)
      img.src = dataUrl
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

/** Lấy file ảnh tầng đầu tiên trong ClipboardEvent */
export function getImageFromClipboardEvent(e) {
  const items = e.clipboardData?.items
  if (!items) return null
  for (let i = 0; i < items.length; i++) {
    const it = items[i]
    if (it.kind === 'file' && it.type.startsWith('image/')) {
      const f = it.getAsFile()
      if (f) return f
    }
  }
  return null
}

/** Lấy file ảnh từ DragEvent */
export function getImageFromDataTransfer(dt) {
  if (!dt?.files?.length) return null
  for (let i = 0; i < dt.files.length; i++) {
    const f = dt.files[i]
    if (f.type.startsWith('image/')) return f
  }
  return null
}
