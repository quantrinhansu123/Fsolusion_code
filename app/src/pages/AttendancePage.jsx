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

  // 1. Lấy danh sách nhân viên để đổ vào Dropdown bộ lọc
  useEffect(() => {
    async function fetchStaffs() {
      const { data } = await supabase.from('users').select('user_id, full_name').order('full_name')
      if (data) setStaffList(data)
    }
    fetchStaffs()
  }, [])

  // 2. Hàm chính: Lấy dữ liệu chấm công từ Supabase
  const fetchAttendanceData = async () => {
    setLoading(true)
    setError(null)
    try {
      // Logic Query (PostgreSQL lồng ghép API Supabase): 
      // - Join work_sessions với users (Lấy Avatar, Fullname)
      // - Join work_sessions với subtasks (Lấy Tên task đã làm)
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
        `)
        .order('check_in_time', { ascending: false })

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
      const { data, error: fetchError } = await query

      if (fetchError) throw fetchError

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
          return new Date(isoString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        }

        const dateFormat = (dateString) => {
          if (!dateString) return '-'
          const [y, m, d] = dateString.split('-')
          return `${d}/${m}/${y}`
        }

        // Tính tổng thời gian nếu Database chưa Update tự động (Giúp UI mượt hơn)
        let displayHours = session.total_hours ? `${session.total_hours}h` : '-'
        if (!session.total_hours && session.check_in_time && session.check_out_time) {
          const diffMs = new Date(session.check_out_time) - new Date(session.check_in_time)
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

  // 3. Tự động gọi hàm API mỗi khi State Bộ lọc thay đổi
  useEffect(() => {
    fetchAttendanceData()
  }, [filterDate, filterMonth, filterUser])

  return (
    <div className="flex h-screen overflow-hidden bg-[#faf8ff] text-[13px]">
      <Sidebar />

      <div className="flex-1 ml-64 flex flex-col h-screen overflow-y-auto">
        <TopBar title="Bảng Chấm Công" />

        <main className="flex-1 p-8">
          <div className="max-w-7xl mx-auto space-y-6 pb-20">

            {/* 1. Khu vực Bộ lọc (Top Bar) */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h2 className="text-xl font-bold text-slate-800">
                Bảng Chấm Công
              </h2>

              <div className="flex items-center gap-4 flex-wrap">
                <input
                  type="date"
                  value={filterDate}
                  onChange={e => {
                    setFilterDate(e.target.value)
                    if (e.target.value) setFilterMonth('') // Xóa bộ lọc tháng nếu chọn ngày
                  }}
                  className="px-3 py-2 border border-slate-200 bg-white rounded-lg outline-none focus:border-blue-500 text-slate-700 shadow-sm"
                />

                <input
                  type="month"
                  value={filterMonth}
                  onChange={e => {
                    setFilterMonth(e.target.value)
                    if (e.target.value) setFilterDate('') // Xóa bộ lọc ngày nếu chọn tháng
                  }}
                  className="px-3 py-2 border border-slate-200 bg-white rounded-lg outline-none focus:border-blue-500 text-slate-700 shadow-sm"
                />

                <select
                  value={filterUser}
                  onChange={e => setFilterUser(e.target.value)}
                  className="px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500 text-slate-700 bg-white shadow-sm min-w-[160px]"
                >
                  <option value="all">Tất cả nhân sự</option>
                  {staffList.map(staff => (
                    <option key={staff.user_id} value={staff.user_id}>
                      {staff.full_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Trạng thái lỗi (nếu có) */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg">
                ⚠️ {error}
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

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead className="bg-slate-50 text-slate-500 text-[12px] uppercase whitespace-nowrap">
                    <tr>
                      <th className="px-4 py-3 font-semibold border-b border-slate-200">Người làm</th>
                      <th className="px-4 py-3 font-semibold border-b border-slate-200">Ngày làm</th>
                      <th className="px-4 py-3 font-semibold border-b border-slate-200">Check-in</th>
                      <th className="px-4 py-3 font-semibold border-b border-slate-200">Check-out</th>
                      <th className="px-4 py-3 font-semibold border-b border-slate-200">Tổng giờ</th>
                      <th className="px-4 py-3 font-semibold border-b border-slate-200 w-1/3">Task hoàn thành</th>
                    </tr>
                  </thead>

                  <tbody className="text-slate-700">
                    {!loading && attendanceList.map((row) => (
                      <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
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
                      </tr>
                    ))}

                    {!loading && attendanceList.length === 0 && (
                      <tr>
                        <td colSpan="6" className="px-4 py-12 text-center text-slate-500 italic border-0">
                          Không có dữ liệu ca làm việc phù hợp với bộ lọc.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </main>
      </div>
    </div>
  )
}
