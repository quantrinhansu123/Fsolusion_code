import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import ProjectsPage from './pages/ProjectsPage'
import UserManagement from './pages/UserManagement'
import CustomerManagement from './pages/CustomerManagement'
import TodosPage from './pages/TodosPage'
import ProgressReportPage from './pages/ProgressReportPage'
import StaffSubtasksPage from './pages/StaffSubtasksPage'
import './index.css'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/users" element={<UserManagement />} />
        <Route path="/customers" element={<CustomerManagement />} />
        <Route path="/todos" element={<TodosPage />} />
        <Route path="/progress" element={<ProgressReportPage />} />
        <Route path="/staff-subtasks" element={<StaffSubtasksPage />} />
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
