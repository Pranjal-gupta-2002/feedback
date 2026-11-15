import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useStaffAuth } from '../context/StaffAuthContext';

export default function StaffToolbar({ pendingCount = 0 }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useStaffAuth();

  const isModeration = location.pathname.startsWith('/moderation');
  const isAnalytics = location.pathname.startsWith('/analytics');

  return (
    <div className="w-full max-w-7xl mx-auto mb-4 bg-white/95 backdrop-blur-md p-3 sm:p-3.5 rounded-2xl sm:rounded-3xl border border-purple-200/90 shadow-[0_4px_20px_rgba(81,34,254,0.06)] flex flex-col md:flex-row md:items-center justify-between gap-3">
      {/* Left: Staff Badge & Section Switcher */}
      <div className="flex flex-wrap items-center justify-between sm:justify-start gap-2">
        <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#5122fe] bg-purple-100/90 px-3 py-1.5 rounded-xl border border-purple-200 flex items-center gap-1.5 shadow-2xs">
          <span className="w-1.5 h-1.5 rounded-full bg-[#5122fe] animate-pulse"></span>
          Staff Portal
        </span>

        {/* Navigation Tabs between Moderation & Analytics */}
        <div className="flex items-center bg-purple-50 p-1 rounded-xl border border-purple-200 text-xs">
          <button
            type="button"
            onClick={() => navigate('/moderation')}
            className={`px-2.5 sm:px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer text-xs ${
              isModeration 
                ? 'bg-gradient-to-r from-[#5122fe] to-[#7b4eff] text-white shadow-xs' 
                : 'text-purple-900/70 hover:text-purple-950 hover:bg-white/60'
            }`}
          >
            <span className="material-symbols-outlined text-[15px]">verified_user</span>
            <span>Queue</span>
            {pendingCount > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold ${
                isModeration ? 'bg-white/20 text-white' : 'bg-purple-200 text-purple-900'
              }`}>
                {pendingCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => navigate('/analytics')}
            className={`px-2.5 sm:px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer text-xs ${
              isAnalytics 
                ? 'bg-gradient-to-r from-[#5122fe] to-[#7b4eff] text-white shadow-xs' 
                : 'text-purple-900/70 hover:text-purple-950 hover:bg-white/60'
            }`}
          >
            <span className="material-symbols-outlined text-[15px]">insights</span>
            <span>Analytics</span>
          </button>
        </div>
      </div>

      {/* Right: Return to Store Feed & Lock Staff Mode */}
      <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-purple-100">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-900 text-xs font-semibold border border-purple-200 transition-colors cursor-pointer text-center"
        >
          <span className="material-symbols-outlined text-[15px] text-[#5122fe]">storefront</span>
          <span className="truncate">Public Feed</span>
        </button>

        <button
          type="button"
          onClick={() => {
            logout();
            navigate('/');
          }}
          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-rose-50 hover:border-rose-200 text-purple-900 hover:text-rose-600 text-xs font-bold border border-purple-200 shadow-2xs transition-all cursor-pointer text-center"
          title="Sign out and lock staff access"
        >
          <span className="material-symbols-outlined text-[15px]">lock</span>
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
}
