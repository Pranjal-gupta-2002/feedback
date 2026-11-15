import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import CustomerReviewsHub from './pages/CustomerReviewsHub';
import AdminModerationQueue from './pages/AdminModerationQueue';
import AnalyticsInsights from './pages/AnalyticsInsights';
import StaffPasswordModal from './components/StaffPasswordModal';
import StaffGateScreen from './components/StaffGateScreen';
import Toast from './components/Toast';
import { StaffAuthProvider, useStaffAuth } from './context/StaffAuthContext';
import { api } from './api/client';

function ProtectedStaffRoute({ children, targetPath, showToast }) {
  const { isAuthenticated } = useStaffAuth();

  if (!isAuthenticated) {
    return <StaffGateScreen targetPath={targetPath} showToast={showToast} />;
  }

  return children;
}

function MainAppLayout() {
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  return (
    <div className="min-h-screen bg-[#fcfaff] text-[#1a0f30] flex flex-col selection:bg-[#5122fe] selection:text-white font-sans overflow-x-hidden w-full max-w-[100vw]">
      
      {/* Floating Island Navigation */}
      <Navbar
        onSearch={setSearchQuery}
        searchQuery={searchQuery}
      />

      {/* Main Content Area with Routing */}
      <main className="flex-1 pt-24 sm:pt-28 pb-12 w-full overflow-x-hidden">
        <Routes>
          {/* Public Route: Feed */}
          <Route 
            path="/" 
            element={
              <CustomerReviewsHub
                showToast={showToast}
                searchQuery={searchQuery}
                onSearch={setSearchQuery}
              />
            } 
          />
          <Route 
            path="/feed" 
            element={
              <CustomerReviewsHub
                showToast={showToast}
                searchQuery={searchQuery}
                onSearch={setSearchQuery}
              />
            } 
          />

          {/* Protected Route: Moderation Queue (Requires password 12345) */}
          <Route 
            path="/moderation" 
            element={
              <ProtectedStaffRoute targetPath="/moderation" showToast={showToast}>
                <AdminModerationQueue
                  showToast={showToast}
                  searchQuery={searchQuery}
                  onSearch={setSearchQuery}
                />
              </ProtectedStaffRoute>
            } 
          />

          {/* Protected Route: Analytics Dashboard (Requires password 12345) */}
          <Route 
            path="/analytics" 
            element={
              <ProtectedStaffRoute targetPath="/analytics" showToast={showToast}>
                <AnalyticsInsights showToast={showToast} />
              </ProtectedStaffRoute>
            } 
          />

          {/* Fallback Catch-all: Redirect to Feed */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {/* Global Staff Passcode Prompt Modal */}
      <StaffPasswordModal showToast={showToast} />

      {/* Notification Toast */}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <StaffAuthProvider>
        <MainAppLayout />
      </StaffAuthProvider>
    </BrowserRouter>
  );
}
