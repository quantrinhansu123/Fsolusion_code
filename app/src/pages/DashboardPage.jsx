import { useState, useEffect } from 'react'
import Sidebar from '../components/Sidebar'
import TopBar from '../components/TopBar'
import { supabase } from '../utils/supabase'

export default function DashboardPage() {
  const [stats, setStats] = useState([
    { label: 'Tổng khách hàng', value: '0', trend: '...', trendLabel: 'đang tải', icon: 'groups', bg: 'bg-teal-100', iconColor: 'text-teal-600', trendBg: 'bg-teal-50', trendText: 'text-teal-600', circleBg: 'bg-teal-50' },
    { label: 'Tổng dự án', value: '0', trend: '...', trendLabel: 'mới cập nhật', icon: 'folder_open', bg: 'bg-blue-100', iconColor: 'text-blue-600', trendBg: 'bg-blue-50', trendText: 'text-blue-600', circleBg: 'bg-blue-50' },
    { label: 'Tổng doanh thu', value: '0 ₫', trend: '...', trendLabel: 'tổng cộng', icon: 'bar_chart', bg: 'bg-green-100', iconColor: 'text-green-600', trendBg: 'bg-green-50', trendText: 'text-green-600', circleBg: 'bg-green-50' },
  ])
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  async function fetchDashboardData() {
    setLoading(true)
    try {
      // 1. Fetch Stats
      const [
        { count: customerCount },
        { count: projectCount },
        { data: projectsData },
      ] = await Promise.all([
        supabase.from('customers').select('*', { count: 'exact', head: true }),
        supabase.from('projects').select('*', { count: 'exact', head: true }),
        supabase.from('projects').select('pricing'),
      ])

      const totalRevenue = (projectsData || []).reduce((sum, p) => sum + (Number(p.pricing) || 0), 0)

      setStats([
        { label: 'Tổng khách hàng', value: String(customerCount || 0), trend: '', trendLabel: 'Hệ thống', icon: 'groups', bg: 'bg-teal-100', iconColor: 'text-teal-600', trendBg: 'bg-teal-50', trendText: 'text-teal-600', circleBg: 'bg-teal-50' },
        { label: 'Tổng dự án', value: String(projectCount || 0), trend: '', trendLabel: 'Dự án đang chạy', icon: 'folder_open', bg: 'bg-blue-100', iconColor: 'text-blue-600', trendBg: 'bg-blue-50', trendText: 'text-blue-600', circleBg: 'bg-blue-50' },
        { label: 'Tổng doanh thu', value: new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(totalRevenue), trend: '', trendLabel: 'Kế hoạch', icon: 'bar_chart', bg: 'bg-green-100', iconColor: 'text-green-600', trendBg: 'bg-green-50', trendText: 'text-green-600', circleBg: 'bg-green-50' },
      ])

      // 2. Fetch Recent Activities (Mix of Projects and Tasks)
      const [
        { data: recentProjects },
        { data: recentTasks },
      ] = await Promise.all([
        supabase.from('projects').select('name, created_at').order('created_at', { ascending: false }).limit(3),
        supabase.from('tasks').select('name, created_at, status').order('created_at', { ascending: false }).limit(3),
      ])

      const combined = [
        ...(recentProjects || []).map(p => ({
          icon: 'folder',
          iconBg: 'bg-[#c9e6ff]',
          iconColor: 'text-[#001e2f]',
          title: `Dự án mới: ${p.name}`,
          meta: `Khởi tạo vào ${new Date(p.created_at).toLocaleDateString('vi-VN')}`,
          tag: 'Dự án',
          tagCls: 'bg-[#dae2fd] text-[#3e4850]',
        })),
        ...(recentTasks || []).map(t => {
          const STATUS_MAP = {
            pending: 'Đang chờ',
            in_progress: 'Đang làm',
            completed: 'Hoàn thành',
            overdue: 'Trễ hẹn'
          }
          return {
            icon: t.status === 'completed' ? 'task_alt' : 'description',
            iconBg: t.status === 'completed' ? 'bg-[#ffdcbd]' : 'bg-[#dae2fd]',
            iconColor: 'text-[#001e2f]',
            title: `Nhiệm vụ: ${t.name}`,
            meta: `Trạng thái: ${STATUS_MAP[t.status] || t.status}`,
            tag: 'Task',
            tagCls: 'bg-[#dae2fd] text-[#3e4850]',
          }
        }),
      ].sort((a, b) => new Date(b.meta.split('vào ')[1] || 0) - new Date(a.meta.split('vào ')[1] || 0))

      setActivities(combined.slice(0, 5))
    } catch (err) {
      console.error('Error fetching dashboard data:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-[#faf8ff]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#006591]"></div>
    </div>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-[#faf8ff]">
      <Sidebar />

      <div className="flex-1 ml-64 flex flex-col h-screen overflow-y-auto">
        <TopBar title="Dashboard" />

        <div className="p-10 space-y-10 max-w-7xl mx-auto w-full">
          {/* Heading */}
          <div className="flex items-end justify-between">
            <div>
              <h3 className="text-2xl font-bold text-[#131b2e] tracking-tight">Tổng quan hoạt động</h3>
              <p className="text-[#3e4850] mt-1 text-sm">Cập nhật số liệu kinh doanh mới nhất.</p>
            </div>
            <div className="text-sm text-[#3e4850] font-medium bg-[#f2f3ff] px-4 py-2 rounded-lg">
              {new Date().toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })}
            </div>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {stats.map(s => (
              <div
                key={s.label}
                className="bg-white rounded-2xl p-6 shadow-[0_8px_30px_rgb(19,27,46,0.04)] border border-[#bec8d2]/10 hover:shadow-[0_8px_30px_rgb(19,27,46,0.09)] transition-shadow duration-300 relative overflow-hidden group"
              >
                <div className={`absolute -right-6 -top-6 w-24 h-24 ${s.circleBg} rounded-full group-hover:scale-110 transition-transform duration-500`} />
                <div className="flex items-start justify-between relative z-10">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-[#3e4850] font-semibold mb-2">{s.label}</p>
                    <h4 className="text-4xl font-black text-[#131b2e] tracking-tighter">{s.value}</h4>
                  </div>
                  <div className={`w-12 h-12 rounded-xl ${s.bg} flex items-center justify-center ${s.iconColor}`}>
                    <span className="material-symbols-outlined icon-fill">{s.icon}</span>
                  </div>
                </div>
                <div className="mt-6 flex items-center gap-2 text-sm">
                  {s.trend && (
                    <span className={`${s.trendText} ${s.trendBg} px-2 py-0.5 rounded flex items-center gap-1 font-medium`}>
                      <span className="material-symbols-outlined text-[14px]">trending_up</span>
                      {s.trend}
                    </span>
                  )}
                  <span className="text-[#3e4850]">{s.trendLabel}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Recent activity */}
          <div className="bg-[#f2f3ff] rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-[#131b2e]">Hoạt động gần đây</h3>
              <button className="text-sm font-semibold text-[#006591] hover:text-[#0ea5e9] transition-colors flex items-center gap-1">
                Xem tất cả
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </button>
            </div>
            <div className="space-y-3">
              {activities.map((a, i) => (
                <div key={i} className="bg-white p-4 rounded-xl flex items-center justify-between hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full ${a.iconBg} flex items-center justify-center ${a.iconColor}`}>
                      <span className="material-symbols-outlined icon-fill">{a.icon}</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#131b2e]">{a.title}</p>
                      <p className="text-xs text-[#3e4850] mt-0.5">{a.meta}</p>
                    </div>
                  </div>
                  <span className={`text-xs font-medium px-3 py-1 rounded-full ${a.tagCls}`}>{a.tag}</span>
                </div>
              ))}
              {activities.length === 0 && (
                <p className="text-sm text-[#3e4850] italic py-4 text-center">Chưa có hoạt động nào được ghi nhận.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
