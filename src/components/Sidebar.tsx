import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { yellowCabSwal } from '../utils/sweetAlerts';
import {
  LayoutDashboard,
  Upload,
  FileText,
  AlertCircle,
  Users,
  Calculator,
  Award,
  Clock,
  LogOut,
  FileSpreadsheet,
  Menu,
  X,
  ChevronRight,
  Shield,
  UserCheck,
  Building2,
  CalendarDays,
  PanelLeftClose,
  PanelLeftOpen,
  KeyRound,
  History,
} from 'lucide-react';

interface SidebarProps {
  currentUser: User;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  pendingDisputesCount?: number;
  pendingCtoCount?: number;
  onLogout: () => void;
  onSyncGoogleSheets?: () => void;
  isSyncing?: boolean;
  onUpdatePin?: (newPin: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentUser,
  activeTab,
  setActiveTab,
  pendingDisputesCount = 0,
  pendingCtoCount = 0,
  onLogout,
  onSyncGoogleSheets,
  isSyncing = false,
  onUpdatePin,
}) => {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Change PIN modal state
  const [showChangePinModal, setShowChangePinModal] = useState(false);
  const [currentPinInput, setCurrentPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [pinError, setPinError] = useState('');

  const handleSavePin = (e: React.FormEvent) => {
    e.preventDefault();
    setPinError('');

    if (!currentPinInput.trim()) {
      setPinError('Please enter your current PIN.');
      return;
    }
    if (currentPinInput.trim() !== currentUser.pin) {
      setPinError('Current PIN is incorrect.');
      return;
    }
    if (!newPinInput.trim() || newPinInput.trim().length < 4) {
      setPinError('New PIN must be at least 4 digits.');
      return;
    }
    if (!/^\d+$/.test(newPinInput.trim())) {
      setPinError('New PIN must contain digits only.');
      return;
    }
    if (newPinInput.trim() !== confirmPinInput.trim()) {
      setPinError('New PIN and Confirm PIN do not match.');
      return;
    }

    if (onUpdatePin) {
      onUpdatePin(newPinInput.trim());
    }

    yellowCabSwal.fire({
      icon: 'success',
      title: 'Default PIN Changed!',
      html: `<div style="text-align: left; font-size: 13px;">
        <p style="margin-bottom: 6px;">Your account default PIN has been successfully updated to <strong>${newPinInput.trim()}</strong>.</p>
        <p style="color: #71717a; margin: 0;">Use this new PIN for your next login sessions.</p>
      </div>`,
    });

    setShowChangePinModal(false);
    setCurrentPinInput('');
    setNewPinInput('');
    setConfirmPinInput('');
    setPinError('');
  };

  const getRoleBadge = (role: UserRole) => {
    const userPos = currentUser?.position || '';
    switch (role) {
      case 'ADMIN':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-zinc-950 uppercase tracking-wider">
            <Shield className="w-3 h-3" /> {userPos || 'Admin / Owner'}
          </span>
        );
      case 'BRANCH_MANAGER':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-zinc-950 uppercase tracking-wider">
            <Building2 className="w-3 h-3" /> {userPos || 'Branch Manager'}
          </span>
        );
      case 'SHIFT_MANAGER':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-zinc-950 uppercase tracking-wider">
            <Building2 className="w-3 h-3" /> {userPos || 'Shift Manager'}
          </span>
        );
      case 'PAYROLL':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-zinc-800 text-amber-300 uppercase tracking-wider">
            <FileSpreadsheet className="w-3 h-3" /> {userPos || 'Payroll'}
          </span>
        );
      case 'STAFF':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-950 uppercase tracking-wider border border-amber-300">
            <UserCheck className="w-3 h-3" /> {userPos || 'Staff Employee'}
          </span>
        );
    }
  };

  // Role Navigation Items configuration
  const getNavItems = () => {
    switch (currentUser.role) {
      case 'ADMIN':
        return [
          {
            id: 'overview',
            label: 'Overview & Analytics',
            icon: LayoutDashboard,
            description: 'System health & shift stats',
          },
          {
            id: 'dtr-logs',
            label: 'Employee DTR Logs',
            icon: Clock,
            description: 'Daily Time Record DTR form & logs',
            highlight: true,
          },
          {
            id: 'logs',
            label: 'Attendance Logs',
            icon: FileText,
            description: '8h Flexi punches & anomalies',
          },
          {
            id: 'upload',
            label: 'Upload ZKTeco .XLS',
            icon: Upload,
            description: 'YC Ebloc & YC Talisay',
          },
          {
            id: 'upload-dat',
            label: 'Upload ZKTeco .DAT',
            icon: Upload,
            description: 'YC Ramos,Banilad,Ayala,SM Seaside',
          },
          {
            id: 'schedules',
            label: 'Work Schedule Roster',
            icon: CalendarDays,
            description: 'Manage employee shift schedules',
          },
          {
            id: 'disputes',
            label: 'Dispute Approvals',
            icon: AlertCircle,
            badge: pendingDisputesCount > 0 ? pendingDisputesCount : undefined,
            description: 'Employee punch dispute queue',
          },
          {
            id: 'users',
            label: 'User Accounts',
            icon: Users,
            description: 'Employee & Manager directory',
          },
          {
            id: 'activity-logs',
            label: 'Activity Log',
            icon: History,
            description: 'Audit history of actions & data changes',
          },
        ];

      case 'BRANCH_MANAGER':
        return [
          {
            id: 'dtr-logs',
            label: 'Employee DTR Logs',
            icon: Clock,
            description: 'Daily Time Record DTR form & logs',
            highlight: true,
          },
          {
            id: 'disputes',
            label: 'Time Adjustment Approvals',
            icon: Clock,
            badge: pendingDisputesCount > 0 ? pendingDisputesCount : undefined,
            description: 'Approve or reject employee time forms',
          },
          {
            id: 'schedules',
            label: 'Work Schedule Roster',
            icon: CalendarDays,
            description: 'Assign staff & manager shift hours',
          },
          {
            id: 'upload',
            label: 'Upload ZKTeco Excel',
            icon: Upload,
            description: 'Branch biometric Excel parser',
          },
          {
            id: 'upload-dat',
            label: 'Upload ZKTeco .DAT',
            icon: Upload,
            description: 'Old model .dat file parser',
          },
          {
            id: 'my-punches',
            label: 'My Personal Punches',
            icon: UserCheck,
            description: 'My 8h shift attendance log',
          },
          {
            id: 'my-disputes',
            label: 'File / View Disputes',
            icon: AlertCircle,
            description: 'Request missing punch corrections',
          },
          {
            id: 'my-cto',
            label: 'CTO Leave Requests',
            icon: Award,
            description: 'Compensatory Time Off balance & leave requests',
          },
        ];

      case 'PAYROLL':
        return [
          {
            id: 'dtr-logs',
            label: 'Employee DTR Logs',
            icon: Clock,
            description: 'Daily Time Record DTR form & logs',
            highlight: true,
          },
          {
            id: 'daily-logs',
            label: 'Daily Attendance Logs',
            icon: FileText,
            description: 'Uploaded biometric daily records',
          },
          {
            id: 'schedules',
            label: 'Work Schedule Roster',
            icon: CalendarDays,
            description: 'View employee shift schedules & advance rosters',
          },
          {
            id: 'disputes',
            label: 'Branch Time Adjustments & Disputes',
            icon: AlertCircle,
            badge: pendingDisputesCount > 0 ? pendingDisputesCount : undefined,
            description: 'View attachments, request history & manager approvals',
          },
          {
            id: 'upload',
            label: 'Upload ZKTeco Excel',
            icon: Upload,
            description: 'Import ZKTeco Excel data',
          },
          {
            id: 'upload-dat',
            label: 'Upload ZKTeco .DAT',
            icon: Upload,
            description: 'Old model .dat file parser',
          },
          {
            id: 'cto-management',
            label: 'CTO Leave Balances',
            icon: Award,
            badge: pendingCtoCount > 0 ? pendingCtoCount : undefined,
            description: 'Compensatory Time Off approval',
          },
        ];

      case 'SHIFT_MANAGER':
      case 'STAFF':
      default:
        return [
          {
            id: 'my-punches',
            label: 'My Punches & Hours',
            icon: Clock,
            description: 'Daily 8h Flexitime progress',
          },
          {
            id: 'my-schedule',
            label: 'My Work Schedule',
            icon: CalendarDays,
            description: 'Assigned shift & duty days',
          },
          {
            id: 'my-disputes',
            label: 'File / View Disputes',
            icon: AlertCircle,
            description: 'Submit punch adjustments',
          },
          {
            id: 'my-cto',
            label: 'CTO Leave Requests',
            icon: Award,
            description: 'Compensatory Time Off balance & leave requests',
          },
        ];
    }
  };

  const navItems = getNavItems();

  const handleNavClick = (tabId: string) => {
    setActiveTab(tabId);
    setIsMobileOpen(false);

    // Automatically collapse sidebar upon clicking DTR form and Daily Attendance Log form buttons
    if (['dtr-logs', 'daily-logs', 'logs', 'branch-logs', 'my-punches'].includes(tabId)) {
      setIsCollapsed(true);
    }
  };

  return (
    <>
      {/* Mobile Sidebar Toggle Header Bar */}
      <div className="md:hidden bg-zinc-950 text-white p-3.5 flex items-center justify-between border-b border-amber-400/40">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-400 text-zinc-950 flex items-center justify-center font-black text-xs">
            {currentUser.name.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="text-xs font-black">{currentUser.name}</div>
            <div className="text-[10px] text-amber-300 font-bold uppercase">{currentUser.role}</div>
          </div>
        </div>

        <button
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className="p-2 rounded-lg bg-zinc-800 text-amber-400 hover:bg-zinc-700 transition-colors"
          aria-label="Toggle Navigation Sidebar"
        >
          {isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Backdrop overlay for mobile drawer */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-zinc-950/60 backdrop-blur-xs z-40 md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar Main Wrapper Container with Collapsible Width */}
      <aside
        className={`fixed md:sticky top-0 md:top-[68px] left-0 z-40 md:z-30 h-[100dvh] md:h-[calc(100vh-68px)] bg-zinc-950 text-white border-r-2 border-amber-400/60 shadow-xl flex flex-col justify-between transition-all duration-300 ease-in-out ${
          isCollapsed ? 'md:w-20 w-72' : 'w-72'
        } ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
      >
        <div className="p-3 space-y-4 overflow-y-auto flex-1">
          {/* Desktop Collapse Toggle Bar */}
          <div className="hidden md:flex items-center justify-between border-b border-zinc-800/80 pb-2.5">
            {!isCollapsed && (
              <span className="text-[10px] font-black uppercase text-amber-400/80 tracking-wider">
                FBC ATTENDANCE
              </span>
            )}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-amber-400 border border-zinc-800 transition-colors cursor-pointer mx-auto md:mx-0"
              title={isCollapsed ? 'Expand Sidebar' : 'Minimize Sidebar (Maximize Workspace)'}
            >
              {isCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            </button>
          </div>

          {/* USER ACCOUNT CARD */}
          {!isCollapsed ? (
            <div className="bg-zinc-900/90 rounded-2xl p-3.5 border border-zinc-800 shadow-inner">
              <div className="flex items-start gap-3">
                {currentUser.avatarUrl ? (
                  <img
                    src={currentUser.avatarUrl}
                    alt={currentUser.name}
                    className="w-10 h-10 rounded-xl object-cover border-2 border-amber-400 shrink-0 shadow-sm"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-amber-400 text-zinc-950 font-black text-sm flex items-center justify-center border-2 border-amber-300 shrink-0 shadow-sm">
                    {currentUser.name.substring(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="text-xs font-black text-white truncate uppercase tracking-tight">
                    {currentUser.name}
                  </h3>
                  <p className="text-[11px] font-mono text-amber-300 font-bold truncate">
                    {currentUser.employeeId}
                  </p>
                  <div className="mt-1">{getRoleBadge(currentUser.role)}</div>
                </div>
              </div>

              <div className="mt-2.5 pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[10px] text-zinc-400">
                <span className="font-medium truncate max-w-[130px]">Position: <strong className="text-zinc-200">{currentUser.position || currentUser.department}</strong></span>
                <button
                  type="button"
                  onClick={() => {
                    setPinError('');
                    setShowChangePinModal(true);
                  }}
                  className="font-mono text-[10px] bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 border border-amber-400/40 px-2 py-0.5 rounded-lg font-bold transition-colors cursor-pointer flex items-center gap-1"
                  title="Click to change your default access PIN"
                >
                  <KeyRound className="w-3 h-3 text-amber-400" />
                  PIN: {currentUser.pin}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex justify-center py-2" title={`${currentUser.name} (${currentUser.role})`}>
              <div className="w-10 h-10 rounded-xl bg-amber-400 text-zinc-950 font-black text-sm flex items-center justify-center border-2 border-amber-300 shadow-sm">
                {currentUser.name.substring(0, 2).toUpperCase()}
              </div>
            </div>
          )}

          {/* MAIN SIDEBAR NAVIGATION MENU */}
          <div className="space-y-1">
            {!isCollapsed && (
              <div className="px-2 text-[10px] font-black uppercase text-amber-400/80 tracking-wider">
                PORTAL NAVIGATION
              </div>
            )}

            <nav className="mt-2 space-y-1.5">
              {navItems.map((item) => {
                const IconComponent = item.icon;
                const isActive = activeTab === item.id;

                return (
                  <button
                    key={item.id}
                    id={`sidebar-tab-${item.id}`}
                    onClick={() => handleNavClick(item.id)}
                    title={isCollapsed ? `${item.label} — ${item.description}` : undefined}
                    className={`w-full flex items-center ${
                      isCollapsed ? 'justify-center p-2.5' : 'justify-between p-3'
                    } rounded-xl transition-all cursor-pointer text-left group ${
                      isActive
                        ? 'bg-amber-400 text-zinc-950 font-black shadow-md border border-amber-300'
                        : item.highlight
                        ? 'bg-amber-400/10 text-amber-300 hover:bg-amber-400/20 border border-amber-400/30'
                        : 'text-zinc-300 hover:bg-zinc-900 hover:text-white border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`p-1.5 rounded-lg transition-colors shrink-0 ${
                          isActive
                            ? 'bg-zinc-950 text-amber-400'
                            : 'bg-zinc-900 text-zinc-400 group-hover:text-amber-400'
                        }`}
                      >
                        <IconComponent className="w-4 h-4" />
                      </div>
                      {!isCollapsed && (
                        <div className="min-w-0">
                          <div className="text-xs font-black truncate leading-tight">
                            {item.label}
                          </div>
                          <div
                            className={`text-[10px] truncate ${
                              isActive ? 'text-zinc-900/80 font-semibold' : 'text-zinc-500'
                            }`}
                          >
                            {item.description}
                          </div>
                        </div>
                      )}
                    </div>

                    {!isCollapsed && (
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        {item.badge !== undefined && (
                          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white animate-pulse">
                            {item.badge}
                          </span>
                        )}
                        <ChevronRight
                          className={`w-3.5 h-3.5 transition-transform ${
                            isActive ? 'translate-x-0.5 text-zinc-950' : 'text-zinc-600 group-hover:text-amber-400'
                          }`}
                        />
                      </div>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* SYSTEM QUICK ACTIONS */}
          <div className="space-y-2 pt-2 border-t border-zinc-800">
            {!isCollapsed && (
              <div className="px-2 text-[10px] font-black uppercase text-amber-400/80 tracking-wider">
                SYSTEM ACTIONS
              </div>
            )}

            {/* ZKTeco Quick Upload Button for Admin, Branch Manager, Payroll */}
            {(currentUser.role === 'ADMIN' ||
              currentUser.role === 'BRANCH_MANAGER' ||
              currentUser.role === 'PAYROLL') && (
              <>
                <button
                  id="sidebar-quick-upload-btn"
                  onClick={() => handleNavClick('upload')}
                  title={isCollapsed ? 'Upload ZKTeco Excel' : undefined}
                  className={`w-full flex items-center ${
                    isCollapsed ? 'justify-center p-2.5' : 'gap-2 px-3 py-2'
                  } rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-zinc-950 text-xs font-black uppercase tracking-wider shadow-sm border border-amber-300 transition-all cursor-pointer`}
                >
                  <Upload className="w-4 h-4 shrink-0" />
                  {!isCollapsed && <span>Upload ZKTeco Excel</span>}
                </button>

                <button
                  id="sidebar-quick-upload-dat-btn"
                  onClick={() => handleNavClick('upload-dat')}
                  title={isCollapsed ? 'Upload ZKTeco .DAT' : undefined}
                  className={`w-full flex items-center ${
                    isCollapsed ? 'justify-center p-2.5' : 'gap-2 px-3 py-2'
                  } rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black uppercase tracking-wider shadow-sm border border-emerald-400 transition-all cursor-pointer`}
                >
                  <Upload className="w-4 h-4 text-amber-300 shrink-0" />
                  {!isCollapsed && <span>Upload ZKTeco .DAT</span>}
                </button>
              </>
            )}

            {/* Change Default PIN Button */}
            <button
              id="sidebar-change-default-pin-btn"
              onClick={() => {
                setPinError('');
                setShowChangePinModal(true);
              }}
              title={isCollapsed ? 'Change Default PIN' : undefined}
              className={`w-full flex items-center ${
                isCollapsed ? 'justify-center p-2.5' : 'gap-2 px-3 py-2'
              } rounded-xl bg-zinc-900 hover:bg-zinc-800 text-amber-300 hover:text-amber-200 text-xs font-bold border border-amber-400/30 transition-colors cursor-pointer`}
            >
              <KeyRound className="w-4 h-4 text-amber-400 shrink-0" />
              {!isCollapsed && <span>Change Default PIN</span>}
            </button>
          </div>
        </div>

        {/* SIDEBAR FOOTER & LOGOUT */}
        <div className="p-3 border-t border-zinc-800 bg-zinc-950/90">
          <button
            id="sidebar-logout-btn"
            onClick={onLogout}
            title={isCollapsed ? 'Sign Out of Account' : undefined}
            className={`w-full flex items-center ${
              isCollapsed ? 'justify-center p-2.5' : 'justify-center gap-2 px-4 py-2.5'
            } rounded-xl bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 border border-rose-800/60 font-black text-xs uppercase tracking-wider transition-colors cursor-pointer`}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!isCollapsed && <span>Sign Out of Account</span>}
          </button>
        </div>
      </aside>

      {/* CHANGE DEFAULT PIN MODAL */}
      {showChangePinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl border-2 border-zinc-950 shadow-2xl w-full max-w-md overflow-hidden text-zinc-900">
            <div className="bg-zinc-950 text-amber-400 p-4 border-b-2 border-amber-400 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-400" />
                <h3 className="font-black text-sm uppercase tracking-wider">
                  Change Default Access PIN
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowChangePinModal(false)}
                className="text-zinc-400 hover:text-white transition-colors cursor-pointer p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePin} className="p-5 space-y-4">
              <div className="bg-amber-50 rounded-xl p-3 border border-amber-200 text-xs text-amber-950 space-y-1">
                <p className="font-bold">
                  User: <span className="uppercase text-zinc-950 font-black">{currentUser.name}</span> ({currentUser.employeeId})
                </p>
                <p className="text-[11px] text-zinc-600">
                  Updating your default security PIN for Yellow Cab Biometric Attendance System login.
                </p>
              </div>

              {pinError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{pinError}</span>
                </div>
              )}

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-extrabold text-zinc-700 uppercase tracking-wider text-[10px] mb-1">
                    Current PIN:
                  </label>
                  <input
                    type="password"
                    maxLength={6}
                    value={currentPinInput}
                    onChange={(e) => setCurrentPinInput(e.target.value)}
                    placeholder="Enter current PIN (e.g. 1234)"
                    className="w-full px-3 py-2 rounded-xl border border-zinc-300 font-mono font-bold text-sm text-zinc-900 focus:ring-2 focus:ring-amber-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-extrabold text-zinc-700 uppercase tracking-wider text-[10px] mb-1">
                    New PIN (4-6 digits):
                  </label>
                  <input
                    type="password"
                    maxLength={6}
                    value={newPinInput}
                    onChange={(e) => setNewPinInput(e.target.value)}
                    placeholder="Enter new 4-6 digit numeric PIN"
                    className="w-full px-3 py-2 rounded-xl border border-zinc-300 font-mono font-bold text-sm text-zinc-900 focus:ring-2 focus:ring-amber-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-extrabold text-zinc-700 uppercase tracking-wider text-[10px] mb-1">
                    Confirm New PIN:
                  </label>
                  <input
                    type="password"
                    maxLength={6}
                    value={confirmPinInput}
                    onChange={(e) => setConfirmPinInput(e.target.value)}
                    placeholder="Re-enter new PIN to confirm"
                    className="w-full px-3 py-2 rounded-xl border border-zinc-300 font-mono font-bold text-sm text-zinc-900 focus:ring-2 focus:ring-amber-400 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-zinc-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowChangePinModal(false)}
                  className="px-4 py-2 rounded-xl border border-zinc-300 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 text-xs font-black uppercase tracking-wider border border-zinc-950 shadow-xs transition-all cursor-pointer"
                >
                  Save New PIN
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
