import React, { useState, useMemo } from 'react'

/**
 * TaskTemplateManager
 * Giao diện quản lý thư viện Task mẫu phong cách "Hạt tiêu"
 */
export default function TaskTemplateManager({ templates = [], onEdit, onDelete, onAdd }) {
  const [searchTerm, setSearchTerm] = useState('')

  // Logic lọc dữ liệu nhanh
  const filteredTemplates = useMemo(() => {
    if (!searchTerm.trim()) return templates
    const search = searchTerm.toLowerCase()
    return templates.filter(t => 
      t.name?.toLowerCase().includes(search) || 
      t.group_name?.toLowerCase().includes(search)
    )
  }, [searchTerm, templates])

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col w-full h-full">
      
      {/* HEADER & FILTER AREA */}
      <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between bg-slate-50/40">
        <div className="flex items-center gap-3">
          <h2 className="text-[12px] font-black text-[#131b2e] uppercase tracking-wider flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[18px] text-[#006591]">library_books</span>
            Thư viện Task mẫu
          </h2>
          <div className="relative w-48 lg:w-64">
            <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-[14px] text-slate-400">search</span>
            <input 
              type="text"
              placeholder="Tìm tên hoặc nhóm..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-md py-0.5 pl-7 pr-2 text-[10px] focus:outline-none focus:ring-1 focus:ring-[#006591]/30 transition-all"
            />
          </div>
        </div>

        <button 
          onClick={onAdd}
          className="flex items-center gap-1 px-2 py-1 bg-[#006591] text-white rounded-md text-[10px] font-bold hover:bg-[#004d6e] transition-all shadow-sm active:scale-95"
        >
          <span className="material-symbols-outlined text-[14px]">add_circle</span>
          THÊM MẪU MỚI
        </button>
      </div>

      {/* TABLE AREA */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-left table-fixed">
          <thead className="sticky top-0 z-10">
            <tr className="bg-slate-100/80 backdrop-blur-sm text-[#64748b] text-[9px] uppercase tracking-widest font-bold border-b border-slate-200">
              <th className="px-2 py-1.5 w-[80px]">Nhóm</th>
              <th className="px-2 py-1.5 w-[200px]">Tên Task / Subtask</th>
              <th className="px-2 py-1.5">Yêu cầu tiêu chuẩn</th>
              <th className="px-2 py-1.5">Giải pháp xử lý</th>
              <th className="px-2 py-1.5 w-[90px] text-center">TG Tiêu chuẩn</th>
              <th className="px-2 py-1.5 w-[60px] text-right pr-3">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredTemplates.length === 0 ? (
              <tr>
                <td colSpan="6" className="py-10 text-center text-[11px] text-slate-400 italic">
                  Chưa có dữ liệu mẫu nào...
                </td>
              </tr>
            ) : (
              filteredTemplates.map((item) => (
                <TemplateRow 
                  key={item.template_id} 
                  item={item} 
                  onEdit={onEdit} 
                  onDelete={onDelete} 
                />
              ))
            )}
          </tbody>
        </table>
      </div>
      
      {/* FOOTER STATS */}
      <div className="px-3 py-1 bg-slate-50 border-t border-slate-100 flex justify-between items-center text-[9px] text-slate-400 font-medium">
        <span>Hiển thị: {filteredTemplates.length} dòng dữ liệu</span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          Hệ thống ổn định
        </span>
      </div>
    </div>
  )
}

/**
 * Component render từng dòng (Row) với logic phân cấp
 */
function TemplateRow({ item, onEdit, onDelete }) {
  const isSubtask = !!item.parent_id
  
  return (
    <tr className={`hover:bg-blue-50/30 transition-colors group ${!isSubtask ? 'bg-white font-medium' : 'bg-slate-50/20'}`}>
      {/* Cột Nhóm */}
      <td className="px-2 py-1 border-r border-slate-50 overflow-hidden">
        {!isSubtask && (
          <span className="px-1 py-0.5 rounded bg-slate-200 text-slate-600 font-black text-[8px] uppercase tracking-tighter truncate block text-center">
            {item.group_name || '—'}
          </span>
        )}
      </td>

      {/* Cột Tên */}
      <td className={`px-2 py-1 relative ${isSubtask ? 'pl-7' : ''}`}>
        {isSubtask && (
          <>
            <div className="absolute left-3 top-0 bottom-0 w-[1px] bg-slate-200"></div>
            <div className="absolute left-3 top-1/2 w-3 h-[1px] bg-slate-200"></div>
          </>
        )}
        <div className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[14px] text-slate-400 shrink-0">
            {isSubtask ? 'subdirectory_arrow_right' : 'list_alt'}
          </span>
          <span className={`text-[10px] truncate leading-tight ${!isSubtask ? 'text-[#131b2e] font-bold' : 'text-slate-600'}`} title={item.name}>
            {item.name}
          </span>
        </div>
      </td>

      {/* Cột Yêu cầu */}
      <td className="px-2 py-1 text-[10px] text-slate-500 leading-tight italic overflow-hidden">
        <div className="truncate max-w-full" title={item.requirement}>
          {item.requirement || '—'}
        </div>
      </td>

      {/* Cột Giải pháp */}
      <td className="px-2 py-1 text-[10px] text-slate-600 leading-tight overflow-hidden">
        <div className="truncate max-w-full" title={item.solution}>
          {item.solution || '—'}
        </div>
      </td>

      {/* Cột Thời gian */}
      <td className="px-2 py-1 text-center align-middle">
        <div className="inline-flex items-center justify-center px-1.5 py-0.5 rounded bg-slate-800 text-white font-bold text-[9px] shadow-sm min-h-[18px]">
          <span className="tabular-nums">{item.standard_time || 0} phút</span>
        </div>
      </td>

      {/* Cột Thao tác */}
      <td className="px-2 py-1 text-right pr-2 align-middle">
        <div className="flex items-center justify-end gap-0.5 min-h-[18px]">
          <button 
            onClick={() => onEdit?.(item)}
            className="p-0.5 hover:bg-blue-50 rounded text-blue-500 transition-colors flex items-center justify-center" 
            title="Sửa"
          >
            <span className="material-symbols-outlined text-[11px]">edit_square</span>
          </button>
          <button 
            onClick={() => onDelete?.(item.template_id)}
            className="p-0.5 hover:bg-red-50 rounded text-red-500 transition-colors flex items-center justify-center" 
            title="Xóa"
          >
            <span className="material-symbols-outlined text-[11px]">delete</span>
          </button>
        </div>
      </td>
    </tr>
  )
}
