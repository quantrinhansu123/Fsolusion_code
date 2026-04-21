import { useState, useEffect } from 'react'
import Sidebar from '../components/Sidebar'
import TopBar from '../components/TopBar'
import { supabase } from '../utils/supabase'

export default function ProgressReportPage() {
  const [reportData, setReportData] = useState([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    fetchProfileAndData()
  }, [])

  async function fetchProfileAndData() {
    setLoading(true)
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) return

    const { data: profile } = await supabase.from('users').select('*').eq('user_id', authUser.id).single()
    setUser(profile)

    // Fetch projects with tasks
    let query = supabase
      .from('projects')
      .select(`
        *,
        customers(name),
        project_assignments(user_id),
        features(
          *,
          tasks(
            *,
            users:assigned_to(full_name),
            subtasks(*)
          )
        )
      `)

    const { data, error } = await query
    if (error) {
      console.error('Error fetching report data:', error)
    } else {
      // Filter for managers
      let filtered = data
      if (profile.role === 'manager') {
        filtered = data.filter(p =>
          p.project_assignments.some(a => a.user_id === authUser.id)
        )
      }
      setReportData(filtered || [])
    }
    setLoading(false)
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
                    <div className="grid grid-cols-1 gap-4">
                      {paginatedData.map(p => {
                        const progress = calculateProgress(p)
                        return (
                          <div key={p.project_id} className="bg-white rounded-2xl shadow-sm border border-[#bec8d2]/15 overflow-hidden hover:shadow-md transition-shadow">
                            <div className="p-4">
                              <div className="flex justify-between items-start mb-3">
                                <div>
                                  <span className="text-[8px] md:text-[10px] font-bold text-[#006591] bg-[#dae2fd] px-2 py-0.5 rounded-full uppercase tracking-wider mb-2 inline-block">
                                    {p.customers?.name}
                                  </span>
                                  <h3 className="text-base md:text-xl font-bold text-[#131b2e]">{p.name}</h3>
                                </div>
                                <div className="text-right">
                                  <div className="text-xl md:text-3xl font-black text-[#131b2e]">{progress}%</div>
                                  <div className="text-[8px] md:text-[10px] font-bold text-[#3e4850] uppercase tracking-widest">Hoàn thành</div>
                                </div>
                              </div>

                              {/* Progress Bar */}
                              <div className="w-full h-3 bg-[#f2f3ff] rounded-full mb-4 relative overflow-hidden">
                                <div
                                  className="absolute left-0 top-0 h-full primary-gradient transition-all duration-1000 ease-out"
                                  style={{ width: `${progress}%` }}
                                />
                              </div>

                              {/* Tasks Detail */}
                              <div className="space-y-2">
                                <h4 className="text-[10px] md:text-xs font-bold text-[#3e4850] uppercase tracking-wider border-b border-[#bec8d2]/10 pb-2 flex justify-between">
                                  Chi tiết nhiệm vụ
                                  <span>Trạng thái</span>
                                </h4>
                                <div className="grid grid-cols-1 gap-2">
                                  {p.features?.flatMap(f => f.tasks || []).map(t => (
                                    <div key={t.task_id} className="flex justify-between items-center py-2 px-2 bg-[#faf8ff] rounded-xl border border-[#bec8d2]/5">
                                      <div className="flex items-center gap-2">
                                        <span className={`material-symbols-outlined text-sm ${t.status === 'completed' ? 'text-green-500' : 'text-[#6e7881]'}`}>
                                          {t.status === 'completed' ? 'check_circle' : 'radio_button_unchecked'}
                                        </span>
                                        <div>
                                          <div className="text-xs md:text-sm font-semibold text-[#131b2e]">{t.name}</div>
                                          <div className="text-[8px] md:text-[10px] text-[#3e4850]">Phụ trách: <span className="font-bold">{t.users?.full_name || 'Chưa phân công'}</span></div>
                                        </div>
                                      </div>
                                      <span className={`text-[8px] md:text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${t.status === 'completed' ? 'bg-green-100 text-green-700' :
                                          t.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                                            'bg-gray-100 text-gray-700'
                                        }`}>
                                        {t.status === 'completed' ? 'Xong' : t.status === 'in_progress' ? 'Làm' : 'Chờ'}
                                      </span>
                                    </div>
                                  ))}
                                </div>
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
