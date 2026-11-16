import React, { useEffect, useMemo, useRef, useState } from 'react';
import { User, UserRole } from '../types';
import {
  LogOut,
  Shield,
  UserCheck,
  FileSpreadsheet,
  Bell,
  CheckCheck,
  X,
  ArrowRight,
  Package,
  AlertTriangle,
  Clock,
  CalendarClock,
  RotateCcw,
} from 'lucide-react';
import { YellowCabPlateLogo, YellowCabCheckerboard } from './YellowCabBrand';
import {
  AdminAlertItem,
  AdminAlertSeverity,
  formatAlertTimestamp,
} from '../utils/adminAlerts';

interface HeaderProps {
  currentUser: User | null;
  onLogout: () => void;
  onSyncGoogleSheets: () => void;
  isSyncing: boolean;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  pendingDisputesCount: number;
  adminAlerts?: AdminAlertItem[];
  readAlertIds?: Set<string>;
  dismissedCount?: number;
  onMarkAlertRead?: (alertId: string) => void;
  onDismissAlert?: (alertId: string) => void;
  onMarkAllAlertsRead?: () => void;
  onRestoreDismissedAlerts?: () => void;
}

type PopoverFilter = 'ALL' | 'WAREHOUSE' | 'DISPUTE' | 'ATTENDANCE';

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  onLogout,
  activeTab,
  setActiveTab,
  adminAlerts = [],
  readAlertIds = new Set<string>(),
  dismissedCount = 0,
  onMarkAlertRead,
  onDismissAlert,
  onMarkAllAlertsRead,
  onRestoreDismissedAlerts,
}) => {
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [filter, setFilter] = useState<PopoverFilter>('ALL');
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isNotifOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isNotifOpen]);

  const unreadCount = useMemo(
    () => adminAlerts.filter((a) => !readAlertIds.has(a.id)).length,
    [adminAlerts, readAlertIds]
  );

  const criticalUnreadCount = useMemo(
    () =>
      adminAlerts.filter((a) => !readAlertIds.has(a.id) && a.severity === 'critical').length,
    [adminAlerts, readAlertIds]
  );

  const filteredAlerts = useMemo(() => {
    if (filter === 'WAREHOUSE') {
      return adminAlerts.filter((a) => a.category === 'STR' || a.category === 'LOW_STOCK');
    }
    if (filter === 'DISPUTE') {
      return adminAlerts.filter((a) => a.category === 'DISPUTE');
    }
    if (filter === 'ATTENDANCE') {
      return adminAlerts.filter((a) => a.category === 'ATTENDANCE' || a.category === 'CTO');
    }
    return adminAlerts;
  }, [adminAlerts, filter]);

  if (!currentUser) return null;

  const isAdmin = currentUser.role === 'ADMIN';

  const getRoleBadge = (role: UserRole) => {
    const userPos = currentUser.position ? currentUser.position.toUpperCase() : null;
    switch (role) {
      case 'ADMIN':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-zinc-900 text-amber-400 border border-amber-400/40 shadow-xs uppercase">
            <Shield className="w-3.5 h-3.5" /> {userPos || 'OWNER / ADMIN'}
          </span>
        );
      case 'SHIFT_MANAGER':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-400 text-zinc-950 border border-amber-500 shadow-xs uppercase">
            <Shield className="w-3.5 h-3.5" /> {userPos || 'SHIFT MANAGER'}
          </span>
        );
      case 'BRANCH_MANAGER':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-400 text-zinc-950 border border-amber-500 shadow-xs uppercase">
            <Shield className="w-3.5 h-3.5" /> {userPos || 'BRANCH MANAGER'}
          </span>
        );
      case 'PAYROLL':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-zinc-800 text-amber-300 border border-zinc-700 uppercase">
            <FileSpreadsheet className="w-3.5 h-3.5" /> {userPos || 'PAYROLL'}
          </span>
        );
      case 'STAFF':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-900 border border-amber-300 uppercase">
            <UserCheck className="w-3.5 h-3.5" /> {userPos || 'STAFF EMPLOYEE'}
          </span>
        );
    }
  };

  const renderCategoryIcon = (alert: AdminAlertItem) => {
    const baseColor =
      alert.severity === 'critical'
        ? 'bg-rose-100 text-rose-700 border-rose-200'
        : alert.severity === 'warning'
        ? 'bg-amber-100 text-amber-800 border-amber-200'
        : 'bg-sky-100 text-sky-700 border-sky-200';

    let Icon = AlertTriangle;
    if (alert.category === 'STR' || alert.category === 'LOW_STOCK') Icon = Package;
    else if (alert.category === 'DISPUTE') Icon = Clock;
    else if (alert.category === 'CTO') Icon = CalendarClock;

    return (
      <div
        className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${baseColor}`}
      >
        <Icon className="w-4 h-4" />
      </div>
    );
  };

  const getSeverityLabel = (severity: AdminAlertSeverity) => {
    if (severity === 'critical') return 'Critical';
    if (severity === 'warning') return 'Action Needed';
    return 'Notice';
  };

  const handleAlertClick = (alert: AdminAlertItem) => {
    if (onMarkAlertRead) onMarkAlertRead(alert.id);
    if (alert.targetTab && alert.targetTab !== activeTab) {
      setActiveTab(alert.targetTab);
    }
    setIsNotifOpen(false);
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
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Super Admin Live Alert Notifications */}
            {isAdmin && (
              <div className="relative" ref={popoverRef}>
                <button
                  id="btn-admin-notifications"
                  type="button"
                  onClick={() => setIsNotifOpen((prev) => !prev)}
                  aria-label={`Admin alert notifications (${unreadCount} unread)`}
                  aria-expanded={isNotifOpen}
                  className={`relative inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    isNotifOpen
                      ? 'bg-amber-400 text-zinc-950 border-amber-300'
                      : unreadCount > 0
                      ? 'bg-zinc-900 text-amber-300 border-amber-400/50 hover:bg-zinc-800'
                      : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:text-amber-300 hover:border-zinc-700'
                  }`}
                >
                  <Bell className="w-4 h-4 shrink-0" />
                  <span className="hidden sm:inline">Alerts</span>
                  {unreadCount > 0 && (
                    <span
                      className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-md text-[11px] font-black tabular-nums ${
                        criticalUnreadCount > 0
                          ? 'bg-rose-600 text-white'
                          : 'bg-amber-400 text-zinc-950'
                      }`}
                    >
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>

                {isNotifOpen && (
                  <div
                    role="dialog"
                    aria-label="Admin Alert Notifications"
                    className="fixed sm:absolute right-2 sm:right-0 left-2 sm:left-auto top-[84px] sm:top-full sm:mt-2 w-auto sm:w-[430px] bg-white text-zinc-900 rounded-2xl border border-zinc-300 shadow-2xl overflow-hidden z-50"
                  >
                    {/* Popover Header */}
                    <div className="bg-zinc-950 text-white px-4 py-3 border-b border-zinc-800 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Bell className="w-4 h-4 text-amber-400 shrink-0" />
                          <h3 className="text-xs font-black uppercase tracking-wider text-white truncate">
                            Admin Alert Center
                          </h3>
                          <span className="text-[11px] font-bold text-amber-300 tabular-nums">
                            · {unreadCount} unread
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-400 mt-0.5 truncate">
                          Real-time STR, stock, dispute & punch alerts
                        </p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {unreadCount > 0 && onMarkAllAlertsRead && (
                          <button
                            type="button"
                            onClick={onMarkAllAlertsRead}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-300 text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0"
                            title="Mark all current alerts as read"
                          >
                            <CheckCheck className="w-3.5 h-3.5" />
                            <span>Mark all read</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setIsNotifOpen(false)}
                          aria-label="Close notifications"
                          className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Category Filter Tabs */}
                    <div className="px-3 py-2 bg-zinc-50 border-b border-zinc-200 flex items-center gap-1.5 overflow-x-auto">
                      {(
                        [
                          { id: 'ALL', label: `All (${adminAlerts.length})` },
                          {
                            id: 'WAREHOUSE',
                            label: `STR & Stock (${
                              adminAlerts.filter(
                                (a) => a.category === 'STR' || a.category === 'LOW_STOCK'
                              ).length
                            })`,
                          },
                          {
                            id: 'DISPUTE',
                            label: `Disputes (${
                              adminAlerts.filter((a) => a.category === 'DISPUTE').length
                            })`,
                          },
                          {
                            id: 'ATTENDANCE',
                            label: `Attendance (${
                              adminAlerts.filter(
                                (a) => a.category === 'ATTENDANCE' || a.category === 'CTO'
                              ).length
                            })`,
                          },
                        ] as { id: PopoverFilter; label: string }[]
                      ).map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setFilter(tab.id)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap shrink-0 transition-colors cursor-pointer tabular-nums ${
                            filter === tab.id
                              ? 'bg-zinc-900 text-amber-400'
                              : 'bg-white text-zinc-600 hover:bg-zinc-200/70 border border-zinc-200'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    {/* Alert Items List */}
                    <div className="max-h-[360px] overflow-y-auto divide-y divide-zinc-100">
                      {filteredAlerts.length === 0 ? (
                        <div className="py-10 px-4 text-center space-y-2">
                          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center mx-auto">
                            <Bell className="w-5 h-5" />
                          </div>
                          <p className="text-xs font-bold text-zinc-800">
                            All clear in this category
                          </p>
                          <p className="text-[11px] text-zinc-500">
                            New STR reviews, low-stock warnings, and pending disputes will appear here automatically.
                          </p>
                        </div>
                      ) : (
                        filteredAlerts.map((alert) => {
                          const isRead = readAlertIds.has(alert.id);
                          return (
                            <div
                              key={alert.id}
                              className={`p-3 transition-colors flex items-start gap-3 ${
                                isRead ? 'bg-white opacity-75' : 'bg-amber-50/40 hover:bg-amber-50/70'
                              }`}
                            >
                              {renderCategoryIcon(alert)}

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2">
                                  <span
                                    className={`text-[10px] font-black uppercase tracking-wider ${
                                      alert.severity === 'critical'
                                        ? 'text-rose-700'
                                        : alert.severity === 'warning'
                                        ? 'text-amber-800'
                                        : 'text-sky-700'
                                    }`}
                                  >
                                    {getSeverityLabel(alert.severity)} · {alert.category.replace('_', ' ')}
                                  </span>
                                  <span className="text-[10px] font-mono text-zinc-500 tabular-nums shrink-0">
                                    {formatAlertTimestamp(alert.timestamp)}
                                  </span>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handleAlertClick(alert)}
                                  className="text-left w-full group cursor-pointer mt-0.5"
                                >
                                  <div className="text-xs font-extrabold text-zinc-900 group-hover:text-amber-700 leading-snug">
                                    {!isRead && (
                                      <span
                                        className="inline-block w-1.5 h-1.5 rounded-full bg-rose-600 mr-1.5 align-middle"
                                        aria-hidden="true"
                                      />
                                    )}
                                    {alert.title}
                                  </div>
                                  <p className="text-[11px] text-zinc-600 line-clamp-2 mt-0.5 leading-snug">
                                    {alert.description}
                                  </p>
                                  <div className="mt-1.5 flex items-center justify-between gap-2">
                                    <span className="text-[10px] font-medium text-zinc-500 truncate">
                                      {alert.meta}
                                    </span>
                                    <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-amber-800 group-hover:translate-x-0.5 transition-transform whitespace-nowrap shrink-0">
                                      {alert.actionLabel}
                                      <ArrowRight className="w-3 h-3" />
                                    </span>
                                  </div>
                                </button>
                              </div>

                              {onDismissAlert && (
                                <button
                                  type="button"
                                  onClick={() => onDismissAlert(alert.id)}
                                  title="Dismiss alert"
                                  aria-label={`Dismiss alert ${alert.title}`}
                                  className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200/60 transition-colors cursor-pointer shrink-0"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Popover Footer */}
                    {(dismissedCount > 0 || adminAlerts.length > 0) && (
                      <div className="px-3.5 py-2.5 bg-zinc-50 border-t border-zinc-200 flex items-center justify-between gap-2 text-[11px]">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTab('overview');
                            setIsNotifOpen(false);
                          }}
                          className="font-bold text-zinc-700 hover:text-zinc-950 cursor-pointer whitespace-nowrap"
                        >
                          Open Admin Overview
                        </button>
                        {dismissedCount > 0 && onRestoreDismissedAlerts && (
                          <button
                            type="button"
                            onClick={onRestoreDismissedAlerts}
                            className="inline-flex items-center gap-1 font-bold text-amber-800 hover:text-amber-950 cursor-pointer whitespace-nowrap"
                          >
                            <RotateCcw className="w-3 h-3" />
                            Restore {dismissedCount} dismissed
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center space-x-2">
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
                className="p-1.5 text-zinc-400 hover:text-amber-400 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
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

