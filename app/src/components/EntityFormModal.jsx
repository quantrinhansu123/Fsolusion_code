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
        <div className="absolute top-full left-0 right-0 z-[60] mt-1.5 rounded-xl border border-[#bec8d2]/30 bg-white shadow-xl max-h-60 overflow-y-auto py-1 animate-in fade-in slide-in-from-top-1 duration-200">
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-slate-400 italic">
              Không tìm thấy khách hàng...
            </div>
          ) : (
            <ul>
              {filtered.map(o => (
                <li key={o.value}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      // Dùng onMouseDown để chạy trước onBlur của input
                      e.preventDefault();
                      onChange(o.value);
                      setSearch('');
                      setOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between group ${
                      value === o.value ? 'bg-[#f2f3ff] text-[#006591] font-bold' : 'text-[#131b2e] hover:bg-slate-50'
                    }`}
                  >
                    <span className="truncate">{o.label}</span>
                    {value === o.value && (
                      <span className="material-symbols-outlined text-[18px] text-[#006591]">check</span>
                    )}
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
      maxWidthClassName="max-w-[95vw] lg:max-w-[70vw]"
      overlayClassName="fixed inset-0 z-50 flex items-center justify-center bg-[#131b2e]/40 backdrop-blur-sm p-3 sm:p-4"
      bodyClassName="px-4 sm:px-6 py-5 sm:py-6 space-y-5 flex-grow overflow-y-auto max-h-[60vh]"
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
            ? data[key].map(b => ({
                ...b,
                image_urls: Array.isArray(b.image_urls) 
                  ? b.image_urls 
                  : (b.image_url ? [b.image_url] : [])
              }))
            : [{ content: '', image_urls: [] }]
          const setBlocks = next => onChange(key, next)
          const updateRow = (i, patch) => {
            setBlocks(blocks.map((b, j) => (j === i ? { ...b, ...patch } : b)))
          }
          const removeRow = i => {
            if (blocks.length <= 1) return
            setBlocks(blocks.filter((_, j) => j !== i))
          }
          const addRow = (initialData = { content: '', image_urls: [] }) => setBlocks([...blocks, initialData])

          const handleFiles = async (files, currentIndex) => {
            if (!files || files.length === 0) return
            const fileList = Array.from(files).filter(f => f.type.startsWith('image/'))
            if (fileList.length === 0) return

            const newUrls = []
            for (const file of fileList) {
              const url = await imageFileToDataUrl(file)
              if (url) newUrls.push(url)
            }
            
            const currentBlock = blocks[currentIndex]
            const existingUrls = Array.isArray(currentBlock.image_urls) ? currentBlock.image_urls : []
            
            updateRow(currentIndex, { 
              image_urls: [...existingUrls, ...newUrls] 
            })
          }
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
                      handleFiles([file], i)
                    }}
                    onDragOver={ev => {
                      ev.preventDefault()
                      ev.stopPropagation()
                    }}
                    onDrop={async ev => {
                      ev.preventDefault()
                      ev.stopPropagation()
                      handleFiles(ev.dataTransfer.files, i)
                    }}
                  >
                    <input
                      type="file"
                      id={`file-input-${i}`}
                      className="hidden"
                      accept="image/*"
                      multiple
                      onChange={e => handleFiles(e.target.files, i)}
                    />
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
                          rows={4}
                          className={`${inputCls} resize-y min-h-[96px]`}
                          placeholder={field.placeholderContent || 'Nhập nội dung...'}
                          value={block.content}
                          onChange={e => updateRow(i, { content: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1.5 w-full lg:w-[min(340px,45%)] shrink-0">
                        <span className="block text-[10px] font-bold text-[#3e4850] uppercase tracking-wide">
                          Ảnh
                        </span>
                        
                        <div
                          tabIndex={0}
                          className="w-full rounded-xl border border-dashed border-[#bec8d2]/70 bg-white p-2 min-h-[120px] flex flex-col focus:outline-none focus:ring-2 focus:ring-[#006591]/25 text-sm text-[#131b2e] cursor-pointer hover:bg-slate-50 transition-colors"
                          onClick={() => document.getElementById(`file-input-${i}`)?.click()}
                        >
                          {/* GALLERY VIEW INSIDE THE BOX */}
                          {(block.image_urls || []).length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {(block.image_urls || []).map((url, imgIdx) => (
                                <div key={imgIdx} className="group relative w-20 h-20 rounded-lg overflow-hidden bg-[#f0f0f5] border border-[#bec8d2]/20">
                                  <img
                                    src={url}
                                    alt=""
                                    className="h-full w-full object-cover"
                                  />
                                  <button
                                    type="button"
                                    title="Xóa ảnh"
                                    className="absolute top-0.5 right-0.5 h-5 w-5 rounded-full bg-[#131b2e]/80 text-white flex items-center justify-center hover:bg-[#131b2e] transition-colors"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      const nextUrls = block.image_urls.filter((_, k) => k !== imgIdx)
                                      updateRow(i, { image_urls: nextUrls })
                                    }}
                                  >
                                    <span className="material-symbols-outlined text-[14px]">close</span>
                                  </button>
                                </div>
                              ))}
                              {/* Small 'Add' placeholder inside the list */}
                              <div className="w-20 h-20 rounded-lg border border-dashed border-[#bec8d2]/50 flex flex-col items-center justify-center text-[#6e7881] hover:bg-white transition-colors">
                                <span className="material-symbols-outlined text-[20px]">add</span>
                                <span className="text-[8px] font-bold uppercase">Thêm</span>
                              </div>
                            </div>
                          ) : (
                            /* EMPTY STATE: LARGE INSTRUCTIONS */
                            <div className="flex flex-1 flex-col items-center justify-center gap-1 py-6 text-center text-[11px] text-[#6e7881] select-none pointer-events-none">
                              <span className="material-symbols-outlined text-3xl text-[#bec8d2]">add_photo_alternate</span>
                              <span>
                                <strong className="text-[#131b2e]">Click để chọn</strong>, kéo thả hoặc <strong className="text-[#131b2e]">Ctrl+V</strong>
                              </span>
                              <span className="text-[10px] text-[#9aa3ab]">Có thể chọn nhiều ảnh cùng lúc</span>
                            </div>
                          )}
                        </div>

                        {/* URL INPUT FOR APPENDING */}
                        <div className="flex gap-2">
                          <input
                            type="url"
                            className={`${inputCls} text-[10px] py-1.5 flex-1`}
                            placeholder="Hoặc dán link ảnh https://..."
                            id={`url-input-${i}`}
                            onClick={e => e.stopPropagation()}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                e.stopPropagation()
                                const val = e.target.value.trim()
                                if (val) {
                                  updateRow(i, { image_urls: [...(block.image_urls || []), val] })
                                  e.target.value = ''
                                }
                              }
                            }}
                          />
                          <button
                            type="button"
                            className="px-2 py-1 rounded-lg bg-[#dae2fd] text-[#006591] text-[9px] font-bold uppercase shrink-0"
                            onClick={(e) => {
                              e.stopPropagation()
                              const input = document.getElementById(`url-input-${i}`)
                              const val = input.value.trim()
                              if (val) {
                                updateRow(i, { image_urls: [...(block.image_urls || []), val] })
                                input.value = ''
                              }
                            }}
                          >
                            Thêm
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addRow()}
                  className="w-full text-sm font-semibold text-[#006591] border border-dashed border-[#006591]/45 rounded-xl px-4 py-2.5 hover:bg-[#f2f3ff] transition-colors"
                >
                  + Thêm dòng nội dung mới
                </button>
              </div>
            </FormField>
          )
        }
        if (field.type === 'dynamic_pairs') {
          const key = field.name
          const items = Array.isArray(data[key]) ? data[key] : []
          const setItems = next => onChange(key, next)
          const updateItem = (i, patch) => {
            setItems(items.map((it, j) => (j === i ? { ...it, ...patch } : it)))
          }
          const removeItem = i => setItems(items.filter((_, j) => j !== i))
          const addItem = () => setItems([...items, { name: '', link: '' }])

          return (
            <FormField key={key} label={field.label}>
              <div className="space-y-3">
                {items.map((item, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-5">
                      <input
                        type="text"
                        className={`${inputCls} !py-2 !text-xs`}
                        placeholder="Tên tài liệu (VD: Quy trình SEO)"
                        value={item.name || ''}
                        onChange={e => updateItem(i, { name: e.target.value })}
                      />
                    </div>
                    <div className="col-span-6">
                      <input
                        type="text"
                        className={`${inputCls} !py-2 !text-xs`}
                        placeholder="Link..."
                        value={item.link || ''}
                        onChange={e => updateItem(i, { link: e.target.value })}
                      />
                    </div>
                    <div className="col-span-1 flex justify-center">
                      <button
                        type="button"
                        onClick={() => removeItem(i)}
                        className="text-[#ba1a1a] hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addItem}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-[#006591]/40 text-[#006591] text-xs font-bold hover:bg-[#f2f3ff] transition-all"
                >
                  <span className="material-symbols-outlined text-[16px]">add</span>
                  Thêm tài liệu
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
  { name: 'documents',   label: 'Tài liệu', type: 'dynamic_pairs' },
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
