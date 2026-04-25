import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../utils/supabase'
import Sidebar from '../components/Sidebar'
import TopBar from '../components/TopBar'

export default function StaffStatisticsPage() {
  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0]
  })
  const [subtasks, setSubtasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedStaffTasks, setSelectedStaffTasks] = useState(null)

  // Fetch data
  const fetchData = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('subtasks')
        .select(`
          *,
          users (user_id, full_name, email, avatar_url),
          tasks (task_id, name, features (name))
        `)
        .gte('updated_at', `${dateRange.from}T00:00:00Z`)
        .lte('updated_at', `${dateRange.to}T23:59:59Z`)

      if (error) throw error
      setSubtasks(data || [])
    } catch (err) {
      console.error('Error fetching statistics:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [dateRange])

  // Lọc nhanh
  const setQuickFilter = (type) => {
    const now = new Date()
    let from = new Date()
    if (type === 'week') {
      from.setDate(now.getDate() - now.getDay())
    } else if (type === 'month') {
      from = new Date(now.getFullYear(), now.getMonth(), 1)
    }
    setDateRange({
      from: from.toISOString().split('T')[0],
      to: now.toISOString().split('T')[0]
    })
  }

  // Aggregate Data
  const staffStats = useMemo(() => {
    const stats = subtasks.reduce((acc, st) => {
      const userId = st.assigned_to
      if (!userId) return acc
      
      if (!acc[userId]) {
        acc[userId] = {
          user: st.users,
          total: 0,
          completed: 0,
          ratings: { good: 0, fair: 0, bad: 0, none: 0 },
          recentNotes: [],
          badTasks: []
        }
      }

      const s = acc[userId]
      s.total += 1
      if (st.status === 'completed') s.completed += 1
      
      const rating = st.evaluation_rating || 'none'
      if (s.ratings[rating] !== undefined) s.ratings[rating] += 1
      
      if (st.evaluation_note) {
        s.recentNotes.unshift(st.evaluation_note)
        if (s.recentNotes.length > 3) s.recentNotes.pop()
      }

      if (rating === 'bad') {
        s.badTasks.push(st)
      }

      return acc
    }, {})

    return Object.values(stats).sort((a, b) => b.total - a.total)
  }, [subtasks])

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar />
      <div className="flex-1 md:ml-64 flex flex-col h-screen overflow-y-auto">
        <TopBar title="Thống kê nhân sự" />
        <div className="p-4 lg:p-6 font-sans">
          <div className="max-w-7xl mx-auto">
        {/* Header & Filter */}
        <div className="mb-6 flex flex-col lg:flex-row lg:items-end justify-between gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
          <div>
            <h1 className="text-lg font-bold text-[#131b2e]">Thống kê nhân sự</h1>
            <p className="text-xs text-slate-500 mt-1">Tổng hợp kết quả đánh giá công việc</p>
          </div>
          
          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200">
              <button 
                onClick={() => setQuickFilter('week')}
                className="flex-1 sm:flex-none px-3 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-white hover:shadow-sm rounded-lg transition-all text-center"
              >
                Tuần này
              </button>
              <button 
                onClick={() => setQuickFilter('month')}
                className="flex-1 sm:flex-none px-3 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-white hover:shadow-sm rounded-lg transition-all text-center"
              >
                Tháng này
              </button>
            </div>
            
            <div className="flex items-center justify-between sm:justify-start gap-2 bg-slate-50/50 p-1 sm:p-0 rounded-xl sm:bg-transparent">
              <input 
                type="date" 
                value={dateRange.from}
                onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                className="flex-1 sm:flex-none px-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none bg-white"
              />
              <span className="text-slate-400 text-[10px] font-bold uppercase">To</span>
              <input 
                type="date" 
                value={dateRange.to}
                onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
                className="flex-1 sm:flex-none px-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none bg-white"
              />
            </div>

            <button 
              onClick={() => window.print()}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-[#006591] text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-900/20 hover:brightness-110 transition-all"
            >
              <span className="material-symbols-outlined text-sm">download</span>
              Xuất báo cáo
            </button>
          </div>
        </div>

        {/* Summary Table & Mobile Cards */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="hidden sm:block overflow-x-auto bg-white">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Nhân sự</th>
                  <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center">Tổng việc</th>
                  <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center">Hoàn thành</th>
                  <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center">Đánh giá</th>
                  <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Nhận xét gần nhất</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent"></div>
                        <span className="text-xs text-slate-400 font-medium">Đang tính toán dữ liệu...</span>
                      </div>
                    </td>
                  </tr>
                ) : staffStats.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-12 text-center text-slate-400 text-sm">
                      Không có dữ liệu trong khoảng thời gian này
                    </td>
                  </tr>
                ) : (
                  staffStats.map((stat) => (
                    <tr 
                      key={stat.user.user_id} 
                      className="hover:bg-blue-50/30 transition-colors cursor-pointer group"
                      onClick={() => stat.badTasks.length > 0 && setSelectedStaffTasks(stat)}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-md border-2 border-white">
                            {stat.user.avatar_url ? (
                              <img src={stat.user.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                            ) : stat.user.full_name?.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-[#131b2e] truncate">{stat.user.full_name}</p>
                            <p className="text-[10px] text-slate-400 truncate">{stat.user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-sm font-bold text-[#131b2e]">{stat.total}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-sm font-bold text-blue-600">{Math.round((stat.completed / stat.total) * 100)}%</span>
                          <div className="w-16 h-1 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-blue-500 rounded-full" 
                              style={{ width: `${(stat.completed / stat.total) * 100}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-1.5">
                          {stat.ratings.good > 0 && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 text-[10px] font-bold">
                              {stat.ratings.good} Tốt
                            </span>
                          )}
                          {stat.ratings.fair > 0 && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-100 text-[10px] font-bold">
                              {stat.ratings.fair} Khá
                            </span>
                          )}
                          {stat.ratings.bad > 0 && (
                            <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-100 text-[10px] font-bold animate-pulse">
                              {stat.ratings.bad} Tệ
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1 max-w-[300px]">
                          {stat.recentNotes.length > 0 ? (
                            stat.recentNotes.map((note, i) => (
                              <p key={i} className="text-[11px] text-slate-500 italic truncate" title={note}>
                                " {note} "
                              </p>
                            ))
                          ) : (
                            <span className="text-[10px] text-slate-300 italic">Chưa có nhận xét</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* 2. VIEW MOBILE: Card List (block sm:hidden) */}
          <div className="block sm:hidden flex flex-col divide-y divide-slate-100 bg-white">
            {loading ? (
              <div className="px-6 py-12 text-center">
                <div className="flex flex-col items-center gap-2">
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent"></div>
                  <span className="text-xs text-slate-400 font-medium">Đang tính toán dữ liệu...</span>
                </div>
              </div>
            ) : staffStats.length === 0 ? (
              <div className="px-6 py-12 text-center text-slate-400 text-sm">
                Không có dữ liệu trong khoảng thời gian này
              </div>
            ) : (
              staffStats.map((stat) => (
                <div 
                  key={stat.user.user_id} 
                  className="p-3 active:bg-slate-50 transition-colors flex flex-col gap-2.5"
                  onClick={() => stat.badTasks.length > 0 && setSelectedStaffTasks(stat)}
                >
                  {/* Tầng 1: Chỉ số KPI (Header Row) */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-[11px] shrink-0 border border-white shadow-sm">
                        {stat.user.avatar_url ? (
                          <img src={stat.user.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                        ) : stat.user.full_name?.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold text-[#131b2e] truncate leading-tight uppercase tracking-tight">{stat.user.full_name}</p>
                        <p className="text-[9px] text-slate-400 truncate leading-tight">{stat.user.email}</p>
                      </div>
                    </div>
                    
                    <div className="text-right shrink-0">
                      <div className="flex items-center justify-end gap-2 mb-1">
                        <span className="text-[10px] font-black text-slate-700">{stat.total} việc</span>
                        <span className="text-[10px] font-black text-blue-600">{Math.round((stat.completed / stat.total) * 100)}%</span>
                      </div>
                      {/* Mini Progress Bar */}
                      <div className="w-24 h-[3px] bg-slate-100 rounded-full ml-auto overflow-hidden">
                        <div 
                          className="h-full bg-blue-500 rounded-full" 
                          style={{ width: `${(stat.completed / stat.total) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Tầng 2: Phản hồi định tính (Feedback Row) */}
                  <div className="border-t border-slate-50 pt-2 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 flex-wrap">
                        {stat.ratings.good > 0 && (
                          <span className="text-[8px] bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded border border-emerald-100 font-black uppercase">
                            {stat.ratings.good} Tốt
                          </span>
                        )}
                        {stat.ratings.fair > 0 && (
                          <span className="text-[8px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded border border-amber-100 font-black uppercase">
                            {stat.ratings.fair} Khá
                          </span>
                        )}
                        {stat.ratings.bad > 0 && (
                          <span className="text-[8px] bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded border border-rose-100 font-black uppercase animate-pulse">
                            {stat.ratings.bad} Tệ
                          </span>
                        )}
                        {stat.ratings.good === 0 && stat.ratings.fair === 0 && stat.ratings.bad === 0 && (
                          <span className="text-[9px] text-slate-300 italic">Chưa có đánh giá</span>
                        )}
                      </div>
                      {stat.badTasks.length > 0 && (
                        <span className="text-[9px] font-bold text-rose-500 flex items-center gap-1">
                          {stat.badTasks.length} task lỗi <span className="material-symbols-outlined text-[10px]">arrow_forward_ios</span>
                        </span>
                      )}
                    </div>

                    <div className="bg-slate-50/80 p-1.5 rounded-lg border border-slate-100/50">
                      <p className="text-[10px] text-slate-500 italic leading-tight line-clamp-2">
                        {stat.recentNotes.length > 0 ? `"${stat.recentNotes[0]}"` : 'Chưa có nhận xét'}
                      </p>
                    </div>
                  </div>
                </div>
              )
            ))}
          </div>
        </div>

        {/* Modal Chi tiết Task Tệ */}
        {selectedStaffTasks && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
              <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-[#131b2e]">Danh sách Task cần chấn chỉnh</h3>
                  <p className="text-xs text-rose-500 font-medium">Nhân sự: {selectedStaffTasks.user.full_name}</p>
                </div>
                <button 
                  onClick={() => setSelectedStaffTasks(null)}
                  className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-slate-200 text-slate-400 transition-colors"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {selectedStaffTasks.badTasks.map((st) => (
                  <div key={st.subtask_id} className="p-4 rounded-2xl border border-rose-100 bg-rose-50/30">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-bold text-[#131b2e]">{st.name}</h4>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">
                        {new Date(st.updated_at).toLocaleDateString('vi-VN')}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mb-2">
                      <span className="font-bold">Dự án:</span> {st.tasks?.features?.name} · {st.tasks?.name}
                    </div>
                    <div className="p-2 rounded-lg bg-white border border-rose-100 text-xs italic text-rose-600">
                      <span className="font-bold not-italic">Lý do:</span> {st.evaluation_note || 'Không có ghi chú cụ thể'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
          </div>
        </div>
      </div>
    </div>
  )
}
