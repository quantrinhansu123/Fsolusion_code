import React, { useState, useEffect } from 'react'
import Sidebar from '../components/Sidebar'
import TopBar from '../components/TopBar'
import TaskTemplateManager, { TemplateFormModal } from '../components/TaskTemplateModal'
import ConfirmModal from '../components/ConfirmModal'
import { supabase } from '../utils/supabase'
import Toast from '../components/Toast'

export default function TaskTemplatePage() {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    fetchTemplates()
  }, [])

  async function fetchTemplates() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('task_templates')
        .select('*')
        .order('group_name', { ascending: true })
        .order('created_at', { ascending: true })
      
      if (error) throw error
      
      const sorted = []
      const parents = data.filter(t => !t.parent_id)
      const children = data.filter(t => t.parent_id)
      
      parents.forEach(p => {
        sorted.push(p)
        const subtasks = children.filter(c => c.parent_id === p.template_id)
        sorted.push(...subtasks)
      })
      
      const orphanIds = new Set(children.map(c => c.template_id))
      sorted.forEach(s => orphanIds.delete(s.template_id))
      orphanIds.forEach(id => sorted.push(children.find(c => c.template_id === id)))

      setTemplates(sorted)
    } catch (err) {
      console.error('Fetch error:', err)
      showToast('Không thể tải dữ liệu quy trình', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (formData) => {
    try {
      // Tách template_id ra để kiểm tra xem là THÊM hay SỬA
      const isEditing = !!formData.template_id
      
      const cleanData = {
        name: formData.name || '',
        group_name: formData.group_name || '',
        requirement: formData.requirement || '',
        solution: formData.solution || '',
        standard_time: parseInt(formData.standard_time) || 0,
        parent_id: formData.parent_id || null
      }

      if (isEditing) {
        // Chế độ Sửa (UPDATE)
        const { error } = await supabase
          .from('task_templates')
          .update(cleanData)
          .eq('template_id', formData.template_id)
        if (error) throw error
        showToast('Cập nhật quy trình thành công', 'success')
      } else {
        // Chế độ Thêm mới (INSERT)
        const { error } = await supabase
          .from('task_templates')
          .insert([cleanData])
        if (error) throw error
        showToast('Thêm quy trình mẫu mới thành công', 'success')
      }
      setIsModalOpen(false)
      setEditingItem(null)
      fetchTemplates()
    } catch (err) {
      console.error('Save error:', err)
      showToast('Lỗi khi lưu dữ liệu', 'error')
    }
  }

  const confirmDelete = (id) => {
    setDeletingId(id)
    setIsConfirmOpen(true)
  }

  const handleDelete = async () => {
    if (!deletingId) return
    try {
      const { error } = await supabase
        .from('task_templates')
        .delete()
        .eq('template_id', deletingId)
      if (error) throw error
      showToast('Đã xóa quy trình mẫu', 'success')
      fetchTemplates()
    } catch (err) {
      console.error('Delete error:', err)
      showToast('Lỗi khi xóa dữ liệu', 'error')
    }
  }

  const showToast = (message, type) => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#faf8ff]">
      <Sidebar />
      <div className="flex-1 md:ml-64 flex flex-col h-screen overflow-hidden">
        <TopBar 
          title="QUẢN TRỊ QUY TRÌNH MẪU" 
          subtitle="Hệ thống định mức thời gian và tiêu chuẩn công việc"
        />
        
        <main className="flex-1 p-2 sm:p-3 overflow-hidden flex flex-col min-h-0">
          <div className="flex-1 min-h-0 overflow-hidden bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col">
            {loading ? (
              <div className="flex h-full items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#006591]"></div>
              </div>
            ) : (
              <div className="flex-1 overflow-x-auto">
                <div className="min-w-[800px] h-full flex flex-col">
                  <TaskTemplateManager 
                    templates={templates}
                    onAdd={() => { setEditingItem(null); setIsModalOpen(true); }}
                    onEdit={(item) => { setEditingItem(item); setIsModalOpen(true); }}
                    onDelete={confirmDelete}
                    onAddSubtask={(parent) => {
                      setEditingItem({ 
                        parent_id: parent.template_id, 
                        group_name: parent.group_name 
                      });
                      setIsModalOpen(true);
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </main>

        <TemplateFormModal 
          isOpen={isModalOpen}
          onClose={() => { setIsModalOpen(false); setEditingItem(null); }}
          onSave={handleSave}
          editingItem={editingItem}
          parentOptions={templates.filter(t => !t.parent_id)}
        />

        <ConfirmModal 
          isOpen={isConfirmOpen}
          onClose={() => setIsConfirmOpen(false)}
          onConfirm={handleDelete}
          title="Xóa quy trình mẫu"
          message="Sếp có chắc chắn muốn xóa quy trình này không? (Hành động này sẽ xóa luôn các Subtask liên quan)"
        />

        {toast && (
          <Toast 
            message={toast.message} 
            type={toast.type} 
            onClose={() => setToast(null)} 
          />
        )}
      </div>
    </div>
  )
}
