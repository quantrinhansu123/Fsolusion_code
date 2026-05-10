/**
 * Upload ảnh unsigned lên Cloudinary (preset trong Dashboard → Settings → Upload).
 * Biến môi trường: VITE_CLOUDINARY_CLOUD_NAME, VITE_CLOUDINARY_UPLOAD_PRESET
 */

export function isCloudinaryUploadConfigured() {
  const cloud = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
  const preset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET
  return !!(cloud && preset && String(cloud).trim() && String(preset).trim())
}

/**
 * @param {File|Blob} fileOrBlob
 * @param {string} [filename] — dùng khi Blob không có tên (vd. dán từ clipboard)
 * @returns {Promise<string>} secure_url
 */
export async function uploadImageBlobToCloudinary(fileOrBlob, filename = 'image.png') {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
  const preset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET
  if (!cloudName || !preset) {
    throw new Error('Thiếu VITE_CLOUDINARY_CLOUD_NAME hoặc VITE_CLOUDINARY_UPLOAD_PRESET trong .env')
  }

  const file =
    fileOrBlob instanceof File
      ? fileOrBlob
      : new File([fileOrBlob], filename, { type: fileOrBlob.type || 'image/png' })

  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', preset)

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body: formData,
  })

  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = json?.error?.message || res.statusText || 'Upload thất bại'
    throw new Error(msg)
  }
  if (!json.secure_url) {
    throw new Error('Cloudinary không trả về secure_url')
  }
  return json.secure_url
}
