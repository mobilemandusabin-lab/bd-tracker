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
import GoalsPage from './pages/GoalsPage';
import TasksPage from './pages/TasksPage';
import TicketsPage from './pages/TicketsPage';
import NepalcanSalesPage from './pages/NepalcanSalesPage';
import NepalcanOrderDetailPage from './pages/NepalcanOrderDetailPage';
import SettingsPage from './pages/SettingsPage';
import VendorManagementPage from './pages/VendorManagementPage';
import ActiveSellersPage from './pages/ActiveSellersPage';
import AnalyticsPage from './pages/AnalyticsPage';
import BDTierPage from './pages/BDTierPage';
import BDLeaderboardDetailPage from './pages/BDLeaderboardDetailPage';
import ExtensionPage from './pages/ExtensionPage';
import OperationsAnalyticsPage from './pages/OperationsAnalyticsPage';
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
            <Route path="vendors" element={<VendorManagementPage />} />
            <Route path="active-sellers" element={
              <ProtectedRoute permissions={['leads.view']}>
                <ActiveSellersPage />
              </ProtectedRoute>
            } />
            <Route path="goals" element={<GoalsPage />} />
            <Route path="bd-tiers" element={<BDTierPage />} />
            <Route path="users" element={
              <ProtectedRoute permissions={['users.view']}>
                <UsersPage />
              </ProtectedRoute>
            } />
            <Route path="tasks" element={<TasksPage />} />
            <Route path="tickets" element={<TicketsPage />} />
            <Route path="nepalcan-sales" element={
              <ProtectedRoute permissions={['nepalcan.view']}>
                <NepalcanSalesPage />
              </ProtectedRoute>
            } />
            <Route path="nepalcan-sales/:orderId" element={
              <ProtectedRoute permissions={['nepalcan.view']}>
                <NepalcanOrderDetailPage />
              </ProtectedRoute>
            } />
            <Route path="settings" element={
              <ProtectedRoute permissions={['pipeline.manage', 'users.view']}>
                <SettingsPage />
              </ProtectedRoute>
            } />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="analytics/leaderboard/:bdId" element={<BDLeaderboardDetailPage />} />
            <Route path="extension" element={
              <ProtectedRoute permissions={['extension.view']}>
                <ExtensionPage />
              </ProtectedRoute>
            } />
            <Route path="operations-analytics" element={
              <ProtectedRoute permissions={['extension.admin']}>
                <OperationsAnalyticsPage />
              </ProtectedRoute>
            } />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;
