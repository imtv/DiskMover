import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import PublicLayout from './components/PublicLayout';
import AdminLayout from './components/AdminLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import SystemSettings from './pages/admin/SystemSettings';
import Settings115 from './pages/admin/Settings115';
import OpenListSettings from './pages/admin/OpenListSettings';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<PublicLayout />}>
            <Route index element={<Dashboard />} />
          </Route>
          
          <Route path="/login" element={<Login />} />
          
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/admin/system" replace />} />
            <Route path="system" element={<SystemSettings />} />
            <Route path="115" element={<Settings115 />} />
            <Route path="openlist" element={<OpenListSettings />} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

