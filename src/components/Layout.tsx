/**
 * Layout principal da aplicação com navegação e header
 */
import React, { ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/button';
import { LogOut, User, FileText, Upload, Home, MessageCircle, Calendar as CalendarIcon, TrendingUp, Calculator, Users, Settings, CalendarCheck, Code, TableProperties } from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, logout } = useAuth();

  const navigation = [
    { name: 'Dashboard', href: '#/', icon: Home },
    { name: 'Holerites', href: '#/paystubs', icon: FileText },
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
    { name: 'Visão Macro Folha', href: '#/admin/payroll-grid', icon: TableProperties },
    { name: 'Fórmulas e Tabelas', href: '#/admin/formulas', icon: Code },
    { name: 'Configurações', href: '#/admin/config', icon: Settings },
    { name: 'Upload Folha', href: '#/admin/payroll-upload', icon: Upload },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-blue-600">HRPro</h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <User className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-700">{user?.fullName}</span>
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                  {user?.role}
                </span>
              </div>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={logout}
                className="text-gray-500 hover:text-gray-700"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <nav className="w-64 bg-white shadow-sm min-h-[calc(100vh-4rem)]">
          <div className="px-4 py-6">
            <ul className="space-y-2">
              {navigation.map((item) => (
                <li key={item.name}>
                  <a
                    href={item.href}
                    className="flex items-center space-x-3 text-gray-700 hover:text-blue-600 hover:bg-blue-50 rounded-lg px-3 py-2 transition-colors"
                  >
                    <item.icon className="h-5 w-5" />
                    <span>{item.name}</span>
                  </a>
                </li>
              ))}
              
              {user?.role === 'admin' && (
                <>
                  <li className="pt-4">
                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                      Administração
                    </div>
                  </li>
                  {adminNavigation.map((item) => (
                    <li key={item.name}>
                      <a
                        href={item.href}
                        className="flex items-center space-x-3 text-gray-700 hover:text-blue-600 hover:bg-blue-50 rounded-lg px-3 py-2 transition-colors"
                      >
                        <item.icon className="h-5 w-5" />
                        <span>{item.name}</span>
                      </a>
                    </li>
                  ))}
                </>
              )}
            </ul>
          </div>
        </nav>

        {/* Main content */}
        <main className="flex-1 px-6 py-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
