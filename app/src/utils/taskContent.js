/** @typedef {{ content: string, image_url: string }} TaskContentBlock */

/**
 * Chuẩn hóa dữ liệu task thành mảng các khối { content, image_url } cho form.
 * Hỗ trợ dữ liệu cũ: description + image_url đơn.
 * @param {object|null|undefined} task
 * @returns {TaskContentBlock[]}
 */
export function normalizeTaskContentBlocks(task) {
  if (!task) return [{ content: '', image_url: '' }]
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
      return parsed.map(b => ({
        content: typeof b?.content === 'string' ? b.content : '',
        image_url: typeof b?.image_url === 'string' ? b.image_url : '',
      }))
    }
  }
  const c = typeof task.description === 'string' ? task.description : ''
  const u = typeof task.image_url === 'string' ? task.image_url : ''
  if (c.trim() || u.trim()) return [{ content: c, image_url: u }]
  return [{ content: '', image_url: '' }]
}

/**
 * Chuẩn bị payload lưu DB: lọc khối rỗng, đồng bộ description / image_url (cột cũ).
 * @param {unknown} content_blocks
 */
export function sanitizeTaskContentForSave(content_blocks) {
  if (!Array.isArray(content_blocks)) {
    return { content_blocks: [], description: null, image_url: null }
  }
  const blocks = content_blocks
    .map(b => ({
      content: (b?.content ?? '').trim(),
      image_url: (b?.image_url ?? '').trim(),
    }))
    .filter(b => b.content || b.image_url)
  return {
    content_blocks: blocks,
    description: blocks.length ? blocks.map(b => b.content).filter(Boolean).join('\n\n') || null : null,
    image_url: blocks[0]?.image_url || null,
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
