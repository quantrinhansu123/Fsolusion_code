/** @typedef {{ content: string, image_urls: string[] }} TaskContentBlock */

/**
 * Chuẩn hóa dữ liệu task thành mảng các khối { content, image_urls } cho form.
 * Hỗ trợ dữ liệu cũ: description + image_url đơn, hoặc content_blocks cũ có image_url đơn.
 * @param {object|null|undefined} task
 * @returns {TaskContentBlock[]}
 */
export function normalizeTaskContentBlocks(task) {
  const defaultBlock = { content: '', image_urls: [] }
  if (!task) return [defaultBlock]
  
  const raw = task.content_blocks
  if (raw != null) {
    let parsed = raw
    if (typeof raw === 'string') {
      try {
        parsed = JSON.parse(raw)
      } catch {
        parsed = []
      }
    }
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map(b => {
        // Hỗ trợ cả image_urls (mảng) và image_url (chuỗi cũ)
        let urls = []
        if (Array.isArray(b?.image_urls)) {
          urls = b.image_urls
        } else if (typeof b?.image_url === 'string' && b.image_url.trim()) {
          urls = [b.image_url.trim()]
        }
        
        return {
          content: typeof b?.content === 'string' ? b.content : '',
          image_urls: urls,
        }
      })
    }
  }

  // Fallback cho dữ liệu cột cũ description/image_url
  const c = typeof task.description === 'string' ? task.description : ''
  const u = typeof task.image_url === 'string' ? task.image_url : ''
  if (c.trim() || u.trim()) {
    return [{ content: c, image_urls: u.trim() ? [u.trim()] : [] }]
  }
  
  return [defaultBlock]
}

/**
 * Chuẩn bị payload lưu DB: lọc khối rỗng, đồng bộ description / image_url (cột cũ).
 * @param {TaskContentBlock[]} content_blocks
 */
export function sanitizeTaskContentForSave(content_blocks) {
  if (!Array.isArray(content_blocks)) {
    return { content_blocks: [], description: null, image_url: null }
  }
  
  const blocks = content_blocks
    .map(b => ({
      content: (b?.content ?? '').trim(),
      image_urls: Array.isArray(b?.image_urls) ? b.image_urls.map(u => u.trim()).filter(Boolean) : [],
    }))
    .filter(b => b.content || b.image_urls.length > 0)

  // Lấy tất cả ảnh từ tất cả các khối để đồng bộ vào cột image_url cũ (dùng ảnh đầu tiên)
  const allImages = blocks.flatMap(b => b.image_urls)
  
  return {
    content_blocks: blocks,
    description: blocks.length ? blocks.map(b => b.content).filter(Boolean).join('\n\n') || null : null,
    image_url: allImages[0] || null,
  }
}

/**
 * @param {object} task
 */
export function taskFormInitial(task) {
  return {
    ...task,
    content_blocks: normalizeTaskContentBlocks(task),
  }
}

/**
 * @param {object} subtask
 */
export function subtaskFormInitial(subtask) {
  return {
    ...subtask,
    content_blocks: normalizeTaskContentBlocks(subtask),
  }
}
