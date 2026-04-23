import React, { useState, useEffect } from 'react'
import Sidebar from '../components/Sidebar'
import TopBar from '../components/TopBar'
import { supabase } from '../utils/supabase'

export default function AttendancePage() {
  const [filterDate, setFilterDate] = useState('')
  const [filterMonth, setFilterMonth] = useState('')
  const [filterUser, setFilterUser] = useState('all')

  // Trạng thái dữ liệu
  const [attendanceList, setAttendanceList] = useState([])
  const [staffList, setStaffList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showTasksId, setShowTasksId] = useState(null) // Quản lý xem task chi tiết trên Mobile
  const [selectedIds, setSelectedIds] = useState(new Set()) // Lưu ID các bản ghi được chọn
  const [deleting, setDeleting] = useState(false) // Trạng thái xóa
  const [toast, setToast] = useState(null) // Thông báo
  const [currentPage, setCurrentPage] = useState(1) // Phân trang
  const [totalRecords, setTotalRecords] = useState(0) // Tổng số bản ghi
  const PAGE_SIZE = 100 // Lấy 100 bản ghi trên trang
  const [editingRecord, setEditingRecord] = useState(null) // Bản ghi đang sửa
  const [isUpdating, setIsUpdating] = useState(false)

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
    async function initUser() {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) return
      setCurrentUser(authUser)

      // Khôi phục session checkin chỉ khi session thuộc về user này
      const storedSessionId = localStorage.getItem('checkin_session_id')
      const storedUserId = localStorage.getItem('checkin_user_id')
      const storedStartTime = localStorage.getItem('checkin_start_time')
      if (storedSessionId && storedUserId === authUser.id && storedStartTime) {
        setActiveSessionId(storedSessionId)
        setIsWorking(true)
        setSessionStartTime(Number(storedStartTime))
      } else {
        // Xóa session cũ không hợp lệ
        localStorage.removeItem('checkin_session_id')
        localStorage.removeItem('checkin_user_id')
        localStorage.removeItem('checkin_start_time')
      }
    }
    initUser()
  }, [])

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
          users:user_id (user_id, full_name, avatar_url),
          subtasks (name, status)
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

      if (filterUser && filterUser !== 'all') {
        query = query.eq('user_id', filterUser)
      }

      // Execute API Call
      const { data, error: fetchError, count } = await query

      if (fetchError) throw fetchError

      setTotalRecords(count || 0)

      // Trả về JSON, transform map dữ liệu ra giao diện
      const formattedData = data.map(session => {
        // Lấy danh sách Task đã hoàn thành
        const completedTasksArray = (session.subtasks || [])
          .filter(task => task.status === 'completed')
          .map(task => task.name)

        // Lấy thông tin user (Tránh lỗi trả về array từ supabase lồng)
        const userData = Array.isArray(session.users) ? session.users[0] : session.users

        // Hàm tiện ích format Time & Date
        const timeFormat = (isoString) => {
          if (!isoString) return '-'
          return new Date(isoString).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
        }

        const dateFormat = (dateString) => {
          if (!dateString) return '-'
          const [y, m, d] = dateString.split('-')
          return `${d}/${m}/${y}`
        }

        // Tính tổng thời gian nếu Database chưa Update tự động (Giúp UI mượt hơn)
        let displayHours = session.total_hours ? `${session.total_hours}h` : '-'
        if (!session.total_hours && session.check_in_time && session.check_out_time) {
          const start = new Date(session.check_in_time)
          let end = new Date(session.check_out_time)

          let diffMs = end - start
          if (diffMs < 0) {
            // Hỗ trợ tính ca đêm xuyên ngày ở client
            end.setDate(end.getDate() + 1)
            diffMs = end - start
          }

          const diffHrs = (diffMs / (1000 * 60 * 60)).toFixed(2)
          displayHours = `${diffHrs}h`
        }

        return {
          id: session.session_id,
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
          tasks: completedTasksArray
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
  }, [filterDate, filterMonth, filterUser])

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
      const today = new Date().toISOString().split('T')[0]
      // Dùng currentUser.id (user đang đăng nhập), KHÔNG dùng filterUser
      const { data, error } = await supabase
        .from('work_sessions')
        .insert({
          user_id: currentUser.id,
          work_date: today,
          status: 'working'
        })
        .select('*')
        .single()
      if (error) throw error
      const startTime = Date.now()
      localStorage.setItem('checkin_session_id', data.session_id)
      localStorage.setItem('checkin_user_id', currentUser.id)  // Lưu thêm user_id để validate
      localStorage.setItem('checkin_start_time', String(startTime))
      setActiveSessionId(data.session_id)
      setIsWorking(true)
      setSessionStartTime(startTime)
      setSessionTimer(0)
      setToast({ message: 'Đã Check-in thành công!', type: 'success' })
      fetchAttendanceData() // Tải lại bảng
    } catch (err) {
      console.error(err)
      setToast({ message: err.message || 'Lỗi check-in', type: 'error' })
    }
  }

  const handleCheckOut = async () => {
    if (!activeSessionId) return
    try {
      const { error } = await supabase
        .from('work_sessions')
        .update({
          check_out_time: new Date().toISOString(),
          status: 'completed'
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
      setToast({ message: 'Đã Check-out kết thúc ca', type: 'success' })
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

    if (!window.confirm(`Bạn có chắc muốn xóa ${selectedIds.size} bản ghi này không?`)) {
      return
    }

    setDeleting(true)
    try {
      const idsArray = Array.from(selectedIds)

      // Kiểm tra xem có session nào đang hoạt động không để tránh xóa nhầm ca đang làm
      if (idsArray.includes(activeSessionId)) {
        if (!window.confirm('Trong danh sách chọn có ca làm việc đang hoạt động. Bạn có chắc muốn xóa và kết thúc ca này không?')) {
          setDeleting(false)
          return
        }
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
  const handleDeleteSingle = async (id) => {
    if (!window.confirm('Bạn có chắc muốn xóa bản ghi chấm công này?')) return

    // Nếu xóa đúng session đang làm việc
    const isDeletingActive = id === activeSessionId
    if (isDeletingActive) {
      if (!window.confirm('Đây là ca làm việc đang hoạt động. Xóa đồng nghĩa với việc hủy ca này. Tiếp tục?')) return
    }

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

  return (
    <div className="flex h-screen overflow-hidden bg-[#faf8ff] text-[13px]">
      <Sidebar />

      <div className="flex-1 md:ml-64 flex flex-col h-screen overflow-y-auto">
        <TopBar title="Bảng Chấm Công" />

        <main className="flex-1 p-8">
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

            {/* 1. Khu vực Header & Bộ lọc (Top Bar mới) */}
            <div className="bg-white/60 backdrop-blur-md rounded-2xl border border-slate-200/60 p-4 shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-6">

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

                  <div className="relative group">
                    <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[18px] text-slate-400 group-focus-within:text-blue-500 transition-colors">group</span>
                    <select
                      value={filterUser}
                      onChange={e => setFilterUser(e.target.value)}
                      className="h-9 pl-9 pr-8 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-700 shadow-sm text-[12px] min-w-[160px] appearance-none transition-all"
                    >
                      <option value="all">Tất cả nhân sự</option>
                      {staffList.map(staff => (
                        <option key={staff.user_id} value={staff.user_id}>
                          {staff.full_name}
                        </option>
                      ))}
                    </select>
                    <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-[18px] text-slate-400 pointer-events-none">expand_more</span>
                  </div>
                </div>

                {selectedIds.size > 0 && (
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
                      <th className="px-4 py-3 font-semibold border-b border-slate-200">Người làm</th>
                      <th className="px-4 py-3 font-semibold border-b border-slate-200">Ngày làm</th>
                      <th className="px-4 py-3 font-semibold border-b border-slate-200">Check-in</th>
                      <th className="px-4 py-3 font-semibold border-b border-slate-200">Check-out</th>
                      <th className="px-4 py-3 font-semibold border-b border-slate-200">Tổng giờ</th>
                      <th className="px-4 py-3 font-semibold border-b border-slate-200 w-1/3">Task hoàn thành</th>
                      <th className="px-4 py-3 font-semibold border-b border-slate-200 text-right">Thao tác</th>
                    </tr>
                  </thead>

                  <tbody className="text-slate-700">
                    {!loading && attendanceList.map((row) => (
                      <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(row.id)}
                            onChange={() => toggleSelectId(row.id)}
                            className="w-4 h-4 cursor-pointer"
                          />
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

                        <td className="px-4 py-3">
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
                        </td>
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
                              onClick={() => handleDeleteSingle(row.id)}
                              disabled={deleting}
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
                            >
                              <span className="material-symbols-outlined text-[18px]">delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* VIEW MOBILE: Vertical Mini Cards */}
              <div className="lg:hidden p-4 space-y-3">
                {!loading && attendanceList.map((row) => (
                  <div key={row.id} className={`bg-white rounded-xl border p-4 shadow-sm active:scale-[0.98] transition-all ${selectedIds.has(row.id) ? 'border-blue-400 bg-blue-50' : 'border-slate-100'
                    }`}>
                    <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-50">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(row.id)}
                          onChange={() => toggleSelectId(row.id)}
                          className="w-4 h-4 cursor-pointer mt-0.5 shrink-0"
                        />
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-black text-[11px] uppercase shadow-sm shrink-0">
                          {row.user.avatar}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800 text-[14px] leading-tight truncate">{row.user.name}</p>
                          <p className="text-[11px] text-slate-400 font-medium">{row.work_date}</p>
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <button
                          type="button"
                          onClick={() => setShowTasksId(showTasksId === row.id ? null : row.id)}
                          className="bg-[#f2f3ff] text-[#006591] px-2.5 py-1.5 rounded-lg text-[10px] font-bold border border-[#dce4ff] flex items-center gap-1 active:scale-95 transition-all"
                        >
                          <span className="material-symbols-outlined text-[14px]">list_alt</span>
                          TASK ĐÃ LÀM
                        </button>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditingRecord(row)}
                            className="flex-1 bg-blue-50 text-blue-600 px-2.5 py-1.5 rounded-lg text-[10px] font-bold border border-blue-100 flex items-center justify-center gap-1 active:scale-95 transition-all"
                          >
                            <span className="material-symbols-outlined text-[14px]">edit</span>
                            SỬA
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSingle(row.id)}
                            disabled={deleting}
                            className="flex-1 bg-red-50 text-red-600 px-2.5 py-1.5 rounded-lg text-[10px] font-bold border border-red-100 flex items-center justify-center gap-1 active:scale-95 transition-all disabled:opacity-50"
                          >
                            <span className="material-symbols-outlined text-[14px]">delete</span>
                            XÓA
                          </button>
                        </div>
                      </div>
                    </div>

                    {showTasksId === row.id && (
                      <div className="mb-3 p-3 bg-slate-50 rounded-lg border border-slate-100 animate-in fade-in slide-in-from-top-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Chi tiết task hoàn thành:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {row.tasks.length > 0 ? row.tasks.map((task, idx) => (
                            <span key={idx} className="bg-white border border-slate-200 text-slate-600 px-2 py-0.5 rounded text-[10px]">
                              {task}
                            </span>
                          )) : <span className="text-[10px] text-slate-400 italic">Chưa có task nào được ghi nhận</span>}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-2 mt-2">
                      <div className="flex-1 flex flex-col items-center p-2 rounded-lg bg-slate-50 border border-slate-100">
                        <span className="text-[9px] font-bold text-slate-400 uppercase mb-1">Vào</span>
                        <span className="bg-white border border-slate-200 text-green-600 px-2 py-0.5 rounded text-[11px] font-bold">
                          {row.check_in}
                        </span>
                      </div>
                      <div className="flex-1 flex flex-col items-center p-2 rounded-lg bg-slate-50 border border-slate-100">
                        <span className="text-[9px] font-bold text-slate-400 uppercase mb-1">Ra</span>
                        <span className="bg-white border border-slate-200 text-red-600 px-2 py-0.5 rounded text-[11px] font-bold">
                          {row.check_out}
                        </span>
                      </div>
                      <div className="flex-1 flex flex-col items-center p-2 rounded-lg bg-slate-50 border border-slate-100">
                        <span className="text-[9px] font-bold text-slate-400 uppercase mb-1">Tổng</span>
                        <span className="text-slate-800 text-[13px] font-black">
                          {row.total_hours}
                        </span>
                      </div>
                    </div>

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
          </div>
        </main>
      </div>
    </div>
  )
}
