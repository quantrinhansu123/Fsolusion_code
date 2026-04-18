import { useEffect } from 'react'

export default function Modal({ title, subtitle, onClose, children, footer }) {
  // Close on Escape key
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#131b2e]/40 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white w-full max-w-lg rounded-[20px] shadow-[0_32px_64px_rgba(19,27,46,0.14)] border border-[#bec8d2]/20 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-8 pt-8 pb-5 flex justify-between items-start">
          <div>
            <h3 className="text-2xl font-bold text-[#131b2e] tracking-tight">{title}</h3>
            {subtitle && <p className="text-sm text-[#3e4850] mt-1">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="text-[#6e7881] hover:text-[#131b2e] transition-colors p-2 -mr-2 -mt-2 rounded-full hover:bg-[#eaedff]/60"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="px-8 py-2 space-y-5 flex-grow overflow-y-auto max-h-[60vh]">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-8 pb-8 pt-6 flex justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
