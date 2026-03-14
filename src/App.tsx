/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import Report from './pages/Report';
import Admin from './pages/Admin';
import Volunteer from './pages/Volunteer';
import Login from './pages/Login';
import TrackCase from './pages/TrackCase';
import NotFound from './pages/NotFound';
import UntilHelp from './pages/UntilHelp';
import LostFound from './pages/LostFound';
import Layout from './components/Layout';
import { ToastProvider } from './components/Toast';
import { ThemeProvider } from './components/Theme';
import { AuthProvider, useAuth } from './components/Auth';

function ProtectedRoute({ roles, children }: { roles: string[]; children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function LoginRoute() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to={user.role === 'admin' ? '/admin' : '/volunteer'} replace />;
  return <Login />;
}

export default function App() {
  return (
    <ThemeProvider>
    <ToastProvider>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="report" element={<Report />} />
            <Route path="track" element={<TrackCase />} />
            <Route path="until-help" element={<UntilHelp />} />
            <Route path="lost-found" element={<LostFound />} />
            <Route path="login" element={<LoginRoute />} />
            <Route path="admin" element={<ProtectedRoute roles={['admin']}><Admin /></ProtectedRoute>} />
            <Route path="volunteer" element={<ProtectedRoute roles={['admin', 'volunteer']}><Volunteer /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
    </ToastProvider>
    </ThemeProvider>
  );
}
