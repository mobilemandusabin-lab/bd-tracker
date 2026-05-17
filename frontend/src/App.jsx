import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { fetchCurrentUser } from './store/authSlice';
import Layout from './layouts/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import LeadsPage from './pages/LeadsPage';
import UsersPage from './pages/UsersPage';
import DailyReportPage from './pages/DailyReportPage';
import GoalsPage from './pages/GoalsPage';
import TasksPage from './pages/TasksPage';
import TicketsPage from './pages/TicketsPage';
import BDLeaderboardPage from './pages/BDLeaderboardPage';
import NepalcanSalesPage from './pages/NepalcanSalesPage';
import PipelineSettingsPage from './pages/PipelineSettingsPage';
import VendorManagementPage from './pages/VendorManagementPage';
import ActiveSellersPage from './pages/ActiveSellersPage';
import ProtectedRoute from './components/ProtectedRoute';
import InstallPrompt from './components/InstallPrompt';

function App() {
  const dispatch = useDispatch();
  const { token } = useSelector((state) => state.auth);

  // Fetch current user on app load if token exists
  useEffect(() => {
    if (token) {
      dispatch(fetchCurrentUser());
    }
  }, [dispatch, token]);

  return (
    <>
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#1e293b',
            color: '#fff',
            borderRadius: '1rem',
            padding: '1rem',
            fontWeight: 'bold',
            fontSize: '12px',
          },
          success: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
      <InstallPrompt />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          
          <Route path="/" element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }>
            <Route index element={<DashboardPage />} />
            <Route path="leads" element={<LeadsPage />} />
<Route path="vendors" element={
               <ProtectedRoute roles={['super_admin', 'admin']}>
                 <VendorManagementPage />
               </ProtectedRoute>
             } />
             <Route path="active-sellers" element={
               <ProtectedRoute roles={['super_admin', 'admin']}>
                 <ActiveSellersPage />
               </ProtectedRoute>
             } />
            <Route path="goals" element={<GoalsPage />} />
            <Route path="users" element={
              <ProtectedRoute roles={['super_admin', 'admin']}>
                <UsersPage />
              </ProtectedRoute>
            } />
            <Route path="daily-report" element={
              <ProtectedRoute roles={['super_admin']}>
                <DailyReportPage />
              </ProtectedRoute>
            } />
            <Route path="tasks" element={<TasksPage />} />
            <Route path="tickets" element={<TicketsPage />} />
<Route path="bd-leaderboard" element={<BDLeaderboardPage />} />
<Route path="nepalcan-sales" element={
                <ProtectedRoute roles={['super_admin']}>
                  <NepalcanSalesPage />
                </ProtectedRoute>
              } />
<Route path="settings/pipeline" element={
                <ProtectedRoute roles={['super_admin']}>
                  <PipelineSettingsPage />
                </ProtectedRoute>
              } />
              <Route path="analytics" element={<div className="p-8 font-black uppercase tracking-widest text-slate-400">Analytics Module (Coming Soon)</div>} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;
