import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/auth.store';
import LoginPage from './pages/LoginPage';
import AdminDashboard from './pages/AdminDashboard';
import StaffDashboard from './pages/StaffDashboard';
import StudentDashboard from './pages/StudentDashboard';

function PrivateRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles: string[] }) {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated || !user) return <Navigate to="/login" replace />;
  if (!allowedRoles.includes(user.role)) {
    const redirect = user.role === 'ADMIN' ? '/admin' : user.role === 'STAFF' ? '/staff' : '/student';
    return <Navigate to={redirect} replace />;
  }
  return <>{children}</>;
}

function App() {
  const { isAuthenticated, user } = useAuthStore();

  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: { background: '#1e1e2e', color: '#cdd6f4', border: '1px solid #313244' },
          success: { iconTheme: { primary: '#a6e3a1', secondary: '#1e1e2e' } },
          error: { iconTheme: { primary: '#f38ba8', secondary: '#1e1e2e' } },
        }}
      />
      <Routes>
        <Route path="/login" element={
          isAuthenticated && user
            ? <Navigate to={user.role === 'ADMIN' ? '/admin' : user.role === 'STAFF' ? '/staff' : '/student'} replace />
            : <LoginPage />
        } />
        <Route path="/admin/*" element={<PrivateRoute allowedRoles={['ADMIN']}><AdminDashboard /></PrivateRoute>} />
        <Route path="/staff/*" element={<PrivateRoute allowedRoles={['STAFF']}><StaffDashboard /></PrivateRoute>} />
        <Route path="/student/*" element={<PrivateRoute allowedRoles={['STUDENT']}><StudentDashboard /></PrivateRoute>} />
        <Route path="/" element={
          isAuthenticated && user
            ? <Navigate to={user.role === 'ADMIN' ? '/admin' : user.role === 'STAFF' ? '/staff' : '/student'} replace />
            : <Navigate to="/login" replace />
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
