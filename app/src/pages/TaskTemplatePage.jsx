import React, { useState, useEffect } from 'react'
import Sidebar from '../components/Sidebar'
import TopBar from '../components/TopBar'
import TaskTemplateManager from '../components/TaskTemplateModal'
import { supabase } from '../utils/supabase'

export default function TaskTemplatePage() {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)

  // Fetch dữ liệu thật từ database (giả lập hoặc thật tùy sếp)
  useEffect(() => {
    fetchTemplates()
  }, [])

  async function fetchTemplates() {
    setLoading(true)
    try {
      // Giả lập dữ liệu để sếp soi UI trước
      const mockData = [
        { template_id: '1', group_name: 'KỸ THUẬT', name: 'Thiết lập hạ tầng dự án mới', standard_time: '120', requirement: 'Server Ubuntu 22.04, Docker installed', solution: 'Dùng script auto-setup v2' },
        { template_id: '2', parent_id: '1', name: 'Cài đặt SSL Let\'s Encrypt', standard_time: '15', requirement: 'Domain đã trỏ IP', solution: 'certbot --nginx -d domain.com' },
        { template_id: '3', parent_id: '1', name: 'Phân quyền thư mục web', standard_time: '5', requirement: 'User www-data', solution: 'chown -R www-data:www-data' },
        { template_id: '4', group_name: 'DESIGN', name: 'Thiết kế Moodboard khách hàng', standard_time: '180', requirement: 'Tối thiểu 3 phương án màu', solution: 'Sử dụng Adobe Color + Pinterest' },
        { template_id: '5', parent_id: '4', name: 'Chọn Font chữ chủ đạo', standard_time: '30', requirement: 'Font Google Free', solution: 'Kiểm tra độ đọc trên mobile' },
      ]
      
      // Nếu có database thật thì dùng:
      // const { data } = await supabase.from('task_templates').select('*').order('created_at')
      // setTemplates(data || [])
      
      setTemplates(mockData)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#faf8ff]">
      <Sidebar />
      <div className="flex-1 md:ml-64 flex flex-col h-screen overflow-y-auto">
        <TopBar 
          title="QUẢN TRỊ QUY TRÌNH MẪU" 
          subtitle="Hệ thống định mức thời gian và tiêu chuẩn công việc"
        />
        
        <main className="flex-1 px-3 py-4 flex flex-col min-h-0">
          <div className="flex-1 min-h-0">
            {loading ? (
              <div className="flex h-full items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#006591]"></div>
              </div>
            ) : (
              <TaskTemplateManager 
                templates={templates}
                onAdd={() => alert('Chức năng thêm mẫu sẽ code ở bước tiếp theo sếp nhé!')}
                onEdit={(item) => console.log('Edit', item)}
                onDelete={(id) => console.log('Delete', id)}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
