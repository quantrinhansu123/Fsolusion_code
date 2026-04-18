import { useState, useEffect } from 'react'
import Sidebar from '../components/Sidebar'
import TopBar from '../components/TopBar'
import StatusBadge from '../components/StatusBadge'
import ThreeDotMenu from '../components/ThreeDotMenu'
import { EntityFormModal, CUSTOMER_FIELDS, PROJECT_FIELDS, FEATURE_FIELDS, TASK_FIELDS, SUBTASK_FIELDS } from '../components/EntityFormModal'
import { supabase } from '../utils/supabase'
import Toast from '../components/Toast'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return '—'
  // Handle YYYY-MM-DD
  const parts = dateStr.split('-')
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`
  return dateStr
}

function useModal() {
  const [modal, setModal] = useState(null)    // { type, ...context }
  const [form, setForm] = useState({})
  const open = (type, ctx = {}) => { 
    setModal({ type, ...ctx })
    setForm(ctx.initial || ctx || {})
  }
  const close = () => { setModal(null); setForm({}) }
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  return { modal, form, open, close, set }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SubtaskRow({ subtask, onEdit, onDelete, userRole }) {
  const canEdit = userRole !== 'employee'
  return (
    <div className="grid grid-cols-[3fr_3fr_1.5fr_1.5fr_1.5fr_auto] gap-2 items-center py-1.5 px-2 rounded hover:bg-[#eaedff]/50">
      <div className="flex items-center gap-1.5 text-[11px] text-[#131b2e]">
        <span className="material-symbols-outlined text-[14px] text-[#006591]">check_box_outline_blank</span>
        {subtask.name}
      </div>
      <div className="text-[10px] text-[#3e4850] truncate">{subtask.description}</div>
      <div className="text-[10px] text-[#3e4850]">{formatDate(subtask.deadline)}</div>
      <div className="flex items-center gap-1 min-w-[100px]">
        {subtask.users?.full_name && (
          <div className="flex items-center gap-1 text-[10px] text-[#006591] bg-[#dae2fd] px-1.5 py-0.5 rounded-full font-medium">
            <span className="material-symbols-outlined text-[12px]">person</span>
            {subtask.users.full_name}
          </div>
        )}
      </div>
      <div><StatusBadge status={subtask.status} /></div>
      <ThreeDotMenu items={[
        { icon: 'edit', label: 'Chỉnh sửa', onClick: () => onEdit(subtask) },
        ...(canEdit ? [{ icon: 'delete', label: 'Xóa', onClick: () => onDelete(subtask.subtask_id), danger: true }] : []),
      ]} />
    </div>
  )
}

function TaskRow({ task, onEdit, onDelete, onAddSubtask, onEditSubtask, onDeleteSubtask, userRole }) {
  const [expanded, setExpanded] = useState(false)
  const canModify = userRole !== 'employee'

  return (
    <div className="bg-white rounded-md shadow-sm border border-[#bec8d2]/10">
      <div
        className="grid grid-cols-[3fr_3fr_1.5fr_1.5fr_1.5fr_auto] gap-2 items-center px-3 py-2.5 cursor-pointer"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-center gap-2 font-medium text-xs text-[#131b2e]">
          <span className={`material-symbols-outlined text-[14px] text-[#006591] transition-transform ${expanded ? 'rotate-90' : ''}`}>chevron_right</span>
          {task.name}
        </div>
        <div className="text-[11px] text-[#3e4850] truncate">{task.description}</div>
        <div className="text-[11px] text-[#3e4850]">{formatDate(task.deadline)}</div>
        <div className="flex items-center gap-1 min-w-[120px]">
          {task.users?.full_name && (
            <div className="flex items-center gap-1 text-[11px] text-[#006591] bg-[#dae2fd] px-2 py-0.5 rounded-full font-semibold">
              <span className="material-symbols-outlined text-[14px]">person</span>
              {task.users.full_name}
            </div>
          )}
        </div>
        <div><StatusBadge status={task.status} /></div>
        <ThreeDotMenu items={[
          { icon: 'edit', label: 'Chỉnh sửa', onClick: () => onEdit(task) },
          ...(canModify ? [{ icon: 'delete', label: 'Xóa', onClick: () => onDelete(task.task_id), danger: true }] : []),
          { icon: 'add_circle', label: 'Nhập subtask', onClick: () => onAddSubtask(task), primary: true },
        ]} />
      </div>

      {expanded && (
        <div className="pl-8 pr-2 pb-2 relative">
          <div className="absolute left-[18px] top-0 bottom-2 w-px border-l border-dashed border-[#bec8d2]/40" />
          <div className="space-y-0.5">
            {task.subtasks.map(st => (
              <SubtaskRow
                key={st.subtask_id}
                subtask={st}
                userRole={userRole}
                onEdit={s => onEditSubtask(s, task.task_id)}
                onDelete={sid => onDeleteSubtask(sid, task.task_id)}
              />
            ))}
            {task.subtasks.length === 0 && (
              <p className="pl-2 pt-1 text-[11px] text-[#6e7881] italic">Chưa có subtask.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function FeatureRow({ feature, onEdit, onDelete, onAddTask, onEditTask, onDeleteTask, onAddSubtask, onEditSubtask, onDeleteSubtask, userRole }) {
  const [expanded, setExpanded] = useState(false)
  const canModify = userRole !== 'employee'

  return (
    <div className={`rounded-lg border ${expanded ? 'bg-[#f2f3ff] border-[#bec8d2]/20' : 'bg-transparent border-transparent'}`}>
      <div
        className="grid grid-cols-[3fr_4fr_2fr_2fr_auto] gap-3 px-3 py-2 items-center cursor-pointer hover:bg-[#f2f3ff] rounded-lg transition-colors relative z-20 group-hover:z-30"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-center gap-2 font-medium text-sm text-[#131b2e]">
          <div className={`w-1.5 h-1.5 rounded-full ${feature.status === 'in_progress' ? 'bg-[#006591] animate-pulse' : 'bg-[#006591]'}`} />
          <span className={`material-symbols-outlined text-[14px] text-[#3e4850] transition-transform ${expanded ? 'rotate-90' : ''}`}>chevron_right</span>
          {feature.name}
        </div>
        <div className="text-xs text-[#3e4850] truncate">{feature.description}</div>
        <div className="text-xs text-[#3e4850]">{formatDate(feature.deadline)}</div>
        <div><StatusBadge status={feature.status} /></div>
        <ThreeDotMenu items={[
          { icon: 'edit', label: 'Chỉnh sửa', onClick: () => onEdit(feature) },
          ...(canModify ? [
            { icon: 'add_circle', label: 'Thêm nhiệm vụ (Task)', onClick: () => onAddTask(feature), primary: true },
            { icon: 'delete', label: 'Xóa', onClick: () => onDelete(feature.feature_id), danger: true }
          ] : []),
        ]} />
      </div>

      {expanded && (
        <div className="pl-10 pr-2 pb-3 relative mt-1">
          <div className="absolute left-5 top-0 bottom-2 w-px border-l border-dashed border-[#bec8d2]/40" />
          <div className="space-y-2">
            {feature.tasks.map(task => (
              <TaskRow
                key={task.task_id}
                task={task}
                userRole={userRole}
                onEdit={t => onEditTask(t, feature.feature_id)}
                onDelete={tid => onDeleteTask(tid, feature.feature_id)}
                onAddSubtask={t => onAddSubtask(t, feature.feature_id)}
                onEditSubtask={(s, tid) => onEditSubtask(s, tid, feature.feature_id)}
                onDeleteTask={(sid, tid) => onDeleteSubtask(sid, tid, feature.feature_id)}
              />
            ))}
            {feature.tasks.length === 0 && (
              <p className="text-xs text-[#6e7881] italic">Chưa có task.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ProjectRow({ project, onEdit, onDelete, onAssign, onRemoveAssignment, onAddFeature, onEditFeature, onDeleteFeature, onAddTask, onEditTask, onDeleteTask, onAddSubtask, onEditSubtask, onDeleteSubtask, userRole }) {
  const [expanded, setExpanded] = useState(false)
  const isManagerOrAdmin = userRole === 'admin' || userRole === 'manager'

  return (
    <div className="relative group">
      <div
        className="grid grid-cols-[3fr_3fr_2fr_2fr_2fr_auto] gap-3 px-3 py-3 items-center rounded-lg bg-white border border-[#bec8d2]/10 shadow-sm relative z-[5] cursor-pointer hover:shadow-md transition-shadow hover:z-20"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-center gap-2 font-semibold text-sm text-[#131b2e]">
          <span className={`material-symbols-outlined text-[14px] text-[#3e4850] transition-transform ${expanded ? 'rotate-90' : ''}`}>chevron_right</span>
          {project.name}
        </div>
        <div className="text-xs text-[#3e4850] truncate">{project.description}</div>
        <div className="text-xs font-medium text-[#3e4850]">{project.pricing ? `${project.pricing.toLocaleString()} ₫` : '—'}</div>
        <div className="text-xs text-[#3e4850]">{formatDate(project.deadline)}</div>
        <div><StatusBadge status={project.status} /></div>
        <ThreeDotMenu items={[
          { icon: 'edit', label: 'Chỉnh sửa', onClick: () => onEdit(project) },
          ...(isManagerOrAdmin ? [
            { icon: 'group_add', label: 'Phân công nhân sự', onClick: () => onAssign(project), primary: true },
            { icon: 'add_circle', label: 'Thêm tính năng mới', onClick: () => onAddFeature(project), primary: true },
            { icon: 'delete', label: 'Xóa', onClick: () => onDelete(project.project_id), danger: true }
          ] : []),
        ]} />
      </div>

      {expanded && (
        <div className="pl-10 pr-2 mt-2 pb-2 relative">
          <div className="absolute left-5 top-[-8px] bottom-0 w-px bg-[#bec8d2]/30" />
          
          {/* Section: Assignments */}
          <div className="bg-white rounded-lg shadow-sm border border-[#bec8d2]/15">
            <div className="flex justify-between items-center px-5 py-3 border-b border-[#bec8d2]/10 bg-slate-50/50 rounded-t-lg">
              <h4 className="text-sm font-semibold text-[#131b2e] flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">group</span>
                Nhân sự dự án
              </h4>
              {isManagerOrAdmin && (
                <button
                  onClick={e => { e.stopPropagation(); onAssign(project) }}
                  className="text-xs font-medium text-[#006591] hover:text-[#0ea5e9] flex items-center gap-1 bg-[#dae2fd] px-3 py-1.5 rounded-lg"
                >
                  <span className="material-symbols-outlined text-[14px]">add</span>
                  Phân công
                </button>
              )}
            </div>
            <div className="p-4 flex flex-wrap gap-2">
              {project.project_assignments && project.project_assignments.map(a => (
                <div key={a.user_id} className="flex items-center gap-2 bg-[#f2f3ff] px-3 py-1.5 rounded-full border border-[#bec8d2]/20">
                  <div className="w-6 h-6 rounded-full primary-gradient flex items-center justify-center text-[10px] text-white font-bold">
                    {a.users?.full_name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <span className="text-xs font-medium text-[#131b2e]">{a.users?.full_name}</span>
                  {isManagerOrAdmin && (
                    <button 
                      onClick={() => onRemoveAssignment(project.project_id, a.user_id)}
                      className="text-[#ba1a1a] hover:opacity-70 transition-opacity ml-1"
                    >
                      <span className="material-symbols-outlined text-[14px]">close</span>
                    </button>
                  )}
                </div>
              ))}
              {(!project.project_assignments || project.project_assignments.length === 0) && (
                <p className="text-xs text-[#6e7881] italic">Chưa có nhân sự được phân công.</p>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-[#bec8d2]/15">
            <div className="flex justify-between items-center px-5 py-3 border-b border-[#bec8d2]/10">
              <h4 className="text-sm font-semibold text-[#131b2e]">Tính năng</h4>
              {isManagerOrAdmin && (
                <button
                  onClick={e => { e.stopPropagation(); onAddFeature(project) }}
                  className="text-xs font-medium text-[#006591] hover:text-[#0ea5e9] flex items-center gap-1 bg-[#dae2fd] px-3 py-1.5 rounded-lg"
                >
                  <span className="material-symbols-outlined text-[14px]">add</span>
                  Thêm tính năng
                </button>
              )}
            </div>
            <div className="p-3 space-y-2">
              {project.features.map(feature => (
                <FeatureRow
                  key={feature.feature_id}
                  feature={feature}
                  userRole={userRole}
                  onEdit={f => onEditFeature(f, project.project_id)}
                  onDelete={fid => onDeleteFeature(fid, project.project_id)}
                  onAddTask={(f) => onAddTask(f, project.project_id)}
                  onEditTask={(t, fid) => onEditTask(t, fid, project.project_id)}
                  onDeleteTask={(tid, fid) => onDeleteTask(tid, fid, project.project_id)}
                  onAddSubtask={(t, fid) => onAddSubtask(t, fid, project.project_id)}
                  onEditSubtask={(s, tid, fid) => onEditSubtask(s, tid, fid, project.project_id)}
                  onDeleteSubtask={(sid, tid, fid) => onDeleteSubtask(sid, tid, fid, project.project_id)}
                />
              ))}
              {project.features.length === 0 && (
                <p className="text-xs text-[#6e7881] italic px-2 py-2">Chưa có tính năng.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ProjectsPage() {
  const [customers, setCustomers] = useState([])
  const [userRole, setUserRole] = useState('employee')
  const [allUsers, setAllUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedCustomer, setExpandedCustomer] = useState(null)
  const [toast, setToast] = useState(null)
  const m = useModal()

  useEffect(() => {
    init()
  }, [])

  async function init() {
    setLoading(true)
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (authUser) {
      const { data: profile } = await supabase.from('users').select('role').eq('user_id', authUser.id).single()
      setUserRole(profile?.role || 'employee')

      if (profile?.role !== 'employee') {
        const { data: usersData } = await supabase.from('users').select('user_id, full_name, role')
        setAllUsers(usersData || [])
      }
    }
    await fetchData()
  }

  async function fetchData() {
    setLoading(true)
    const { data, error } = await supabase
      .from('customers')
      .select(`
        *,
        projects (*, 
          project_assignments(*, users(full_name)), 
          features (*, 
            tasks (*, users:assigned_to(full_name), 
              subtasks (*, users:assigned_to(full_name))
            )
          )
        )
      `)

    if (error) console.error('Error fetching data:', error)
    else setCustomers(data || [])
    setLoading(false)
  }

  async function handleSave() {
    const { type, customerId, projectId, featureId, taskId, id } = m.modal
    const data = { ...m.form }

    try {
      // Clean data: removing empty strings to avoid 400 errors on numeric columns
      const cleanData = { ...data }
      // Remove modal management noise to avoid column-not-found errors in Supabase
      delete cleanData.id
      delete cleanData.type
      delete cleanData.projectId
      delete cleanData.customerId
      delete cleanData.featureId
      delete cleanData.taskId
      
      // Remove nested relationship objects from fetch results
      delete cleanData.subtasks
      delete cleanData.tasks
      delete cleanData.features
      delete cleanData.projects
      delete cleanData.users
      delete cleanData.project_assignments
      delete cleanData.customers

      Object.keys(cleanData).forEach(key => {
        if (cleanData[key] === '') delete cleanData[key]
      })

      let res = { error: null }
      
      if (type === 'add_customer') {
        const { data: userData } = await supabase.auth.getUser()
        res = await supabase.from('customers').insert({ ...cleanData, user_id: userData.user.id })
      } else if (type === 'edit_customer') {
        res = await supabase.from('customers').update(cleanData).eq('customer_id', id)
      } else if (type === 'add_project') {
        if (!cleanData.customer_id) throw new Error('Vui lòng chọn khách hàng')
        if (!cleanData.name) throw new Error('Vui lòng nhập tên dự án')
        res = await supabase.from('projects').insert(cleanData)
      } else if (type === 'edit_project') {
        res = await supabase.from('projects').update(cleanData).eq('project_id', id)
      } else if (type === 'add_feature') {
        res = await supabase.from('features').insert({ ...cleanData, project_id: projectId })
      } else if (type === 'edit_feature') {
        res = await supabase.from('features').update(cleanData).eq('feature_id', id)
      } else if (type === 'add_task') {
        res = await supabase.from('tasks').insert({ ...cleanData, feature_id: featureId })
      } else if (type === 'edit_task') {
        res = await supabase.from('tasks').update(cleanData).eq('task_id', id)
      } else if (type === 'add_subtask') {
        res = await supabase.from('subtasks').insert({ ...cleanData, task_id: taskId })
      } else if (type === 'edit_subtask') {
        res = await supabase.from('subtasks').update(cleanData).eq('subtask_id', id)
      } else if (type === 'assign_team') {
        const selectedUserId = cleanData.user_id
        if (selectedUserId) {
          res = await supabase.from('project_assignments').insert({ project_id: projectId, user_id: selectedUserId })
        }
      }
      
      if (res?.error) throw res.error

      m.close()
      fetchData()
    } catch (err) {
      console.error('Error saving:', err)
      setToast({ message: err.message || 'Không thể lưu dữ liệu', type: 'error' })
    }
  }

  async function deleteEntity(table, column, id) {
    if (!window.confirm('Bạn có chắc chắn muốn xóa?')) return
    const { error } = await supabase.from(table).delete().eq(column, id)
    if (error) setToast({ message: error.message, type: 'error' })
    else {
      fetchData()
      setToast({ message: 'Đã xóa dữ liệu thành công', type: 'success' })
    }
  }

  async function removeAssignment(projectId, userId) {
    if (!window.confirm('Xóa nhân viên khỏi dự án này?')) return
    const { error } = await supabase.from('project_assignments').delete().match({ project_id: projectId, user_id: userId })
    if (error) setToast({ message: error.message, type: 'error' })
    else {
      fetchData()
      setToast({ message: 'Đã gỡ nhân sự khỏi dự án', type: 'success' })
    }
  }

  function modalConfig() {
    const t = m.modal?.type
    if (t === 'add_customer' || t === 'edit_customer') return { title: t === 'add_customer' ? 'Thêm khách hàng' : 'Sửa khách hàng', fields: CUSTOMER_FIELDS }
    if (t === 'add_project' || t === 'edit_project') {
      const pFields = PROJECT_FIELDS.map(f =>
        f.name === 'customer_id'
          ? { ...f, options: customers.map(c => ({ value: c.customer_id, label: c.name })) }
          : f
      )
      return { title: t === 'add_project' ? 'Dự án mới' : 'Sửa dự án', fields: pFields }
    }
    if (t === 'add_feature' || t === 'edit_feature') return { title: t === 'add_feature' ? 'Tính năng mới' : 'Sửa tính năng', fields: FEATURE_FIELDS }
    if (t === 'add_task' || t === 'edit_task') {
      const flds = TASK_FIELDS.map(f => 
        f.name === 'assigned_to' 
          ? { ...f, options: allUsers.map(u => ({ value: u.user_id, label: u.full_name })) }
          : f
      )
      return { title: t === 'add_task' ? 'Nhiệm vụ mới' : 'Sửa nhiệm vụ', fields: flds }
    }
    if (t === 'add_subtask' || t === 'edit_subtask') {
      const flds = SUBTASK_FIELDS.map(f => 
        f.name === 'assigned_to' 
          ? { ...f, options: allUsers.map(u => ({ value: u.user_id, label: u.full_name })) }
          : f
      )
      return { title: t === 'add_subtask' ? 'Tiểu mục mới' : 'Sửa tiểu mục', fields: flds }
    }
    if (t === 'assign_team') return { title: 'Phân công nhân sự', fields: [{ name: 'user_id', label: 'Thành viên', type: 'select', options: allUsers.map(u => ({ value: u.user_id, label: `${u.full_name} (${u.role})` })) }] }
    return null
  }

  const cfg = m.modal ? modalConfig() : null

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-[#faf8ff]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#006591]"></div>
    </div>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-[#faf8ff]">
      <Sidebar />
      <div className="flex-1 ml-64 flex flex-col h-screen overflow-y-auto">
        <TopBar title="Quản lý dự án" />
        <main className="flex-1 p-8">
          <div className="max-w-7xl mx-auto space-y-6 pb-24">
            <div className="flex justify-between items-end">
              <div>
                <h2 className="text-3xl font-bold tracking-tight text-[#131b2e] mb-1">Quản lý dự án</h2>
                <p className="text-[#3e4850] text-sm">Theo dõi tiến độ và quản lý phân công công việc.</p>
              </div>
              {userRole === 'admin' && (
                <button onClick={() => m.open('add_project')} className="primary-gradient text-white px-5 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 shadow-lg">
                  <span className="material-symbols-outlined text-sm">add_circle</span> Dự án mới
                </button>
              )}
            </div>

            <div className="bg-[#f2f3ff] rounded-xl p-4 shadow-sm">
              <div className="bg-white rounded-lg shadow-sm">
                <div className="grid grid-cols-[3fr_2fr_2fr_3fr_1fr_auto] gap-4 px-6 py-4 border-b border-[#bec8d2]/15 text-xs font-bold text-[#3e4850] uppercase tracking-wider">
                  <div>Khách hàng</div><div>Email</div><div>Điện thoại</div><div>Địa chỉ</div><div className="text-center">Dự án</div><div />
                </div>

                {customers.filter(c => c.projects.length > 0).map(c => (
                  <div key={c.customer_id}>
                    <div className={`grid grid-cols-[3fr_2fr_2fr_3fr_1fr_auto] gap-4 px-6 py-4 items-center transition-colors ${expandedCustomer === c.customer_id ? 'bg-[#f2f3ff] border-l-4 border-[#006591]' : 'hover:bg-[#fafafa]'}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold ${expandedCustomer === c.customer_id ? 'primary-gradient text-white' : 'bg-[#dae2fd] text-[#006591]'}`}>
                          {c.name.charAt(0)}
                        </div>
                        <span className="text-sm font-semibold text-[#131b2e]">{c.name}</span>
                      </div>
                      <div className="text-sm text-[#3e4850]">{c.email}</div>
                      <div className="text-sm text-[#3e4850]">{c.phone}</div>
                      <div className="text-sm text-[#3e4850] truncate">{c.address}</div>
                      <div className="text-sm text-center font-bold text-[#131b2e]">{c.projects.length}</div>
                      <div className="flex justify-end gap-1">
                        <button onClick={() => setExpandedCustomer(expandedCustomer === c.customer_id ? null : c.customer_id)} className="p-1.5 text-[#3e4850] hover:text-[#006591]">
                          <span className="material-symbols-outlined">visibility</span>
                        </button>
                        {userRole === 'admin' && (
                          <ThreeDotMenu items={[
                            { icon: 'edit', label: 'Sửa', onClick: () => m.open('edit_customer', { id: c.customer_id, initial: c }) },
                            { icon: 'add', label: 'Thêm dự án', onClick: () => { setExpandedCustomer(c.customer_id); m.open('add_project', { initial: { customer_id: c.customer_id } }) }, primary: true },
                            { icon: 'delete', label: 'Xóa', onClick: () => deleteEntity('customers', 'customer_id', c.customer_id), danger: true },
                          ]} />
                        )}
                      </div>
                    </div>

                    {expandedCustomer === c.customer_id && (
                      <div className="pl-14 pr-6 pb-6 bg-[#f2f3ff]/40">
                        <div className="bg-white rounded-xl shadow-sm border border-[#bec8d2]/15 mt-2">
                          <div className="px-5 py-3 border-b border-[#bec8d2]/10 flex justify-between items-center">
                            <h4 className="text-sm font-bold text-[#131b2e]">Dự án</h4>
                            {userRole === 'admin' && (
                              <button onClick={() => m.open('add_project', { initial: { customer_id: c.customer_id } })} className="text-xs font-bold text-[#006591] bg-[#dae2fd] px-3 py-1.5 rounded-lg">Thêm dự án</button>
                            )}
                          </div>
                          <div className="p-4 space-y-4">
                            {c.projects.map(p => (
                              <div key={p.project_id} className="space-y-2">
                                <ProjectRow project={p} userRole={userRole}
                                  onEdit={p => m.open('edit_project', { id: p.project_id, ...p })}
                                  onDelete={id => deleteEntity('projects', 'project_id', id)}
                                  onAssign={p => m.open('assign_team', { projectId: p.project_id })}
                                  onRemoveAssignment={removeAssignment}
                                  onAddFeature={p => m.open('add_feature', { projectId: p.project_id })}
                                  onEditFeature={f => m.open('edit_feature', { id: f.feature_id, initial: f })}
                                  onDeleteFeature={id => deleteEntity('features', 'feature_id', id)}
                                  onAddTask={f => m.open('add_task', { featureId: f.feature_id })}
                                  onEditTask={t => m.open('edit_task', { id: t.task_id, initial: t })}
                                  onDeleteTask={id => deleteEntity('tasks', 'task_id', id)}
                                  onAddSubtask={t => m.open('add_subtask', { taskId: t.task_id })}
                                  onEditSubtask={s => m.open('edit_subtask', { id: s.subtask_id, initial: s })}
                                  onDeleteSubtask={id => deleteEntity('subtasks', 'subtask_id', id)}
                                />
                                {(userRole === 'admin' || userRole === 'manager') && (
                                  <div className="pl-12 flex flex-wrap items-center gap-2">
                                    <span className="text-[10px] font-bold text-[#3e4850] uppercase">Thành viên:</span>
                                    {p.project_assignments.map(a => {
                                      const u = allUsers.find(x => x.user_id === a.user_id)
                                      return (
                                        <div key={a.user_id} className="flex items-center gap-1 bg-[#f9fafb] border border-[#bec8d2]/20 px-2 py-0.5 rounded-full text-[10px]">
                                          {u?.full_name || '...'}
                                          <button onClick={() => removeAssignment(p.project_id, a.user_id)} className="text-[#6e7881] hover:text-red-500 ml-1"><span className="material-symbols-outlined text-[12px]">close</span></button>
                                        </div>
                                      )
                                    })}
                                    <button onClick={() => m.open('assign_team', { projectId: p.project_id })} className="w-5 h-5 rounded-full border border-dashed border-[#bec8d2] text-[#6e7881] flex items-center justify-center"><span className="material-symbols-outlined text-xs">add</span></button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
      {m.modal && cfg && <EntityFormModal title={cfg.title} fields={cfg.fields} data={m.form} onChange={m.set} onSave={handleSave} onClose={m.close} />}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
