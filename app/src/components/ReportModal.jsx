import React, { useState, useRef, useEffect } from 'react'
import Modal from './Modal'
import { supabase } from '../utils/supabase'

export default function ReportModal({ open, onClose, task, sessionId, onSave }) {
  const [content, setContent] = useState('')
  const [percent, setPercent] = useState(0)
  const [newImages, setNewImages] = useState([])
  const [previewUrls, setPreviewUrls] = useState([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const fileRef = useRef()

  useEffect(() => {
    if (task) {
      setContent(task.report_content || '')
      setPercent(task.percent ?? 0)
      setNewImages([])
      setPreviewUrls([])
      setError(null)
    }
  }, [task])

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files)
    setNewImages(files)
    setPreviewUrls(files.map(f => URL.createObjectURL(f)))
  }

  const handleRemoveNewImage = (idx) => {
    URL.revokeObjectURL(previewUrls[idx])
    setNewImages(prev => prev.filter((_, i) => i !== idx))
    setPreviewUrls(prev => prev.filter((_, i) => i !== idx))
  }

  const handleSave = async () => {
    if (!content.trim()) {
      setError('Vui lòng nhập nội dung báo cáo.')
      return
    }
    setUploading(true)
    setError(null)
    try {
      const existingUrls = task?.report_images || []
      const newUrls = []

      for (const file of newImages) {
        const ext = file.name.split('.').pop()
        const path = `${sessionId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('attendance-reports')
          .upload(path, file)
        if (uploadError) throw uploadError
        const { data: { publicUrl } } = supabase.storage
          .from('attendance-reports')
          .getPublicUrl(path)
        newUrls.push(publicUrl)
      }

      await onSave({
        subtask_id: task.subtask_id,
        report_content: content.trim(),
        report_images: [...existingUrls, ...newUrls],
        percent,
        status: 'pending_approval',
        reported_at: new Date().toISOString(),
      })
    } catch (err) {
      console.error(err)
      setError(err.message || 'Lỗi khi gửi báo cáo.')
    } finally {
      setUploading(false)
    }
  }

  if (!open || !task) return null

  const existingImages = task.report_images || []
  const isRejected = task.status === 'rejected'

  return (
    <Modal
      title={isRejected ? 'Cập nhật báo cáo' : 'Gửi báo cáo công việc'}
      subtitle={task.title}
      onClose={onClose}
      maxWidthClassName="max-w-lg"
      bodyClassName="px-6 py-4 space-y-4 flex-grow overflow-y-auto max-h-[65vh]"
      footer={
        <div className="flex gap-3 w-full">
          <button type="button" onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-all">
            Hủy
          </button>
          <button type="button" onClick={handleSave} disabled={uploading}
            className="flex-1 px-6 py-2.5 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-100">
            {uploading
              ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <span className="material-symbols-outlined text-[16px]">send</span>}
            GỬI BÁO CÁO
          </button>
        </div>
      }
    >
      {/* Rejected reason banner */}
      {isRejected && task.comment && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex gap-2">
          <span className="material-symbols-outlined text-red-500 text-[16px] shrink-0 mt-0.5">error_outline</span>
          <div>
            <p className="text-[11px] font-bold text-red-700 uppercase tracking-wider mb-0.5">Lý do từ chối</p>
            <p className="text-[12px] text-red-600">{task.comment}</p>
          </div>
        </div>
      )}

      {/* Content textarea */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
          Nội dung báo cáo <span className="text-red-500">*</span>
        </label>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Mô tả chi tiết công việc đã thực hiện..."
          rows={5}
          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-[13px] resize-none text-slate-700"
        />
      </div>

      {/* Percent slider */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Tiến độ hoàn thành</label>
          <span className="text-[16px] font-black text-blue-600">{percent}%</span>
        </div>
        <div className="relative">
          <input type="range" min="0" max="100" step="5" value={percent}
            onChange={e => setPercent(Number(e.target.value))}
            className="w-full h-2 bg-slate-200 rounded-full appearance-none cursor-pointer accent-blue-600" />
        </div>
        <div className="grid grid-cols-5 gap-1.5">
          {[0, 25, 50, 75, 100].map(p => (
            <button key={p} type="button" onClick={() => setPercent(p)}
              className={`h-8 rounded-lg border font-bold text-[11px] transition-all active:scale-95 ${percent === p
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-200'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}>
              {p}%
            </button>
          ))}
        </div>
      </div>

      {/* Image section */}
      <div className="space-y-2">
        <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Hình ảnh đính kèm</label>

        {existingImages.length > 0 && (
          <div>
            <p className="text-[10px] text-slate-400 mb-1.5">Ảnh đã tải lên</p>
            <div className="grid grid-cols-3 gap-2">
              {existingImages.map((url, idx) => (
                <a key={idx} href={url} target="_blank" rel="noreferrer"
                  className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 bg-slate-50 block">
                  <img src={url} alt={`ảnh ${idx + 1}`} className="w-full h-full object-cover" />
                </a>
              ))}
            </div>
          </div>
        )}

        {previewUrls.length > 0 && (
          <div>
            <p className="text-[10px] text-blue-500 mb-1.5">Ảnh mới sẽ tải lên</p>
            <div className="grid grid-cols-3 gap-2">
              {previewUrls.map((url, idx) => (
                <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border-2 border-blue-300 bg-slate-50">
                  <img src={url} alt={`preview ${idx + 1}`} className="w-full h-full object-cover" />
                  <button type="button" onClick={() => handleRemoveNewImage(idx)}
                    className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors">
                    <span className="material-symbols-outlined text-[12px]">close</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <button type="button" onClick={() => fileRef.current?.click()}
          className="w-full h-10 border-2 border-dashed border-slate-300 rounded-xl flex items-center justify-center gap-2 text-slate-500 hover:border-blue-400 hover:text-blue-600 transition-colors text-[12px] font-bold">
          <span className="material-symbols-outlined text-[18px]">add_photo_alternate</span>
          Chọn ảnh
        </button>
        <input ref={fileRef} type="file" multiple accept="image/*"
          className="hidden" onChange={handleFileChange} />
      </div>

      {error && (
        <p className="text-red-500 text-[12px] font-medium bg-red-50 p-2 rounded-lg border border-red-100">
          {error}
        </p>
      )}
    </Modal>
  )
}
