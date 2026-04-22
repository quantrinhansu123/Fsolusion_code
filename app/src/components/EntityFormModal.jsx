import { useState, useEffect } from 'react'
import Modal from './Modal'
import { deadlineToFormValue } from '../utils/deadline'
import { imageFileToDataUrl, getImageFromClipboardEvent, getImageFromDataTransfer } from '../utils/imagePaste'

export const STATUS_OPTIONS = [
  { value: 'pending',     label: 'Đang chờ' },
  { value: 'in_progress', label: 'Đang làm' },
  { value: 'completed',   label: 'Hoàn thành' },
  { value: 'overdue',     label: 'Trễ hẹn' },
]

function FormField({ label, children }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-bold text-[#131b2e] tracking-wide uppercase">{label}</label>
      {children}
    </div>
  )
}

const formatCurrency = (val) => {
  if (val === undefined || val === null) return ''
  const num = val.toString().replace(/\D/g, '')
  return num.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

const toDMY = (dateStr) => {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  if (!y || !m || !d) return dateStr
  return `${d}/${m}/${y}`
}

const fromDMY = (dmy) => {
  if (!dmy) return ''
  const parts = dmy.split('/')
  if (parts.length === 3) {
    const [d, m, y] = parts
    if (d.length === 2 && m.length === 2 && y.length === 4) {
      return `${y}-${m}-${d}`
    }
  }
  return dmy
}

const inputCls =
  'w-full bg-[#faf8ff] border border-[#bec8d2]/40 rounded-xl px-4 py-3 text-sm text-[#131b2e] placeholder:text-[#6e7881] focus:border-[#006591] focus:ring-1 focus:ring-[#006591] focus:outline-none transition-shadow'

function DateInput({ value, onChange }) {
  const [display, setDisplay] = useState(toDMY(value))

  // Sync internal state when prop changes (from picker)
  useEffect(() => {
    setDisplay(toDMY(value))
  }, [value])

  const handleChange = (e) => {
    let val = e.target.value
    
    // Simple mask logic: 12/34/5678
    if (val.length > display.length) {
      if (val.length === 2 || val.length === 5) val += '/'
    }
    
    if (val.length <= 10) {
      setDisplay(val)
      if (val.length === 10) {
        const internal = fromDMY(val)
        if (internal.length === 10 && !internal.includes('undefined')) {
          onChange(internal)
        }
      }
    }
  }

  return (
    <div className="relative">
      <input
        type="text"
        className={`${inputCls} pr-10`}
        placeholder="dd/mm/yyyy"
        value={display}
        onChange={handleChange}
      />
      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
        <span className="material-symbols-outlined text-[#6e7881] text-[20px] pointer-events-none">calendar_month</span>
        <input
          type="date"
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          value={value || ''}
          onChange={e => onChange(e.target.value)}
        />
      </div>
    </div>
  )
}

function DateTimeInput({ value, onChange }) {
  const display = deadlineToFormValue(value ?? '')
  return (
    <input
      type="datetime-local"
      step={60}
      className={inputCls}
      value={display}
      onChange={e => onChange(e.target.value)}
    />
  )
}

// SearchableSelect cho trường khách hàng với khả năng tìm kiếm
function SearchableSelect({ value, options = [], onChange, placeholder = '-- Chọn --' }) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)

  const filtered = search.trim()
    ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : options

  const selectedLabel = options.find(o => o.value === value)?.label || ''

  return (
    <div className="relative">
      <input
        type="text"
        className={`${inputCls} cursor-pointer`}
        placeholder={placeholder}
        value={open ? search : selectedLabel}
        onChange={e => setSearch(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
      />
      <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-[#6e7881] pointer-events-none">
        {open ? 'expand_less' : 'expand_more'}
      </span>
      
      {open && (
        <div className="absolute top-full left-0 right-0 z-50 mt-2 rounded-xl border border-[#bec8d2]/30 bg-white shadow-lg max-h-72 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-4 py-3 text-sm text-[#6e7881] text-center">Không tìm thấy kết quả</div>
          ) : (
            <ul className="divide-y divide-[#bec8d2]/10">
              {filtered.map(o => (
                <li key={o.value}>
                  <button
                    type="button"
                    className="w-full text-left px-4 py-2.5 text-sm text-[#131b2e] hover:bg-[#f2f3ff] transition-colors"
                    onClick={() => {
                      onChange(o.value)
                      setSearch('')
                      setOpen(false)
                    }}
                  >
                    {o.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

// Generic entity form (project / feature / task / subtask / customer)
export function EntityFormModal({ title, subtitle, fields, data, onChange, onSave, onClose, saveLabel = 'Lưu', isLoading = false }) {
  return (
    <Modal
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} disabled={isLoading} className="px-6 py-2.5 rounded-xl text-sm font-medium text-[#006591] hover:bg-[#f2f3ff] transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            Hủy
          </button>
          <button 
            onClick={onSave} 
            disabled={isLoading}
            className={`px-6 py-2.5 rounded-xl text-sm font-medium text-white shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 ${
              isLoading ? 'bg-slate-400 cursor-not-allowed opacity-80' : 'primary-gradient hover:brightness-110'
            }`}
          >
            {isLoading && (
              <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
            )}
            {isLoading ? 'Đang lưu...' : saveLabel}
          </button>
        </>
      }
    >
      {fields.map(field => {
        if (field.type === 'textarea') {
          return (
            <FormField key={field.name} label={field.label}>
              <textarea
                rows={3}
                className={`${inputCls} resize-none`}
                placeholder={field.placeholder}
                value={data[field.name] || ''}
                onChange={e => onChange(field.name, e.target.value)}
              />
            </FormField>
          )
        }
        if (field.type === 'select') {
          return (
            <FormField key={field.name} label={field.label}>
              <div className="relative">
                <select
                  className={`${inputCls} appearance-none pr-10`}
                  value={data[field.name] || ''}
                  onChange={e => onChange(field.name, e.target.value)}
                >
                  <option value="">-- Chọn --</option>
                  {(field.options || STATUS_OPTIONS).map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-[#6e7881] pointer-events-none">expand_more</span>
              </div>
            </FormField>
          )
        }
        if (field.type === 'searchable_select') {
          return (
            <FormField key={field.name} label={field.label}>
              <SearchableSelect
                value={data[field.name] || ''}
                options={field.options || []}
                onChange={val => onChange(field.name, val)}
                placeholder="-- Chọn --"
              />
            </FormField>
          )
        }
        if (field.type === 'content_image_pairs') {
          const key = field.name
          let blocks = Array.isArray(data[key]) && data[key].length > 0
            ? data[key]
            : [{ content: '', image_url: '' }]
          const setBlocks = next => onChange(key, next)
          const updateRow = (i, patch) => {
            setBlocks(blocks.map((b, j) => (j === i ? { ...b, ...patch } : b)))
          }
          const removeRow = i => {
            if (blocks.length <= 1) return
            setBlocks(blocks.filter((_, j) => j !== i))
          }
          const addRow = () => setBlocks([...blocks, { content: '', image_url: '' }])
          return (
            <FormField key={key} label={field.label}>
              <div className="space-y-3">
                {blocks.map((block, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-[#bec8d2]/30 bg-[#faf8ff]/60 p-3 space-y-2"
                    onPasteCapture={async ev => {
                      const file = getImageFromClipboardEvent(ev)
                      if (!file) return
                      ev.preventDefault()
                      ev.stopPropagation()
                      const url = await imageFileToDataUrl(file)
                      if (url) updateRow(i, { image_url: url })
                    }}
                    onDragOver={ev => {
                      ev.preventDefault()
                      ev.stopPropagation()
                    }}
                    onDrop={async ev => {
                      ev.preventDefault()
                      ev.stopPropagation()
                      const file = getImageFromDataTransfer(ev.dataTransfer)
                      if (!file) return
                      const url = await imageFileToDataUrl(file)
                      if (url) updateRow(i, { image_url: url })
                    }}
                  >
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-[10px] font-bold text-[#3e4850] uppercase tracking-wide">
                        Dòng {i + 1}
                      </span>
                      {blocks.length > 1 && (
                        <button
                          type="button"
                          className="text-[11px] text-[#ba1a1a] font-medium hover:underline"
                          onClick={() => removeRow(i)}
                        >
                          Xóa dòng
                        </button>
                      )}
                    </div>
                    <div className="flex flex-col lg:flex-row gap-3 lg:gap-4 items-stretch">
                      <div className="space-y-1 flex-1 min-w-0">
                        <span className="block text-[10px] font-bold text-[#3e4850] uppercase tracking-wide">
                          Nội dung
                        </span>
                        <textarea
                          rows={3}
                          className={`${inputCls} resize-y min-h-[64px]`}
                          placeholder={field.placeholderContent || 'Nhập nội dung...'}
                          value={block.content}
                          onChange={e => updateRow(i, { content: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1.5 w-full lg:w-[min(280px,36%)] lg:max-w-[280px] shrink-0">
                        <span className="block text-[10px] font-bold text-[#3e4850] uppercase tracking-wide">
                          Ảnh
                        </span>
                        <div
                          tabIndex={0}
                          className="w-full rounded-xl border border-dashed border-[#bec8d2]/70 bg-white px-2 py-2 min-h-[112px] flex flex-col focus:outline-none focus:ring-2 focus:ring-[#006591]/25 text-sm text-[#131b2e]"
                        >
                          {block.image_url ? (
                            <div className="relative rounded-lg overflow-hidden bg-[#f0f0f5] flex-1 flex items-center justify-center min-h-[96px]">
                              <img
                                src={block.image_url}
                                alt=""
                                className="max-h-44 w-full object-contain"
                                onError={e => {
                                  e.currentTarget.style.display = 'none'
                                }}
                              />
                              <button
                                type="button"
                                title="Xóa ảnh"
                                className="absolute top-1.5 right-1.5 rounded-full bg-[#131b2e]/75 text-white p-1 hover:bg-[#131b2e] shadow-sm"
                                onClick={() => updateRow(i, { image_url: '' })}
                              >
                                <span className="material-symbols-outlined text-[18px] leading-none block">close</span>
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-1 flex-col items-center justify-center gap-1 py-5 text-center text-[11px] text-[#6e7881] pointer-events-none select-none">
                              <span className="material-symbols-outlined text-3xl text-[#bec8d2]">content_paste</span>
                              <span>
                                <strong className="text-[#131b2e]">Ctrl+V</strong> hoặc kéo thả ảnh vào dòng này
                              </span>
                              <span className="text-[10px] text-[#9aa3ab]">Ảnh hiện ngay và lưu kèm nhiệm vụ</span>
                            </div>
                          )}
                        </div>
                        {!block.image_url?.startsWith('data:') && (
                          <input
                            type="url"
                            className={`${inputCls} text-xs py-2.5`}
                            placeholder="Hoặc nhập link ảnh https://..."
                            value={block.image_url || ''}
                            onChange={e => updateRow(i, { image_url: e.target.value })}
                          />
                        )}
                        {block.image_url?.startsWith('data:') && (
                          <p className="text-[10px] text-[#3e4850] leading-snug">
                            Ảnh đã nhúng (JPEG).{' '}
                            <button
                              type="button"
                              className="font-semibold text-[#006591] hover:underline"
                              onClick={() => updateRow(i, { image_url: '' })}
                            >
                              Xóa để dùng link
                            </button>
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addRow}
                  className="w-full text-sm font-semibold text-[#006591] border border-dashed border-[#006591]/45 rounded-xl px-4 py-2.5 hover:bg-[#f2f3ff] transition-colors"
                >
                  + Thêm dòng (nội dung + link ảnh)
                </button>
              </div>
            </FormField>
          )
        }
        if (field.type === 'grid') {
          const gridCols = field.gridCols ?? 'grid-cols-1 sm:grid-cols-2'
          return (
            <div key={field.name} className={`grid ${gridCols} gap-4`}>
              {field.children.map(child => (
                <FormField key={child.name} label={child.label}>
                  {child.type === 'select' ? (
                    <div className="relative">
                      <select
                        className={`${inputCls} appearance-none pr-10`}
                        value={data[child.name] || ''}
                        onChange={e => onChange(child.name, e.target.value)}
                      >
                        <option value="">-- Chọn --</option>
                        {(child.options || STATUS_OPTIONS).map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                      <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-[#6e7881] pointer-events-none">expand_more</span>
                    </div>
                  ) : child.type === 'textarea' ? (
                    <textarea
                      rows={child.rows || 4}
                      className={`${inputCls} resize-y min-h-[72px]`}
                      placeholder={child.placeholder}
                      value={data[child.name] || ''}
                      onChange={e => onChange(child.name, e.target.value)}
                    />
                  ) : child.type === 'datetime-local' ? (
                    <DateTimeInput
                      value={data[child.name]}
                      onChange={val => onChange(child.name, val)}
                    />
                  ) : child.type === 'date' ? (
                    <DateInput
                      value={data[child.name]}
                      onChange={val => onChange(child.name, val)}
                    />
                  ) : (
                    <input
                      type={child.type || 'text'}
                      className={inputCls}
                      placeholder={child.placeholder}
                      value={data[child.name] || ''}
                      onChange={e => onChange(child.name, e.target.value)}
                    />
                  )}
                </FormField>
              ))}
            </div>
          )
        }
        return (
          <FormField key={field.name} label={field.label}>
            <input
              type={field.type || 'text'}
              className={inputCls}
              placeholder={field.placeholder}
              value={field.name === 'pricing' ? formatCurrency(data[field.name]) : (data[field.name] || '')}
              onChange={e => {
                const val = field.name === 'pricing' ? e.target.value.replace(/\D/g, '') : e.target.value
                onChange(field.name, val)
              }}
            />
          </FormField>
        )
      })}
    </Modal>
  )
}

// Pre-configured forms for each entity
export const CUSTOMER_FIELDS = [
  { name: 'name',    label: 'Tên khách hàng', placeholder: 'VD: Công ty ABC' },
  { name: 'email',   label: 'Liên hệ', type: 'text', placeholder: 'SĐT, Zalo…' },
  { name: 'phone',   label: 'Số điện thoại', placeholder: '090 xxx xxxx' },
  { name: 'address', label: 'Địa chỉ', type: 'textarea', placeholder: 'Địa chỉ đầy đủ...' },
]

export const PROJECT_FIELDS = [
  { name: 'customer_id', label: 'Khách hàng', type: 'searchable_select' },
  { name: 'name',        label: 'Tên dự án', placeholder: 'VD: CRM System Revamp' },
  { name: 'description', label: 'Mô tả', type: 'textarea', placeholder: 'Mục tiêu và phạm vi dự án...' },
  {
    name: 'meta', type: 'grid', children: [
      { name: 'pricing',     label: 'Ngân sách (₫)', type: 'text', placeholder: '0' },
      { name: 'deadline',    label: 'Hạn chót (ngày & giờ)', type: 'datetime-local' },
    ]
  },
  { name: 'status', label: 'Trạng thái', type: 'select' },
]

export const FEATURE_FIELDS = [
  { name: 'name',        label: 'Tên tính năng', placeholder: 'VD: Tích hợp thanh toán' },
  { name: 'description', label: 'Mô tả', type: 'textarea', placeholder: 'Chi tiết yêu cầu...' },
  {
    name: 'meta', type: 'grid', children: [
      { name: 'deadline', label: 'Hạn chót (ngày & giờ)', type: 'datetime-local' },
      { name: 'status',   label: 'Trạng thái', type: 'select', options: STATUS_OPTIONS },
    ]
  },
]

export const TASK_FIELDS = [
  { name: 'name',        label: 'Tên task', placeholder: 'VD: Design UI mockups' },
  { name: 'assigned_to', label: 'Người phụ trách', type: 'select' },
  {
    name: 'content_blocks',
    label: 'Nội dung & ảnh',
    type: 'content_image_pairs',
    placeholderContent: 'Chi tiết công việc...',
  },
  {
    name: 'meta', type: 'grid', children: [
      { name: 'deadline', label: 'Hạn chót (ngày & giờ)', type: 'datetime-local' },
      { name: 'status',   label: 'Trạng thái', type: 'select', options: STATUS_OPTIONS },
    ]
  },
]

export const SUBTASK_FIELDS = [
  { name: 'name',        label: 'Tên tiểu mục', placeholder: 'VD: Line chart widget' },
  { name: 'assigned_to', label: 'Người phụ trách', type: 'select' },
  {
    name: 'content_blocks',
    label: 'Nội dung & ảnh',
    type: 'content_image_pairs',
    placeholderContent: 'Chi tiết tiểu mục...',
  },
  {
    name: 'meta', type: 'grid', children: [
      { name: 'deadline', label: 'Hạn chót (ngày & giờ)', type: 'datetime-local' },
      { name: 'status',   label: 'Trạng thái', type: 'select', options: STATUS_OPTIONS },
    ]
  },
]
