import React from 'react';
import { User, UserRole } from '../types';
import { LogOut, Shield, UserCheck, Calculator, RefreshCw, FileSpreadsheet } from 'lucide-react';
import { YellowCabPlateLogo, YellowCabCheckerboard } from './YellowCabBrand';

interface HeaderProps {
  currentUser: User | null;
  onLogout: () => void;
  onSyncGoogleSheets: () => void;
  isSyncing: boolean;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  pendingDisputesCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  onLogout,
  onSyncGoogleSheets,
  isSyncing,
  activeTab,
  setActiveTab,
  pendingDisputesCount,
}) => {
  if (!currentUser) return null;

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'ADMIN':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-zinc-900 text-amber-400 border border-amber-400/40 shadow-xs">
            <Shield className="w-3.5 h-3.5" /> OWNER / ADMIN
          </span>
        );
      case 'SHIFT_MANAGER':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-400 text-zinc-950 border border-amber-500 shadow-xs">
            <Shield className="w-3.5 h-3.5" /> SHIFT MANAGER
          </span>
        );
      case 'BRANCH_MANAGER':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-400 text-zinc-950 border border-amber-500 shadow-xs">
            <Shield className="w-3.5 h-3.5" /> BRANCH MANAGER
          </span>
        );
      case 'PAYROLL':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-zinc-800 text-amber-300 border border-zinc-700">
            <FileSpreadsheet className="w-3.5 h-3.5" /> PAYROLL SPECIALIST
          </span>
        );
      case 'STAFF':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-900 border border-amber-300">
            <UserCheck className="w-3.5 h-3.5" /> STAFF EMPLOYEE
          </span>
        );
    }
  };

  return (
    <header className="bg-zinc-950 text-white border-b-2 border-amber-400 sticky top-0 z-50 shadow-md">
      <YellowCabCheckerboard height="h-2.5" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-1">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Name */}
          <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
            <YellowCabPlateLogo size="sm" />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <h1 className="text-xs sm:text-base font-black text-white tracking-tight leading-none uppercase truncate">
                  FBC Restaurants Corp
                </h1>
                <span className="hidden xs:inline-block px-1.5 sm:px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-black bg-amber-400 text-zinc-950 tracking-wider shrink-0">
                  YELLOW CAB PIZZA CO.
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-amber-300 font-medium mt-0.5 truncate">
                Biometric Attendance System
              </p>
            </div>
          </div>

          {/* Action Tools & User Profile */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 pl-2 border-l border-zinc-700">
              {currentUser.avatarUrl ? (
                <img
                  src={currentUser.avatarUrl}
                  alt={currentUser.name}
                  className="w-8 h-8 rounded-full object-cover border-2 border-amber-400"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-amber-400 text-zinc-950 flex items-center justify-center font-black text-xs">
                  {currentUser.name.substring(0, 2).toUpperCase()}
                </div>
              )}
              <div className="hidden lg:block text-left">
                <div className="text-xs font-extrabold text-white leading-tight">
                  {currentUser.name}
                </div>
                <div className="mt-0.5">{getRoleBadge(currentUser.role)}</div>
              </div>
              <button
                id="btn-logout"
                onClick={onLogout}
                className="p-1.5 text-zinc-400 hover:text-amber-400 rounded-lg hover:bg-zinc-800 transition-colors"
                title="Logout from application"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
