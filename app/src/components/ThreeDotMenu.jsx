import { useState, useRef, useEffect } from 'react'

export default function ThreeDotMenu({ items, dropUp = false }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div
      className="relative"
      ref={ref}
      onMouseDown={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={e => { e.stopPropagation(); setOpen(v => !v) }}
        className="text-[#3e4850] hover:text-[#131b2e] p-1 rounded-md hover:bg-[#eaedff] transition-colors"
      >
        <span className="material-symbols-outlined text-xl">more_vert</span>
      </button>

      {open && (
        <div className={`absolute right-0 w-48 bg-white rounded-xl shadow-[0_8px_32px_rgba(19,27,46,0.15)] border border-[#bec8d2]/20 py-2 z-[100] ${dropUp ? 'bottom-8' : 'top-8'}`}>
          {items.map((item, i) => (
            <button
              type="button"
              key={i}
              onClick={e => { e.stopPropagation(); setOpen(false); item.onClick() }}
              className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition-colors
                ${item.danger
                  ? 'text-[#ba1a1a] hover:bg-[#ffdad6]'
                  : item.primary
                    ? 'text-[#006591] hover:bg-[#f2f3ff] font-medium'
                    : 'text-[#131b2e] hover:bg-[#f2f3ff]'
                }`}
            >
              <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
