import React, { useState, useMemo, useEffect } from 'react'
import Modal from './Modal'

/**
 * TaskTemplateManager
 * Giao diện quản lý thư viện Task mẫu phong cách "Hạt tiêu" cao cấp
 */
export default function TaskTemplateManager({ templates = [], onEdit, onDelete, onAdd, onAddSubtask, onSelect, isPicker = false }) {
  const [searchTerm, setSearchTerm] = useState('')

  const filteredTemplates = useMemo(() => {
    if (!searchTerm.trim()) return templates
    const search = searchTerm.toLowerCase()
    return templates.filter(t =>
      t.name?.toLowerCase().includes(search) ||
      t.group_name?.toLowerCase().includes(search)
    )
  }, [searchTerm, templates])

  return (
    <div className="bg-[#f8fafc] sm:bg-white rounded-lg border-0 sm:border border-slate-200 shadow-none sm:shadow-sm overflow-hidden flex flex-col w-full h-full relative">

      {/* HEADER AREA: Tối ưu cho Mobile */}
      <div className="px-4 py-3 border-b border-slate-100 bg-white shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center justify-between sm:justify-start gap-4">
            <h2 className="text-[13px] sm:text-[14px] font-black text-[#131b2e] uppercase tracking-wider flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] sm:text-[20px] text-[#006591]">library_books</span>
              Thư viện Task mẫu
            </h2>
            {/* Nút thêm mẫu (chỉ hiện trên Desktop ở vị trí cũ) */}
            {!isPicker && (
              <button
                onClick={onAdd}
                className="hidden sm:flex bg-[#006591] text-white px-3 py-1.5 rounded-lg text-[11px] font-bold items-center gap-2 shadow-lg shadow-blue-100 hover:brightness-110 transition-all active:scale-95"
              >
                <span className="material-symbols-outlined text-[16px]">add_circle</span>
                THÊM MẪU MỚI
              </button>
            )}
          </div>

          {/* Ô tìm kiếm: 100% trên Mobile */}
          <div className="relative w-full sm:w-48 lg:w-72 group">
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[16px] text-slate-400 group-focus-within:text-[#006591] transition-colors">search</span>
            <input
              type="text"
              placeholder="Tìm tên hoặc nhóm..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-100/80 sm:bg-slate-100/50 border border-slate-200 rounded-xl sm:rounded-lg py-2 sm:py-1.5 pl-9 pr-8 text-[12px] sm:text-[11px] placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-[#006591] focus:ring-4 focus:ring-[#006591]/10 transition-all"
            />
          </div>
        </div>
      </div>

      {/* 1. VIEW DESKTOP: Table Area (hidden sm:block) */}
      <div className="hidden sm:block flex-1 overflow-auto bg-white">
        <table className="w-full border-collapse text-left table-fixed">
          <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-100">
            <tr className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              {!isPicker && <th className="px-3 py-2 w-[10%]">Nhóm</th>}
              <th className="px-3 py-2">Tên Task / Subtask</th>
              <th className="px-3 py-2 w-[25%]">Yêu cầu tiêu chuẩn</th>
              <th className="px-3 py-2 w-[25%]">Giải pháp xử lý</th>
              <th className="px-3 py-2 w-[90px] text-center">Thời gian</th>
              <th className={`px-3 py-2 text-right pr-4 ${isPicker ? 'w-[70px]' : 'w-[120px]'}`}>Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredTemplates.length === 0 ? (
              <tr>
                <td colSpan={isPicker ? "5" : "6"} className="py-12 text-center text-[12px] text-slate-400 italic">
                  Chưa có quy trình mẫu nào được tạo...
                </td>
              </tr>
            ) : (
              filteredTemplates.map((item) => (
                <TemplateRow
                  key={item.template_id}
                  item={item}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onAddSubtask={onAddSubtask}
                  onSelect={onSelect}
                  isPicker={isPicker}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 2. VIEW MOBILE: Card Area (block sm:hidden) */}
      <div className="block sm:hidden flex-1 overflow-auto bg-white">
        <div className="pb-20">
          {filteredTemplates.length === 0 ? (
            <div className="py-12 text-center text-[12px] text-slate-400 italic">
              Chưa có quy trình mẫu nào...
            </div>
          ) : (
            filteredTemplates.map((item) => {
              const isSub = !!item.parent_id
              return (
                <div
                  key={item.template_id}
                  className={`p-2.5 border-b border-slate-50 last:border-none transition-all ${isSub ? 'ml-4 bg-slate-50/50' : 'bg-white'}`}
                >
                  <div className="flex gap-2 w-full items-start">
                    {/* Cột 1: Nội dung (80%) - flex-1 min-w-0 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                        {!isSub && item.group_name && (
                          <span className="bg-blue-50 text-blue-600 px-1 py-0.5 rounded text-[8px] font-black uppercase shrink-0">
                            {item.group_name}
                          </span>
                        )}
                        <div className="flex items-center min-w-0">
                          {isSub && <span className="material-symbols-outlined text-[12px] text-slate-400 shrink-0 mr-0.5">subdirectory_arrow_right</span>}
                          <span className={`text-[11px] leading-tight break-words ${isSub ? 'text-slate-500 font-medium' : 'text-slate-800 font-bold uppercase'}`}>
                            {item.name}
                          </span>
                        </div>
                      </div>

                      {/* Yêu cầu & Giải pháp (Gọn gàng) */}
                      <div className="space-y-0.5">
                        {item.requirement && (
                          <p className="text-[10px] text-slate-400 italic leading-tight line-clamp-1">
                            <span className="font-bold not-italic mr-1">YC:</span>{item.requirement}
                          </p>
                        )}
                        {item.solution && (
                          <p className="text-[10px] text-slate-500 leading-tight line-clamp-1">
                            <span className="font-bold mr-1 text-slate-300">GP:</span>{item.solution}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Cột 2: Hành động (20%) - shrink-0 w-[70px] */}
                    <div className="shrink-0 w-[72px] flex flex-col items-end gap-2">
                      <span className={`shrink-0 rounded-md font-black tabular-nums ${isSub ? 'bg-slate-100 text-slate-500 text-[8px] px-1 py-0.5' : 'bg-slate-800 text-white text-[9px] px-1.5 py-0.5'}`}>
                        {item.standard_time || 0}m
                      </span>

                      {/* Nhóm Icon thao tác (Góc dưới phải cột 2) */}
                      <div className="flex items-center justify-end gap-1 mt-auto">
                        {isPicker ? (
                          <button
                            onClick={() => onSelect?.(item)}
                            className="bg-cyan-500 text-white px-2 py-1 rounded text-[9px] font-black active:scale-95 transition-all"
                          >
                            CHỌN
                          </button>
                        ) : (
                          <>
                            {!isSub && (
                              <button
                                onClick={() => onAddSubtask?.(item)}
                                className="p-1.5 text-emerald-600 bg-emerald-50 rounded-lg active:scale-90"
                              >
                                <span className="material-symbols-outlined text-[14px]">playlist_add</span>
                              </button>
                            )}
                            <button
                              onClick={() => onEdit?.(item)}
                              className="p-1.5 text-blue-500 bg-blue-50 rounded-lg active:scale-90"
                            >
                              <span className="material-symbols-outlined text-[14px]">edit_square</span>
                            </button>
                            <button
                              onClick={() => onDelete?.(item.template_id)}
                              className="p-1.5 text-red-500 bg-red-50 rounded-lg active:scale-90"
                            >
                              <span className="material-symbols-outlined text-[14px]">delete</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Nút FAB cho Mobile */}
        {!isPicker && (
          <button
            onClick={onAdd}
            className="fixed bottom-6 right-6 w-14 h-14 bg-[#006591] text-white rounded-full shadow-2xl flex items-center justify-center active:scale-90 transition-all z-[100] border-4 border-white"
          >
            <span className="material-symbols-outlined text-[28px]">add</span>
          </button>
        )}
      </div>

      {/* FOOTER DESKTOP */}
      <div className="hidden sm:flex px-4 py-1.5 bg-slate-50 border-t border-slate-100 justify-between items-center text-[10px] text-slate-400 font-medium shrink-0">
        <span>Tổng số: {filteredTemplates.length} quy trình mẫu</span>
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          Dữ liệu trực tuyến
        </span>
      </div>
    </div>
  )
}

function TemplateRow({ item, onEdit, onDelete, onAddSubtask, onSelect, isPicker }) {
  const isSubtask = !!item.parent_id

  return (
    <tr className={`hover:bg-blue-50/30 transition-colors group ${!isSubtask ? 'bg-white font-medium' : 'bg-slate-50/10'}`}>
      {/* Cột Nhóm */}
      {!isPicker && (
        <td className="px-3 py-2.5">
          {!isSubtask && item.group_name && (
            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-black text-[9px] uppercase tracking-tighter">
              {item.group_name}
            </span>
          )}
        </td>
      )}

      {/* Cột Tên Task */}
      <td className={`px-3 py-2.5 relative ${isSubtask ? 'pl-10' : ''}`}>
        {isSubtask && (
          <>
            <div className="absolute left-4 top-0 bottom-0 w-[1px] bg-slate-200"></div>
            <div className="absolute left-4 top-1/2 w-4 h-[1px] bg-slate-200"></div>
            <span className="material-symbols-outlined absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">subdirectory_arrow_right</span>
          </>
        )}
        {!isSubtask && (
          <span className="material-symbols-outlined text-[18px] text-slate-300 absolute left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">list_alt</span>
        )}
        <span className={`text-[11px] leading-tight block ${!isSubtask ? 'text-[#131b2e] font-bold' : 'text-slate-600'}`}>
          {item.name}
        </span>
      </td>

      {/* Cột Yêu cầu */}
      <td className="px-3 py-2.5 text-[11px] text-slate-500 italic leading-tight">
        <div className="line-clamp-2" title={item.requirement}>{item.requirement || '—'}</div>
      </td>

      {/* Cột Giải pháp */}
      <td className="px-3 py-2.5 text-[11px] text-slate-600 leading-tight">
        <div className="line-clamp-2" title={item.solution}>{item.solution || '—'}</div>
      </td>

      {/* Cột Thời gian */}
      <td className="px-3 py-2.5 text-center pr-6">
        <span className="px-1.5 py-0.5 rounded-lg bg-[#131b2e] text-white text-[9px] font-black tabular-nums whitespace-nowrap">
          {item.standard_time || 0} phút
        </span>
      </td>

      {/* Cột Thao tác */}
      <td className="px-3 py-2.5 text-right pr-4 relative z-20 min-w-[130px]">
        <div className="flex items-center justify-end gap-3">
          {isPicker ? (
            <button
              onClick={(e) => { e.stopPropagation(); onSelect?.(item); }}
              className="px-3 py-1 bg-cyan-500 text-white text-[10px] font-black rounded-lg hover:bg-cyan-600 transition-all active:scale-95 shadow-md shadow-cyan-100"
            >
              CHỌN
            </button>
          ) : (
            <div className="flex items-center gap-2">
              {!isSubtask && (
                <button
                  onClick={(e) => { e.stopPropagation(); onAddSubtask?.(item); }}
                  className="p-1 hover:bg-emerald-50 rounded-lg text-emerald-600 transition-all hover:scale-110 active:scale-90"
                  title="Thêm tiểu mục mẫu"
                >
                  <span className="material-symbols-outlined text-[15px]">playlist_add</span>
                </button>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); onEdit?.(item); }}
                className="p-1 hover:bg-blue-50 rounded-lg text-blue-500 transition-all hover:scale-110 active:scale-90"
                title="Sửa"
              >
                <span className="material-symbols-outlined text-[15px]">edit_square</span>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete?.(item.template_id); }}
                className="p-1 hover:bg-red-50 rounded-lg text-red-500 transition-all hover:scale-110 active:scale-90"
                title="Xóa"
              >
                <span className="material-symbols-outlined text-[15px]">delete</span>
              </button>
            </div>
          )}
        </div>
      </td>
    </tr>
  )
}

/**
 * Modal thêm/sửa quy trình mẫu
 */
export function TemplateFormModal({ isOpen, onClose, onSave, editingItem }) {
  const [formData, setFormData] = useState({
    name: '',
    group_name: '',
    requirement: '',
    solution: '',
    standard_time: 0
  })

  useEffect(() => {
    if (editingItem) {
      setFormData({
        name: editingItem.name || '',
        group_name: editingItem.group_name || '',
        requirement: editingItem.requirement || '',
        solution: editingItem.solution || '',
        standard_time: editingItem.standard_time || 0,
        parent_id: editingItem.parent_id || null,
        template_id: editingItem.template_id || null
      })
    } else {
      setFormData({ name: '', group_name: '', requirement: '', solution: '', standard_time: 0 })
    }
  }, [editingItem, isOpen])

  if (!isOpen) return null

  const isSubtask = !!formData.parent_id

  return (
    <Modal
      title={formData.template_id ? 'Sửa quy trình mẫu' : 'Thêm quy trình mẫu mới'}
      onClose={onClose}
      maxWidthClassName="max-w-2xl"
    >
      <div className="space-y-4 p-2">
        <div className="grid grid-cols-2 gap-4">
          <div className={`space-y-1.5 ${isSubtask ? 'col-span-2' : ''}`}>
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Tên {isSubtask ? 'Tiểu mục' : 'Task / Quy trình'}</label>
            <input
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:bg-white focus:ring-4 focus:ring-blue-100 outline-none transition-all"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder={isSubtask ? "VD: Cài đặt SSL Let's Encrypt" : "VD: Thiết lập hạ tầng dự án mới"}
            />
          </div>
          {!isSubtask && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Nhóm bộ phận</label>
              <input
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:bg-white focus:ring-4 focus:ring-blue-100 outline-none transition-all"
                value={formData.group_name}
                onChange={e => setFormData({ ...formData, group_name: e.target.value })}
                placeholder="VD: KỸ THUẬT, DESIGN..."
              />
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Yêu cầu tiêu chuẩn</label>
          <textarea
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:bg-white focus:ring-4 focus:ring-blue-100 outline-none transition-all min-h-[100px]"
            value={formData.requirement}
            onChange={e => setFormData({ ...formData, requirement: e.target.value })}
            placeholder="Mô tả các tiêu chuẩn cần đạt được..."
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Giải pháp xử lý</label>
          <textarea
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:bg-white focus:ring-4 focus:ring-blue-100 outline-none transition-all min-h-[100px]"
            value={formData.solution}
            onChange={e => setFormData({ ...formData, solution: e.target.value })}
            placeholder="Các bước thực hiện chi tiết..."
          />
        </div>

        <div className="w-40 space-y-1.5">
          <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Thời gian (Phút)</label>
          <input
            type="number"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:bg-white focus:ring-4 focus:ring-blue-100 outline-none transition-all font-bold tabular-nums"
            value={formData.standard_time}
            onChange={e => setFormData({ ...formData, standard_time: e.target.value })}
          />
        </div>

        <div className="flex gap-3 pt-4">
          <button onClick={onClose} className="flex-1 py-3 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-2xl transition-all">Hủy bỏ</button>
          <button
            onClick={() => onSave(formData)}
            className="flex-1 py-3 bg-[#006591] text-white text-sm font-bold rounded-2xl shadow-xl shadow-blue-100 hover:brightness-110 active:scale-95 transition-all"
          >
            Lưu quy trình mẫu
          </button>
        </div>
      </div>
    </Modal>
  )
}
