import React from 'react'
import Modal from './Modal'

export default function ConfirmModal({ isOpen, onClose, onConfirm, title, message, confirmText = 'Xác nhận xóa', cancelText = 'Quay lại', type = 'danger' }) {
  if (!isOpen) return null

  return (
    <Modal 
      onClose={onClose} 
      title={title || "Xác nhận hành động"}
      maxWidthClassName="max-w-sm"
    >
      <div className="p-1 pb-4 text-center">
        <div className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full ${type === 'danger' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
          <span className="material-symbols-outlined text-[28px]">
            {type === 'danger' ? 'delete_forever' : 'warning'}
          </span>
        </div>
        <h4 className="text-sm font-bold text-[#131b2e] mb-2">{message || "Sếp có chắc chắn muốn thực hiện hành động này không?"}</h4>
        <p className="text-[11px] text-slate-500 leading-relaxed px-4">
          Hành động này không thể hoàn tác. Vui lòng kiểm tra kỹ trước khi xác nhận.
        </p>

        <div className="mt-6 flex flex-col sm:flex-row gap-2 px-4">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-slate-200 py-2 text-[12px] font-bold text-slate-500 hover:bg-slate-50 transition-all"
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm()
              onClose()
            }}
            className={`flex-1 rounded-lg py-2 text-[12px] font-bold text-white transition-all shadow-sm active:scale-95 ${
              type === 'danger' ? 'bg-red-500 hover:bg-red-600' : 'bg-amber-500 hover:bg-amber-600'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  )
}
