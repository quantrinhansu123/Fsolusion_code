import { useEffect } from 'react'

const DEFAULT_OVERLAY =
  'fixed inset-0 z-50 flex items-center justify-center bg-[#131b2e]/40 backdrop-blur-sm p-4'

export default function Modal({
  title,
  subtitle,
  /** Thay block tiêu đề mặc định (breadcrumb + tiêu đề tùy chỉnh) */
  headerChildren,
  onClose,
  children,
  footer,
  /** Tailwind cho hàng footer (mặc định chỉ căn phải) */
  footerClassName,
  maxWidthClassName = 'max-w-lg',
  bodyClassName,
  headerActions,
  overlayClassName,
}) {
  const bodyCls =
    bodyClassName ??
    'px-8 py-2 space-y-5 flex-grow overflow-y-auto max-h-[60vh]'
  // Close on Escape key
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className={overlayClassName ?? DEFAULT_OVERLAY}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className={`bg-white w-full ${maxWidthClassName} max-h-[90vh] rounded-[20px] shadow-[0_32px_64px_rgba(19,27,46,0.14)] border border-[#bec8d2]/20 overflow-hidden flex flex-col`}
      >
        {/* Header */}
        <div className="px-[18px] pt-3 pb-3 sm:px-6 flex flex-col-reverse lg:flex-row lg:justify-between lg:items-start gap-2 border-b border-[#e2e8f0]">
          {headerChildren ? (
            <div className="min-w-0 flex-1">{headerChildren}</div>
          ) : (
            <div className="min-w-0 flex-1">
              {title ? (
                <h3 className="text-[16px] lg:text-2xl font-bold text-[#131b2e] tracking-tight leading-tight">{title}</h3>
              ) : null}
              {subtitle ? <p className="text-sm text-[#3e4850] mt-1 hidden lg:block">{subtitle}</p> : null}
            </div>
          )}
          <div className="flex items-start gap-2 shrink-0 justify-between lg:justify-start">
            {headerActions}
            <button
              type="button"
              onClick={onClose}
              className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-md text-[#64748b] transition-colors hover:bg-[#f1f5f9] hover:text-[#131b2e]"
              aria-label="Đóng"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className={bodyCls}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div
            className={`border-t border-[#e2e8f0] px-[18px] py-3 sm:px-6 flex flex-wrap items-center gap-3 ${footerClassName ?? 'justify-end'}`}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
