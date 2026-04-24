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
import StaffStatisticsPage from './pages/StaffStatisticsPage'
import TaskTemplatePage from './pages/TaskTemplatePage'
import { AuthProvider, useAuth } from './utils/AuthContext'
import './index.css'

/**
 * KeepAliveApp — render tất cả page một lần, ẩn/hiện bằng CSS.
 * Không bao giờ unmount → data giữ nguyên → chuyển tab = 0ms.
 */
function KeepAliveApp() {
  const location = useLocation()
  const navigate = useNavigate()
  const path = location.pathname
  const { user, loading } = useAuth()

  // Kiểm tra auth và điều hướng
  useEffect(() => {
    if (!loading) {
      if (!user && path !== '/login') {
        navigate('/login', { replace: true })
        return
      }

      if (user) {
        const role = user.role || 'employee'
        const isEmployee = role === 'employee'
        const employeeAllowedPaths = ['/staff-subtasks', '/attendance']

        // 1. Điều hướng mặc định khi vừa login hoặc vào trang chủ
        if (path === '/' || path === '/login') {
          if (isEmployee) {
            navigate('/staff-subtasks', { replace: true })
          } else {
            navigate('/dashboard', { replace: true })
          }
        } 
        // 2. Chặn truy cập trái phép bằng URL
        else if (isEmployee && !employeeAllowedPaths.includes(path)) {
          navigate('/staff-subtasks', { replace: true })
        }
      }
    }
  }, [user, loading, path, navigate])

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
      <div style={{ display: path === '/statistics' ? 'contents' : 'none' }}><StaffStatisticsPage /></div>
      <div style={{ display: path === '/staff-subtasks' ? 'contents' : 'none' }}><StaffSubtasksPage /></div>
      <div style={{ display: path === '/attendance' ? 'contents' : 'none' }}><AttendancePage /></div>
      <div style={{ display: path === '/task-templates' ? 'contents' : 'none' }}><TaskTemplatePage /></div>
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/*" element={<KeepAliveApp />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
