import { useState, useEffect } from 'react'
import Modal from './Modal'

const STATUS_OPTIONS = [
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

// Generic entity form (project / feature / task / subtask / customer)
export function EntityFormModal({ title, subtitle, fields, data, onChange, onSave, onClose, saveLabel = 'Lưu' }) {
  return (
    <Modal
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="px-6 py-2.5 rounded-xl text-sm font-medium text-[#006591] hover:bg-[#f2f3ff] transition-colors">
            Hủy
          </button>
          <button onClick={onSave} className="px-6 py-2.5 rounded-xl text-sm font-medium text-white primary-gradient shadow-md hover:brightness-110 transition-all active:scale-95">
            {saveLabel}
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
        if (field.type === 'grid') {
          return (
            <div key={field.name} className="grid grid-cols-2 gap-4">
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
  { name: 'email',   label: 'Email', type: 'email', placeholder: 'contact@company.com' },
  { name: 'phone',   label: 'Số điện thoại', placeholder: '090 xxx xxxx' },
  { name: 'address', label: 'Địa chỉ', type: 'textarea', placeholder: 'Địa chỉ đầy đủ...' },
]

export const PROJECT_FIELDS = [
  { name: 'customer_id', label: 'Khách hàng', type: 'select' },
  { name: 'name',        label: 'Tên dự án', placeholder: 'VD: CRM System Revamp' },
  { name: 'description', label: 'Mô tả', type: 'textarea', placeholder: 'Mục tiêu và phạm vi dự án...' },
  {
    name: 'meta', type: 'grid', children: [
      { name: 'pricing',     label: 'Ngân sách (₫)', type: 'text', placeholder: '0' },
      { name: 'deadline',    label: 'Hạn chót', type: 'date' },
    ]
  },
  { name: 'status', label: 'Trạng thái', type: 'select' },
]

export const FEATURE_FIELDS = [
  { name: 'name',        label: 'Tên tính năng', placeholder: 'VD: Tích hợp thanh toán' },
  { name: 'description', label: 'Mô tả', type: 'textarea', placeholder: 'Chi tiết yêu cầu...' },
  {
    name: 'meta', type: 'grid', children: [
      { name: 'deadline', label: 'Hạn chót', type: 'date' },
      { name: 'status',   label: 'Trạng thái', type: 'select', options: STATUS_OPTIONS },
    ]
  },
]

export const TASK_FIELDS = [
  { name: 'name',        label: 'Tên task', placeholder: 'VD: Design UI mockups' },
  { name: 'assigned_to', label: 'Người phụ trách', type: 'select' },
  { name: 'description', label: 'Mô tả', type: 'textarea', placeholder: 'Chi tiết công việc...' },
  {
    name: 'meta', type: 'grid', children: [
      { name: 'deadline', label: 'Hạn chót', type: 'date' },
      { name: 'status',   label: 'Trạng thái', type: 'select', options: STATUS_OPTIONS },
    ]
  },
]

export const SUBTASK_FIELDS = [
  { name: 'name',        label: 'Tên subtask', placeholder: 'VD: Line chart widget' },
  { name: 'assigned_to', label: 'Người phụ trách', type: 'select' },
  { name: 'description', label: 'Mô tả', type: 'textarea', placeholder: 'Chi tiết...' },
  {
    name: 'meta', type: 'grid', children: [
      { name: 'deadline', label: 'Hạn chót', type: 'date' },
      { name: 'status',   label: 'Trạng thái', type: 'select', options: STATUS_OPTIONS },
    ]
  },
]
