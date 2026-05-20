import React, { useState, useEffect, useMemo, useRef } from 'react'
import Sidebar from '../components/Sidebar'
import TopBar from '../components/TopBar'
import { supabase } from '../utils/supabase'
import { uploadImageBlobToCloudinary, isCloudinaryUploadConfigured } from '../utils/cloudinaryUpload'
import { getImageFilesFromClipboardEvent } from '../utils/imagePaste'
import { useAuth } from '../utils/AuthContext'
import Modal from '../components/Modal'
import ReportModal from '../components/ReportModal'

import { ClipboardList, Edit3, Plus, Minus } from 'lucide-react'

// -- UTILITY FUNCTIONS --
const timeFormat = (isoString) => {
  if (!isoString) return '--:--'
  const date = new Date(isoString)
  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })
}

const dateFormat = (dateString) => {
  if (!dateString) return '-'
  const [y, m, d] = dateString.split('-')
  return `${d}/${m}/${y}`
}

const calcDuration = (start, end) => {
  if (!start || !end) return ''
  const diffMs = new Date(end) - new Date(start)
  if (diffMs < 0) return ''
  const diffHrs = Math.floor(diffMs / 3600000)
  const diffMins = Math.round(((diffMs % 3600000) / 60000) % 60)

  let res = ''
  if (diffHrs > 0) res += `${diffHrs}h `
  if (diffMins > 0) res += `${diffMins}m`
  return res.trim() || '1m'
}




