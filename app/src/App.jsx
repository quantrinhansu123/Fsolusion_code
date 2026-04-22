import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from './utils/supabase'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import ProjectsPage from './pages/ProjectsPage'
import UserManagement from './pages/UserManagement'
import CustomerManagement from './pages/CustomerManagement'
import ProgressReportPage from './pages/ProgressReportPage'
import StaffSubtasksPage from './pages/StaffSubtasksPage'
import AttendancePage from './pages/AttendancePage'
import './index.css'

/**
 * KeepAliveApp — render tất cả page một lần, ẩn/hiện bằng CSS.
 * Không bao giờ unmount → data giữ nguyên → chuyển tab = 0ms.
 */
function KeepAliveApp() {
  const location = useLocation()
  const navigate = useNavigate()
  const path = location.pathname

  // Kiểm tra auth một lần khi app load
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session && path !== '/login') {
        navigate('/login', { replace: true })
      }
      if (session && (path === '/' || path === '/login')) {
        navigate('/dashboard', { replace: true })
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'SIGNED_OUT' || !session) && path !== '/login') {
        navigate('/login', { replace: true })
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  // Trang Login render riêng, không keep-alive
  if (path === '/login') return <LoginPage />

  // Tất cả page authenticated đều rendered, chỉ ẩn bằng display
  return (
    <>
      <div style={{ display: path === '/dashboard' ? 'contents' : 'none' }}><DashboardPage /></div>
      <div style={{ display: path === '/projects' ? 'contents' : 'none' }}><ProjectsPage /></div>
      <div style={{ display: path === '/users' ? 'contents' : 'none' }}><UserManagement /></div>
      <div style={{ display: path === '/customers' ? 'contents' : 'none' }}><CustomerManagement /></div>
      <div style={{ display: path === '/progress' ? 'contents' : 'none' }}><ProgressReportPage /></div>
      <div style={{ display: path === '/staff-subtasks' ? 'contents' : 'none' }}><StaffSubtasksPage /></div>
      <div style={{ display: path === '/attendance' ? 'contents' : 'none' }}><AttendancePage /></div>
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/*" element={<KeepAliveApp />} />
      </Routes>
    </BrowserRouter>
  )
}
