import { useEffect } from 'react'

export default function Toast({ message, type = 'error', onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000)
    return () => clearTimeout(timer)
  }, [onClose])

  if (!message) return null

  const isError = type === 'error'

  return (
    <div className="fixed top-6 right-6 z-[200] animate-in slide-in-from-right-full duration-300">
      <div className={`px-5 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border min-w-[320px] 
        ${isError 
          ? 'bg-[#fff5f5] border-[#ffdad6] text-[#ba1a1a]' 
          : 'bg-[#f0f9ff] border-[#b9e6fe] text-[#006591]'
        }`}>
        <span className="material-symbols-outlined">
          {isError ? 'error' : 'check_circle'}
        </span>
        <div className="flex-1">
          <p className={`text-xs font-semibold mb-0.5 ${isError ? 'text-[#ba1a1a]' : 'text-[#006591]'}`}>
            {isError ? 'Lỗi' : 'Thành công'}
          </p>
          <p className="text-sm font-medium">{message}</p>
        </div>
        <button onClick={onClose} className="hover:opacity-70 transition-opacity">
          <span className="material-symbols-outlined text-sm">close</span>
        </button>
      </div>
    </div>
  )
}
