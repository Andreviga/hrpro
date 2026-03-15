/**
 * Componente principal da aplicação HRPro
 * Define as rotas e fornece o contexto de autenticação
 */
import { HashRouter, Route, Routes } from 'react-router';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import PaystubsPage from './pages/PaystubsPage';
import PaystubDetailPage from './pages/PaystubDetailPage';
import AdminPayrollUploadPage from './pages/AdminPayrollUploadPage';
import SupportPage from './pages/SupportPage';
import ChatPage from './pages/ChatPage';
import NewTicketPage from './pages/NewTicketPage';
import TicketDetailPage from './pages/TicketDetailPage';
import CalendarPage from './pages/CalendarPage';
import ReportsPage from './pages/ReportsPage';
import DocumentsCenterPage from './pages/DocumentsCenterPage';
import BenefitsPage from './pages/BenefitsPage';
import AdminEmployeesPage from './pages/AdminEmployeesPage';
import AdminConfigPage from './pages/AdminConfigPage';
import RescisionCalculatorPage from './pages/RescisionCalculatorPage';
import AdminPayrollRunsPage from './pages/AdminPayrollRunsPage';
import AdminFormulasPage from './pages/AdminFormulasPage';
import AdminPayrollGridPage from './pages/AdminPayrollGridPage';
import AdminPaystubBatchPage from './pages/AdminPaystubBatchPage';
import AdminPaystubsListPage from './pages/AdminPaystubsListPage';
import AdminEsocialPage from './pages/AdminEsocialPage';
import AdminEmployeeProfilePage from './pages/AdminEmployeeProfilePage';
import { Toaster } from './components/ui/toaster';

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route 
            path="/" 
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/paystubs" 
            element={
              <ProtectedRoute>
                <PaystubsPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/paystubs/:id" 
            element={
              <ProtectedRoute>
                <PaystubDetailPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/admin/payroll-upload" 
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminPayrollUploadPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/support" 
            element={
              <ProtectedRoute>
                <SupportPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/support/chat" 
            element={
              <ProtectedRoute>
                <ChatPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/support/new-ticket" 
            element={
              <ProtectedRoute>
                <NewTicketPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/support/tickets/:id" 
            element={
              <ProtectedRoute>
                <TicketDetailPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/calendar" 
            element={
              <ProtectedRoute>
                <CalendarPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/reports" 
            element={
              <ProtectedRoute>
                <ReportsPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/rescision" 
            element={
              <ProtectedRoute>
                <RescisionCalculatorPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/documents" 
            element={
              <ProtectedRoute>
                <DocumentsCenterPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/benefits" 
            element={
              <ProtectedRoute>
                <BenefitsPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/admin/employees" 
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminEmployeesPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/admin/employees/:id" 
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminEmployeeProfilePage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/admin/config" 
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminConfigPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/admin/payroll-runs" 
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminPayrollRunsPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/admin/formulas" 
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminFormulasPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/admin/payroll-grid" 
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminPayrollGridPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/admin/paystub-batch" 
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminPaystubBatchPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/admin/paystubs" 
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminPaystubsListPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/admin/esocial" 
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminEsocialPage />
              </ProtectedRoute>
            } 
          />
        </Routes>
      </HashRouter>
      <Toaster />
    </AuthProvider>
  );
}

