/**
 * Página inicial que redireciona para o dashboard se autenticado
 * ou mostra a página de login se não autenticado
 */
import React from 'react';
import { useAuth } from '../context/AuthContext';
import DashboardPage from './DashboardPage';
import LoginPage from './LoginPage';

const Home: React.FC = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return user ? <DashboardPage /> : <LoginPage />;
};

export default Home;
