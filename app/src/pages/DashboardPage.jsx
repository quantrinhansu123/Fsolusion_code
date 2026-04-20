import { useState, useEffect } from 'react'
import Sidebar from '../components/Sidebar'
import TopBar from '../components/TopBar'
import { supabase } from '../utils/supabase'

const SUBTASK_STATUS_LABELS = {
  pending: 'Đang chờ',
  in_progress: 'Đang làm',
  completed: 'Hoàn thành',
  overdue: 'Trễ hẹn',
}

function formatSubtaskDeadline(iso) {
  if (!iso) return 'Không có hạn'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'Không có hạn'
  return d.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
}

export default function DashboardPage() {
  const [stats, setStats] = useState([
    { label: 'Tổng khách hàng', value: '0', trend: '...', trendLabel: 'đang tải', icon: 'groups', bg: 'bg-teal-100', iconColor: 'text-teal-600', trendBg: 'bg-teal-50', trendText: 'text-teal-600', circleBg: 'bg-teal-50' },
    { label: 'Tổng dự án', value: '0', trend: '...', trendLabel: 'mới cập nhật', icon: 'folder_open', bg: 'bg-blue-100', iconColor: 'text-blue-600', trendBg: 'bg-blue-50', trendText: 'text-blue-600', circleBg: 'bg-blue-50' },
    { label: 'Tổng doanh thu', value: '0 ₫', trend: '...', trendLabel: 'tổng cộng', icon: 'bar_chart', bg: 'bg-green-100', iconColor: 'text-green-600', trendBg: 'bg-green-50', trendText: 'text-green-600', circleBg: 'bg-green-50' },
  ])
  const [activities, setActivities] = useState([])
  const [subtaskByStaff, setSubtaskByStaff] = useState([])
  const [selectedAssignee, setSelectedAssignee] = useState('all')
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

      // 3. Fetch subtask theo nhân sự phụ trách
      const { data: subtaskData } = await supabase
        .from('subtasks')
        .select(`
          subtask_id,
          name,
          status,
          deadline,
          assigned_to,
          updated_at,
          users:assigned_to(user_id, full_name),
          task:tasks(
            name,
            feature:features(
              name,
              project:projects(name)
            )
          )
        `)
        .not('assigned_to', 'is', null)
        .order('updated_at', { ascending: false })

      setSubtaskByStaff(subtaskData || [])
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

  const assigneeOptions = Array.from(
    new Map(
      subtaskByStaff.map(s => [s.assigned_to, {
        id: s.assigned_to,
        name: s.users?.full_name || 'Chưa rõ tên',
      }])
    ).values()
  )

  const filteredSubtasks =
    selectedAssignee === 'all'
      ? subtaskByStaff
      : subtaskByStaff.filter(s => s.assigned_to === selectedAssignee)

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

          <div className="bg-white rounded-2xl p-6 border border-[#bec8d2]/15 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
              <div>
                <h3 className="text-lg font-bold text-[#131b2e]">Task theo nhân sự</h3>
                <p className="text-xs text-[#3e4850] mt-1">Nhấn từng nhân sự để chỉ xem các subtask họ đang phụ trách.</p>
              </div>
              <span className="text-xs font-semibold text-[#3e4850] bg-[#f2f3ff] px-3 py-1 rounded-lg">
                {filteredSubtasks.length} subtask
              </span>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              <button
                type="button"
                onClick={() => setSelectedAssignee('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                  selectedAssignee === 'all'
                    ? 'bg-[#006591] text-white border-[#006591]'
                    : 'bg-white text-[#3e4850] border-[#bec8d2]/40 hover:bg-[#f2f3ff]'
                }`}
              >
                Tất cả
              </button>
              {assigneeOptions.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedAssignee(p.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    selectedAssignee === p.id
                      ? 'bg-[#006591] text-white border-[#006591]'
                      : 'bg-white text-[#3e4850] border-[#bec8d2]/40 hover:bg-[#f2f3ff]'
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              {filteredSubtasks.map(st => (
                <div key={st.subtask_id} className="rounded-xl border border-[#bec8d2]/15 bg-[#faf8ff] p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#131b2e]">{st.name}</p>
                      <p className="text-xs text-[#3e4850] mt-0.5">
                        {st.task?.feature?.project?.name || '—'} · {st.task?.feature?.name || '—'} · {st.task?.name || '—'}
                      </p>
                    </div>
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[#dae2fd] text-[#3e4850]">
                      {SUBTASK_STATUS_LABELS[st.status] || st.status}
                    </span>
                  </div>
                  <div className="mt-2 text-[11px] text-[#3e4850]">
                    <span className="font-medium">Phụ trách:</span> {st.users?.full_name || '—'} ·{' '}
                    <span className="font-medium">Hạn:</span> {formatSubtaskDeadline(st.deadline)}
                  </div>
                </div>
              ))}

              {filteredSubtasks.length === 0 && (
                <p className="text-sm text-[#3e4850] italic py-4 text-center">
                  Không có subtask nào cho nhân sự đã chọn.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