export default function AttendancePage() {
  const { user } = useAuth()
  const role = user?.role || 'employee'
  const canEditDelete = role === 'admin' || role === 'manager'

  const [filterDate, setFilterDate] = useState('')
  const [filterMonth, setFilterMonth] = useState('')
  const [filterUser, setFilterUser] = useState('all')

  // Trạng thái dữ liệu
  const [attendanceList, setAttendanceList] = useState([])
  const [staffList, setStaffList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  // const [showTasksId, setShowTasksId] = useState(null) // Quản lý xem task chi tiết trên Mobile
  const [selectedIds, setSelectedIds] = useState(new Set()) // Lưu ID các bản ghi được chọn
  const [deleting, setDeleting] = useState(false) // Trạng thái xóa
  const [toast, setToast] = useState(null) // Thông báo
  const [currentPage, setCurrentPage] = useState(1) // Phân trang
  const [totalRecords, setTotalRecords] = useState(0) // Tổng số bản ghi
  const PAGE_SIZE = 100 // Lấy 100 bản ghi trên trang
  const [editingRecord, setEditingRecord] = useState(null) // Bản ghi đang sửa
  const [isUpdating, setIsUpdating] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [confirmDeleteBulk, setConfirmDeleteBulk] = useState(false)
  const [expandedRows, setExpandedRows] = useState(new Set()) // Quản lý hàng đang mở rộng
  const [isMobileStaffOpen, setIsMobileStaffOpen] = useState(false)
  const [isDesktopStaffOpen, setIsDesktopStaffOpen] = useState(false)
  const [showMobileHeader, setShowMobileHeader] = useState(true)
  // -- MODAL: Báo cáo (employee) & Từ chối (admin) --
  const [reportModal, setReportModal] = useState({ open: false, sessionId: null, task: null })
  const [rejectModal, setRejectModal] = useState({ open: false, sessionId: null, subtaskId: null, reason: '' })
  const [commentModal, setCommentModal] = useState({ open: false, sessionId: null, subtaskId: null, comment: '' })

  // -- THÊM CÔNG VIỆC THỦ CÔNG (trong ca đang làm) --
  const [addTaskModalOpen, setAddTaskModalOpen] = useState(false)
  const [isAddingTask, setIsAddingTask] = useState(false)
  const [newTaskForm, setNewTaskForm] = useState({
    project_id: '',
    pick_row_key: '',
    task_id: '',
    title: '',
    work_detail: '',
    percent: 0,
    parent_task_name: '',
  })
  const [addTaskTargetSessionId, setAddTaskTargetSessionId] = useState(null)
  const [pickListProjects, setPickListProjects] = useState([])
  const [pickListLoading, setPickListLoading] = useState(false)
  /** Subtask đang làm / chờ, được giao cho chủ ca — lọc theo dự án đang chọn */
  const [addTaskAssigneeSubtasks, setAddTaskAssigneeSubtasks] = useState([])
  const [addTaskAssigneeSubtasksLoading, setAddTaskAssigneeSubtasksLoading] = useState(false)
  const [addTaskProjectQuery, setAddTaskProjectQuery] = useState('')
  const [addTaskTaskQuery, setAddTaskTaskQuery] = useState('')
  const [addTaskShowProjectSuggest, setAddTaskShowProjectSuggest] = useState(false)
  const [addTaskShowTaskSuggest, setAddTaskShowTaskSuggest] = useState(false)

  const [editPercentModal, setEditPercentModal] = useState({
    open: false,
    sessionId: null,
    subtaskId: null,
    title: '',
    work_detail: '',
    report_content: '',
    report_images: [],
    percent: 0,
  })
  const [isSavingPercent, setIsSavingPercent] = useState(false)
  const [editImagesUploading, setEditImagesUploading] = useState(0)
  const editTaskReportFileRef = useRef(null)
  /** Phóng to ảnh báo cáo (toàn màn hình) */
  const [imageLightboxUrl, setImageLightboxUrl] = useState(null)
  const [loadingAction, setLoadingAction] = useState(null)
  const [activeDropdown, setActiveDropdown] = useState(null)

  // -- TÀI KHOẢN ĐANG ĐĂNG NHẬP --
  const [currentUser, setCurrentUser] = useState(null)

  // -- STATE CHẤM CÔNG --
  // Chỉ khôi phục session nếu session đó thuộc về user đang đăng nhập
  const [activeSessionId, setActiveSessionId] = useState(null)
  const [isWorking, setIsWorking] = useState(false)
  const [sessionTimer, setSessionTimer] = useState(0)
  const [sessionStartTime, setSessionStartTime] = useState(null)

  // 1. Load user đang đăng nhập + khôi phục session checkin nếu hợp lệ
  useEffect(() => {
    if (!user?.user_id) return
    setCurrentUser(user)

    const storedSessionId = localStorage.getItem('checkin_session_id')
    const storedUserId = localStorage.getItem('checkin_user_id')
    const storedStartTime = localStorage.getItem('checkin_start_time')
    if (storedSessionId && storedUserId === user.user_id && storedStartTime) {
      setActiveSessionId(storedSessionId)
      setIsWorking(true)
      setSessionStartTime(Number(storedStartTime))
    } else {
      localStorage.removeItem('checkin_session_id')
      localStorage.removeItem('checkin_user_id')
      localStorage.removeItem('checkin_start_time')
    }
  }, [user])

  // -- REALTIME: TỰ ĐỘNG CẬP NHẬT CÔNG VIỆC MỚI KHI ĐANG TRONG CA --
  useEffect(() => {
    if (!currentUser?.user_id || !isWorking || !activeSessionId) return

    const channel = supabase
      .channel(`realtime_tasks_${activeSessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'work_schedules',
          filter: `assigned_to=eq.${currentUser.user_id}`
        },
        async (payload) => {
          const newWS = payload.new

          // Kiểm tra xem việc mới này có phải của ngày hôm nay không
          const now = new Date()
          const local = new Date(now.getTime() - (now.getTimezoneOffset() * 60000))
          const today = local.toISOString().split('T')[0]
          const startOfDay = `${today}T00:00:00.000`
          const endOfDay = `${today}T23:59:59.999`

          if (newWS.scheduled_at >= startOfDay && newWS.scheduled_at <= endOfDay) {
            // Lấy dữ liệu session hiện tại để gộp task mới
            const { data: session, error: sessionErr } = await supabase
              .from('work_sessions')
              .select('tasks_data')
              .eq('session_id', activeSessionId)
              .single()

            if (session && !sessionErr) {
              const currentTasks = session.tasks_data || []
              // Tránh trùng lặp
              if (!currentTasks.some(t => t.subtask_id === newWS.schedule_id)) {
                const newTask = {
                  subtask_id: newWS.schedule_id,
                  title: newWS.title,
                  status: newWS.status || 'in_progress',
                  percent: 0,
                  work_detail: newWS.description,
                  report_images: newWS.image_urls || [],
                  start_time: newWS.scheduled_at
                }
                const updatedTasks = [...currentTasks, newTask]

                // Cập nhật Database
                const { error: updateErr } = await supabase
                  .from('work_sessions')
                  .update({ tasks_data: updatedTasks })
                  .eq('session_id', activeSessionId)

                if (!updateErr) {
                  setToast({ message: `Sếp vừa giao thêm việc: ${newWS.title}`, type: 'success' })
                  fetchAttendanceData() // Tải lại giao diện
                }
              }
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentUser, isWorking, activeSessionId])

  // 2. Lấy danh sách nhân viên để đổ vào Dropdown bộ lọc
  useEffect(() => {
    async function fetchStaffs() {
      const { data } = await supabase.from('users').select('user_id, full_name').order('full_name')
      if (data) setStaffList(data)
    }
    fetchStaffs()
  }, [])

  // 2. Hàm chính: Lấy dữ liệu chấm công từ Supabase (có LIMIT & OFFSET để tối ưu)
  const fetchAttendanceData = async () => {
    if (!user) return

    setLoading(true)
    setError(null)

    try {
      // Logic Query (PostgreSQL lồng ghép API Supabase): 
      // - Join work_sessions với users (Lấy Avatar, Fullname)
      // - Join work_sessions với subtasks (Lấy Tên task đã làm)
      // - LIMIT 100 & OFFSET phân trang để tối ưu performance
      const from = (currentPage - 1) * PAGE_SIZE
      const to = from + PAGE_SIZE - 1

      let query = supabase
        .from('work_sessions')
        .select(`
          session_id,
          work_date,
          check_in_time,
          check_out_time,
          total_hours,
          tasks_data,
          users:user_id (user_id, full_name, avatar_url)
        `, { count: 'exact' })
        .order('check_in_time', { ascending: false })
        .range(from, to)

      // Xử lý bộ lọc
      if (filterDate) {
        query = query.eq('work_date', filterDate)
      } else if (filterMonth) {
        // Lọc theo tháng: tính ngày đầu tiên và cuối cùng của tháng đó (YYYY-MM)
        const year = parseInt(filterMonth.split('-')[0])
        const month = parseInt(filterMonth.split('-')[1])
        const firstDay = `${filterMonth}-01`
        const lastDay = new Date(year, month, 0).toISOString().split('T')[0]

        query = query.gte('work_date', firstDay).lte('work_date', lastDay)
      }

      if (filterUser && filterUser !== 'all' && role !== 'employee') {
        query = query.eq('user_id', filterUser)
      }

      // RÀNG BUỘC PHÂN QUYỀN: Nếu là nhân viên thì CHỈ được xem của chính mình
      if (role === 'employee') {
        query = query.eq('user_id', user.user_id)
      }

      // Execute API Call
      const { data, error: fetchError, count } = await query

      if (fetchError) throw fetchError

      setTotalRecords(count || 0)

      // Trả về JSON, transform map dữ liệu ra giao diện
      const formattedData = data.map(session => {
        // Lấy danh sách Task đã hoàn thành
        /*
        const completedTasksArray = (session.subtasks || [])
          .filter(task => task.status === 'completed')
          .map(task => task.name)
        */

        // Lấy thông tin user (Tránh lỗi trả về array từ supabase lồng)
        const userData = Array.isArray(session.users) ? session.users[0] : session.users

        // Tính tổng thời gian nếu Database chưa Update tự động (Giúp UI mượt hơn)
        let displayHours = session.total_hours ? `${session.total_hours}h` : '-'
        if (!session.total_hours && session.check_in_time && session.check_out_time) {
          const start = new Date(session.check_in_time)
          let end = new Date(session.check_out_time)

          let diffMs = end - start
          if (diffMs < -1000 * 60 * 30) {
            // Chỉ cộng 1 ngày nếu lệch âm đáng kể (> 30 phút), hỗ trợ ca đêm xuyên ngày
            end.setDate(end.getDate() + 1)
            diffMs = end - start
          } else if (diffMs < 0) {
            // Lệch âm nhẹ (vài giây/phút do clock drift hoặc thao tác nhanh) thì coi như 0
            diffMs = 0
          }

          const diffHrs = (diffMs / (1000 * 60 * 60)).toFixed(2)
          displayHours = `${diffHrs}h`
        }

        return {
          id: session.session_id,
          ownerUserId: userData?.user_id ?? null,
          user: {
            name: userData?.full_name || 'Không xác định',
            avatar: userData?.avatar_url || (userData?.full_name ? userData.full_name.charAt(0).toUpperCase() : '?')
          },
          work_date: dateFormat(session.work_date),
          check_in: timeFormat(session.check_in_time),
          check_out: timeFormat(session.check_out_time),
          check_in_raw: session.check_in_time, // Giữ lại raw để sửa
          check_out_raw: session.check_out_time,
          total_hours: displayHours,
          tasks_data: (session.tasks_data && session.tasks_data.length > 0) ? session.tasks_data.map(t => ({
            ...t,
            start_fmt: timeFormat(t.start_time),
            end_fmt: timeFormat(t.end_time),
            duration: calcDuration(t.start_time, t.end_time)
          })) : [],
          overallProgress: (session.tasks_data && session.tasks_data.length > 0)
            ? Math.round(
              session.tasks_data.reduce((sum, t) => {
                const p = typeof t.percent === 'number'
                  ? t.percent
                  : (t.is_approved ? 100 : 0)
                return sum + Math.max(0, Math.min(100, p))
              }, 0) / session.tasks_data.length
            )
            : 0,
          isValidForSalary: session.tasks_data && session.tasks_data.length > 0
            && session.tasks_data.every(t => t.status === 'completed' || t.is_approved)
        }
      })

      setAttendanceList(formattedData)
    } catch (err) {
      console.error(err)
      setError(err.message || 'Có lỗi khi tải Bảng chấm công.')
    } finally {
      setLoading(false)
    }
  }

  // 3. Tự động gọi hàm API mỗi khi State Bộ lọc thay đổi (reset về trang 1)
  useEffect(() => {
    setCurrentPage(1) // Reset về trang 1 khi filter thay đổi
    fetchAttendanceData()
  }, [filterDate, filterMonth, filterUser, user])

  // Gọi lại khi page thay đổi
  useEffect(() => {
    if (currentPage > 1) {
      fetchAttendanceData()
    }
  }, [currentPage])

  // Tự động ẩn Toast sau 2 giây
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 2000)
      return () => clearTimeout(timer)
    }
  }, [toast])


  // 4. Hàm xử lý checkbox
  const toggleSelectId = (id) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  // 5. Chọn/bỏ chọn tất cả
  const toggleSelectAll = () => {
    if (selectedIds.size === attendanceList.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(attendanceList.map(row => row.id)))
    }
  }

  // -- LOGIC CHẤM CÔNG (Được bê từ StaffSubtasksPage sang) --
  useEffect(() => {
    if (!isWorking || !sessionStartTime) return
    setSessionTimer(Math.floor((Date.now() - sessionStartTime) / 1000))
    const interval = setInterval(() => {
      setSessionTimer(Math.floor((Date.now() - sessionStartTime) / 1000))
    }, 1000)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        setSessionTimer(Math.floor((Date.now() - sessionStartTime) / 1000))
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [isWorking, sessionStartTime])

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (!isWorking) return
      e.preventDefault()
      e.returnValue = 'Bạn đang check-in. Nếu thoát, ca làm việc sẽ không được kết thúc đúng cách.'
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isWorking])

  useEffect(() => {
    if (!imageLightboxUrl) return
    const onKey = e => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation()
        setImageLightboxUrl(null)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [imageLightboxUrl])

  const formatTimer = (seconds) => {
    const h = String(Math.floor(seconds / 3600)).padStart(2, '0')
    const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')
    const s = String(seconds % 60).padStart(2, '0')
    return `${h}:${m}:${s}`
  }

  const handleCheckIn = async () => {
    if (!currentUser) {
      setToast({ message: 'Không xác định được tài khoản đang đăng nhập!', type: 'error' })
      return
    }
    try {
      // 1. Lấy ngày hôm nay theo giờ địa phương (tránh lệch múi giờ quốc tế)
      const now = new Date()
      const localDate = new Date(now.getTime() - (now.getTimezoneOffset() * 60000))
      const today = localDate.toISOString().split('T')[0]
      const startOfDay = `${today}T00:00:00.000`
      const endOfDay = `${today}T23:59:59.999`

      // 2. Lấy việc từ bảng Lịch trình (Chỉ lấy việc của ngày hôm nay)
      const { data: wsTasks } = await supabase
        .from('work_schedules')
        .select('*')
        .eq('assigned_to', currentUser.user_id)
        .gte('scheduled_at', startOfDay)
        .lte('scheduled_at', endOfDay)
        .neq('status', 'completed')

      // 3. Lấy việc từ bảng Nhân sự (Công việc của nhân viên: Hạn chót hôm nay HOẶC đang làm dở)
      const { data: stTasks } = await supabase
        .from('subtasks')
        .select('subtask_id, name, status, plan_target_at, deadline')
        .eq('assigned_to', currentUser.user_id)
        .neq('status', 'completed')
        .or(`plan_target_at.lte.${endOfDay},deadline.lte.${endOfDay},status.eq.in_progress,and(plan_target_at.is.null,deadline.is.null,status.eq.pending)`)

      const tasksData = []

      // Nạp việc từ Lịch trình
      wsTasks?.forEach(ws => {
        tasksData.push({
          subtask_id: ws.schedule_id,
          title: ws.title,
          status: ws.status || 'in_progress',
          percent: 0,
          work_detail: ws.description,
          report_images: ws.image_urls || [],
          start_time: ws.scheduled_at
        })
      })

      // Nạp việc từ Nhân sự (Tránh trùng lặp ID nếu có)
      stTasks?.forEach(st => {
        if (!tasksData.some(t => t.subtask_id === st.subtask_id)) {
          tasksData.push({
            subtask_id: st.subtask_id,
            title: st.name,
            status: st.status || 'in_progress',
            percent: 0,
            work_detail: '',
            report_images: [],
            start_time: st.plan_target_at
          })
        }
      })

      // 4. Tạo ca làm việc mới
      const { data, error } = await supabase
        .from('work_sessions')
        .insert({
          user_id: currentUser.user_id,
          work_date: today,
          status: 'working',
          tasks_data: tasksData
        })
        .select('*')
        .single()

      if (error) throw error
      const startTime = Date.now()
      localStorage.setItem('checkin_session_id', data.session_id)
      localStorage.setItem('checkin_user_id', currentUser.user_id)
      localStorage.setItem('checkin_start_time', String(startTime))
      setActiveSessionId(data.session_id)
      setIsWorking(true)
      setSessionStartTime(startTime)
      setSessionTimer(0)
      setToast({ message: `Đã Check-in! Nạp thành công ${tasksData.length} việc từ Lịch trình hôm nay.`, type: 'success' })
      fetchAttendanceData()
    } catch (err) {
      console.error(err)
      setToast({ message: err.message || 'Lỗi check-in', type: 'error' })
    }
  }

  const handleCheckOut = async () => {
    if (!activeSessionId) return
    try {
      // 1. Chỉ cập nhật giờ ra và trạng thái hoàn thành ca làm việc
      const { error } = await supabase
        .from('work_sessions')
        .update({
          check_out_time: new Date().toISOString(),
          status: 'completed',
        })
        .eq('session_id', activeSessionId)

      if (error) throw error

      localStorage.removeItem('checkin_session_id')
      localStorage.removeItem('checkin_user_id')
      localStorage.removeItem('checkin_start_time')
      setActiveSessionId(null)
      setIsWorking(false)
      setSessionStartTime(null)
      setSessionTimer(0)
      setToast({ message: 'Đã Check-out và lưu danh sách công việc!', type: 'success' })
      fetchAttendanceData() // Tải lại bảng
    } catch (err) {
      console.error(err)
      setToast({ message: err.message || 'Lỗi check-out', type: 'error' })
    }
  }

  // 6. Hàm xóa các bản ghi chọn
  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) {
      setToast({ message: 'Vui lòng chọn ít nhất một bản ghi để xóa', type: 'warning' })
      return
    }
    setConfirmDeleteBulk(true)
  }

  const performDeleteSelected = async () => {
    setConfirmDeleteBulk(false)

    setDeleting(true)
    try {
      const idsArray = Array.from(selectedIds)

      // Kiểm tra xem có session nào đang hoạt động không để tránh xóa nhầm ca đang làm
      if (idsArray.includes(activeSessionId)) {
        // Ghi chú: Logic xác nhận xóa ca đang làm đã được gộp vào Modal xác nhận chung
      }

      const { error: deleteError, count } = await supabase
        .from('work_sessions')
        .delete({ count: 'exact' })
        .in('session_id', idsArray)

      if (deleteError) throw deleteError

      if (count === 0) {
        throw new Error('Không có bản ghi nào bị xóa. Vui lòng kiểm tra quyền hạn của bạn.')
      }

      // Nếu xóa đúng session đang làm việc thì reset state checkin
      if (idsArray.includes(activeSessionId)) {
        localStorage.removeItem('checkin_session_id')
        localStorage.removeItem('checkin_user_id')
        localStorage.removeItem('checkin_start_time')
        setActiveSessionId(null)
        setIsWorking(false)
      }

      // Xóa thành công: cập nhật state
      setAttendanceList(prev => prev.filter(row => !selectedIds.has(row.id)))
      setSelectedIds(new Set())
      setToast({ message: `Đã xóa ${count} bản ghi thành công`, type: 'success' })
    } catch (err) {
      console.error('Lỗi khi xóa nhiều:', err)
      setToast({ message: err.message || 'Không thể xóa bản ghi', type: 'error' })
    } finally {
      setDeleting(false)
    }
  }

  // 7. Hàm xóa 1 bản ghi duy nhất
  const handleDeleteSingle = (id) => {
    setConfirmDeleteId(id)
  }

  // 7.1. Hàm xử lý mở rộng hàng
  const toggleExpandRow = (id) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  const performDeleteSingle = async (id) => {
    setConfirmDeleteId(null)

    setDeleting(true)
    try {
      const { error: deleteError, count } = await supabase
        .from('work_sessions')
        .delete({ count: 'exact' })
        .eq('session_id', id)

      if (deleteError) throw deleteError

      if (count === 0) {
        throw new Error('Không thể xóa bản ghi. Có thể bạn không có quyền hoặc bản ghi không tồn tại.')
      }

      // Kiểm tra xem có đang xóa đúng ca làm việc hiện tại không
      const isDeletingActive = id === activeSessionId
      if (isDeletingActive) {
        localStorage.removeItem('checkin_session_id')
        localStorage.removeItem('checkin_user_id')
        localStorage.removeItem('checkin_start_time')
        setActiveSessionId(null)
        setIsWorking(false)
      }

      setAttendanceList(prev => prev.filter(row => row.id !== id))
      if (selectedIds.has(id)) {
        const newSet = new Set(selectedIds)
        newSet.delete(id)
        setSelectedIds(newSet)
      }
      setToast({ message: 'Đã xóa bản ghi thành công', type: 'success' })
    } catch (err) {
      console.error('Lỗi khi xóa đơn:', err)
      setToast({ message: err.message || 'Không thể xóa bản ghi', type: 'error' })
    } finally {
      setDeleting(false)
    }
  }
  // 7.2. [Admin] Nghiệm thu: set status='completed', percent=100, is_approved=true, set end_time = now
  const handleAcceptTask = async (sessionId, subtaskId) => {
    if (role !== 'admin') {
      setToast({ message: 'Lỗi 403: Bạn không có quyền nghiệm thu!', type: 'error' })
      return
    }
    try {
      const session = attendanceList.find(s => s.id === sessionId)
      if (!session) return

      const now = new Date().toISOString()
      const updatedTasksData = session.tasks_data.map(t =>
        t.subtask_id === subtaskId
          ? { ...t, status: 'completed', is_approved: true, percent: 100, end_time: now }
          : t
      )

      // 1. Cập nhật bảng work_sessions (JSONB tasks_data)
      const { error: sessionErr } = await supabase.from('work_sessions')
        .update({ tasks_data: updatedTasksData }).eq('session_id', sessionId)
      if (sessionErr) throw sessionErr

      // 2. Đồng bộ trạng thái vào bảng subtasks gốc
      const { error: subtaskErr } = await supabase.from('subtasks')
        .update({
          status: 'completed',
          completed_at: now
        })
        .eq('subtask_id', subtaskId)
      if (subtaskErr) console.error('Lỗi đồng bộ subtask:', subtaskErr)

      setToast({ message: 'Đã nghiệm thu công việc!', type: 'success' })
      fetchAttendanceData()
    } catch (err) {
      console.error(err)
      setToast({ message: 'Lỗi khi nghiệm thu', type: 'error' })
    }
  }

  // 7.3. [Admin] Từ chối: set status='rejected', lưu lý do vào comment
  const handleRejectTask = async () => {
    if (role !== 'admin') return
    const { sessionId, subtaskId, reason } = rejectModal
    if (!reason.trim()) {
      setToast({ message: 'Vui lòng nhập lý do từ chối.', type: 'warning' })
      return
    }
    try {
      const session = attendanceList.find(s => s.id === sessionId)
      if (!session) return
      const updatedTasksData = session.tasks_data.map(t =>
        t.subtask_id === subtaskId
          ? { ...t, status: 'rejected', is_approved: false, comment: reason.trim() }
          : t
      )
      const { error } = await supabase.from('work_sessions')
        .update({ tasks_data: updatedTasksData }).eq('session_id', sessionId)
      if (error) throw error
      setToast({ message: 'Đã từ chối và gửi phản hồi!', type: 'success' })
      setRejectModal({ open: false, sessionId: null, subtaskId: null, reason: '' })
      fetchAttendanceData()
    } catch (err) {
      console.error(err)
      setToast({ message: 'Lỗi khi từ chối', type: 'error' })
    }
  }

  // [Admin] Nhận xét: cập nhật comment mà không đổi trạng thái
  const handleCommentTask = async () => {
    if (role !== 'admin') return
    const { sessionId, subtaskId, comment } = commentModal
    if (!comment.trim()) {
      setToast({ message: 'Vui lòng nhập nhận xét.', type: 'warning' })
      return
    }
    try {
      const session = attendanceList.find(s => s.id === sessionId)
      if (!session) return
      const updatedTasksData = session.tasks_data.map(t =>
        t.subtask_id === subtaskId
          ? { ...t, comment: comment.trim() }
          : t
      )
      const { error } = await supabase.from('work_sessions')
        .update({ tasks_data: updatedTasksData }).eq('session_id', sessionId)
      if (error) throw error
      setToast({ message: 'Đã lưu nhận xét!', type: 'success' })
      setCommentModal({ open: false, sessionId: null, subtaskId: null, comment: '' })
      fetchAttendanceData()
    } catch (err) {
      console.error(err)
      setToast({ message: 'Lỗi khi lưu nhận xét', type: 'error' })
    }
  }

  // 7.4. [Employee] Lưu báo cáo: set status='pending_approval'
  const handleSaveReport = async (reportData) => {
    const { subtask_id, report_content, report_images, percent, status, reported_at } = reportData
    try {
      const session = attendanceList.find(s => s.id === reportModal.sessionId)
      if (!session) return
      const updatedTasksData = session.tasks_data.map(t =>
        t.subtask_id === subtask_id
          ? { ...t, report_content, report_images, percent, status, reported_at }
          : t
      )
      const { error } = await supabase.from('work_sessions')
        .update({ tasks_data: updatedTasksData }).eq('session_id', reportModal.sessionId)
      if (error) throw error
      setToast({ message: 'Đã gửi báo cáo! Chờ Admin duyệt.', type: 'success' })
      setReportModal({ open: false, sessionId: null, task: null })
      fetchAttendanceData()
    } catch (err) {
      console.error(err)
      setToast({ message: err.message || 'Lỗi khi gửi báo cáo', type: 'error' })
    }
  }

  const handleFinishTask = async (sessionId, subtaskId) => {
    setLoadingAction(subtaskId)
    try {
      const session = attendanceList.find(s => s.id === sessionId)
      if (!session) return

      const updatedTasksData = session.tasks_data
        .map(t =>
          t.subtask_id === subtaskId ? { ...t, end_time: new Date().toISOString() } : t
        )
        .map(normalizeTaskForDb)

      const { error } = await supabase
        .from('work_sessions')
        .update({ tasks_data: updatedTasksData })
        .eq('session_id', sessionId)

      if (error) throw error
      setToast({ message: 'Đã ghi nhận thời gian kết thúc!', type: 'success' })
      fetchAttendanceData()
    } catch (err) {
      console.error(err)
      setToast({ message: err.message || 'Lỗi khi kết thúc công việc', type: 'error' })
    } finally {
      setLoadingAction(null)
    }
  }

  const normalizeTaskForDb = (task) => ({
    subtask_id: task?.subtask_id ?? null,
    task_id: task?.task_id ?? null,
    title: task?.title ?? '',
    parent_task_name: task?.parent_task_name ?? null,
    work_detail: typeof task?.work_detail === 'string' ? task.work_detail : '',
    percent: typeof task?.percent === 'number' ? task.percent : (task?.is_approved ? 100 : 0),
    comment: task?.comment ?? '',
    is_approved: !!task?.is_approved,
    status: task?.status ?? 'in_progress',
    report_content: task?.report_content ?? '',
    report_images: Array.isArray(task?.report_images)
      ? task.report_images.filter(u => typeof u === 'string' && u.trim())
      : [],
    reported_at: task?.reported_at ?? null,
    start_time: task?.start_time ?? null,
    end_time: task?.end_time ?? null,
  })

  const activeSessionRow = activeSessionId ? attendanceList.find(s => s.id === activeSessionId) : null

  const canEditTaskPercent = (row) =>
    canEditDelete || (currentUser?.user_id && row?.ownerUserId === currentUser.user_id)

  const uploadEditTaskReportImages = async (fileList) => {
    const files = Array.from(fileList || []).filter(f => f?.type?.startsWith('image/'))
    if (files.length === 0) return
    if (!isCloudinaryUploadConfigured()) {
      setToast({
        message: 'Chưa cấu hình Cloudinary. Thêm VITE_CLOUDINARY_CLOUD_NAME và VITE_CLOUDINARY_UPLOAD_PRESET vào .env rồi khởi động lại dev server.',
        type: 'warning',
      })
      return
    }
    setEditImagesUploading(n => n + 1)
    try {
      const urls = []
      for (const file of files) {
        const name = file instanceof File && file.name ? file.name : `paste_${Date.now()}.png`
        urls.push(await uploadImageBlobToCloudinary(file, name))
      }
      setEditPercentModal(m => ({
        ...m,
        report_images: [...(Array.isArray(m.report_images) ? m.report_images : []), ...urls],
      }))
      setToast({ message: `Đã thêm ${urls.length} ảnh lên Cloudinary.`, type: 'success' })
    } catch (err) {
      console.error(err)
      setToast({ message: err.message || 'Lỗi tải ảnh lên Cloudinary', type: 'error' })
    } finally {
      setEditImagesUploading(n => Math.max(0, n - 1))
    }
  }

  const openEditPercentModal = (sessionId, task) => {
    const pct = typeof task.percent === 'number' ? task.percent : (task.is_approved ? 100 : 0)
    const safePct = Math.max(0, Math.min(100, Number(pct) || 0))
    setEditPercentModal({
      open: true,
      sessionId,
      subtaskId: task.subtask_id,
      title: task.title || '',
      work_detail: typeof task.work_detail === 'string' ? task.work_detail : '',
      report_content: typeof task.report_content === 'string' ? task.report_content : '',
      report_images: Array.isArray(task.report_images)
        ? task.report_images.filter(u => typeof u === 'string' && u.trim())
        : [],
      percent: safePct,
    })
  }

  const handleSaveTaskPercent = async (e) => {
    e.preventDefault()
    if (editImagesUploading > 0) {
      setToast({ message: 'Vẫn đang tải ảnh lên Cloudinary, vui lòng đợi.', type: 'warning' })
      return
    }
    const { sessionId, subtaskId, percent, title, work_detail, report_content, report_images } = editPercentModal
    const p = Math.round(Number(percent))
    const titleTrim = (title || '').trim()
    const detailTrim = (work_detail || '').trim()
    const reportTrim = (report_content || '').trim()
    const imagesArr = Array.isArray(report_images)
      ? report_images.filter(u => typeof u === 'string' && u.trim())
      : []

    if (!sessionId || subtaskId == null) {
      setToast({ message: 'Thiếu thông tin phiên làm việc.', type: 'warning' })
      return
    }
    if (!titleTrim) {
      setToast({ message: 'Tên công việc không được để trống.', type: 'warning' })
      return
    }
    if (!Number.isFinite(p) || p < 0 || p > 100) {
      setToast({ message: 'Phần trăm hoàn thành phải từ 0 đến 100.', type: 'warning' })
      return
    }

    const session = attendanceList.find(s => s.id === sessionId)
    if (!session) return

    if (!canEditTaskPercent(session)) {
      setToast({ message: 'Bạn không có quyền sửa tiến độ ca này.', type: 'error' })
      return
    }

    setIsSavingPercent(true)
    try {
      const updatedTasksData = session.tasks_data
        .map(t => (t.subtask_id === subtaskId
          ? {
            ...t,
            percent: p,
            title: titleTrim,
            work_detail: detailTrim,
            report_content: reportTrim,
            report_images: imagesArr,
          }
          : t))
        .map(normalizeTaskForDb)

      const { error: updateError } = await supabase
        .from('work_sessions')
        .update({ tasks_data: updatedTasksData })
        .eq('session_id', sessionId)

      if (updateError) throw updateError

      setToast({ message: 'Đã cập nhật công việc.', type: 'success' })
      setEditPercentModal({ open: false, sessionId: null, subtaskId: null, title: '', work_detail: '', report_content: '', report_images: [], percent: 0 })
      fetchAttendanceData()
    } catch (err) {
      console.error(err)
      setToast({ message: err.message || 'Lỗi khi lưu công việc', type: 'error' })
    } finally {
      setIsSavingPercent(false)
    }
  }

  const resetAddTaskSearchUi = () => {
    setAddTaskProjectQuery('')
    setAddTaskTaskQuery('')
    setAddTaskShowProjectSuggest(false)
    setAddTaskShowTaskSuggest(false)
  }

  const openAddTaskModal = (sessionId) => {
    setAddTaskTargetSessionId(sessionId ?? null)
    setNewTaskForm({
      project_id: '',
      pick_row_key: '',
      task_id: '',
      title: '',
      work_detail: '',
      percent: 0,
      parent_task_name: '',
    })
    setAddTaskAssigneeSubtasks([])
    resetAddTaskSearchUi()
    setAddTaskModalOpen(true)
  }

  useEffect(() => {
    if (!addTaskModalOpen || !user?.user_id) return
    let cancelled = false
      ; (async () => {
        setPickListLoading(true)
        try {
          const { data, error } = await supabase
            .from('projects')
            .select(`
            project_id,
            name,
            project_assignments(user_id),
            features(
              feature_id,
              name,
              tasks(task_id, name, status)
            )
          `)
            .order('name', { ascending: true })
          if (error) throw error
          let list = data || []
          if (role === 'employee') {
            list = list.filter(p =>
              p.project_assignments?.some(a => a.user_id === user.user_id)
            )
          }
          if (!cancelled) setPickListProjects(list)
        } catch (e) {
          console.error(e)
          if (!cancelled) setPickListProjects([])
        } finally {
          if (!cancelled) setPickListLoading(false)
        }
      })()
    return () => { cancelled = true }
  }, [addTaskModalOpen, user?.user_id, role])

  // Tải subtask đang làm / chờ được giao cho chủ ca (theo dự án đang chọn trong modal)
  useEffect(() => {
    if (!addTaskModalOpen || !newTaskForm.project_id) {
      setAddTaskAssigneeSubtasks([])
      return
    }
    const sessionId = addTaskTargetSessionId || activeSessionId
    const sessionRow = sessionId ? attendanceList.find(s => s.id === sessionId) : null
    const assigneeId = sessionRow?.ownerUserId ?? currentUser?.user_id ?? user?.user_id
    if (!assigneeId) {
      setAddTaskAssigneeSubtasks([])
      return
    }
    const projectId = newTaskForm.project_id
    let cancelled = false
      ; (async () => {
        setAddTaskAssigneeSubtasksLoading(true)
        try {
          const { data, error } = await supabase
            .from('subtasks')
            .select(`
            subtask_id,
            name,
            status,
            task_id,
            task:tasks(name, feature:features(name, project_id))
          `)
            .eq('assigned_to', assigneeId)
            .in('status', ['in_progress', 'pending'])
          if (error) throw error
          const rows = []
          for (const st of data || []) {
            const taskRel = Array.isArray(st.task) ? st.task[0] : st.task
              ?? (Array.isArray(st.tasks) ? st.tasks[0] : st.tasks)
            const feat = taskRel?.feature
            const feature = Array.isArray(feat) ? feat[0] : feat
            if (!feature || feature.project_id !== projectId) continue
            rows.push({
              subtask_id: st.subtask_id,
              task_id: st.task_id,
              name: st.name,
              status: st.status,
              featureName: feature.name || '',
              parentTaskName: taskRel?.name || '',
            })
          }
          rows.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'vi'))
          if (!cancelled) setAddTaskAssigneeSubtasks(rows)
        } catch (e) {
          console.error(e)
          if (!cancelled) setAddTaskAssigneeSubtasks([])
        } finally {
          if (!cancelled) setAddTaskAssigneeSubtasksLoading(false)
        }
      })()
    return () => { cancelled = true }
  }, [addTaskModalOpen, newTaskForm.project_id, addTaskTargetSessionId, activeSessionId, attendanceList, currentUser?.user_id, user?.user_id])

  const tasksForPickedProject = useMemo(() => {
    const p = pickListProjects.find(x => x.project_id === newTaskForm.project_id)
    const subRows = (addTaskAssigneeSubtasks || []).map(s => ({
      rowKey: `sub-${s.subtask_id}`,
      pickKind: 'subtask',
      task_id: s.task_id,
      subtask_id: s.subtask_id,
      name: s.name,
      status: s.status,
      featureName: s.featureName,
      parentTaskName: s.parentTaskName,
      suggestLabel: `${s.featureName} › ${s.parentTaskName} › ${s.name}`,
    }))
    if (!p?.features?.length) return subRows
    const parentRows = []
    for (const f of p.features) {
      for (const t of f.tasks || []) {
        parentRows.push({
          rowKey: `task-${t.task_id}`,
          pickKind: 'task',
          task_id: t.task_id,
          subtask_id: null,
          name: t.name,
          status: t.status,
          featureName: f.name,
          parentTaskName: '',
          suggestLabel: `${f.name} › ${t.name}`,
        })
      }
    }
    parentRows.sort((a, b) => a.name.localeCompare(b.name, 'vi'))
    return [...subRows, ...parentRows]
  }, [pickListProjects, newTaskForm.project_id, addTaskAssigneeSubtasks])

  const addTaskProjectSuggestions = useMemo(() => {
    const q = addTaskProjectQuery.trim().toLowerCase()
    let list = pickListProjects
    if (q) {
      list = list.filter(p => (p.name || '').toLowerCase().includes(q))
    }
    return list.slice(0, 40)
  }, [pickListProjects, addTaskProjectQuery])

  /** Mục gợi ý task: có dòng phân loại “đang làm” vs task trong cây dự án */
  const addTaskTaskPickEntries = useMemo(() => {
    const q = addTaskTaskQuery.trim().toLowerCase()
    const match = (r) =>
      !q ||
      (r.suggestLabel || '').toLowerCase().includes(q) ||
      (r.status || '').toLowerCase().includes(q)
    const subs = tasksForPickedProject.filter(r => r.pickKind === 'subtask').filter(match)
    const tasks = tasksForPickedProject.filter(r => r.pickKind === 'task').filter(match)
    const out = []
    if (subs.length) {
      out.push({ kind: 'header', key: 'hdr-doing', label: 'Công việc đang làm (được giao)' })
      subs.forEach(r => out.push({ kind: 'row', key: r.rowKey, row: r }))
    }
    if (tasks.length) {
      out.push({ kind: 'header', key: 'hdr-tree', label: 'Task theo tính năng' })
      tasks.forEach(r => out.push({ kind: 'row', key: r.rowKey, row: r }))
    }
    return out.slice(0, 80)
  }, [tasksForPickedProject, addTaskTaskQuery])

  const handleAddTaskToSession = async (e) => {
    e.preventDefault()
    const targetSessionId = addTaskTargetSessionId || activeSessionId
    if (!targetSessionId) {
      setToast({ message: 'Không xác định được ca làm việc để thêm công việc.', type: 'warning' })
      return
    }

    const percent = Number(newTaskForm.percent)
    const picked = tasksForPickedProject.find(t => t.rowKey === newTaskForm.pick_row_key)
    const title = picked?.name?.trim() || (newTaskForm.title || '').trim()
    const project = pickListProjects.find(p => p.project_id === newTaskForm.project_id)

    if (!newTaskForm.project_id) {
      setToast({ message: 'Vui lòng chọn dự án (project).', type: 'warning' })
      return
    }
    if (!newTaskForm.pick_row_key || !picked) {
      setToast({ message: 'Vui lòng chọn công việc trong danh sách.', type: 'warning' })
      return
    }
    if (!title) {
      setToast({ message: 'Không xác định được tên công việc.', type: 'warning' })
      return
    }

    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      setToast({ message: 'Phần trăm hoàn thành phải từ 0 đến 100.', type: 'warning' })
      return
    }

    setIsAddingTask(true)
    try {
      const workDetail = (newTaskForm.work_detail || '').trim()
      const parentLabel = project && picked
        ? (picked.pickKind === 'subtask'
          ? `${project.name} › ${picked.featureName} › ${picked.parentTaskName}`
          : `${project.name} › ${picked.featureName}`)
        : null

      const newTask = picked.pickKind === 'subtask'
        ? {
          subtask_id: picked.subtask_id,
          task_id: picked.task_id,
          title,
          parent_task_name: parentLabel,
          work_detail: workDetail,
          percent,
          comment: '',
          is_approved: false,
          status: 'in_progress',
          report_content: '',
          report_images: [],
          reported_at: null,
          start_time: new Date().toISOString(),
          end_time: null,
        }
        : {
          subtask_id: `task_${picked.task_id}`,
          task_id: picked.task_id,
          title,
          parent_task_name: parentLabel,
          work_detail: workDetail,
          percent,
          comment: '',
          is_approved: false,
          status: 'in_progress',
          report_content: '',
          report_images: [],
          reported_at: null,
          start_time: new Date().toISOString(),
          end_time: null,
        }

      const targetRow = attendanceList.find(s => s.id === targetSessionId) || null
      const currentTasks = (targetRow?.tasks_data || []).map(normalizeTaskForDb)
      const updatedTasksData = [...currentTasks, newTask]

      const { error: updateError } = await supabase
        .from('work_sessions')
        .update({ tasks_data: updatedTasksData })
        .eq('session_id', targetSessionId)

      if (updateError) throw updateError

      setToast({ message: 'Đã thêm công việc!', type: 'success' })
      setAddTaskModalOpen(false)
      setAddTaskTargetSessionId(null)
      setNewTaskForm({
        project_id: '',
        pick_row_key: '',
        task_id: '',
        title: '',
        work_detail: '',
        percent: 0,
        parent_task_name: '',
      })
      resetAddTaskSearchUi()
      fetchAttendanceData()
    } catch (err) {
      console.error(err)
      setToast({ message: err.message || 'Lỗi khi thêm công việc', type: 'error' })
    } finally {
      setIsAddingTask(false)
    }
  }

  // 8. Hàm lưu bản ghi sau khi sửa
  const handleSaveEdit = async (e) => {
    e.preventDefault()
    if (!editingRecord) return

    const { id, in_date, in_h, in_m, out_date, out_h, out_m } = editingRecord

    setIsUpdating(true)
    try {
      const createISO = (dateStr, h, m) => {
        if (!dateStr || !h || !m) return null
        const [year, mon, day] = dateStr.split('-')
        const dateObj = new Date(parseInt(year), parseInt(mon) - 1, parseInt(day), parseInt(h), parseInt(m))
        return dateObj.toISOString()
      }

      const finalCheckIn = createISO(in_date, in_h, in_m)
      const finalCheckOut = (out_date && out_h && out_m) ? createISO(out_date, out_h, out_m) : null

      // Tính toán total_hours
      let total_hours = null
      if (finalCheckIn && finalCheckOut) {
        const diffMs = new Date(finalCheckOut) - new Date(finalCheckIn)
        if (diffMs < 0) {
          throw new Error('Lỗi: Giờ ra không thể trước Giờ vào!')
        }
        total_hours = parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2))
      }

      const { error: updateError } = await supabase
        .from('work_sessions')
        .update({
          work_date: in_date, // Lấy ngày vào làm ngày của bản ghi
          check_in_time: finalCheckIn,
          check_out_time: finalCheckOut,
          total_hours
        })
        .eq('session_id', id)

      if (updateError) throw updateError

      setToast({ message: 'Cập nhật bản ghi thành công', type: 'success' })
      setEditingRecord(null)
      fetchAttendanceData()
    } catch (err) {
      console.error('Lỗi khi sửa:', err)
      setToast({ message: err.message || 'Không thể cập nhật bản ghi', type: 'error' })
    } finally {
      setIsUpdating(false)
    }
  }

  // -- TỰ ĐỘNG ĐỒNG BỘ VIỆC MỚI (REALTIME) --
  useEffect(() => {
    if (!isWorking || !currentUser || !activeSessionId) return

    const channel = supabase
      .channel(`sync_work_${activeSessionId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'work_schedules',
        filter: `assigned_to=eq.${currentUser.user_id}`
      }, async (payload) => {
        const newTask = payload.new
        const today = new Date().toISOString().split('T')[0]

        if (newTask.scheduled_at?.startsWith(today) || newTask.deadline?.startsWith(today)) {
          try {
            const { data: session } = await supabase
              .from('work_sessions')
              .select('tasks_data')
              .eq('session_id', activeSessionId)
              .single()

            const currentTasks = session?.tasks_data || []
            // Kiểm tra tránh trùng lặp
            if (!currentTasks.find(t => t.subtask_id === newTask.schedule_id)) {
              const updatedTasks = [...currentTasks, {
                subtask_id: newTask.schedule_id,
                title: newTask.title,
                status: 'in_progress',
                percent: 0,
                work_detail: newTask.description,
                report_images: newTask.image_urls || []
              }]

              await supabase.from('work_sessions').update({ tasks_data: updatedTasks }).eq('session_id', activeSessionId)
              fetchAttendanceData()
              setToast({ message: '🔔 Sếp vừa giao thêm việc mới cho bạn!', type: 'info' })
            }
          } catch (err) {
            console.error('Auto-sync error:', err)
          }
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [isWorking, currentUser, activeSessionId])

  return (
    <>
      <div className="flex h-screen overflow-hidden bg-[#faf8ff] text-[13px]">
        <Sidebar />

        <div className="flex-1 md:ml-64 flex flex-col h-screen overflow-y-auto">
          <TopBar title="Bảng Chấm Công" />

          <main className="flex-1 p-4 md:p-8">
            <div className="max-w-7xl mx-auto space-y-6 pb-20">

              {/* Toast Notification */}
              {toast && (
                <div className={`fixed top-4 right-4 px-5 py-3 rounded-2xl shadow-2xl text-white z-[100] animate-in fade-in slide-in-from-top-4 flex items-center gap-3 font-bold border border-white/20 ${toast.type === 'success' ? 'bg-emerald-500' :
                  toast.type === 'error' ? 'bg-red-500' :
                    'bg-amber-500'
                  }`}>
                  <span className="material-symbols-outlined">
                    {toast.type === 'success' ? 'check_circle' : toast.type === 'error' ? 'error' : 'warning'}
                  </span>
                  {toast.message}
                </div>
              )}

              {/* 1. Mobile Header (Dành riêng cho < 640px) */}
              {showMobileHeader ? (
                <div className="block sm:hidden bg-white border border-slate-200 rounded-2xl sticky top-[72px] z-[30] mb-4 p-3 shadow-lg animate-in fade-in zoom-in-95 duration-200 flex flex-col gap-2.5">
                  {/* Lớp 1: Tiêu đề & Nút đóng */}
                  <div className="flex items-center justify-between">
                    <h1 className="text-[11px] font-black text-slate-800 flex items-center gap-2 uppercase tracking-tight">
                      <div className="w-1 h-3 bg-blue-600 rounded-full"></div>
                      Bảng Chấm Công
                    </h1>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => fetchAttendanceData()}
                        className="p-1.5 hover:bg-slate-100 rounded-full transition-colors active:scale-90"
                      >
                        <span className="material-symbols-outlined text-[14px] text-slate-400">refresh</span>
                      </button>
                      <button
                        onClick={() => setShowMobileHeader(false)}
                        className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-full transition-colors active:scale-90"
                      >
                        <span className="material-symbols-outlined text-[18px]">close</span>
                      </button>
                    </div>
                  </div>

                  {/* Lớp 2: Nhóm Hành động & Đồng hồ LED */}
                  <div className="grid grid-cols-3 items-center gap-2 p-1 bg-slate-50 rounded-xl border border-slate-100">
                    <button
                      onClick={handleCheckIn}
                      disabled={isWorking}
                      className="h-8 flex items-center justify-center gap-1.5 bg-white border border-blue-100 rounded-lg shadow-sm active:scale-95 disabled:opacity-50 transition-all"
                    >
                      <span className="material-symbols-outlined text-[12px] text-blue-600">login</span>
                      <span className="text-[9px] font-bold text-blue-700">Vào</span>
                    </button>

                    <div className="h-8 flex items-center justify-center bg-[#0a0a0a] rounded-lg border border-slate-800 shadow-[inset_0_0_8px_rgba(34,197,94,0.3)]">
                      <span className="font-mono text-[11px] font-black text-green-400 drop-shadow-[0_0_3px_rgba(74,222,128,0.5)] tracking-tighter">
                        {formatTimer(sessionTimer)}
                      </span>
                    </div>

                    <button
                      onClick={handleCheckOut}
                      disabled={!isWorking}
                      className="h-8 flex items-center justify-center gap-1.5 bg-white border border-red-100 rounded-lg shadow-sm active:scale-95 disabled:opacity-50 transition-all"
                    >
                      <span className="material-symbols-outlined text-[12px] text-red-600">logout</span>
                      <span className="text-[9px] font-bold text-red-700">Ra</span>
                    </button>
                  </div>

                  {/* Lớp 3: Bộ lọc (Tinh gọn) */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="relative group">
                      <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-[12px] text-slate-400">event</span>
                      <input
                        type="date"
                        value={filterDate}
                        onChange={e => {
                          setFilterDate(e.target.value)
                          if (e.target.value) setFilterMonth('')
                        }}
                        className="w-full h-7 pl-7 pr-1 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-medium outline-none"
                      />
                    </div>
                    {role !== 'employee' && (
                      <div className="relative">
                        <div
                          onClick={() => setIsMobileStaffOpen(!isMobileStaffOpen)}
                          className="w-full h-7 pl-7 pr-6 bg-slate-50 border border-slate-200 rounded-lg text-[10px] flex items-center cursor-pointer font-medium"
                        >
                          <span className="material-symbols-outlined absolute left-2 text-[12px] text-slate-400">group</span>
                          <span className="truncate">
                            {staffList.find(s => s.user_id === filterUser)?.full_name || 'Nhân sự'}
                          </span>
                          <span className="material-symbols-outlined absolute right-1 text-[12px] text-slate-400">expand_more</span>
                        </div>

                        {isMobileStaffOpen && (
                          <>
                            <div className="fixed inset-0 z-[90]" onClick={() => setIsMobileStaffOpen(false)} />
                            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-[100] max-h-60 overflow-y-auto py-1 animate-in fade-in zoom-in-95 duration-100">
                              <div
                                onClick={() => { setFilterUser('all'); setIsMobileStaffOpen(false); }}
                                className={`py-1.5 px-3 text-[10px] truncate cursor-pointer hover:bg-slate-50 transition-colors ${filterUser === 'all' ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-700'}`}
                              >
                                Tất cả nhân sự
                              </div>
                              {staffList.map(staff => (
                                <div
                                  key={staff.user_id}
                                  onClick={() => { setFilterUser(staff.user_id); setIsMobileStaffOpen(false); }}
                                  className={`py-1.5 px-3 text-[10px] truncate cursor-pointer hover:bg-slate-50 transition-colors ${filterUser === staff.user_id ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-700'}`}
                                >
                                  {staff.full_name}
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowMobileHeader(true)}
                  className="block sm:hidden fixed top-[80px] right-4 z-[30] bg-blue-600 text-white p-2.5 rounded-full shadow-lg animate-in fade-in slide-in-from-right-4 active:scale-90 transition-all border border-white/20"
                >
                  <span className="material-symbols-outlined text-[18px] animate-spin-slow">refresh</span>
                </button>
              )}

              {/* 1. Desktop Header (Ẩn trên Mobile) */}
              <div className="hidden sm:flex bg-white/60 backdrop-blur-md rounded-2xl border border-slate-200/60 p-4 shadow-sm flex-col xl:flex-row xl:items-center justify-between gap-6">

                {/* Cánh trái: Tiêu đề & Badge */}
                <div className="flex items-center gap-4">
                  <div className="p-2.5 bg-blue-600 rounded-xl shadow-lg shadow-blue-200">
                    <span className="material-symbols-outlined text-white text-[22px] block">calendar_month</span>
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-800 leading-tight">Bảng Chấm Công</h2>
                    {selectedIds.size > 0 ? (
                      <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">
                        Đã chọn {selectedIds.size} bản ghi
                      </span>
                    ) : (
                      <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                        Quản lý ca làm việc
                      </span>
                    )}
                  </div>
                </div>

                {/* Cụm trung tâm: CHECK-IN/OUT & TIMER (Gọn gàng hơn) */}
                <div className="flex items-center gap-2 mx-auto xl:mx-0">
                  <button
                    type="button"
                    onClick={handleCheckIn}
                    disabled={isWorking}
                    className={`flex items-center gap-1.5 px-3 h-9 rounded-xl text-[11px] font-bold border transition-all active:scale-95 ${isWorking
                      ? 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed'
                      : 'bg-white border-blue-100 text-blue-700 shadow-sm hover:shadow-md hover:border-blue-200'
                      }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">login</span>
                    Check-in
                  </button>

                  <div className={`flex items-center justify-center px-3 min-w-[90px] h-9 rounded-xl border border-slate-200/60 bg-white/50 shadow-inner ${isWorking ? 'text-emerald-600' : 'text-slate-400'}`}>
                    <span className="font-mono text-[14px] font-bold tracking-wider leading-none">
                      {formatTimer(sessionTimer)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleCheckOut}
                    disabled={!isWorking}
                    className={`flex items-center gap-1.5 px-3 h-9 rounded-xl text-[11px] font-bold border transition-all active:scale-95 ${!isWorking
                      ? 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed'
                      : 'bg-white border-red-100 text-red-600 shadow-sm hover:shadow-md hover:border-red-200'
                      }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">logout</span>
                    Check-out
                  </button>

                  <div className="w-px h-5 bg-slate-200 mx-1" />



                  <button
                    type="button"
                    onClick={() => {
                      setFilterDate('')
                      setFilterMonth('')
                      setFilterUser('all')
                    }}
                    className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-blue-600 transition-all group/reset"
                    title="Đặt lại bộ lọc"
                  >
                    <span className="material-symbols-outlined text-[20px] group-active/reset:rotate-180 transition-transform duration-300">restart_alt</span>
                  </button>
                </div>

                {/* Cánh phải: Bộ lọc & Action */}
                <div className="flex flex-wrap items-center justify-end gap-3">
                  <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200/60">
                    <div className="relative group">
                      <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[18px] text-slate-400 group-focus-within:text-blue-500 transition-colors">event</span>
                      <input
                        type="date"
                        value={filterDate}
                        onChange={e => {
                          setFilterDate(e.target.value)
                          if (e.target.value) setFilterMonth('')
                        }}
                        className="h-9 pl-9 pr-3 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-700 shadow-sm text-[12px] w-[145px] transition-all"
                      />
                    </div>

                    <div className="relative group">
                      <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[18px] text-slate-400 group-focus-within:text-blue-500 transition-colors">calendar_view_month</span>
                      <input
                        type="month"
                        value={filterMonth}
                        onChange={e => {
                          setFilterMonth(e.target.value)
                          if (e.target.value) setFilterDate('')
                        }}
                        className="h-9 pl-9 pr-3 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-700 shadow-sm text-[12px] w-[145px] transition-all"
                      />
                    </div>

                    {role !== 'employee' && (
                      <div className="relative">
                        <div
                          onClick={() => setIsDesktopStaffOpen(!isDesktopStaffOpen)}
                          className="h-9 pl-9 pr-8 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-700 shadow-sm text-[12px] min-w-[180px] flex items-center cursor-pointer hover:border-blue-400 transition-all"
                        >
                          <span className="material-symbols-outlined absolute left-2.5 text-[18px] text-slate-400">group</span>
                          <span className="truncate max-w-[120px]">
                            {staffList.find(s => s.user_id === filterUser)?.full_name || 'Tất cả nhân sự'}
                          </span>
                          <span className="material-symbols-outlined absolute right-2 text-[18px] text-slate-400 pointer-events-none">expand_more</span>
                        </div>

                        {isDesktopStaffOpen && (
                          <>
                            <div className="fixed inset-0 z-[90]" onClick={() => setIsDesktopStaffOpen(false)} />
                            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-[100] max-h-60 overflow-y-auto py-1 animate-in fade-in zoom-in-95 duration-100">
                              <div
                                onClick={() => { setFilterUser('all'); setIsDesktopStaffOpen(false); }}
                                className={`py-2 px-4 text-[12px] truncate cursor-pointer hover:bg-slate-50 transition-colors ${filterUser === 'all' ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-700'}`}
                              >
                                Tất cả nhân sự
                              </div>
                              {staffList.map(staff => (
                                <div
                                  key={staff.user_id}
                                  onClick={() => { setFilterUser(staff.user_id); setIsDesktopStaffOpen(false); }}
                                  className={`py-2 px-4 text-[12px] truncate cursor-pointer hover:bg-slate-50 transition-colors ${filterUser === staff.user_id ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-700'}`}
                                >
                                  {staff.full_name}
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {canEditDelete && selectedIds.size > 0 && (
                    <button
                      type="button"
                      onClick={handleDeleteSelected}
                      disabled={deleting}
                      className="h-10 px-5 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-xl font-bold text-[12px] shadow-lg shadow-red-200 transition-all flex items-center gap-2 active:scale-95"
                    >
                      <span className="material-symbols-outlined text-[18px]">delete_sweep</span>
                      XÓA {selectedIds.size} DÒNG
                    </button>
                  )}
                </div>
              </div>

              {/* Trạng thái lỗi (nếu có) */}
              {error && (
                <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-lg shadow-sm flex items-center gap-3 mt-4">
                  <span className="material-symbols-outlined">warning</span>
                  <span className="font-medium">{error}</span>
                </div>
              )}

              {/* Thêm công việc trong ca đang làm */}
              {isWorking && activeSessionId && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-4 py-3 sm:px-6 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <ClipboardList size={16} className="text-blue-600 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-[11px] font-black text-slate-700 uppercase tracking-wider truncate">
                          Công việc trong ca hiện tại
                        </div>
                        <div className="text-[11px] text-slate-400 font-medium truncate">
                          {activeSessionRow?.user?.name ? `Nhân sự: ${activeSessionRow.user.name}` : `Session: ${activeSessionId}`}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => openAddTaskModal(activeSessionId)}
                      className="h-9 px-3 sm:px-4 rounded-xl bg-blue-600 text-white font-bold text-[11px] shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95 flex items-center gap-2"
                    >
                      <span className="material-symbols-outlined text-[18px]">add</span>
                      Thêm công việc
                    </button>
                  </div>

                  <div className="p-4 sm:p-6">
                    {activeSessionRow?.tasks_data?.length ? (
                      <div className="space-y-3">
                        {activeSessionRow.tasks_data.map((t, idx) => {
                          const pct = typeof t.percent === 'number' ? t.percent : (t.is_approved ? 100 : 0)
                          const safePct = Math.max(0, Math.min(100, Number(pct) || 0))
                          return (
                            <div key={`${t.subtask_id || idx}`} className="p-3 rounded-2xl border border-slate-200 bg-white">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="font-bold text-slate-800 text-[12px] truncate">{t.title || 'Công việc'}</div>
                                  {t.work_detail ? (
                                    <p className="text-[10px] text-slate-600 mt-1 line-clamp-2 whitespace-pre-wrap">{t.work_detail}</p>
                                  ) : null}
                                  <div className="text-[10px] text-slate-400 font-medium">
                                    {t.start_fmt ? `Bắt đầu: ${t.start_fmt}` : ''}
                                  </div>
                                </div>
                                <div className="shrink-0 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <div className="text-[12px] font-black text-blue-600">{safePct}%</div>
                                    {activeSessionRow && canEditTaskPercent(activeSessionRow) && (
                                      <button
                                        type="button"
                                        onClick={() => openEditPercentModal(activeSessionId, t)}
                                        className="text-[10px] font-bold text-blue-600 hover:text-blue-800 underline underline-offset-2"
                                      >
                                        Sửa
                                      </button>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                    {t.is_approved ? 'Đã duyệt' : 'Chưa duyệt'}
                                  </div>
                                </div>
                              </div>
                              <div className="mt-2 w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-blue-600 transition-all duration-500"
                                  style={{ width: `${safePct}%` }}
                                />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="text-slate-500 italic text-[12px]">
                        Chưa có công việc nào. Bấm <strong>Thêm công việc</strong> để tạo công việc và % hoàn thành.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 2. Khu vực Bảng dữ liệu (Main Table) */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden min-h-[300px] relative">
                {/* Overlay Loading Siêu Xịn */}
                {loading && (
                  <div className="absolute inset-0 bg-white/70 backdrop-blur-sm z-10 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                  </div>
                )}

                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[800px]">
                    <thead className="bg-slate-50 text-slate-500 text-[12px] uppercase whitespace-nowrap">
                      <tr>
                        <th className="px-4 py-3 font-semibold border-b border-slate-200 w-12">
                          <input
                            type="checkbox"
                            checked={selectedIds.size > 0 && selectedIds.size === attendanceList.length}
                            onChange={toggleSelectAll}
                            className="w-4 h-4 cursor-pointer"
                          />
                        </th>
                        <th className="px-2 py-3 border-b border-slate-200 w-10"></th>
                        <th className="px-4 py-3 font-semibold border-b border-slate-200">Người làm</th>
                        <th className="px-4 py-3 font-semibold border-b border-slate-200">Ngày làm</th>
                        <th className="px-4 py-3 font-semibold border-b border-slate-200">Check-in</th>
                        <th className="px-4 py-3 font-semibold border-b border-slate-200">Check-out</th>
                        <th className="px-4 py-3 font-semibold border-b border-slate-200">Tổng giờ</th>
                        <th className="px-4 py-3 font-semibold border-b border-slate-200">Trạng thái</th>
                        {/* <th className="px-4 py-3 font-semibold border-b border-slate-200 w-1/3">Task hoàn thành</th> */}
                        {canEditDelete && <th className="px-4 py-3 font-semibold border-b border-slate-200 text-right">Thao tác</th>}
                      </tr>
                    </thead>

                    <tbody className="text-slate-700">
                      {!loading && attendanceList.map((row) => (
                        <React.Fragment key={row.id}>
                          <tr className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${expandedRows.has(row.id) ? 'bg-blue-50/30' : ''}`}>
                            <td className="px-4 py-3">
                              <input
                                type="checkbox"
                                checked={selectedIds.has(row.id)}
                                onChange={() => toggleSelectId(row.id)}
                                className="w-4 h-4 cursor-pointer"
                              />
                            </td>
                            <td className="px-2 py-3 text-center">
                              <button
                                onClick={() => toggleExpandRow(row.id)}
                                className={`p-1 rounded-md transition-all duration-200 hover:bg-white hover:shadow-sm active:scale-90 ${expandedRows.has(row.id) ? 'bg-white shadow-sm text-blue-600 rotate-180' : 'text-slate-400'}`}
                              >
                                {expandedRows.has(row.id) ? <Minus size={16} /> : <Plus size={16} />}
                              </button>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2.5">
                                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0 uppercase">
                                  {row.user.avatar}
                                </div>
                                <span className="font-medium whitespace-nowrap text-slate-800">{row.user.name}</span>
                              </div>
                            </td>

                            <td className="px-4 py-3 whitespace-nowrap">
                              {row.work_date}
                            </td>

                            <td className="px-4 py-3 whitespace-nowrap">
                              {row.check_in !== '-' ? (
                                <span className="bg-slate-100 border border-slate-200 text-green-600 px-2.5 py-1 rounded-md font-semibold text-xs tracking-wide">
                                  {row.check_in}
                                </span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>

                            <td className="px-4 py-3 whitespace-nowrap">
                              {row.check_out !== '-' ? (
                                <span className="bg-slate-100 border border-slate-200 text-red-600 px-2.5 py-1 rounded-md font-semibold text-xs tracking-wide">
                                  {row.check_out}
                                </span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>

                            <td className="px-4 py-3 whitespace-nowrap font-bold text-slate-800">
                              {row.total_hours !== '-' ? row.total_hours : <span className="font-normal text-slate-400">—</span>}
                            </td>

                            <td className="px-4 py-3 whitespace-nowrap">
                              {row.isValidForSalary ? (
                                <span className="flex items-center gap-1.5 text-emerald-600 font-bold bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100 text-[11px]">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                  Hợp lệ tính lương
                                </span>
                              ) : (
                                <span className="flex items-center gap-1.5 text-amber-600 font-bold bg-amber-50 px-2.5 py-1 rounded-full border border-amber-100 text-[11px]">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                  Chưa hoàn thành
                                </span>
                              )}
                            </td>

                            {/* <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1.5">
                              {row.tasks.slice(0, 3).map((task, idx) => (
                                <span key={idx} className="bg-slate-100 border border-slate-200/60 text-slate-600 px-2 py-0.5 rounded text-xs truncate max-w-[160px]">
                                  {task}
                                </span>
                              ))}
                              {row.tasks.length > 3 && (
                                <span className="bg-slate-100 border border-slate-200/60 text-slate-500 px-2 py-0.5 rounded text-xs font-semibold">
                                  +{row.tasks.length - 3} ...
                                </span>
                              )}
                              {row.tasks.length === 0 && (
                                <span className="text-slate-400 italic text-xs">Chưa có task</span>
                              )}
                            </div>
                          </td> */}
                            {canEditDelete && (
                              <td className="px-4 py-3 text-right">
                                <div className="flex justify-end items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const dIn = row.check_in_raw ? new Date(row.check_in_raw) : null
                                      const dOut = row.check_out_raw ? new Date(row.check_out_raw) : null

                                      // Format date YYYY-MM-DD for input
                                      const getD = (d) => d ? d.toISOString().split('T')[0] : ''

                                      setEditingRecord({
                                        ...row,
                                        in_date: getD(dIn),
                                        in_h: dIn ? dIn.getHours().toString().padStart(2, '0') : '08',
                                        in_m: dIn ? dIn.getMinutes().toString().padStart(2, '0') : '00',
                                        out_date: getD(dOut) || getD(dIn), // Mặc định ngày ra giống ngày vào
                                        out_h: dOut ? dOut.getHours().toString().padStart(2, '0') : '',
                                        out_m: dOut ? dOut.getMinutes().toString().padStart(2, '0') : ''
                                      })
                                    }}
                                    className="flex items-center gap-1 px-2 py-1 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md transition-all font-bold text-[11px]"
                                  >
                                    <span className="material-symbols-outlined text-[16px]">edit</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openAddTaskModal(row.id)}
                                    className="flex items-center gap-1 px-2 py-1 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md transition-all font-bold text-[11px]"
                                    title="Thêm công việc"
                                  >
                                    <span className="material-symbols-outlined text-[16px]">add_task</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteSingle(row.id)}
                                    disabled={deleting}
                                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
                                  >
                                    <span className="material-symbols-outlined text-[18px]">delete</span>
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>

                          {/* Hàng mở rộng hiển thị nội dung chi tiết */}
                          {expandedRows.has(row.id) && (
                            <tr className="bg-blue-50/10 animate-in fade-in slide-in-from-top-1 duration-200">
                              <td colSpan={canEditDelete ? 9 : 8} className="px-6 py-4 border-b border-slate-100">
                                <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
                                  <div className="bg-slate-50/80 px-4 py-3 border-b border-slate-100">
                                    <div className="flex items-center justify-between mb-3">
                                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                        <ClipboardList size={14} className="text-blue-500" />
                                        Chi tiết công việc đã thực hiện
                                      </span>
                                      <div className="flex items-center gap-3">
                                        <button
                                          type="button"
                                          onClick={() => openAddTaskModal(row.id)}
                                          className="h-8 px-3 rounded-xl bg-blue-600 text-white font-bold text-[10px] shadow-md shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95 flex items-center gap-1.5"
                                        >
                                          <span className="material-symbols-outlined text-[16px]">add</span>
                                          Thêm công việc
                                        </button>
                                        <div className="flex items-center gap-2">
                                          <span className="text-[11px] font-bold text-slate-400">TIẾN ĐỘ TỔNG:</span>
                                          <span className={`text-[13px] font-black ${row.overallProgress === 100 ? 'text-emerald-600' : 'text-amber-600'
                                            }`}>
                                            {row.overallProgress}%
                                          </span>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Thanh Progress Bar Tổng lớn */}
                                    <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden shadow-inner border border-slate-300/50">
                                      <div
                                        className={`h-full transition-all duration-700 ease-out ${row.overallProgress === 100 ? 'bg-emerald-500' : 'bg-amber-500'
                                          }`}
                                        style={{ width: `${row.overallProgress}%` }}
                                      />
                                    </div>
                                  </div>
                                  <table className="w-full text-left">
                                    <thead className="bg-white text-[10px] text-slate-400 uppercase font-bold">
                                      <tr>
                                        <th className="px-4 py-2">Công việc</th>
                                        <th className="px-4 py-2">Trạng thái</th>
                                        <th className="px-4 py-2 w-1/5">Tiến độ</th>
                                        <th className="px-4 py-2">Nhận xét</th>
                                        <th className="px-4 py-2 text-right">Thao tác</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                      {row.tasks_data && row.tasks_data.length > 0 ? (() => {
                                        // Group subtasks by parent_task_name
                                        const groups = row.tasks_data.reduce((acc, task) => {
                                          const key = task.parent_task_name || 'Công việc khác'
                                          if (!acc[key]) acc[key] = []
                                          acc[key].push(task)
                                          return acc
                                        }, {})
                                        return Object.entries(groups).flatMap(([groupName, tasks]) => [
                                          /* Group header row — flatMap keeps <tr> as direct tbody children (no Fragment) for reliable table layout */
                                          <tr key={`${groupName}__hdr`} className="bg-slate-50/80">
                                            <td colSpan={5} className="px-4 py-2">
                                              <span className="flex items-center gap-1.5 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                                                <span className="material-symbols-outlined text-[14px] text-blue-400">folder_open</span>
                                                {groupName}
                                                <span className="ml-1 px-1.5 py-0.5 bg-slate-200 text-slate-500 rounded-full text-[9px] font-bold">{tasks.length}</span>
                                              </span>
                                            </td>
                                          </tr>,
                                          ...tasks.map((task, tidx) => {
                                            const tStatus = task.status || 'in_progress'
                                            const pct = typeof task.percent === 'number' ? task.percent : (task.is_approved ? 100 : 0)
                                            const safePct = Math.max(0, Math.min(100, Number(pct) || 0))
                                            const statusCfg = {
                                              in_progress: { label: 'Đang làm', cls: 'bg-blue-50 text-blue-600 border-blue-100', dot: 'bg-blue-400' },
                                              pending_approval: { label: 'Chờ duyệt', cls: 'bg-amber-50 text-amber-600 border-amber-200', dot: 'bg-amber-400 animate-pulse' },
                                              completed: { label: 'Nghiệm thu', cls: 'bg-emerald-50 text-emerald-600 border-emerald-100', dot: 'bg-emerald-500' },
                                              rejected: { label: 'Từ chối', cls: 'bg-red-50 text-red-600 border-red-100', dot: 'bg-red-400' },
                                            }[tStatus] || { label: tStatus, cls: 'bg-slate-50 text-slate-500 border-slate-100', dot: 'bg-slate-400' }
                                            const rowKey = `${groupName}__${task?.subtask_id != null ? String(task.subtask_id) : 'noid'}__${tidx}`
                                            return (
                                              <tr key={rowKey} className="hover:bg-slate-50/50 transition-colors">
                                                {/* Task name */}
                                                <td className="px-4 py-3">
                                                  <div className="font-bold text-slate-700 text-[12px]">{task.title || '—'}</div>
                                                  {task.work_detail ? (
                                                    <p className="text-[10px] text-slate-600 mt-1 leading-snug line-clamp-3 whitespace-pre-wrap">{task.work_detail}</p>
                                                  ) : null}
                                                  <div className="text-[10px] text-slate-400">{task.start_fmt} {task.end_fmt ? `→ ${task.end_fmt}` : ''}</div>
                                                </td>
                                                {/* Status badge */}
                                                <td className="px-4 py-3">
                                                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-[10px] font-bold ${statusCfg.cls}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                                                    {statusCfg.label}
                                                  </span>
                                                </td>
                                                {/* Progress bar */}
                                                <td className="px-4 py-3">
                                                  <div className="flex items-center gap-2 flex-wrap">
                                                    <div className="flex-1 min-w-[72px] h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                      <div className={`h-full transition-all duration-500 ${tStatus === 'completed' ? 'bg-emerald-500' : tStatus === 'rejected' ? 'bg-red-400' : 'bg-blue-500'}`}
                                                        style={{ width: `${safePct}%` }} />
                                                    </div>
                                                    <span className="text-[11px] font-bold text-slate-600 shrink-0">{safePct}%</span>
                                                    {canEditTaskPercent(row) && (
                                                      <button
                                                        type="button"
                                                        onClick={() => openEditPercentModal(row.id, task)}
                                                        className="shrink-0 flex items-center gap-0.5 px-2 py-0.5 rounded-lg border border-slate-200 bg-white text-[10px] font-bold text-slate-600 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-all"
                                                      >
                                                        <Edit3 size={10} />
                                                        Sửa
                                                      </button>
                                                    )}
                                                  </div>
                                                </td>
                                                {/* Report content / comment */}
                                                <td className="px-4 py-3 max-w-[220px]">
                                                  {task.comment ? (
                                                    <p className={`text-[11px] italic border-l-2 pl-2 ${tStatus === 'rejected' ? 'text-red-500 border-red-200' : 'text-slate-600 border-slate-200'}`}>{task.comment}</p>
                                                  ) : (
                                                    <span className="text-slate-300 text-[11px] italic">—</span>
                                                  )}
                                                </td>
                                                {/* Actions */}
                                                <td className="px-4 py-3 text-right">
                                                  <div className="flex flex-wrap justify-end gap-1.5">
                                                    {role === 'admin' ? (
                                                      <div className="relative inline-block text-left">
                                                        <button
                                                          type="button"
                                                          onClick={(e) => {
                                                            e.stopPropagation()
                                                            setActiveDropdown(activeDropdown === rowKey ? null : rowKey)
                                                          }}
                                                          className="p-1 rounded-lg hover:bg-slate-200 text-slate-500 transition-colors"
                                                        >
                                                          <span className="material-symbols-outlined text-[20px]">more_vert</span>
                                                        </button>

                                                        {activeDropdown === rowKey && (
                                                          <>
                                                            <div className="fixed inset-0 z-40" onClick={() => setActiveDropdown(null)}></div>
                                                            <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-xl shadow-xl border border-slate-200 z-50 p-1.5 flex flex-col gap-1">
                                                              {/* Xem Báo Cáo */}
                                                              <button
                                                                type="button"
                                                                onClick={() => {
                                                                  setActiveDropdown(null)
                                                                  setReportModal({ open: true, sessionId: row.id, task })
                                                                }}
                                                                className="flex items-center gap-2 px-3 py-2 w-full text-left rounded-lg hover:bg-blue-50 text-[11px] font-bold text-blue-600 transition-colors"
                                                              >
                                                                <span className="material-symbols-outlined text-[15px]">visibility</span>
                                                                Xem báo cáo
                                                              </button>

                                                              {/* Nhận Xét */}
                                                              <button
                                                                type="button"
                                                                onClick={() => {
                                                                  setActiveDropdown(null)
                                                                  setCommentModal({ open: true, sessionId: row.id, subtaskId: task.subtask_id, comment: task.comment || '' })
                                                                }}
                                                                className="flex items-center gap-2 px-3 py-2 w-full text-left rounded-lg hover:bg-indigo-50 text-[11px] font-bold text-indigo-600 transition-colors"
                                                              >
                                                                <span className="material-symbols-outlined text-[15px]">rate_review</span>
                                                                Nhận xét
                                                              </button>

                                                              {/* Các Nút Theo Trạng Thái */}
                                                              {tStatus === 'pending_approval' && (
                                                                <>
                                                                  <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                      setActiveDropdown(null)
                                                                      handleAcceptTask(row.id, task.subtask_id)
                                                                    }}
                                                                    className="flex items-center gap-2 px-3 py-2 w-full text-left rounded-lg hover:bg-emerald-50 text-[11px] font-bold text-emerald-600 transition-colors"
                                                                  >
                                                                    <span className="material-symbols-outlined text-[15px]">verified</span>
                                                                    Nghiệm thu
                                                                  </button>
                                                                  <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                      setActiveDropdown(null)
                                                                      setRejectModal({ open: true, sessionId: row.id, subtaskId: task.subtask_id, reason: '' })
                                                                    }}
                                                                    className="flex items-center gap-2 px-3 py-2 w-full text-left rounded-lg hover:bg-red-50 text-[11px] font-bold text-red-600 transition-colors"
                                                                  >
                                                                    <span className="material-symbols-outlined text-[15px]">cancel</span>
                                                                    Từ chối
                                                                  </button>
                                                                </>
                                                              )}

                                                              {tStatus === 'completed' && (
                                                                <div className="px-3 py-2 text-[10px] font-bold text-emerald-600 flex items-center gap-1.5 bg-emerald-50/50 rounded-lg">
                                                                  <span className="material-symbols-outlined text-[14px]">check_circle</span>
                                                                  Đã nghiệm thu
                                                                </div>
                                                              )}

                                                              {tStatus !== 'pending_approval' && tStatus !== 'completed' && (
                                                                <div className="px-3 py-2 text-[10px] italic text-slate-400">
                                                                  Chờ NV báo cáo
                                                                </div>
                                                              )}

                                                              {/* Kết thúc (nếu chưa có end_time) */}
                                                              {!task.end_time && (
                                                                <button
                                                                  type="button"
                                                                  disabled={loadingAction === task.subtask_id}
                                                                  onClick={() => {
                                                                    setActiveDropdown(null)
                                                                    handleFinishTask(row.id, task.subtask_id)
                                                                  }}
                                                                  className="flex items-center gap-2 px-3 py-2 w-full text-left rounded-lg hover:bg-slate-100 text-[11px] font-bold text-slate-700 transition-colors border-t border-slate-100 mt-1 disabled:opacity-60"
                                                                >
                                                                  <span className="material-symbols-outlined text-[15px]">stop_circle</span>
                                                                  {loadingAction === task.subtask_id ? '...' : 'Kết thúc'}
                                                                </button>
                                                              )}
                                                            </div>
                                                          </>
                                                        )}
                                                      </div>
                                                    ) : (
                                                      // Employee view
                                                      tStatus === 'pending_approval' ? (
                                                        <div className="flex flex-col items-end gap-1">
                                                          {canEditTaskPercent(row) && (
                                                            <button
                                                              type="button"
                                                              onClick={() => openEditPercentModal(row.id, task)}
                                                              className="flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 bg-white text-[10px] font-bold text-slate-700"
                                                            >
                                                              <Edit3 size={11} />
                                                              SỬA
                                                            </button>
                                                          )}
                                                          {!task.end_time && (
                                                            <button
                                                              type="button"
                                                              disabled={loadingAction === task.subtask_id}
                                                              onClick={() => handleFinishTask(row.id, task.subtask_id)}
                                                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-600 text-white text-[10px] font-black disabled:opacity-60"
                                                            >
                                                              {loadingAction === task.subtask_id ? '...' : 'KẾT THÚC'}
                                                            </button>
                                                          )}
                                                          <span className="flex items-center gap-1 text-amber-600 font-bold bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-100 text-[10px]">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                                                            CHỜ DUYỆT
                                                          </span>
                                                        </div>
                                                      ) : tStatus === 'completed' || task.is_approved ? (
                                                        <div className="flex flex-col items-end gap-1">
                                                          {!task.end_time && (
                                                            <button
                                                              type="button"
                                                              disabled={loadingAction === task.subtask_id}
                                                              onClick={() => handleFinishTask(row.id, task.subtask_id)}
                                                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-600 text-white text-[10px] font-black disabled:opacity-60"
                                                            >
                                                              {loadingAction === task.subtask_id ? '...' : 'KẾT THÚC'}
                                                            </button>
                                                          )}
                                                          <span className="flex items-center gap-1 text-emerald-600 font-bold bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-100 text-[10px]">
                                                            <span className="material-symbols-outlined text-[13px]">check_circle</span>
                                                            ĐÃ DUYỆT
                                                          </span>
                                                        </div>
                                                      ) : (
                                                        <div className="flex flex-wrap justify-end gap-1.5 items-center">
                                                          {canEditTaskPercent(row) && (
                                                            <button
                                                              type="button"
                                                              onClick={() => openEditPercentModal(row.id, task)}
                                                              className="flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 bg-white text-[10px] font-bold text-slate-700 hover:bg-blue-50"
                                                            >
                                                              <Edit3 size={11} />
                                                              SỬA
                                                            </button>
                                                          )}
                                                          {!task.end_time && (
                                                            <button
                                                              type="button"
                                                              disabled={loadingAction === task.subtask_id}
                                                              onClick={() => handleFinishTask(row.id, task.subtask_id)}
                                                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-700 text-white hover:bg-slate-800 transition-all text-[10px] font-black disabled:opacity-60"
                                                              title="Ghi nhận giờ kết thúc để đo năng suất"
                                                            >
                                                              {loadingAction === task.subtask_id ? '...' : 'KẾT THÚC'}
                                                            </button>
                                                          )}
                                                          <button onClick={() => setReportModal({ open: true, sessionId: row.id, task })}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all text-[10px] font-black active:scale-95 shadow-md shadow-blue-100">
                                                            <span className="material-symbols-outlined text-[13px]">upload_file</span>
                                                            {tStatus === 'rejected' ? 'CẬP NHẬT' : 'BÁO CÁO'}
                                                          </button>
                                                        </div>
                                                      )
                                                    )}
                                                  </div>
                                                </td>
                                              </tr>
                                            )
                                          }),
                                        ])
                                      })() : (
                                        <tr>
                                          <td colSpan="5" className="px-4 py-8 text-center text-slate-400 italic text-[11px]">
                                            Không có dữ liệu công việc trong ca làm việc này.
                                          </td>
                                        </tr>
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* VIEW MOBILE: Vertical Mini Cards (SIÊU NÉN & THẲNG HÀNG) */}
                <div className="lg:hidden p-4 space-y-3">
                  {!loading && attendanceList.map((row) => (
                    <div key={row.id} className={`bg-white rounded-xl border p-3 shadow-sm transition-all ${selectedIds.has(row.id) ? 'border-blue-400 bg-blue-50' : 'border-slate-100'}`}>

                      {/* HÀNG 1: ĐỊNH DANH & HÀNH ĐỘNG (ÉP THẲNG HÀNG) */}
                      <div className="flex items-center gap-2 w-full mb-2">
                        {/* Checkbox */}
                        <input
                          type="checkbox"
                          checked={selectedIds.has(row.id)}
                          onChange={() => toggleSelectId(row.id)}
                          className="w-4 h-4 cursor-pointer shrink-0"
                        />

                        {/* Icon 'Q' / Avatar */}
                        <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-black text-[9px] uppercase shrink-0 shadow-sm">
                          {row.user.avatar}
                        </div>

                        {/* Tên & Ngày (Tự xuống dòng, không đẩy icon) */}
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-bold text-slate-800 leading-tight break-words">{row.user.name}</p>
                          <p className="text-[9px] text-slate-400 font-medium">{row.work_date}</p>
                        </div>

                        {/* Nhóm Nút (CHỈ ICON - KHÔNG CHỮ) */}
                        <div className="flex items-center gap-2 ml-auto shrink-0">
                          <button
                            type="button"
                            onClick={() => toggleExpandRow(row.id)}
                            className={`p-1.5 rounded-lg active:scale-90 transition-all ${expandedRows.has(row.id) ? 'bg-blue-600 text-white shadow-md' : 'bg-blue-50 text-blue-600'}`}
                          >
                            {expandedRows.has(row.id) ? <Minus size={14} /> : <Plus size={14} />}
                          </button>

                          {canEditDelete && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  const dIn = row.check_in_raw ? new Date(row.check_in_raw) : null
                                  const dOut = row.check_out_raw ? new Date(row.check_out_raw) : null
                                  const getD = (d) => d ? d.toISOString().split('T')[0] : ''
                                  setEditingRecord({
                                    ...row,
                                    in_date: getD(dIn),
                                    in_h: dIn ? dIn.getHours().toString().padStart(2, '0') : '08',
                                    in_m: dIn ? dIn.getMinutes().toString().padStart(2, '0') : '00',
                                    out_date: getD(dOut) || getD(dIn),
                                    out_h: dOut ? dOut.getHours().toString().padStart(2, '0') : '',
                                    out_m: dOut ? dOut.getMinutes().toString().padStart(2, '0') : ''
                                  })
                                }}
                                className="p-1.5 bg-blue-50 text-blue-600 rounded-lg active:scale-90 transition-all"
                              >
                                <span className="material-symbols-outlined text-[14px]">edit</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteSingle(row.id)}
                                disabled={deleting}
                                className="p-1.5 bg-red-50 text-red-600 rounded-lg active:scale-90 transition-all disabled:opacity-50"
                              >
                                <span className="material-symbols-outlined text-[14px]">delete</span>
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Chi tiết Task (Dropdown nội bộ) */}
                      {/* {showTasksId === row.id && (
                      <div className="mb-2 p-2 bg-slate-50 rounded-lg border border-slate-100 animate-in fade-in slide-in-from-top-1">
                        <div className="flex flex-wrap gap-1">
                          {row.tasks.length > 0 ? row.tasks.map((task, idx) => (
                            <span key={idx} className="bg-white border border-slate-200 text-slate-600 px-2 py-0.5 rounded text-[9px]">
                              {task}
                            </span>
                          )) : <span className="text-[9px] text-slate-400 italic text-center w-full">Chưa có task nào</span>}
                        </div>
                      </div>
                    )} */}

                      {/* HÀNG 2: THỐNG KÊ (GRID 3 CỘT) */}
                      <div className="grid grid-cols-3 gap-2" >
                        <div className="flex flex-col items-center p-1.5 rounded-lg bg-slate-50 border border-slate-100">
                          <span className="text-[8px] font-bold text-slate-400 uppercase mb-0.5">Vào</span>
                          <span className="text-[10px] font-mono font-bold text-green-600">{row.check_in}</span>
                        </div>
                        <div className="flex flex-col items-center p-1.5 rounded-lg bg-slate-50 border border-slate-100">
                          <span className="text-[8px] font-bold text-slate-400 uppercase mb-0.5">Ra</span>
                          <span className="text-[10px] font-mono font-bold text-red-600">{row.check_out}</span>
                        </div>
                        <div className="flex flex-col items-center p-1.5 rounded-lg bg-slate-50 border border-slate-100">
                          <span className="text-[8px] font-bold text-slate-400 uppercase mb-0.5">Tổng</span>
                          <span className="text-[11px] font-black text-slate-800">{row.total_hours}</span>
                        </div>
                      </div>

                      {/* Chi tiết công việc trên Mobile */}
                      {expandedRows.has(row.id) && (
                        <div className="mt-3 pt-3 border-t border-slate-100 space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1">
                              <ClipboardList size={10} /> Chi tiết công việc
                            </span>
                            <span className="text-[10px] font-black text-blue-600">{row.overallProgress}%</span>
                          </div>

                          {row.tasks_data && row.tasks_data.length > 0 ? (() => {
                            const groups = row.tasks_data.reduce((acc, task) => {
                              const key = task.parent_task_name || 'Công việc khác'
                              if (!acc[key]) acc[key] = []
                              acc[key].push(task)
                              return acc
                            }, {})
                            return Object.entries(groups).map(([groupName, tasks]) => (
                              <div key={groupName}>
                                {/* Group header */}
                                <div className="flex items-center gap-1 mb-1.5 px-1">
                                  <span className="material-symbols-outlined text-[12px] text-blue-400">folder_open</span>
                                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">{groupName}</span>
                                </div>
                                <div className="space-y-2 mb-3">
                                  {tasks.map((task, tidx) => {
                                    const tStatus = task.status || 'in_progress'
                                    const pct = typeof task.percent === 'number' ? task.percent : (task.is_approved ? 100 : 0)
                                    const safePct = Math.max(0, Math.min(100, Number(pct) || 0))
                                    const statusCfg = {
                                      in_progress: { label: 'Đang làm', cls: 'bg-blue-50 text-blue-600 border-blue-100' },
                                      pending_approval: { label: 'Chờ duyệt', cls: 'bg-amber-50 text-amber-600 border-amber-100' },
                                      completed: { label: 'Nghiệm thu', cls: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
                                      rejected: { label: 'Từ chối', cls: 'bg-red-50 text-red-600 border-red-100' },
                                    }[tStatus] || { label: tStatus, cls: 'bg-slate-50 text-slate-500 border-slate-100' }
                                    return (
                                      <div key={task.subtask_id || tidx} className="bg-slate-50 rounded-lg p-2.5 border border-slate-100">
                                        <div className="flex justify-between items-start mb-1.5">
                                          <span className="text-[11px] font-bold text-slate-700 leading-tight flex-1 mr-2">{task.title}</span>
                                          <span className={`shrink-0 px-1.5 py-0.5 rounded-full border text-[8px] font-bold ${statusCfg.cls}`}>{statusCfg.label}</span>
                                        </div>
                                        {task.work_detail ? (
                                          <p className="text-[9px] text-slate-600 mb-1.5 leading-snug line-clamp-3 whitespace-pre-wrap">{task.work_detail}</p>
                                        ) : null}
                                        {/* Progress bar */}
                                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                          <div className="flex-1 min-w-[64px] h-1 bg-slate-200 rounded-full overflow-hidden">
                                            <div className={`h-full ${tStatus === 'completed' ? 'bg-emerald-500' : tStatus === 'rejected' ? 'bg-red-400' : 'bg-blue-500'}`}
                                              style={{ width: `${safePct}%` }} />
                                          </div>
                                          <span className="text-[9px] font-bold text-slate-600 shrink-0">{safePct}%</span>
                                          {canEditTaskPercent(row) && (
                                            <button
                                              type="button"
                                              onClick={() => openEditPercentModal(row.id, task)}
                                              className="text-[8px] font-bold text-blue-600 underline shrink-0"
                                            >
                                              Sửa
                                            </button>
                                          )}
                                        </div>
                                        {/* Report content preview */}
                                        {task.report_content && (
                                          <p className="text-[9px] text-slate-500 line-clamp-2 mb-1">{task.report_content}</p>
                                        )}
                                        {task.report_images?.length > 0 && (
                                          <div className="flex gap-1 mb-1.5 flex-wrap">
                                            {task.report_images.slice(0, 3).map((url, i) => (
                                              <button
                                                key={i}
                                                type="button"
                                                title="Xem ảnh phóng to"
                                                onClick={() => setImageLightboxUrl(url)}
                                                className="w-7 h-7 rounded border border-slate-200 overflow-hidden block cursor-zoom-in focus:outline-none focus:ring-2 focus:ring-blue-500/40 p-0 shrink-0"
                                              >
                                                <img src={url} alt="" className="w-full h-full object-cover pointer-events-none" />
                                              </button>
                                            ))}
                                            {task.report_images.length > 3 && (
                                              <button
                                                type="button"
                                                title="Xem ảnh tiếp theo"
                                                onClick={() => setImageLightboxUrl(task.report_images[3])}
                                                className="w-7 h-7 rounded border border-slate-200 bg-slate-100 flex items-center justify-center text-[8px] font-bold text-slate-500 cursor-zoom-in hover:bg-slate-200 shrink-0"
                                              >
                                                +{task.report_images.length - 3}
                                              </button>
                                            )}
                                          </div>
                                        )}
                                        {task.comment && tStatus === 'rejected' && (
                                          <p className="text-[9px] text-red-500 italic border-l-2 border-red-200 pl-1.5 mb-1">{task.comment}</p>
                                        )}
                                        {/* Actions */}
                                        <div className="mt-1.5 flex flex-wrap justify-end gap-1.5">
                                          {role === 'admin' ? (
                                            <>
                                              {!task.end_time && (
                                                <button
                                                  type="button"
                                                  disabled={loadingAction === task.subtask_id}
                                                  onClick={() => handleFinishTask(row.id, task.subtask_id)}
                                                  className="px-2 py-1 bg-blue-600 text-white rounded-md text-[8px] font-black active:scale-95 disabled:opacity-60"
                                                >
                                                  {loadingAction === task.subtask_id ? '...' : 'KẾT THÚC'}
                                                </button>
                                              )}
                                              {tStatus === 'pending_approval' ? (
                                                <>
                                                  <button onClick={() => handleAcceptTask(row.id, task.subtask_id)}
                                                    className="px-2 py-1 bg-emerald-500 text-white rounded-md text-[8px] font-black active:scale-95">
                                                    NGHIỆM THU
                                                  </button>
                                                  <button onClick={() => setRejectModal({ open: true, sessionId: row.id, subtaskId: task.subtask_id, reason: '' })}
                                                    className="px-2 py-1 bg-red-50 text-red-600 border border-red-200 rounded-md text-[8px] font-black active:scale-95">
                                                    TỪ CHỐI
                                                  </button>
                                                </>
                                              ) : null}
                                            </>
                                          ) : (
                                            <>
                                              {canEditTaskPercent(row) && (
                                                <button
                                                  type="button"
                                                  onClick={() => openEditPercentModal(row.id, task)}
                                                  className="px-2 py-1 bg-white border border-slate-200 text-slate-700 rounded-md text-[8px] font-bold"
                                                >
                                                  SỬA
                                                </button>
                                              )}
                                              {!task.end_time && (
                                                <button
                                                  type="button"
                                                  disabled={loadingAction === task.subtask_id}
                                                  onClick={() => handleFinishTask(row.id, task.subtask_id)}
                                                  className="px-2 py-1 bg-slate-700 text-white rounded-md text-[8px] font-black disabled:opacity-60"
                                                >
                                                  {loadingAction === task.subtask_id ? '...' : 'KẾT THÚC'}
                                                </button>
                                              )}
                                              {tStatus === 'in_progress' || tStatus === 'rejected' ? (
                                                <button onClick={() => setReportModal({ open: true, sessionId: row.id, task })}
                                                  className="px-3 py-1 bg-blue-600 text-white rounded-md text-[8px] font-black active:scale-95">
                                                  {tStatus === 'rejected' ? 'CẬP NHẬT' : 'BÁO CÁO'}
                                                </button>
                                              ) : null}
                                            </>
                                          )}
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            ))
                          })() : (
                            <p className="text-center py-2 text-[10px] text-slate-400 italic">Không có dữ liệu công việc</p>
                          )}
                        </div>
                      )}

                    </div>
                  ))}
                </div>

                {!loading && attendanceList.length === 0 && (
                  <div className="px-4 py-12 text-center text-slate-500 italic">
                    Không có dữ liệu ca làm việc phù hợp với bộ lọc.
                  </div>
                )}
              </div>

              {/* Phân trang */}
              {!loading && totalRecords > PAGE_SIZE && (
                <div className="flex items-center justify-between pt-6 pb-4">
                  <div className="text-sm text-slate-600">
                    Hiển thị <span className="font-bold">{(currentPage - 1) * PAGE_SIZE + 1}</span>
                    {' '}đến{' '}
                    <span className="font-bold">{Math.min(currentPage * PAGE_SIZE, totalRecords)}</span>
                    {' '}của{' '}
                    <span className="font-bold">{totalRecords}</span> bản ghi
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1 || loading}
                      className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm transition-colors"
                    >
                      Trước
                    </button>
                    <span className="text-sm text-slate-600 px-3">
                      Trang <span className="font-bold">{currentPage}</span> / <span className="font-bold">{Math.ceil(totalRecords / PAGE_SIZE)}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setCurrentPage(p => p + 1)}
                      disabled={currentPage >= Math.ceil(totalRecords / PAGE_SIZE) || loading}
                      className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm transition-colors"
                    >
                      Sau
                    </button>
                  </div>
                </div>
              )}

              {/* MODAL SỬA BẢN GHI */}
              {editingRecord && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                  <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200">
                    <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-200">
                          <span className="material-symbols-outlined text-white text-[20px]">edit_calendar</span>
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-800">Sửa Chấm Công</h3>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{editingRecord.user.name}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setEditingRecord(null)}
                        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-400 transition-colors"
                      >
                        <span className="material-symbols-outlined text-[20px]">close</span>
                      </button>
                    </div>

                    <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
                      {/* KHỐI CHECK-IN */}
                      <div className="p-4 bg-blue-50/30 rounded-2xl border border-blue-100/50 space-y-2">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="material-symbols-outlined text-blue-600 text-[16px]">login</span>
                          <label className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">VÀO LÀM</label>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="date"
                            value={editingRecord.in_date}
                            onChange={e => setEditingRecord({ ...editingRecord, in_date: e.target.value })}
                            className="flex-[2] min-w-0 px-2.5 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none font-medium text-[13px]"
                            required
                          />
                          <div className="flex flex-1 gap-1">
                            <select
                              value={editingRecord.in_h}
                              onChange={e => setEditingRecord({ ...editingRecord, in_h: e.target.value })}
                              className="w-full px-1 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none font-bold text-[13px] appearance-none text-center"
                            >
                              {Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0')).map(h => <option key={h} value={h}>{h}h</option>)}
                            </select>
                            <select
                              value={editingRecord.in_m}
                              onChange={e => setEditingRecord({ ...editingRecord, in_m: e.target.value })}
                              className="w-full px-1 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none font-bold text-[13px] appearance-none text-center"
                            >
                              {Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0')).map(m => <option key={m} value={m}>{m}p</option>)}
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* KHỐI CHECK-OUT */}
                      <div className="p-4 bg-red-50/30 rounded-2xl border border-red-100/50 space-y-2">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="material-symbols-outlined text-red-600 text-[16px]">logout</span>
                          <label className="text-[10px] font-bold text-red-700 uppercase tracking-wider">RA VỀ</label>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="date"
                            value={editingRecord.out_date}
                            onChange={e => setEditingRecord({ ...editingRecord, out_date: e.target.value })}
                            className="flex-[2] min-w-0 px-2.5 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500/20 outline-none font-medium text-[13px]"
                          />
                          <div className="flex flex-1 gap-1">
                            <select
                              value={editingRecord.out_h}
                              onChange={e => setEditingRecord({ ...editingRecord, out_h: e.target.value })}
                              className="w-full px-1 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500/20 outline-none font-bold text-[13px] appearance-none text-center"
                            >
                              <option value="">Giờ</option>
                              {Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0')).map(h => <option key={h} value={h}>{h}h</option>)}
                            </select>
                            <select
                              value={editingRecord.out_m}
                              onChange={e => setEditingRecord({ ...editingRecord, out_m: e.target.value })}
                              className="w-full px-1 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500/20 outline-none font-bold text-[13px] appearance-none text-center"
                            >
                              <option value="">Phút</option>
                              {Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0')).map(m => <option key={m} value={m}>{m}p</option>)}
                            </select>
                          </div>
                        </div>
                      </div>

                      <div className="pt-4 flex gap-3">
                        <button
                          type="button"
                          onClick={() => setEditingRecord(null)}
                          className="flex-1 px-4 py-3 rounded-xl bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 transition-all active:scale-95"
                        >
                          HỦY
                        </button>
                        <button
                          type="submit"
                          disabled={isUpdating}
                          className="flex-2 px-8 py-3 rounded-xl bg-blue-600 text-white font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 disabled:bg-blue-400 transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                          {isUpdating ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            <>
                              <span className="material-symbols-outlined text-[18px]">save</span>
                              LƯU THAY ĐỔI
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
              {/* 6. Modal xác nhận xóa đơn */}
              {confirmDeleteId && (
                <Modal
                  title="Xác nhận xóa"
                  onClose={() => setConfirmDeleteId(null)}
                  footer={
                    <div className="flex gap-3 w-full">
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-all"
                      >
                        Hủy
                      </button>
                      <button
                        onClick={() => performDeleteSingle(confirmDeleteId)}
                        className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 shadow-lg shadow-red-100 transition-all"
                      >
                        Xóa ngay
                      </button>
                    </div>
                  }
                >
                  <div className="py-4 flex flex-col items-center text-center">
                    <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
                      <span className="material-symbols-outlined text-red-600 text-3xl">delete_forever</span>
                    </div>
                    <p className="text-slate-600 font-medium">
                      Bạn có chắc chắn muốn xóa bản ghi chấm công này không?
                    </p>
                    {confirmDeleteId === activeSessionId && (
                      <p className="mt-2 text-red-600 text-xs font-bold bg-red-50 p-2 rounded-lg border border-red-100">
                        Cảnh báo: Đây là ca làm việc đang hoạt động!
                      </p>
                    )}
                    <p className="mt-2 text-slate-400 text-xs italic">
                      Hành động này không thể hoàn tác.
                    </p>
                  </div>
                </Modal>
              )}

              {/* 7. Modal xác nhận xóa nhiều */}
              {confirmDeleteBulk && (
                <Modal
                  title="Xóa nhiều bản ghi"
                  onClose={() => setConfirmDeleteBulk(false)}
                  footer={
                    <div className="flex gap-3 w-full">
                      <button
                        onClick={() => setConfirmDeleteBulk(false)}
                        className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-all"
                      >
                        Hủy
                      </button>
                      <button
                        onClick={performDeleteSelected}
                        className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 shadow-lg shadow-red-100 transition-all"
                      >
                        Xóa {selectedIds.size} dòng
                      </button>
                    </div>
                  }
                >
                  <div className="py-4 flex flex-col items-center text-center">
                    <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
                      <span className="material-symbols-outlined text-red-600 text-3xl">delete_sweep</span>
                    </div>
                    <p className="text-slate-600 font-medium">
                      Bạn có chắc chắn muốn xóa <strong>{selectedIds.size}</strong> bản ghi chấm công đã chọn không?
                    </p>
                    {Array.from(selectedIds).includes(activeSessionId) && (
                      <p className="mt-2 text-red-600 text-xs font-bold bg-red-50 p-2 rounded-lg border border-red-100">
                        Lưu ý: Có bao gồm ca làm việc đang hoạt động!
                      </p>
                    )}
                    <p className="mt-2 text-slate-400 text-xs italic">
                      Mọi dữ liệu liên quan sẽ bị xóa vĩnh viễn.
                    </p>
                  </div>
                </Modal>
              )}
              {/* MODAL: Từ chối công việc (Admin) */}
              {rejectModal.open && (
                <Modal
                  title="Từ chối công việc"
                  subtitle="Nhân viên sẽ nhận được lý do và cập nhật lại báo cáo"
                  onClose={() => setRejectModal({ open: false, sessionId: null, subtaskId: null, reason: '' })}
                  footer={
                    <div className="flex gap-3 w-full">
                      <button
                        onClick={() => setRejectModal({ open: false, sessionId: null, subtaskId: null, reason: '' })}
                        className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-all"
                      >
                        Hủy
                      </button>
                      <button
                        onClick={handleRejectTask}
                        className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 shadow-lg shadow-red-100 transition-all"
                      >
                        XÁC NHẬN TỪ CHỐI
                      </button>
                    </div>
                  }
                >
                  <div className="py-2 space-y-3">
                    <div className="flex items-center gap-2 p-3 bg-red-50 rounded-xl border border-red-100">
                      <span className="material-symbols-outlined text-red-500 text-[20px]">warning</span>
                      <p className="text-[12px] text-red-700 font-medium">Nhân viên sẽ cần gửi lại báo cáo sau khi bị từ chối.</p>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                        Lý do từ chối <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        autoFocus
                        value={rejectModal.reason}
                        onChange={(e) => setRejectModal({ ...rejectModal, reason: e.target.value })}
                        placeholder="Nhập lý do từ chối để nhân viên cải thiện..."
                        rows={4}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500/20 focus:border-red-400 outline-none text-[13px] resize-none"
                      />
                    </div>
                  </div>
                </Modal>
              )}

              {/* MODAL: Thêm công việc */}
              {addTaskModalOpen && (
                <Modal
                  title="Thêm công việc"
                  subtitle="Chọn dự án, công việc đang được giao hoặc task trong dự án, rồi đặt % hoàn thành"
                  onClose={() => {
                    setAddTaskModalOpen(false)
                    setAddTaskTargetSessionId(null)
                    setAddTaskAssigneeSubtasks([])
                    setNewTaskForm({
                      project_id: '',
                      pick_row_key: '',
                      task_id: '',
                      title: '',
                      work_detail: '',
                      percent: 0,
                      parent_task_name: '',
                    })
                    resetAddTaskSearchUi()
                  }}
                  footerClassName="justify-between"
                  footer={
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setAddTaskModalOpen(false)
                          setAddTaskTargetSessionId(null)
                          setNewTaskForm({
                            project_id: '',
                            pick_row_key: '',
                            task_id: '',
                            title: '',
                            work_detail: '',
                            percent: 0,
                            parent_task_name: '',
                          })
                          setAddTaskAssigneeSubtasks([])
                          resetAddTaskSearchUi()
                        }}
                        className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-all"
                      >
                        Hủy
                      </button>
                      <button
                        type="submit"
                        form="add-task-form"
                        disabled={isAddingTask}
                        className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 disabled:bg-blue-400 transition-all active:scale-95 flex items-center gap-2"
                      >
                        {isAddingTask ? (
                          <span className="text-[12px] font-black">...</span>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-[18px]">save</span>
                            Lưu công việc
                          </>
                        )}
                      </button>
                    </>
                  }
                >
                  <form id="add-task-form" onSubmit={handleAddTaskToSession} className="space-y-4">
                    {pickListLoading && (
                      <p className="text-[12px] text-slate-500">Đang tải danh sách dự án…</p>
                    )}
                    <div className="space-y-1.5 relative">
                      <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                        Dự án <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[18px] text-slate-400 pointer-events-none">search</span>
                        <input
                          type="text"
                          value={addTaskProjectQuery}
                          onChange={(e) => {
                            const v = e.target.value
                            setAddTaskProjectQuery(v)
                            setAddTaskShowProjectSuggest(true)
                            const sel = pickListProjects.find(p => p.project_id === newTaskForm.project_id)
                            if (sel && v !== sel.name) {
                              setNewTaskForm(f => ({ ...f, project_id: '', pick_row_key: '', task_id: '', title: '', work_detail: '', parent_task_name: '' }))
                              setAddTaskTaskQuery('')
                            }
                          }}
                          onFocus={() => setAddTaskShowProjectSuggest(true)}
                          onBlur={() => { window.setTimeout(() => setAddTaskShowProjectSuggest(false), 150) }}
                          placeholder="Gõ để tìm dự án…"
                          autoComplete="off"
                          disabled={pickListLoading}
                          className="w-full h-10 pl-9 pr-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 font-medium text-[13px]"
                        />
                        {addTaskShowProjectSuggest && !pickListLoading && (
                          addTaskProjectSuggestions.length > 0 ? (
                            <ul className="absolute z-[120] left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl py-1">
                              {addTaskProjectSuggestions.map(p => (
                                <li key={p.project_id}>
                                  <button
                                    type="button"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => {
                                      setNewTaskForm(f => ({ ...f, project_id: p.project_id, pick_row_key: '', task_id: '', title: '', work_detail: '', parent_task_name: '' }))
                                      setAddTaskProjectQuery(p.name)
                                      setAddTaskTaskQuery('')
                                      setAddTaskShowProjectSuggest(false)
                                    }}
                                    className="w-full text-left px-3 py-2 text-[12px] text-slate-700 hover:bg-blue-50 font-medium truncate"
                                  >
                                    {p.name}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <div className="absolute z-[120] left-0 right-0 mt-1 rounded-xl border border-slate-200 bg-white shadow-xl px-3 py-2 text-[11px] text-slate-400">
                              {addTaskProjectQuery.trim() ? 'Không có dự án khớp.' : 'Không có dự án.'}
                            </div>
                          )
                        )}
                      </div>
                      {newTaskForm.project_id && (
                        <p className="text-[10px] text-emerald-600 font-bold">Đã chọn dự án</p>
                      )}
                    </div>
                    <div className="space-y-1.5 relative">
                      <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                        Công việc <span className="text-red-500">*</span>
                      </label>
                      {addTaskAssigneeSubtasksLoading && (
                        <p className="text-[10px] text-slate-400 font-medium">Đang tải việc được giao…</p>
                      )}
                      <div className="relative">
                        <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[18px] text-slate-400 pointer-events-none">search</span>
                        <input
                          type="text"
                          value={addTaskTaskQuery}
                          onChange={(e) => {
                            const v = e.target.value
                            setAddTaskTaskQuery(v)
                            setAddTaskShowTaskSuggest(true)
                            const cur = tasksForPickedProject.find(t => t.rowKey === newTaskForm.pick_row_key)
                            const curLabel = cur ? cur.suggestLabel : ''
                            if (cur && v !== curLabel) {
                              setNewTaskForm(f => ({ ...f, pick_row_key: '', task_id: '', title: '', work_detail: '', parent_task_name: '' }))
                            }
                          }}
                          onFocus={() => newTaskForm.project_id && setAddTaskShowTaskSuggest(true)}
                          onBlur={() => { window.setTimeout(() => setAddTaskShowTaskSuggest(false), 150) }}
                          placeholder={
                            !newTaskForm.project_id
                              ? 'Chọn dự án trước…'
                              : tasksForPickedProject.length === 0
                                ? 'Dự án chưa có công việc khớp'
                                : 'Gõ để tìm (tên nhiệm vụ, tính năng, task cha)…'
                          }
                          autoComplete="off"
                          disabled={pickListLoading || !newTaskForm.project_id || tasksForPickedProject.length === 0}
                          className="w-full h-10 pl-9 pr-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 font-medium text-[13px] disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                        />
                        {addTaskShowTaskSuggest && newTaskForm.project_id && tasksForPickedProject.length > 0 && (
                          addTaskTaskPickEntries.length > 0 ? (
                            <ul className="absolute z-[120] left-0 right-0 mt-1 max-h-52 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl py-1">
                              {addTaskTaskPickEntries.map(entry => (
                                entry.kind === 'header' ? (
                                  <li key={entry.key} className="px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-slate-400 bg-slate-50 border-y border-slate-100 first:border-t-0 pointer-events-none">
                                    {entry.label}
                                  </li>
                                ) : (
                                  <li key={entry.key}>
                                    <button
                                      type="button"
                                      onMouseDown={(e) => e.preventDefault()}
                                      onClick={() => {
                                        const t = entry.row
                                        const proj = pickListProjects.find(p => p.project_id === newTaskForm.project_id)
                                        setNewTaskForm(f => ({
                                          ...f,
                                          pick_row_key: t.rowKey,
                                          task_id: t.task_id,
                                          title: t.name,
                                          parent_task_name: proj
                                            ? (t.pickKind === 'subtask'
                                              ? `${proj.name} › ${t.featureName} › ${t.parentTaskName}`
                                              : `${proj.name} › ${t.featureName}`)
                                            : '',
                                        }))
                                        setAddTaskTaskQuery(t.suggestLabel)
                                        setAddTaskShowTaskSuggest(false)
                                      }}
                                      className="w-full text-left px-3 py-2 hover:bg-blue-50"
                                    >
                                      <div className="text-[12px] font-bold text-slate-800 truncate">{entry.row.suggestLabel}</div>
                                      <div className="text-[10px] text-slate-400 font-medium">
                                        {entry.row.pickKind === 'subtask' ? 'Được giao · ' : ''}
                                        {entry.row.status === 'pending' ? 'Chờ xử lý' :
                                          entry.row.status === 'in_progress' ? 'Đang làm' :
                                            entry.row.status === 'completed' ? 'Hoàn thành' :
                                              entry.row.status}
                                      </div>
                                    </button>
                                  </li>
                                )
                              ))}
                            </ul>
                          ) : (
                            <div className="absolute z-[120] left-0 right-0 mt-1 rounded-xl border border-slate-200 bg-white shadow-xl px-3 py-2 text-[11px] text-slate-400">
                              {addTaskTaskQuery.trim() ? 'Không có công việc khớp.' : 'Không có công việc.'}
                            </div>
                          )
                        )}
                      </div>
                      {newTaskForm.pick_row_key && (
                        <p className="text-[10px] text-emerald-600 font-bold">Đã chọn công việc</p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                        Chi tiết công việc
                      </label>
                      <textarea
                        value={newTaskForm.work_detail}
                        onChange={(e) => setNewTaskForm(f => ({ ...f, work_detail: e.target.value }))}
                        placeholder="Mô tả ngắn nội dung đang làm, kết quả trong ca…"
                        rows={3}
                        maxLength={2000}
                        className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 text-[13px] resize-y min-h-[72px] placeholder:text-slate-400"
                      />
                      <p className="text-[9px] text-slate-500 font-medium">Tuỳ chọn — hiển thị trong bảng chi tiết ca làm việc.</p>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">% hoàn thành</label>
                        <span className="text-[12px] font-black text-blue-600">{Number(newTaskForm.percent) || 0}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={newTaskForm.percent}
                        onChange={(e) => setNewTaskForm(v => ({ ...v, percent: Number(e.target.value) }))}
                        className="w-full"
                      />
                      <div className="grid grid-cols-5 gap-2">
                        {[0, 25, 50, 75, 100].map(p => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setNewTaskForm(v => ({ ...v, percent: p }))}
                            className={`h-9 rounded-xl border font-bold text-[11px] transition-all active:scale-95 ${Number(newTaskForm.percent) === p
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                              }`}
                          >
                            {p}%
                          </button>
                        ))}
                      </div>
                    </div>
                  </form>
                </Modal>
              )}

              {/* REPORT MODAL: Nhân viên gửi báo cáo */}
              <ReportModal
                open={reportModal.open}
                onClose={() => setReportModal({ open: false, sessionId: null, task: null })}
                task={reportModal.task}
                sessionId={reportModal.sessionId}
                onSave={handleSaveReport}
              />

              {/* COMMENT MODAL: Admin nhận xét */}
              {commentModal.open && (
                <Modal
                  title="Nhận xét công việc"
                  subtitle="Nhận xét này sẽ hiển thị ở cột Nhận xét"
                  onClose={() => setCommentModal({ open: false, sessionId: null, subtaskId: null, comment: '' })}
                  footer={
                    <>
                      <button type="button" onClick={() => setCommentModal({ open: false, sessionId: null, subtaskId: null, comment: '' })} className="px-4 py-2 text-slate-500 font-medium hover:bg-slate-100 rounded-lg transition-colors text-[13px]">Hủy</button>
                      <button type="button" onClick={handleCommentTask} className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-sm shadow-blue-200 text-[13px]">Lưu nhận xét</button>
                    </>
                  }
                >
                  <div className="p-1">
                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-2">Nội dung nhận xét</label>
                    <textarea
                      value={commentModal.comment}
                      onChange={(e) => setCommentModal(m => ({ ...m, comment: e.target.value }))}
                      rows={4}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 text-[13px] resize-y"
                      placeholder="Nhập nhận xét..."
                      autoFocus
                    />
                  </div>
                </Modal>
              )}

              {/* MODAL: Sửa nội dung công việc (tên, chi tiết, báo cáo, %) */}
              {editPercentModal.open && (
                <Modal
                  title="Sửa công việc"
                  subtitle="Tên, chi tiết CV, báo cáo, ảnh (Cloudinary) và % — Ctrl+V trong ô báo cáo để dán ảnh"
                  maxWidthClassName="max-w-2xl"
                  bodyClassName="px-6 py-4 space-y-4 flex-grow overflow-y-auto max-h-[70vh]"
                  onClose={() => setEditPercentModal({ open: false, sessionId: null, subtaskId: null, title: '', work_detail: '', report_content: '', report_images: [], percent: 0 })}
                  footerClassName="justify-between"
                  footer={
                    <>
                      <button
                        type="button"
                        onClick={() => setEditPercentModal({ open: false, sessionId: null, subtaskId: null, title: '', work_detail: '', report_content: '', report_images: [], percent: 0 })}
                        className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-all"
                      >
                        Hủy
                      </button>
                      <button
                        type="submit"
                        form="edit-percent-form"
                        disabled={isSavingPercent || editImagesUploading > 0}
                        className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 disabled:bg-blue-400 transition-all active:scale-95 flex items-center gap-2"
                      >
                        {isSavingPercent ? (
                          <span className="text-[12px] font-black">...</span>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-[18px]">save</span>
                            Lưu
                          </>
                        )}
                      </button>
                    </>
                  }
                >
                  <form id="edit-percent-form" onSubmit={handleSaveTaskPercent} className="space-y-4">
                    {role !== 'admin' && (
                      <>
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                            Tên công việc <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={editPercentModal.title}
                            onChange={(e) => setEditPercentModal(m => ({ ...m, title: e.target.value }))}
                            className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 text-[13px]"
                            placeholder="Tên hiển thị trong ca làm việc"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Chi tiết CV</label>
                          <textarea
                            value={editPercentModal.work_detail}
                            onChange={(e) => setEditPercentModal(m => ({ ...m, work_detail: e.target.value }))}
                            rows={3}
                            maxLength={2000}
                            className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 text-[13px] resize-y min-h-[72px]"
                            placeholder="Mô tả nội dung đang làm…"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Báo cáo / nhận xét</label>
                          <textarea
                            value={editPercentModal.report_content}
                            onChange={(e) => setEditPercentModal(m => ({ ...m, report_content: e.target.value }))}
                            onPaste={(e) => {
                              const files = getImageFilesFromClipboardEvent(e)
                              if (files.length === 0) return
                              e.preventDefault()
                              void uploadEditTaskReportImages(files)
                            }}
                            rows={4}
                            maxLength={8000}
                            className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 text-[13px] resize-y min-h-[96px]"
                            placeholder="Nội dung báo cáo (nếu có)… Dán ảnh: Ctrl+V"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Hình ảnh (Cloudinary)</label>
                          {!isCloudinaryUploadConfigured() ? (
                            <p className="text-[10px] text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-2 leading-snug">
                              Chưa cấu hình Cloudinary — có thể xóa ảnh đã lưu; để thêm ảnh mới, đặt <span className="font-mono">VITE_CLOUDINARY_CLOUD_NAME</span> và{' '}
                              <span className="font-mono">VITE_CLOUDINARY_UPLOAD_PRESET</span> trong <span className="font-mono">.env</span> (upload preset dạng Unsigned).
                            </p>
                          ) : (
                            <p className="text-[10px] text-slate-500 leading-snug">
                              Dán ảnh trong ô báo cáo phía trên (<kbd className="px-1 py-0.5 rounded border border-slate-200 bg-slate-50 font-mono text-[9px]">Ctrl</kbd>
                              {' + '}
                              <kbd className="px-1 py-0.5 rounded border border-slate-200 bg-slate-50 font-mono text-[9px]">V</kbd>
                              ) hoặc chọn nhiều file — mỗi ảnh tải lên Cloudinary và lưu URL.
                            </p>
                          )}
                          {(editPercentModal.report_images || []).length > 0 && (
                            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                              {(editPercentModal.report_images || []).map((url, idx) => (
                                <div key={`${url}-${idx}`} className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
                                  <button
                                    type="button"
                                    title="Xem ảnh phóng to"
                                    onClick={() => setImageLightboxUrl(url)}
                                    className="block w-full h-full cursor-zoom-in focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500/40 p-0"
                                  >
                                    <img src={url} alt="" className="w-full h-full object-cover pointer-events-none" />
                                  </button>
                                  <button
                                    type="button"
                                    title="Gỡ ảnh"
                                    onClick={() => setEditPercentModal(m => ({
                                      ...m,
                                      report_images: (m.report_images || []).filter((_, i) => i !== idx),
                                    }))}
                                    className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-90 hover:opacity-100 shadow-sm"
                                  >
                                    <span className="material-symbols-outlined text-[14px]">close</span>
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              disabled={!isCloudinaryUploadConfigured() || editImagesUploading > 0}
                              onClick={() => editTaskReportFileRef.current?.click()}
                              className="h-9 px-3 rounded-xl border-2 border-dashed border-slate-300 text-slate-600 hover:border-blue-400 hover:text-blue-700 text-[11px] font-bold flex items-center gap-1.5 disabled:opacity-50 disabled:pointer-events-none"
                            >
                              <span className="material-symbols-outlined text-[18px]">add_photo_alternate</span>
                              Chọn ảnh
                            </button>
                            {editImagesUploading > 0 && (
                              <span className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                                <span className="inline-block w-3 h-3 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin" />
                                Đang tải ảnh…
                              </span>
                            )}
                          </div>
                          <input
                            ref={editTaskReportFileRef}
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={(ev) => {
                              const f = ev.target.files
                              if (f?.length) void uploadEditTaskReportImages(f)
                              ev.target.value = ''
                            }}
                          />
                        </div>
                      </>
                    )}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">% hoàn thành</label>
                        <span className="text-[12px] font-black text-blue-600">{Number(editPercentModal.percent) || 0}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={editPercentModal.percent}
                        onChange={(e) => setEditPercentModal(m => ({ ...m, percent: Number(e.target.value) }))}
                        className="w-full"
                      />
                      <div className="grid grid-cols-5 gap-2">
                        {[0, 25, 50, 75, 100].map(p => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setEditPercentModal(m => ({ ...m, percent: p }))}
                            className={`h-9 rounded-xl border font-bold text-[11px] transition-all active:scale-95 ${Number(editPercentModal.percent) === p
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                              }`}
                          >
                            {p}%
                          </button>
                        ))}
                      </div>
                    </div>
                  </form>
                </Modal>
              )}
            </div>
          </main >
        </div >
      </div >

      {imageLightboxUrl ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Xem ảnh phóng to"
          className="fixed inset-0 z-[200] flex items-center justify-center bg-[#131b2e]/92 backdrop-blur-sm p-0"
          onClick={() => setImageLightboxUrl(null)}
        >
          <button
            type="button"
            className="absolute top-3 right-3 sm:top-4 sm:right-4 rounded-full bg-white/95 text-[#131b2e] p-2 shadow-lg hover:bg-white z-10"
            aria-label="Đóng"
            onClick={e => {
              e.stopPropagation()
              setImageLightboxUrl(null)
            }}
          >
            <span className="material-symbols-outlined text-[22px] leading-none block">close</span>
          </button>
          <img
            src={imageLightboxUrl}
            alt=""
            className="max-h-[100dvh] max-w-[100vw] h-auto w-auto object-contain shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
        </div>
      ) : null}
    </>
  )
}
