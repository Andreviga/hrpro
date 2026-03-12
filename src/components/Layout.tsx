/**
 * Layout principal da aplicação com navegação e header
 */
import React, { ReactNode, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/button';
import { LogOut, User, FileText, Upload, Home, MessageCircle, Calendar as CalendarIcon, TrendingUp, Calculator, Users, Settings, CalendarCheck, Code, TableProperties, Menu, X, Database } from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const shouldUseAdminPaystubs = ['admin', 'rh', 'manager'].includes(user?.role ?? '') && !user?.employeeId;

  const navigation = [
    { name: 'Dashboard', href: '#/', icon: Home },
    { name: 'Holerites', href: shouldUseAdminPaystubs ? '#/admin/paystubs' : '#/paystubs', icon: FileText },
    { name: 'Gestão Acadêmica', href: '#/calendar', icon: CalendarIcon },
    { name: 'Relatórios', href: '#/reports', icon: TrendingUp },
    { name: 'Documentos', href: '#/documents', icon: Upload },
    { name: 'Rescisão', href: '#/rescision', icon: Calculator },
    { name: 'Suporte', href: '#/support', icon: MessageCircle },
  ];

  const adminNavigation = [
    { name: 'Funcionários', href: '#/admin/employees', icon: Users },
    { name: 'Competências', href: '#/admin/payroll-runs', icon: CalendarCheck },
    { name: 'Emitir Holerites', href: '#/admin/paystub-batch', icon: FileText },
    { name: 'Ver Todos Holerites', href: '#/admin/paystubs', icon: FileText },
    { name: 'Monitor eSocial', href: '#/admin/esocial', icon: Database },
    { name: 'Visão Macro Folha', href: '#/admin/payroll-grid', icon: TableProperties },
    { name: 'Fórmulas e Tabelas', href: '#/admin/formulas', icon: Code },
    { name: 'Configurações', href: '#/admin/config', icon: Settings },
    { name: 'Upload Folha', href: '#/admin/payroll-upload', icon: Upload },
  ];

  const NavLinks = () => (
    <ul className="space-y-1">
      {navigation.map((item) => (
        <li key={item.name}>
          <a
            href={item.href}
            onClick={() => setSidebarOpen(false)}
            className="flex items-center space-x-3 text-gray-700 hover:text-blue-600 hover:bg-blue-50 rounded-lg px-3 py-2 transition-colors"
          >
            <item.icon className="h-5 w-5 shrink-0" />
            <span>{item.name}</span>
          </a>
        </li>
      ))}

      {user?.role === 'admin' && (
        <>
          <li className="pt-4">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-3">
              Administração
            </div>
          </li>
          {adminNavigation.map((item) => (
            <li key={item.name}>
              <a
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className="flex items-center space-x-3 text-gray-700 hover:text-blue-600 hover:bg-blue-50 rounded-lg px-3 py-2 transition-colors"
              >
                <item.icon className="h-5 w-5 shrink-0" />
                <span>{item.name}</span>
              </a>
            </li>
          ))}
        </>
      )}
    </ul>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-30">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              {/* Hamburger — visible only on mobile */}
              <Button
                variant="ghost"
                size="sm"
                className="md:hidden text-gray-500"
                onClick={() => setSidebarOpen(true)}
                aria-label="Abrir menu"
              >
                <Menu className="h-5 w-5" />
              </Button>
              <h1 className="text-2xl font-bold text-blue-600">HRPro</h1>
            </div>

            <div className="flex items-center space-x-2 sm:space-x-4 min-w-0">
              <div className="hidden sm:flex items-center space-x-2 min-w-0">
                <User className="h-4 w-4 text-gray-500 shrink-0" />
                <span className="text-sm text-gray-700 truncate max-w-[140px]">{user?.fullName}</span>
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded shrink-0">
                  {user?.role}
                </span>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={logout}
                className="text-gray-500 hover:text-gray-700"
                aria-label="Sair"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile overlay backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <div className="flex">
        {/* Sidebar — drawer on mobile, static on desktop */}
        <nav
          className={`
            fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-200 ease-in-out
            md:static md:z-auto md:shadow-sm md:translate-x-0 md:min-h-[calc(100vh-4rem)]
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          `}
        >
          {/* Mobile close button */}
          <div className="flex items-center justify-between px-4 h-16 border-b md:hidden">
            <h1 className="text-xl font-bold text-blue-600">HRPro</h1>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(false)}
              aria-label="Fechar menu"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="px-4 py-6 overflow-y-auto h-[calc(100%-4rem)] md:h-auto">
            <NavLinks />
          </div>
        </nav>

        {/* Main content */}
        <main className="flex-1 min-w-0 px-4 sm:px-6 py-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
