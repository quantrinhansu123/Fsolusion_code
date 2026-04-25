import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import TopBar from '../components/TopBar'
import { supabase } from '../utils/supabase'
import { useAuth } from '../utils/AuthContext'

export default function ProgressReportPage() {
  const [reportData, setReportData] = useState([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)

  const { user: authUser, loading: authLoading } = useAuth()
  const [hasFetched, setHasFetched] = useState(false)

  const location = useLocation()
  const isActive = location.pathname === '/progress'

  useEffect(() => {
    if (isActive && !authLoading && authUser) {
      fetchReportData(!hasFetched)
      setHasFetched(true)
    }
  }, [isActive, authLoading, authUser])

  async function fetchReportData(showSpinner = true) {
    if (showSpinner) setLoading(true)
    try {
      // Fetch projects with tasks only (no subtasks needed for this report)
      let query = supabase
        .from('projects')
        .select(`
          project_id, name, status,
          customers(name),
          project_assignments(user_id),
          features(
            feature_id, name,
            tasks(
              task_id, name, status, assigned_to,
              users:assigned_to(full_name)
            )
          )
        `)

      const { data, error } = await query
      if (error) throw error

      let filtered = data || []
      if (authUser?.role !== 'admin') {
        filtered = filtered.filter(p =>
          p.project_assignments?.some(a => a.user_id === authUser.id)
        )
      }
      setReportData(filtered)
    } catch (err) {
      console.error('Error fetching report data:', err)
    } finally {
      setLoading(false)
    }
  }

  const calculateProgress = (project) => {
    let totalTasks = 0
    let completedTasks = 0

    project.features?.forEach(f => {
      f.tasks?.forEach(t => {
        totalTasks++
        if (t.status === 'completed') completedTasks++
      })
    })

    if (totalTasks === 0) return 0
    return Math.round((completedTasks / totalTasks) * 100)
  }

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-[#faf8ff]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#006591]"></div>
    </div>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-[#faf8ff]">
      <Sidebar />
      <div className="flex-1 md:ml-64 flex flex-col h-screen overflow-y-auto">
        <TopBar title="Báo cáo tiến độ" />
        <main className="flex-1 p-8">
          <div className="max-w-7xl mx-auto space-y-4">
            <header>
              <h2 className="text-xl md:text-3xl font-bold tracking-tight text-[#131b2e] mb-1">Báo cáo tiến độ</h2>
              <p className="text-xs md:text-sm text-[#3e4850]">Tổng quan hiệu suất công việc và trạng thái dự án.</p>
            </header>

            <div className="grid grid-cols-1 gap-4">
              {(() => {
                const itemsPerPage = 4
                const totalPages = Math.ceil(reportData.length / itemsPerPage)
                const startIdx = (currentPage - 1) * itemsPerPage
                const endIdx = startIdx + itemsPerPage
                const paginatedData = reportData.slice(startIdx, endIdx)

                return (
                  <>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {paginatedData.map(p => {
                        const progress = calculateProgress(p)
                        return (
                          <div key={p.project_id} className="bg-white rounded-xl shadow-sm border border-[#bec8d2]/20 overflow-hidden hover:shadow-md transition-shadow">
                            <div className="p-3">
                              {/* Header: All in one line */}
                              <div className="flex items-center justify-between gap-3 mb-2.5">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-0.5">
                                    <span className="text-[8px] font-bold text-[#3e4850] bg-[#dae2fd] px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                                      {p.customers?.name || 'Khách lẻ'}
                                    </span>
                                    <h3 className="text-xs md:text-[13px] font-bold text-[#131b2e] truncate">{p.name}</h3>
                                  </div>
                                  <div className="w-full h-1 bg-[#f2f3ff] rounded-full relative overflow-hidden">
                                    <div
                                      className="absolute left-0 top-0 h-full primary-gradient transition-all duration-1000"
                                      style={{ width: `${progress}%` }}
                                    />
                                  </div>
                                </div>
                                <div className="shrink-0 text-right">
                                  <span className="text-sm md:text-base font-black text-[#006591] leading-none">{progress}%</span>
                                </div>
                              </div>

                              {/* Tasks Detail - Ultra Compact Row List */}
                              <div className="space-y-1">
                                {p.features?.flatMap(f => f.tasks || []).map(t => (
                                  <div key={t.task_id} className="flex justify-between items-center py-1 px-1.5 hover:bg-[#faf8ff] rounded transition-all group border-b border-[#bec8d2]/5 last:border-0">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <span className={`material-symbols-outlined text-[14px] ${t.status === 'completed' ? 'text-green-500' : 'text-[#6e7881]'}`}>
                                        {t.status === 'completed' ? 'check_circle' : 'radio_button_unchecked'}
                                      </span>
                                      <p className="text-[10px] font-medium text-[#131b2e] truncate">{t.name}</p>
                                      <span className="text-[9px] text-[#3e4850] opacity-40 truncate">· {t.users?.full_name?.split(' ').pop() || 'N/A'}</span>
                                    </div>
                                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-md uppercase ${t.status === 'completed' ? 'bg-green-100 text-green-700' :
                                        t.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                                          'bg-gray-100 text-gray-700'
                                      }`}>
                                      {t.status === 'completed' ? 'Xong' : t.status === 'in_progress' ? 'Làm' : 'Chờ'}
                                    </span>
                                  </div>
                                ))}
                                {p.features?.flatMap(f => f.tasks || []).length === 0 && (
                                  <p className="text-[9px] text-[#3e4850] opacity-40 italic py-1 text-center">Không có nhiệm vụ</p>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {totalPages > 1 && reportData.length > 0 && (
                      <div className="mt-6 flex items-center justify-center gap-1 flex-nowrap overflow-x-auto">
                        <button
                          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                          disabled={currentPage === 1}
                          className="px-3 py-2 rounded-lg border border-[#bec8d2]/40 text-[#131b2e] text-xs md:text-sm font-medium hover:bg-[#f2f3ff] disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                        >
                          Trước
                        </button>

                        {/* Show first 2 pages */}
                        {[1, 2].filter(p => p <= totalPages).map(page => (
                          <button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            className={`px-2 md:px-3 py-2 rounded-lg text-xs md:text-sm font-medium transition-colors whitespace-nowrap ${
                              currentPage === page
                                ? 'bg-[#006591] text-white border border-[#006591]'
                                : 'border border-[#bec8d2]/40 text-[#131b2e] hover:bg-[#f2f3ff]'
                            }`}
                          >
                            {page}
                          </button>
                        ))}

                        {/* Ellipsis if there are more pages */}
                        {totalPages > 4 && (
                          <span className="px-2 py-2 text-xs md:text-sm text-[#3e4850]">...</span>
                        )}

                        {/* Show last 2 pages if more than 4 total pages */}
                        {totalPages > 4 && [totalPages - 1, totalPages].map(page => (
                          <button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            className={`px-2 md:px-3 py-2 rounded-lg text-xs md:text-sm font-medium transition-colors whitespace-nowrap ${
                              currentPage === page
                                ? 'bg-[#006591] text-white border border-[#006591]'
                                : 'border border-[#bec8d2]/40 text-[#131b2e] hover:bg-[#f2f3ff]'
                            }`}
                          >
                            {page}
                          </button>
                        ))}

                        {/* Show all pages if 4 or fewer */}
                        {totalPages <= 4 && Array.from({ length: totalPages - 2 }, (_, i) => 3 + i).map(page => (
                          <button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            className={`px-2 md:px-3 py-2 rounded-lg text-xs md:text-sm font-medium transition-colors whitespace-nowrap ${
                              currentPage === page
                                ? 'bg-[#006591] text-white border border-[#006591]'
                                : 'border border-[#bec8d2]/40 text-[#131b2e] hover:bg-[#f2f3ff]'
                            }`}
                          >
                            {page}
                          </button>
                        ))}

                        <button
                          onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                          disabled={currentPage === totalPages}
                          className="px-3 py-2 rounded-lg border border-[#bec8d2]/40 text-[#131b2e] text-xs md:text-sm font-medium hover:bg-[#f2f3ff] disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                        >
                          Sau
                        </button>
                      </div>
                    )}

                    {reportData.length === 0 && (
                      <div className="bg-white rounded-2xl border-2 border-dashed border-[#bec8d2] p-8 text-center text-[#6e7881]">
                        <span className="material-symbols-outlined text-3xl md:text-5xl mb-4">folder_open</span>
                        <p className="text-xs md:text-sm">Chưa có dữ liệu báo cáo cho các dự án của bạn.</p>
                      </div>
                    )}
                  </>
                )
              })()}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
