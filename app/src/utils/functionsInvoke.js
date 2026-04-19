import { FunctionsHttpError } from '@supabase/supabase-js'

/**
 * Lỗi từ body JSON khi invoke thành công parse HTTP (hiếm).
 */
export function errorFromInvokeData(data) {
  if (data && typeof data === 'object' && data !== null && data.error != null) {
    return String(data.error)
  }
  return ''
}

/**
 * Lỗi từ body khi HTTP không 2xx (FunctionsHttpError.context là Response).
 */
export async function errorFromInvokeException(error) {
  if (!error) return ''
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await error.context.json()
      if (body && typeof body === 'object' && body.error != null) {
        return String(body.error)
      }
    } catch {
      try {
        const t = await error.context.text()
        if (t && t.length < 800) return t
      } catch {
        /* ignore */
      }
    }
  }
  return error.message || ''
}

export async function combinedInvokeError(data, error) {
  const fromData = errorFromInvokeData(data)
  if (fromData) return fromData
  return await errorFromInvokeException(error)
}
