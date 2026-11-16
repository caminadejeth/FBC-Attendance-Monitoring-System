import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ActivityActionType,
  ActivityLog,
  AttendanceStatus,
  AttendanceSummaryDaily,
  BiometricPunch,
  CtoManualAdjustment,
  CtoRequest,
  DisputeRequest,
  StockMovementEntry,
  StockTransferLineItem,
  StockTransferRequisition,
  SyncLog,
  User,
  UserRole,
  WarehouseBranchCode,
  WarehouseCategory,
  WarehouseInventoryItem,
  WorkSchedule,
} from './types';
import {
  parseToYYYYMMDD,
  calculateGrossHours,
  getDayOfWeekName,
} from './utils/timeFormatters';
import {
  INITIAL_DAILY_SUMMARIES,
  INITIAL_DISPUTES,
  INITIAL_PUNCHES,
  INITIAL_USERS,
  INITIAL_CTO_REQUESTS,
  INITIAL_CTO_ADJUSTMENTS,
  INITIAL_SCHEDULES,
  INITIAL_ACTIVITY_LOGS,
} from './data/mockData';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { LoginScreen } from './components/LoginScreen';
import { AdminDashboard } from './components/AdminDashboard';
import { StaffDashboard } from './components/StaffDashboard';
import { ManagerDashboard } from './components/ManagerDashboard';
import { PayrollDashboard } from './components/PayrollDashboard';
import { WarehouseInventoryDashboard } from './components/WarehouseInventoryDashboard';
import { GoogleSheetsSyncModal } from './components/GoogleSheetsSyncModal';
import { buildGoogleSheetsData, syncToGoogleSheets } from './utils/googleSheetsSync';
import { showAdminAlertToast, showSyncConfirmAlert } from './utils/sweetAlerts';
import {
  buildAdminAlerts,
  loadAdminDismissedAlertIds,
  loadAdminReadAlertIds,
  saveAdminDismissedAlertIds,
  saveAdminReadAlertIds,
} from './utils/adminAlerts';
import {
  buildDefaultCatalogItemsForBranch,
  buildDefaultWarehouseCategories,
  findStockReferenceByCode,
  findStockReferenceByDescription,
  getBranchByCode,
  isMonitoredWarehouseBranch,
} from './data/warehouseData';
import { YellowCabCheckerboard } from './components/YellowCabBrand';
import {
  subscribeCollection,
  saveDocument,
  saveDocuments,
  removeDocument,
  isWarehouseCatalogSeeded,
  markWarehouseCatalogSeeded,
} from './lib/firestoreSync';

const loadFromStorage = <T,>(key: string, fallback: T): T => {
  try {
    const saved = localStorage.getItem(key);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (err) {
    console.error(`Failed to load ${key} from localStorage`, err);
  }
  return fallback;
};

export default function App() {
  // Authentication & Users State
  const [currentUser, setCurrentUser] = useState<User | null>(() =>
    loadFromStorage<User | null>('fbc_current_user', null)
  );
  const [users, setUsers] = useState<User[]>(() =>
    loadFromStorage<User[]>('fbc_users', INITIAL_USERS)
  );
  const [summaries, setSummaries] = useState<AttendanceSummaryDaily[]>(() =>
    loadFromStorage<AttendanceSummaryDaily[]>('fbc_summaries', INITIAL_DAILY_SUMMARIES)
  );
  const [punches, setPunches] = useState<BiometricPunch[]>(() =>
    loadFromStorage<BiometricPunch[]>('fbc_punches', INITIAL_PUNCHES)
  );
  const [disputes, setDisputes] = useState<DisputeRequest[]>(() =>
    loadFromStorage<DisputeRequest[]>('fbc_disputes', INITIAL_DISPUTES)
  );
  const [schedules, setSchedules] = useState<WorkSchedule[]>(() =>
    loadFromStorage<WorkSchedule[]>('fbc_schedules', INITIAL_SCHEDULES)
  );
  const [ctoRequests, setCtoRequests] = useState<CtoRequest[]>(() =>
    loadFromStorage<CtoRequest[]>('fbc_cto_requests', INITIAL_CTO_REQUESTS)
  );
  const [ctoAdjustments, setCtoAdjustments] = useState<CtoManualAdjustment[]>(() =>
    loadFromStorage<CtoManualAdjustment[]>('fbc_cto_adjustments', INITIAL_CTO_ADJUSTMENTS)
  );
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>(() =>
    loadFromStorage<ActivityLog[]>('fbc_activity_logs', INITIAL_ACTIVITY_LOGS)
  );
  const [warehouseCategories, setWarehouseCategories] = useState<WarehouseCategory[]>(() =>
    loadFromStorage<WarehouseCategory[]>('fbc_warehouseCategories', [])
  );
  const [warehouseItems, setWarehouseItems] = useState<WarehouseInventoryItem[]>(() =>
    loadFromStorage<WarehouseInventoryItem[]>('fbc_warehouseItems', [])
  );
  const [stockMovements, setStockMovements] = useState<StockMovementEntry[]>(() =>
    loadFromStorage<StockMovementEntry[]>('fbc_stockMovements', [])
  );
  const [stockTransfers, setStockTransfers] = useState<StockTransferRequisition[]>(() =>
    loadFromStorage<StockTransferRequisition[]>('fbc_stockTransfers', [])
  );

  // Real-Time Firebase Firestore Cloud Database Subscriptions across all devices/users
  useEffect(() => {
    const unsubUsers = subscribeCollection('users', INITIAL_USERS, setUsers);
    const unsubSummaries = subscribeCollection('summaries', INITIAL_DAILY_SUMMARIES, setSummaries);
    const unsubPunches = subscribeCollection('punches', INITIAL_PUNCHES, setPunches);
    const unsubDisputes = subscribeCollection('disputes', INITIAL_DISPUTES, setDisputes);
    const unsubSchedules = subscribeCollection('schedules', INITIAL_SCHEDULES, setSchedules);
    const unsubCtoReq = subscribeCollection('ctoRequests', INITIAL_CTO_REQUESTS, setCtoRequests);
    const unsubCtoAdj = subscribeCollection('ctoAdjustments', INITIAL_CTO_ADJUSTMENTS, setCtoAdjustments);
    const unsubActivity = subscribeCollection('activityLogs', INITIAL_ACTIVITY_LOGS, setActivityLogs);
    const unsubWarehouseCats = subscribeCollection<WarehouseCategory>('warehouseCategories', [], setWarehouseCategories);
    const unsubWarehouseItems = subscribeCollection<WarehouseInventoryItem>('warehouseItems', [], setWarehouseItems);
    const unsubStockMovements = subscribeCollection<StockMovementEntry>('stockMovements', [], setStockMovements);
    const unsubStockTransfers = subscribeCollection<StockTransferRequisition>('stockTransfers', [], setStockTransfers);

    // One-time default warehouse catalog & categories seed to Firestore if not yet initialized
    (async () => {
      try {
        const alreadySeeded = await isWarehouseCatalogSeeded();
        if (!alreadySeeded) {
          const defaultCats = buildDefaultWarehouseCategories('System Default');
          const defaultItems = buildDefaultCatalogItemsForBranch('YC-EBLC', 'System Default', true);
          await saveDocuments('warehouseCategories', defaultCats);
          await saveDocuments('warehouseItems', defaultItems);
          await markWarehouseCatalogSeeded();
        }
      } catch (err) {
        console.error('Failed one-time warehouse default catalog seed:', err);
      }
    })();

    return () => {
      unsubUsers();
      unsubSummaries();
      unsubPunches();
      unsubDisputes();
      unsubSchedules();
      unsubCtoReq();
      unsubCtoAdj();
      unsubActivity();
      unsubWarehouseCats();
      unsubWarehouseItems();
      unsubStockMovements();
      unsubStockTransfers();
    };
  }, []);

  // System Activity Logger Helper
  const logActivity = (
    actionType: ActivityActionType,
    details: string,
    actionCategory: string = 'System'
  ) => {
    const newLog: ActivityLog = {
      id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      userName: currentUser?.name || 'System Administrator',
      userRole: currentUser?.role || 'ADMIN',
      userEmail: currentUser?.email,
      actionType,
      actionCategory,
      details,
    };

    setActivityLogs((prev) => [newLog, ...prev]);
    saveDocument('activityLogs', newLog);
  };

  const handleClearActivityLogs = async () => {
    for (const log of activityLogs) {
      await removeDocument('activityLogs', log.id);
    }
    setActivityLogs([]);
    try {
      localStorage.removeItem('fbc_activity_logs');
      localStorage.removeItem('fbc_deleted_activityLogs');
    } catch (e) {
      console.error(e);
    }
  };

  // Sync current logged-in user session to localStorage
  useEffect(() => {
    try {
      if (currentUser) {
        localStorage.setItem('fbc_current_user', JSON.stringify(currentUser));
      } else {
        localStorage.removeItem('fbc_current_user');
      }
    } catch (e) {
      console.error(e);
    }
  }, [currentUser]);

  const handleUpdateSummaryAnomaly = (summaryId: string, newNote: string) => {
    setSummaries((prev) =>
      prev.map((s) => {
        if (s.id === summaryId) {
          const updated = {
            ...s,
            anomalies: newNote.trim() ? [newNote.trim()] : [],
          };
          saveDocument('summaries', updated);
          return updated;
        }
        return s;
      })
    );
  };

  const handleSaveSchedule = (updatedSchedule: WorkSchedule) => {
    saveDocument('schedules', updatedSchedule);
    logActivity('SCHEDULE_UPDATE', `Updated work schedule roster for ${updatedSchedule.employeeName} (${updatedSchedule.shiftName}).`, 'Schedules');
    setSchedules((prev) => {
      const idx = prev.findIndex(
        (s) =>
          s.employeeId === updatedSchedule.employeeId &&
          s.effectiveDate === updatedSchedule.effectiveDate
      );
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = updatedSchedule;
        return next;
      }
      return [updatedSchedule, ...prev];
    });
  };

  const handleUpdateUserPin = (userId: string, newPin: string) => {
    const targetUser = users.find((u) => u.id === userId);
    if (targetUser) {
      const updated = { ...targetUser, pin: newPin };
      saveDocument('users', updated);
    }
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, pin: newPin } : u))
    );
    if (currentUser && currentUser.id === userId) {
      setCurrentUser((prev) => (prev ? { ...prev, pin: newPin } : prev));
    }
  };

  // Sync & Modal State
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [currentSyncLog, setCurrentSyncLog] = useState<SyncLog | null>(null);
  const [showSyncModal, setShowSyncModal] = useState<boolean>(false);

  // Navigation Tab State
  const [activeTab, setActiveTab] = useState<string>('overview');

  // Super Admin Alert Notification State (read/dismissed persisted per admin user)
  const [readAlertIds, setReadAlertIds] = useState<Set<string>>(() =>
    loadAdminReadAlertIds(currentUser?.id)
  );
  const [dismissedAlertIds, setDismissedAlertIds] = useState<Set<string>>(() =>
    loadAdminDismissedAlertIds(currentUser?.id)
  );

  useEffect(() => {
    setReadAlertIds(loadAdminReadAlertIds(currentUser?.id));
    setDismissedAlertIds(loadAdminDismissedAlertIds(currentUser?.id));
  }, [currentUser?.id]);

  const allAdminAlerts = useMemo(
    () =>
      buildAdminAlerts({
        stockTransfers,
        warehouseItems,
        disputes,
        ctoRequests,
        summaries,
      }),
    [stockTransfers, warehouseItems, disputes, ctoRequests, summaries]
  );

  const visibleAdminAlerts = useMemo(
    () => allAdminAlerts.filter((a) => !dismissedAlertIds.has(a.id)),
    [allAdminAlerts, dismissedAlertIds]
  );

  const dismissedAdminAlertsCount = useMemo(
    () => allAdminAlerts.filter((a) => dismissedAlertIds.has(a.id)).length,
    [allAdminAlerts, dismissedAlertIds]
  );

  const handleMarkAlertRead = (alertId: string) => {
    setReadAlertIds((prev) => {
      if (prev.has(alertId)) return prev;
      const next = new Set<string>(prev);
      next.add(alertId);
      if (currentUser?.id) saveAdminReadAlertIds(currentUser.id, next);
      return next;
    });
  };

  const handleDismissAlert = (alertId: string) => {
    setDismissedAlertIds((prev) => {
      const next = new Set<string>(prev);
      next.add(alertId);
      if (currentUser?.id) saveAdminDismissedAlertIds(currentUser.id, next);
      return next;
    });
  };

  const handleMarkAllAlertsRead = () => {
    setReadAlertIds((prev) => {
      const next = new Set<string>(prev);
      visibleAdminAlerts.forEach((a) => next.add(a.id));
      if (currentUser?.id) saveAdminReadAlertIds(currentUser.id, next);
      return next;
    });
  };

  const handleRestoreDismissedAlerts = () => {
    const empty = new Set<string>();
    setDismissedAlertIds(empty);
    if (currentUser?.id) saveAdminDismissedAlertIds(currentUser.id, empty);
  };

  // Real-time non-blocking toast for NEW Admin alerts arriving after initial snapshot hydration
  const alertBaselineIdsRef = useRef<Set<string> | null>(null);
  const alertsArmedRef = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      alertBaselineIdsRef.current = new Set(allAdminAlerts.map((a) => a.id));
      alertsArmedRef.current = true;
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!alertsArmedRef.current) {
      alertBaselineIdsRef.current = new Set(allAdminAlerts.map((a) => a.id));
      return;
    }
    if (currentUser?.role !== 'ADMIN') {
      alertBaselineIdsRef.current = new Set(allAdminAlerts.map((a) => a.id));
      return;
    }

    const prevIds = alertBaselineIdsRef.current || new Set<string>();
    const newlyArrived = allAdminAlerts.filter(
      (a) => !prevIds.has(a.id) && !dismissedAlertIds.has(a.id)
    );
    alertBaselineIdsRef.current = new Set(allAdminAlerts.map((a) => a.id));

    if (newlyArrived.length > 0) {
      const topAlert = newlyArrived[0];
      showAdminAlertToast(
        newlyArrived.length > 1
          ? `${newlyArrived.length} New Admin Alerts`
          : topAlert.title,
        newlyArrived.length > 1
          ? `${topAlert.title} (+${newlyArrived.length - 1} more)`
          : topAlert.description,
        topAlert.severity
      );
    }
  }, [allAdminAlerts, currentUser?.role, dismissedAlertIds]);

  // Security guard: Only ADMIN role can access activity-logs
  useEffect(() => {
    if (currentUser && currentUser.role !== 'ADMIN' && activeTab === 'activity-logs') {
      if (currentUser.role === 'BRANCH_MANAGER' || currentUser.role === 'PAYROLL') {
        setActiveTab('dtr-logs');
      } else {
        setActiveTab('my-punches');
      }
    }
  }, [currentUser, activeTab]);

  // Login handler
  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    if (user.role === 'ADMIN') {
      setActiveTab('overview');
    } else if (user.role === 'BRANCH_MANAGER') {
      setActiveTab('dtr-logs');
    } else if (user.role === 'PAYROLL') {
      setActiveTab('dtr-logs');
    } else {
      setActiveTab('my-punches');
    }
  };

  // Logout handler
  const handleLogout = () => {
    setCurrentUser(null);
  };

  // Handle uploaded biometric file processing
  const handleUploadProcessed = async (newSummaries: AttendanceSummaryDaily[]) => {
    await saveDocuments('summaries', newSummaries);
    logActivity('BIOMETRIC_UPLOAD', `Uploaded and processed ${newSummaries.length} biometric attendance summary logs.`, 'Biometrics');
    setSummaries((prev) => {
      const map = new Map<string, AttendanceSummaryDaily>();
      prev.forEach((s) => map.set(`${s.employeeId}_${s.date}`, s));
      newSummaries.forEach((s) => map.set(`${s.employeeId}_${s.date}`, s));
      return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
    });
  };

  // Handle Dispute Approvals & Hours Recalculation (Dual Approval)
  const handleApproveDispute = async (
    disputeId: string,
    adminNotes: string,
    approverRole?: 'MANAGER' | 'PAYROLL' | 'ADMIN'
  ) => {
    const currentNow = new Date().toISOString();
    const role =
      approverRole ||
      (currentUser?.role === 'BRANCH_MANAGER' || currentUser?.role === 'SHIFT_MANAGER'
        ? 'MANAGER'
        : currentUser?.role === 'ADMIN'
        ? 'ADMIN'
        : 'PAYROLL');

    const targetDispute = disputes.find((d) => d.id === disputeId);
    if (!targetDispute) return;

    const isMgr = role === 'MANAGER';
    const isPay = role === 'PAYROLL';
    const isAdmin = role === 'ADMIN' || currentUser?.role === 'ADMIN';

    const updatedMgrApp = isMgr || isAdmin ? true : Boolean(targetDispute.managerApproved);
    const updatedMgrBy = isMgr
      ? currentUser?.name || 'Branch Manager'
      : isAdmin
      ? `${currentUser?.name || 'System Admin'} (Admin)`
      : targetDispute.managerApprovedBy || (targetDispute.status === 'APPROVED' ? targetDispute.reviewedBy : undefined);
    const updatedMgrAt = (isMgr || isAdmin) ? (targetDispute.managerApprovedAt || currentNow) : targetDispute.managerApprovedAt;

    const updatedPayApp = isPay || isAdmin ? true : Boolean(targetDispute.payrollApproved);
    const updatedPayBy = isPay
      ? currentUser?.name || 'Payroll Department'
      : isAdmin
      ? `${currentUser?.name || 'System Admin'} (Admin)`
      : targetDispute.payrollApprovedBy;
    const updatedPayAt = (isPay || isAdmin) ? (targetDispute.payrollApprovedAt || currentNow) : targetDispute.payrollApprovedAt;

    // Fully approved if both approved, OR if done by ADMIN
    const fullyApproved = (updatedMgrApp && updatedPayApp) || isAdmin;

    const approvers: string[] = [];
    if (updatedMgrApp) approvers.push(`Branch Manager (${updatedMgrBy || 'Manager'})`);
    if (updatedPayApp) approvers.push(`Payroll (${updatedPayBy || 'Payroll'})`);

    const updatedDisputeItem: DisputeRequest = {
      ...targetDispute,
      status: fullyApproved ? 'APPROVED' : 'PENDING',
      adminNotes: adminNotes || targetDispute.adminNotes,
      reviewedBy: approvers.join(' & ') || currentUser?.name || 'Authorized Approver',
      reviewedAt: currentNow,
      approvedAt: fullyApproved ? (targetDispute.approvedAt || currentNow) : targetDispute.approvedAt,
      managerApproved: updatedMgrApp,
      managerApprovedBy: updatedMgrBy,
      managerApprovedAt: updatedMgrAt,
      payrollApproved: updatedPayApp,
      payrollApprovedBy: updatedPayBy,
      payrollApprovedAt: updatedPayAt,
    };

    // Save updated dispute directly to Firestore
    await saveDocument('disputes', updatedDisputeItem);

    setDisputes((prev) =>
      prev.map((d) => (d.id === disputeId ? updatedDisputeItem : d))
    );

    logActivity(
      updatedDisputeItem.status === 'APPROVED' ? 'DISPUTE_APPROVAL' : 'SYSTEM_EVENT',
      `${updatedDisputeItem.status === 'APPROVED' ? 'Approved' : 'Updated approval status for'} dispute for ${updatedDisputeItem.employeeName} (${updatedDisputeItem.category || updatedDisputeItem.type} on ${updatedDisputeItem.date}).`,
      'Disputes'
    );

    // Recalculate DTR Attendance summary ONLY when fully approved by BOTH or ADMIN
    if (fullyApproved) {
      const empUser = users.find((u) => u.employeeId === updatedDisputeItem.employeeId);
      const empName = updatedDisputeItem.employeeName || empUser?.name || 'Staff Member';
      const dept = empUser?.department || 'Operations';

      const targetDate = parseToYYYYMMDD(updatedDisputeItem.date);

      const existingSummary = summaries.find(
        (s) => s.employeeId === updatedDisputeItem.employeeId && parseToYYYYMMDD(s.date) === targetDate
      );

      const cat = (updatedDisputeItem.category || updatedDisputeItem.type || '').toLowerCase();

      let reqIn = existingSummary?.firstIn || '';
      let reqOut = existingSummary?.lastOut || '';
      let reqBreakOut = existingSummary?.breakOut || '';
      let reqBreakIn = existingSummary?.breakIn || '';
      const newlyAdjustedFields: string[] = [];

      const isTimeInCat = cat.includes('time-in') || cat.includes('time_in') || cat.includes('time in') || cat.includes('full shift') || cat.includes('full_shift');
      const isTimeOutCat = cat.includes('time-out') || cat.includes('time_out') || cat.includes('time out') || cat.includes('full shift') || cat.includes('full_shift');
      const isBreakOutCat = cat.includes('break-out') || cat.includes('break_out') || cat.includes('break out');
      const isBreakInCat = cat.includes('break-in') || cat.includes('break_in') || cat.includes('break in');

      if (updatedDisputeItem.requestedClockIn || isTimeInCat) {
        reqIn = updatedDisputeItem.requestedClockIn || reqIn || '08:00:00';
        newlyAdjustedFields.push('firstIn');
      }
      if (updatedDisputeItem.requestedClockOut || isTimeOutCat) {
        reqOut = updatedDisputeItem.requestedClockOut || reqOut || '17:00:00';
        newlyAdjustedFields.push('lastOut');
      }
      if (updatedDisputeItem.requestedBreakOut || isBreakOutCat) {
        reqBreakOut = updatedDisputeItem.requestedBreakOut || reqBreakOut;
        newlyAdjustedFields.push('breakOut');
      }
      if (updatedDisputeItem.requestedBreakIn || isBreakInCat) {
        reqBreakIn = updatedDisputeItem.requestedBreakIn || reqBreakIn;
        newlyAdjustedFields.push('breakIn');
      }

      let reqHours = 0;
      let otHours = 0;
      let utHours = 0;
      let finalStatus: AttendanceStatus = 'ADJUSTED';

      if (reqIn && reqOut) {
        reqHours = updatedDisputeItem.requestedHours || calculateGrossHours(reqIn, reqOut) || 0;
        otHours = reqHours > 8.0 ? reqHours - 8.0 : 0;
        utHours = reqHours < 8.0 && reqHours > 0 ? 8.0 - reqHours : 0;
        finalStatus = otHours > 0 ? 'OVERTIME' : utHours > 0 ? 'UNDERTIME' : 'ADJUSTED';
      } else if (reqIn) {
        finalStatus = 'MISSING_OUT';
      } else if (reqOut) {
        finalStatus = 'MISSING_IN';
      } else {
        finalStatus = 'ABSENT';
      }

      const reasonNote = `Time Adjustment (${updatedDisputeItem.category || updatedDisputeItem.type}) Approved: ${updatedDisputeItem.reason}${adminNotes ? ` (Notes: ${adminNotes})` : ''}`;

      let updatedSummaryItem: AttendanceSummaryDaily;

      if (existingSummary) {
        const combinedFields = Array.from(
          new Set([...(existingSummary.adjustedFields || []), ...newlyAdjustedFields])
        );
        const filteredAnomalies = (existingSummary.anomalies || []).filter(
          (a) => !a.startsWith('Time Adjustment (') && !a.includes(' Approved:')
        );
        updatedSummaryItem = {
          ...existingSummary,
          status: finalStatus,
          firstIn: reqIn,
          lastOut: reqOut,
          breakOut: reqBreakOut || existingSummary.breakOut,
          breakIn: reqBreakIn || existingSummary.breakIn,
          netHoursWorked: reqHours,
          undertimeHours: utHours,
          overtimeHours: otHours,
          anomalies: [reasonNote, ...filteredAnomalies],
          isAdjusted: true,
          adjustmentNote: updatedDisputeItem.reason,
          adjustedFields: combinedFields,
        };
      } else {
        const weekday = getDayOfWeekName(targetDate);
        updatedSummaryItem = {
          id: `summary-adj-${Date.now()}`,
          employeeId: updatedDisputeItem.employeeId,
          employeeName: empName,
          department: dept,
          date: targetDate,
          weekday: weekday || 'Workday',
          firstIn: reqIn,
          lastOut: reqOut,
          breakOut: reqBreakOut,
          breakIn: reqBreakIn,
          totalBreakMinutes: 60,
          netHoursWorked: reqHours,
          undertimeHours: utHours,
          overtimeHours: otHours,
          ctoHoursEarned: reqHours > 10.0 ? reqHours - 10.0 : 0,
          targetHours: 8.0,
          status: finalStatus,
          anomalies: [reasonNote],
          punches: [],
          isAdjusted: true,
          adjustmentNote: updatedDisputeItem.reason,
          adjustedFields: newlyAdjustedFields,
        };
      }

      await saveDocument('summaries', updatedSummaryItem);

      setSummaries((prev) => {
        const idx = prev.findIndex(
          (s) => s.employeeId === updatedDisputeItem.employeeId && parseToYYYYMMDD(s.date) === targetDate
        );
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = updatedSummaryItem;
          return next;
        }
        return [updatedSummaryItem, ...prev];
      });
    }
  };

  // Handle Dispute Rejection
  const handleRejectDispute = async (disputeId: string, adminNotes: string) => {
    const currentNow = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const targetDispute = disputes.find((d) => d.id === disputeId);
    if (!targetDispute) return;

    const updatedDisputeItem: DisputeRequest = {
      ...targetDispute,
      status: 'REJECTED',
      adminNotes,
      reviewedBy: currentUser?.name || 'Branch Manager / Admin',
      reviewedAt: currentNow,
    };

    await saveDocument('disputes', updatedDisputeItem);

    setDisputes((prev) =>
      prev.map((d) => (d.id === disputeId ? updatedDisputeItem : d))
    );

    logActivity(
      'DISPUTE_REJECTION',
      `Rejected dispute for ${updatedDisputeItem.employeeName} (${updatedDisputeItem.category || updatedDisputeItem.type} on ${updatedDisputeItem.date}).`,
      'Disputes'
    );
  };

  // Handle Staff submitting new dispute
  const handleSubmitDispute = (
    newDispute: Omit<DisputeRequest, 'id' | 'status' | 'submittedAt'>
  ) => {
    const dispute: DisputeRequest = {
      ...newDispute,
      id: `disp-${Date.now()}`,
      status: 'PENDING',
      submittedAt: new Date().toISOString(),
    };
    saveDocument('disputes', dispute);
    logActivity(
      'DISPUTE_FILING',
      `Submitted dispute request for ${dispute.employeeName} (${dispute.category || dispute.type} on ${dispute.date}).`,
      'Disputes'
    );
    setDisputes((prev) => [dispute, ...prev]);
  };

  // CTO Handlers
  const handleSubmitCtoRequest = (
    newReq: Omit<CtoRequest, 'id' | 'status' | 'submittedAt'>
  ) => {
    const req: CtoRequest = {
      ...newReq,
      id: `cto-req-${Date.now()}`,
      status: 'PENDING',
      managerApproved: false,
      payrollApproved: false,
      submittedAt: new Date().toISOString(),
    };
    saveDocument('ctoRequests', req);
    setCtoRequests((prev) => [req, ...prev]);
  };

  const handleApproveCtoRequest = async (id: string, notes?: string, approverRole?: 'MANAGER' | 'PAYROLL' | 'ADMIN') => {
    const currentNow = new Date().toISOString();
    const role = approverRole || (currentUser?.role === 'BRANCH_MANAGER' || currentUser?.role === 'SHIFT_MANAGER' ? 'MANAGER' : 'PAYROLL');

    const targetCto = ctoRequests.find((r) => r.id === id);
    if (!targetCto) return;

    const isMgr = role === 'MANAGER';
    const isPay = role === 'PAYROLL' || role === 'ADMIN';

    const updatedMgrApp = isMgr ? true : Boolean(targetCto.managerApproved);
    const updatedMgrBy = isMgr ? (currentUser?.name || 'Branch Manager') : targetCto.managerApprovedBy;
    const updatedMgrAt = isMgr ? currentNow : targetCto.managerApprovedAt;

    const updatedPayApp = isPay ? true : Boolean(targetCto.payrollApproved);
    const updatedPayBy = isPay ? (currentUser?.name || 'Payroll Department') : targetCto.payrollApprovedBy;
    const updatedPayAt = isPay ? currentNow : targetCto.payrollApprovedAt;

    // Both approved, or Payroll/Admin final sign-off
    const isFullyApproved = (updatedMgrApp && updatedPayApp) || (isPay && role === 'ADMIN');

    const updatedCtoItem: CtoRequest = {
      ...targetCto,
      status: isFullyApproved ? 'APPROVED' : 'PENDING',
      reviewNotes: notes || targetCto.reviewNotes,
      reviewedBy: currentUser?.name || 'Authorized Approver',
      managerApproved: updatedMgrApp,
      managerApprovedBy: updatedMgrBy,
      managerApprovedAt: updatedMgrAt,
      payrollApproved: updatedPayApp,
      payrollApprovedBy: updatedPayBy,
      payrollApprovedAt: updatedPayAt,
    };

    await saveDocument('ctoRequests', updatedCtoItem);

    setCtoRequests((prev) =>
      prev.map((r) => (r.id === id ? updatedCtoItem : r))
    );

    // If fully approved and it's a LEAVE request, mark Attendance Summary as LEAVE
    if (isFullyApproved && updatedCtoItem.requestType !== 'CREDIT') {
      const target: CtoRequest = updatedCtoItem;
      let updatedSummaryItem: AttendanceSummaryDaily | null = null;
      const existingIdx = summaries.findIndex(
        (s) => s.employeeId === target.employeeId && s.date === target.date
      );

      if (existingIdx >= 0) {
        updatedSummaryItem = {
          ...summaries[existingIdx],
          status: 'LEAVE' as AttendanceStatus,
          isAdjusted: true,
          adjustmentNote: `Approved CTO Leave (${target.hoursRequested}h) - Approved by ${target.managerApprovedBy || 'Manager'} & ${target.payrollApprovedBy || 'Payroll'}`,
          anomalies: Array.from(new Set([...(summaries[existingIdx].anomalies || []), 'Approved CTO Leave'])),
        };
      } else {
        updatedSummaryItem = {
          id: `sum-cto-${target.employeeId}-${target.date}`,
          employeeId: target.employeeId,
          employeeName: target.employeeName,
          department: target.department,
          branch: target.branch || target.department,
          date: target.date,
          weekday: Number.isNaN(new Date(target.date).getTime())
            ? ''
            : new Date(target.date).toLocaleDateString('en-US', { weekday: 'long' }),
          status: 'LEAVE',
          firstIn: null,
          lastOut: null,
          totalBreakMinutes: 0,
          netHoursWorked: 0,
          undertimeHours: 0,
          overtimeHours: 0,
          targetHours: 8.0,
          anomalies: ['Approved CTO Leave'],
          punches: [],
          isAdjusted: true,
          adjustmentNote: `Approved CTO Leave (${target.hoursRequested}h) - Approved by ${target.managerApprovedBy || 'Manager'} & ${target.payrollApprovedBy || 'Payroll'}`,
        };
      }

      await saveDocument('summaries', updatedSummaryItem);

      setSummaries((prevSummaries) => {
        const idx = prevSummaries.findIndex(
          (s) => s.employeeId === target.employeeId && s.date === target.date
        );
        if (idx >= 0) {
          const next = [...prevSummaries];
          next[idx] = updatedSummaryItem!;
          return next;
        }
        return [updatedSummaryItem!, ...prevSummaries];
      });
    }
  };

  const handleRejectCtoRequest = async (id: string, notes?: string) => {
    const currentNow = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const targetCto = ctoRequests.find((r) => r.id === id);
    if (!targetCto) return;

    const rejectorRole = currentUser?.role === 'BRANCH_MANAGER'
      ? `Branch Manager - ${currentUser.branch || 'YC Ebloc'}`
      : currentUser?.role === 'SHIFT_MANAGER'
      ? `Shift Manager - ${currentUser.branch || 'YC Ebloc'}`
      : currentUser?.role === 'PAYROLL'
      ? (currentUser.position || 'Payroll')
      : currentUser?.role === 'ADMIN'
      ? 'System Admin'
      : 'Approver';
    
    const rejectorIdentity = currentUser
      ? `${currentUser.name} (${rejectorRole})`
      : 'Branch Manager';

    const updatedCtoItem: CtoRequest = {
      ...targetCto,
      status: 'REJECTED',
      reviewNotes: notes || 'CTO Request Disapproved',
      reviewedBy: rejectorIdentity,
      reviewedAt: currentNow,
    };

    await saveDocument('ctoRequests', updatedCtoItem);

    setCtoRequests((prev) =>
      prev.map((r) => (r.id === id ? updatedCtoItem : r))
    );
  };

  const handleAddCtoManualAdjustment = (
    adj: Omit<CtoManualAdjustment, 'id' | 'timestamp'>
  ) => {
    const record: CtoManualAdjustment = {
      ...adj,
      id: `cto-adj-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
    };
    saveDocument('ctoAdjustments', record);
    logActivity(
      'CTO_ADJUSTMENT',
      `Manual CTO adjustment of ${adj.amount > 0 ? '+' : ''}${adj.amount}h for ${adj.employeeName || 'ID ' + adj.employeeId}. Reason: ${adj.reason}`,
      'Adjustments'
    );
    setCtoAdjustments((prev) => [record, ...prev]);
  };

  // Add / Edit User handlers
  const handleAddUser = (newUser: User) => {
    saveDocument('users', newUser);
    logActivity('USER_MANAGEMENT', `Created staff account for ${newUser.name} (${newUser.employeeId}).`, 'Users');
    setUsers((prev) => [...prev, newUser]);
  };

  const handleUpdateUser = (updatedUser: User) => {
    saveDocument('users', updatedUser);
    logActivity('USER_MANAGEMENT', `Updated employee profile for ${updatedUser.name} (${updatedUser.employeeId}).`, 'Users');
    setUsers((prev) => prev.map((u) => (u.id === updatedUser.id ? updatedUser : u)));
  };

  const handleDeleteUser = (userId: string) => {
    const target = users.find((u) => u.id === userId);
    removeDocument('users', userId);
    logActivity('USER_MANAGEMENT', `Deleted user account ${target ? target.name + ' (' + target.employeeId + ')' : 'ID ' + userId}.`, 'Users');
    setUsers((prev) => prev.filter((u) => u.id !== userId));
  };

  const handleDeleteDispute = (disputeId: string) => {
    setDisputes((prev) => {
      const updated = prev.filter((d) => d.id !== disputeId);
      try {
        localStorage.setItem('fbc_disputes', JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return updated;
    });
    removeDocument('disputes', disputeId);
  };

  const handleDeleteSummary = (summaryId: string) => {
    removeDocument('summaries', summaryId);
    setSummaries((prev) => prev.filter((s) => s.id !== summaryId));
  };

  const handleClearSummaries = async (summaryIdsToClear?: string[]) => {
    if (summaryIdsToClear && summaryIdsToClear.length > 0) {
      const idsSet = new Set(summaryIdsToClear);
      for (const id of summaryIdsToClear) {
        await removeDocument('summaries', id);
      }
      logActivity('DATA_CLEAR', `Cleared ${summaryIdsToClear.length} selected biometric summary records.`, 'Data Clear');
      setSummaries((prev) => prev.filter((s) => !idsSet.has(s.id)));
    } else {
      for (const s of summaries) {
        await removeDocument('summaries', s.id);
      }
      for (const p of punches) {
        await removeDocument('punches', p.id);
      }
      logActivity('DATA_CLEAR', `Cleared all biometric summary logs (${summaries.length} entries) and punch logs from system.`, 'Data Clear');
      setSummaries([]);
      setPunches([]);
      try {
        localStorage.removeItem('fbc_summaries');
        localStorage.removeItem('fbc_punches');
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleDeleteCtoRequest = (ctoId: string) => {
    removeDocument('ctoRequests', ctoId);
    setCtoRequests((prev) => prev.filter((c) => c.id !== ctoId));
  };

  // Warehouse Category & Stock Item CRUD Handlers
  const handleAddWarehouseCategory = async (name: string) => {
    const nowIso = new Date().toISOString();
    const cleanName = name.trim().toUpperCase();
    const maxOrder = warehouseCategories.reduce(
      (max, c) => Math.max(max, c.sortOrder || 0),
      0
    );
    const newCat: WarehouseCategory = {
      id: `cat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: cleanName,
      sortOrder: maxOrder + 1,
      updatedAt: nowIso,
      updatedBy: currentUser?.name || 'System User',
    };
    await saveDocument('warehouseCategories', newCat);
    setWarehouseCategories((prev) => [...prev, newCat]);
    logActivity('SYSTEM_EVENT', `Added warehouse category "${cleanName}".`, 'Warehouse');
  };

  const handleUpdateWarehouseCategory = async (categoryId: string, newName: string) => {
    const target = warehouseCategories.find((c) => c.id === categoryId);
    if (!target) return;
    const cleanNew = newName.trim().toUpperCase();
    const oldName = target.name;
    const nowIso = new Date().toISOString();
    const performer = currentUser?.name || 'System User';

    const updatedCat: WarehouseCategory = {
      ...target,
      name: cleanNew,
      updatedAt: nowIso,
      updatedBy: performer,
    };
    await saveDocument('warehouseCategories', updatedCat);
    setWarehouseCategories((prev) =>
      prev.map((c) => (c.id === categoryId ? updatedCat : c))
    );

    // Sync renamed category onto matching stock items
    const affectedItems = warehouseItems
      .filter((i) => i.category === oldName)
      .map((i) => ({ ...i, category: cleanNew, updatedAt: nowIso, updatedBy: performer }));
    if (affectedItems.length > 0) {
      await saveDocuments('warehouseItems', affectedItems);
      setWarehouseItems((prev) =>
        prev.map((i) => (i.category === oldName ? { ...i, category: cleanNew, updatedAt: nowIso } : i))
      );
    }

    logActivity(
      'SYSTEM_EVENT',
      `Renamed warehouse category "${oldName}" to "${cleanNew}" (${affectedItems.length} item(s) updated).`,
      'Warehouse'
    );
  };

  const handleDeleteWarehouseCategory = async (categoryId: string) => {
    const target = warehouseCategories.find((c) => c.id === categoryId);
    await removeDocument('warehouseCategories', categoryId);
    setWarehouseCategories((prev) => prev.filter((c) => c.id !== categoryId));
    if (target) {
      logActivity('SYSTEM_EVENT', `Deleted warehouse category "${target.name}".`, 'Warehouse');
    }
  };

  // Warehouse Inventory & Stock Transfer (STR) Handlers
  const handleAddWarehouseItem = async (
    itemData: Omit<WarehouseInventoryItem, 'id' | 'updatedAt' | 'updatedBy'>,
    initialRefNumber?: string,
    notes?: string
  ) => {
    const nowIso = new Date().toISOString();
    const today = nowIso.slice(0, 10);
    const performer = currentUser?.name || 'Warehouse Staff';
    const resolvedItemCode =
      (itemData.itemCode || '').trim() ||
      findStockReferenceByDescription(
        itemData.description,
        warehouseItems,
        itemData.branchCode
      )?.itemCode ||
      '';
    const newItem: WarehouseInventoryItem = {
      ...itemData,
      itemCode: resolvedItemCode || undefined,
      id: `wh-${itemData.branchCode.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      updatedAt: nowIso,
      updatedBy: performer,
    };

    await saveDocument('warehouseItems', newItem);
    setWarehouseItems((prev) => [...prev, newItem]);

    if (newItem.quantity > 0) {
      const initialMovement: StockMovementEntry = {
        id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        date: today,
        timestamp: nowIso,
        movementType: 'STOCK_IN',
        status: 'COMPLETED',
        branchCode: newItem.branchCode,
        branchName: newItem.branchName,
        itemId: newItem.id,
        itemCode: newItem.itemCode,
        description: newItem.description,
        category: newItem.category,
        batchNo: newItem.batchNo,
        uom: newItem.uom,
        unitPrice: newItem.unitPrice,
        quantity: newItem.quantity,
        previousQty: 0,
        newQty: newItem.quantity,
        refNumber: initialRefNumber || `INIT-${newItem.branchCode}`,
        performedBy: performer,
        notes: notes || 'Initial stock item creation',
      };
      await saveDocument('stockMovements', initialMovement);
      setStockMovements((prev) => [initialMovement, ...prev]);
    }

    logActivity(
      'SYSTEM_EVENT',
      `Added warehouse SKU "${newItem.description}" (${newItem.quantity} ${newItem.uom}) to ${newItem.branchName}.`,
      'Warehouse'
    );
  };

  const handleUpdateWarehouseItem = async (updatedItem: WarehouseInventoryItem) => {
    const existing = warehouseItems.find((i) => i.id === updatedItem.id);
    const sanitizedItem: WarehouseInventoryItem =
      currentUser?.role === 'ADMIN'
        ? updatedItem
        : {
            ...updatedItem,
            quantity: existing?.quantity ?? updatedItem.quantity,
          };
    await saveDocument('warehouseItems', sanitizedItem);
    setWarehouseItems((prev) =>
      prev.map((i) => (i.id === sanitizedItem.id ? sanitizedItem : i))
    );
    logActivity(
      'SYSTEM_EVENT',
      `Updated stock item "${sanitizedItem.description}" at ${sanitizedItem.branchName}.`,
      'Warehouse'
    );
  };

  const handleDeleteWarehouseItem = async (itemId: string) => {
    const target = warehouseItems.find((i) => i.id === itemId);
    await removeDocument('warehouseItems', itemId);
    setWarehouseItems((prev) => prev.filter((i) => i.id !== itemId));
    if (target) {
      logActivity(
        'SYSTEM_EVENT',
        `Deleted stock item "${target.description}" from ${target.branchName}.`,
        'Warehouse'
      );
    }
  };

  const handleSeedBranchCatalog = async (branchCode: WarehouseBranchCode) => {
    const performer = currentUser?.name || 'System Admin';
    const branch = getBranchByCode(branchCode);
    const catalogItems = buildDefaultCatalogItemsForBranch(branchCode, performer, false);
    const existingKeys = new Set(
      warehouseItems
        .filter((i) => i.branchCode === branchCode)
        .map((i) => `${(i.itemCode || '').toLowerCase()}::${i.description.toLowerCase()}`)
    );
    const newItems = catalogItems.filter(
      (i) => !existingKeys.has(`${(i.itemCode || '').toLowerCase()}::${i.description.toLowerCase()}`)
    );
    if (newItems.length > 0) {
      await saveDocuments('warehouseItems', newItems);
      setWarehouseItems((prev) => [...prev, ...newItems]);
      logActivity(
        'SYSTEM_EVENT',
        `Seeded ${newItems.length} default catalog items to ${branch?.name || branchCode}.`,
        'Warehouse'
      );
    }
  };

  const handleAutoFillMissingItemCodes = async (): Promise<number> => {
    if (currentUser?.role !== 'ADMIN') return 0;
    const nowIso = new Date().toISOString();
    const performer = currentUser.name || 'Super Admin';
    const updates: WarehouseInventoryItem[] = [];
    const updatedById = new Map<string, WarehouseInventoryItem>();

    warehouseItems.forEach((item) => {
      if ((item.itemCode || '').trim()) return;
      const match = findStockReferenceByDescription(
        item.description,
        warehouseItems,
        item.branchCode
      );
      if (match?.itemCode) {
        const updatedDoc: WarehouseInventoryItem = {
          ...item,
          itemCode: match.itemCode,
          updatedAt: nowIso,
          updatedBy: performer,
        };
        updates.push(updatedDoc);
        updatedById.set(item.id, updatedDoc);
      }
    });

    if (updates.length > 0) {
      await saveDocuments('warehouseItems', updates);
      setWarehouseItems((prev) => prev.map((i) => updatedById.get(i.id) || i));
      logActivity(
        'SYSTEM_EVENT',
        `Auto-filled missing stock item codes for ${updates.length} item(s).`,
        'Warehouse'
      );
    }

    return updates.length;
  };

  const handleBulkImportWarehouseItems = async (params: {
    items: Array<{
      existingId?: string;
      item: Omit<WarehouseInventoryItem, 'id' | 'updatedAt' | 'updatedBy'>;
    }>;
    refNumber?: string;
  }): Promise<{ createdCount: number; updatedCount: number; categoriesAdded: number }> => {
    if (currentUser?.role !== 'ADMIN') {
      return { createdCount: 0, updatedCount: 0, categoriesAdded: 0 };
    }

    const nowIso = new Date().toISOString();
    const today = nowIso.slice(0, 10);
    const compactDate = today.replace(/-/g, '');
    const performer = currentUser.name || 'Super Admin';
    const importRef = params.refNumber?.trim() || `IMP-${compactDate}`;

    // 1. Register any new categories encountered in import
    const existingCatNames = new Set(
      warehouseCategories.map((c) => c.name.trim().toUpperCase())
    );
    let nextSortOrder = warehouseCategories.reduce(
      (max, c) => Math.max(max, c.sortOrder || 0),
      0
    );
    const newCategoryDocs: WarehouseCategory[] = [];
    params.items.forEach(({ item }) => {
      const catUpper = (item.category || '').trim().toUpperCase();
      if (catUpper && !existingCatNames.has(catUpper)) {
        existingCatNames.add(catUpper);
        nextSortOrder += 1;
        newCategoryDocs.push({
          id: `cat-${Date.now()}-${nextSortOrder}-${Math.random().toString(36).slice(2, 5)}`,
          name: catUpper,
          sortOrder: nextSortOrder,
          updatedAt: nowIso,
          updatedBy: performer,
        });
      }
    });

    // 2. Build inventory creations/updates and ledger movements
    const existingMap = new Map<string, WarehouseInventoryItem>();
    warehouseItems.forEach((w) => existingMap.set(w.id, w));

    const docsToSave: WarehouseInventoryItem[] = [];
    const createdIds = new Set<string>();
    const updatedMap = new Map<string, WarehouseInventoryItem>();
    const newMovements: StockMovementEntry[] = [];
    let createdCount = 0;
    let updatedCount = 0;

    params.items.forEach((entry, idx) => {
      const normalizedCat = (entry.item.category || 'GENERAL').trim().toUpperCase();
      if (entry.existingId && existingMap.has(entry.existingId)) {
        const prevItem = existingMap.get(entry.existingId)!;
        const nextQty = Number(entry.item.quantity) || 0;
        const prevQty = Number(prevItem.quantity) || 0;
        const updatedDoc: WarehouseInventoryItem = {
          ...prevItem,
          ...entry.item,
          category: normalizedCat,
          updatedAt: nowIso,
          updatedBy: performer,
        };
        docsToSave.push(updatedDoc);
        updatedMap.set(updatedDoc.id, updatedDoc);
        updatedCount += 1;

        if (nextQty !== prevQty) {
          const isIn = nextQty > prevQty;
          const diff = Math.abs(nextQty - prevQty);
          newMovements.push({
            id: `mov-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
            date: today,
            timestamp: nowIso,
            movementType: isIn ? 'STOCK_IN' : 'STOCK_OUT',
            status: 'COMPLETED',
            branchCode: updatedDoc.branchCode,
            branchName: updatedDoc.branchName,
            fromBranchCode: isIn ? undefined : updatedDoc.branchCode,
            fromBranchName: isIn ? 'Bulk Import Adjustment' : updatedDoc.branchName,
            toBranchCode: isIn ? updatedDoc.branchCode : undefined,
            toBranchName: isIn ? updatedDoc.branchName : 'Bulk Import Adjustment',
            itemId: updatedDoc.id,
            itemCode: updatedDoc.itemCode,
            description: updatedDoc.description,
            category: updatedDoc.category,
            batchNo: updatedDoc.batchNo,
            uom: updatedDoc.uom,
            unitPrice: updatedDoc.unitPrice,
            quantity: diff,
            previousQty: prevQty,
            newQty: nextQty,
            refNumber: importRef,
            performedBy: performer,
            notes: 'Updated via Super Admin Stock Import',
          });
        }
      } else {
        const newId = `wh-${entry.item.branchCode.toLowerCase()}-${Date.now()}-${idx}-${Math.random()
          .toString(36)
          .slice(2, 6)}`;
        const newQty = Number(entry.item.quantity) || 0;
        const resolvedNewCode =
          (entry.item.itemCode || '').trim() ||
          findStockReferenceByDescription(
            entry.item.description,
            warehouseItems,
            entry.item.branchCode
          )?.itemCode ||
          undefined;
        const newDoc: WarehouseInventoryItem = {
          ...entry.item,
          itemCode: resolvedNewCode,
          category: normalizedCat,
          id: newId,
          updatedAt: nowIso,
          updatedBy: performer,
        };
        docsToSave.push(newDoc);
        createdIds.add(newId);
        createdCount += 1;

        if (newQty > 0) {
          newMovements.push({
            id: `mov-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
            date: today,
            timestamp: nowIso,
            movementType: 'STOCK_IN',
            status: 'COMPLETED',
            branchCode: newDoc.branchCode,
            branchName: newDoc.branchName,
            fromBranchName: 'Bulk Stock Import',
            toBranchCode: newDoc.branchCode,
            toBranchName: newDoc.branchName,
            itemId: newDoc.id,
            itemCode: newDoc.itemCode,
            description: newDoc.description,
            category: newDoc.category,
            batchNo: newDoc.batchNo,
            uom: newDoc.uom,
            unitPrice: newDoc.unitPrice,
            quantity: newQty,
            previousQty: 0,
            newQty,
            refNumber: importRef,
            performedBy: performer,
            notes: 'Quick-added via Super Admin Stock Import',
          });
        }
      }
    });

    if (newCategoryDocs.length > 0) {
      await saveDocuments('warehouseCategories', newCategoryDocs);
      setWarehouseCategories((prev) => [...prev, ...newCategoryDocs]);
    }
    if (docsToSave.length > 0) {
      await saveDocuments('warehouseItems', docsToSave);
      setWarehouseItems((prev) => {
        const merged = prev.map((item) => updatedMap.get(item.id) || item);
        const createdDocs = docsToSave.filter((d) => createdIds.has(d.id));
        return [...merged, ...createdDocs];
      });
    }
    if (newMovements.length > 0) {
      await saveDocuments('stockMovements', newMovements);
      setStockMovements((prev) => [...newMovements, ...prev]);
    }

    logActivity(
      'SYSTEM_EVENT',
      `Imported stock items (${createdCount} added, ${updatedCount} updated, ${newCategoryDocs.length} new categories). Ref: ${importRef}.`,
      'Warehouse'
    );

    return {
      createdCount,
      updatedCount,
      categoriesAdded: newCategoryDocs.length,
    };
  };

  const handleRecordStockMovement = async (params: {
    itemId: string;
    movementType: 'STOCK_IN' | 'STOCK_OUT';
    quantity: number;
    refNumber: string;
    date: string;
    notes?: string;
  }) => {
    if (currentUser?.role !== 'ADMIN') return;
    const targetItem = warehouseItems.find((i) => i.id === params.itemId);
    if (!targetItem) return;

    const nowIso = new Date().toISOString();
    const performer = currentUser?.name || 'Warehouse Staff';
    const prevQty = Number(targetItem.quantity) || 0;
    const delta = Number(params.quantity) || 0;
    const nextQty =
      params.movementType === 'STOCK_IN'
        ? prevQty + delta
        : Math.max(0, prevQty - delta);

    const updatedItem: WarehouseInventoryItem = {
      ...targetItem,
      quantity: nextQty,
      updatedAt: nowIso,
      updatedBy: performer,
    };

    const movement: StockMovementEntry = {
      id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      date: params.date || nowIso.slice(0, 10),
      timestamp: nowIso,
      movementType: params.movementType,
      status: 'COMPLETED',
      branchCode: targetItem.branchCode,
      branchName: targetItem.branchName,
      fromBranchCode: params.movementType === 'STOCK_OUT' ? targetItem.branchCode : undefined,
      fromBranchName: params.movementType === 'STOCK_OUT' ? targetItem.branchName : 'Supplier / Stock In',
      toBranchCode: params.movementType === 'STOCK_IN' ? targetItem.branchCode : undefined,
      toBranchName: params.movementType === 'STOCK_IN' ? targetItem.branchName : 'Store Usage / Out',
      itemId: targetItem.id,
      itemCode: targetItem.itemCode,
      description: targetItem.description,
      category: targetItem.category,
      batchNo: targetItem.batchNo,
      uom: targetItem.uom,
      unitPrice: targetItem.unitPrice,
      quantity: delta,
      previousQty: prevQty,
      newQty: nextQty,
      refNumber: params.refNumber,
      performedBy: performer,
      notes: params.notes,
    };

    await saveDocument('warehouseItems', updatedItem);
    await saveDocument('stockMovements', movement);

    setWarehouseItems((prev) =>
      prev.map((i) => (i.id === updatedItem.id ? updatedItem : i))
    );
    setStockMovements((prev) => [movement, ...prev]);

    logActivity(
      'SYSTEM_EVENT',
      `Recorded ${params.movementType === 'STOCK_IN' ? 'Stock In' : 'Stock Out'} of ${delta} ${targetItem.uom} for "${targetItem.description}" at ${targetItem.branchName} (Ref: ${params.refNumber}).`,
      'Warehouse'
    );
  };

  const handleCreateStockTransfer = async (
    transferInput: Omit<
      StockTransferRequisition,
      'id' | 'createdAt' | 'createdByUserId' | 'status'
    >
  ): Promise<StockTransferRequisition> => {
    const nowIso = new Date().toISOString();
    const performer = currentUser?.name || transferInput.preparedBy || 'Warehouse Staff';
    const cleanReviewer =
      currentUser?.role === 'ADMIN' ? (transferInput.reviewedBy || '').trim() : '';

    const newTransfer: StockTransferRequisition = {
      ...transferInput,
      id: `str-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      reviewedBy: cleanReviewer,
      reviewedAt: cleanReviewer ? nowIso : undefined,
      reviewedByUserId: cleanReviewer ? currentUser?.id : undefined,
      receivedBy: '',
      status: 'PENDING',
      createdAt: nowIso,
      createdByUserId: currentUser?.id,
    };

    const workingInventory = [...warehouseItems];
    const itemsToSaveMap = new Map<string, WarehouseInventoryItem>();
    const newMovements: StockMovementEntry[] = [];
    const isFromMonitored = isMonitoredWarehouseBranch(transferInput.fromBranchCode);

    transferInput.items.forEach((line, lineIndex) => {
      const qty = Number(line.quantity) || 0;
      if (qty <= 0) return;

      // Deduct from Issuing (From) Branch immediately on dispatch if it is a monitored warehouse branch
      const issuingIdx = isFromMonitored
        ? workingInventory.findIndex(
            (i) =>
              (line.itemId &&
                i.id === line.itemId &&
                i.branchCode === transferInput.fromBranchCode) ||
              (i.branchCode === transferInput.fromBranchCode &&
                (i.description || '').toLowerCase() === (line.description || '').toLowerCase() &&
                (i.batchNo || '').toLowerCase() === (line.batchNo || '').toLowerCase())
          )
        : -1;

      let issuingPrevQty = 0;
      let issuingNewQty = 0;
      let issuingItemId =
        line.itemId ||
        `wh-${transferInput.fromBranchCode.toLowerCase()}-${Date.now()}-${lineIndex}`;

      let issuingItemCode =
        (line.itemCode || '').trim() ||
        findStockReferenceByDescription(
          line.description,
          workingInventory,
          transferInput.fromBranchCode
        )?.itemCode ||
        undefined;

      if (issuingIdx >= 0) {
        const existingIssuing = workingInventory[issuingIdx];
        issuingPrevQty = Number(existingIssuing.quantity) || 0;
        issuingNewQty = Math.max(0, issuingPrevQty - qty);
        issuingItemId = existingIssuing.id;
        issuingItemCode = (existingIssuing.itemCode || '').trim() || issuingItemCode;

        const updatedIssuing: WarehouseInventoryItem = {
          ...existingIssuing,
          itemCode: existingIssuing.itemCode || issuingItemCode,
          quantity: issuingNewQty,
          updatedAt: nowIso,
          updatedBy: performer,
        };
        workingInventory[issuingIdx] = updatedIssuing;
        itemsToSaveMap.set(updatedIssuing.id, updatedIssuing);
      }

      newMovements.push({
        id: `mov-tout-${Date.now()}-${lineIndex}-${Math.random().toString(36).slice(2, 5)}`,
        date: transferInput.date,
        timestamp: nowIso,
        movementType: 'TRANSFER_OUT',
        status: 'PENDING',
        branchCode: transferInput.fromBranchCode,
        branchName: transferInput.fromBranchName,
        counterpartyBranchCode: transferInput.toBranchCode,
        counterpartyBranchName: transferInput.toBranchName,
        fromBranchCode: transferInput.fromBranchCode,
        fromBranchName: transferInput.fromBranchName,
        toBranchCode: transferInput.toBranchCode,
        toBranchName: transferInput.toBranchName,
        itemId: issuingItemId,
        itemCode: issuingItemCode,
        description: line.description,
        category: line.category,
        batchNo: line.batchNo || 'GENERAL',
        uom: line.uom,
        unitPrice: Number(line.unitPrice) || 0,
        quantity: qty,
        previousQty: issuingPrevQty,
        newQty: issuingNewQty,
        refNumber: transferInput.strRefNumber,
        transferNumber: transferInput.transferNumber,
        performedBy: performer,
        notes: transferInput.remarks || `Dispatched to ${transferInput.toBranchName} (Pending Receipt)`,
      });
    });

    await saveDocuments('warehouseItems', Array.from(itemsToSaveMap.values()));
    await saveDocuments('stockMovements', newMovements);
    await saveDocument('stockTransfers', newTransfer);

    setWarehouseItems(workingInventory);
    setStockMovements((prev) => [...newMovements, ...prev]);
    setStockTransfers((prev) => [newTransfer, ...prev]);

    logActivity(
      'SYSTEM_EVENT',
      `Created PENDING STR ${newTransfer.strRefNumber} (${newTransfer.transferNumber}) from ${newTransfer.fromBranchName} to ${newTransfer.toBranchName}${cleanReviewer ? ` · Reviewed by ${cleanReviewer}` : ''}.`,
      'Warehouse'
    );

    return newTransfer;
  };

  const handleApproveReviewStockTransfer = async (
    transferId: string,
    cancelledItemIds: string[] = [],
    cancelReasons: Record<string, string> = {}
  ) => {
    if (currentUser?.role !== 'ADMIN') return;
    const target = stockTransfers.find((t) => t.id === transferId);
    if (!target) return;

    const nowIso = new Date().toISOString();
    const todayDate = nowIso.slice(0, 10);
    const reviewer = currentUser?.name || 'Super Admin';
    const cancelledSet = new Set(cancelledItemIds);

    const workingInventory = [...warehouseItems];
    const itemsToSaveMap = new Map<string, WarehouseInventoryItem>();
    const newMovements: StockMovementEntry[] = [];
    const updatedMovementsMap = new Map<string, StockMovementEntry>();
    const isFromMonitored = isMonitoredWarehouseBranch(target.fromBranchCode);

    const updatedItems: StockTransferLineItem[] = (target.items || []).map((line, lineIndex) => {
      const lineKey = line.id || `line-idx-${lineIndex}`;
      const isCancelled = cancelledSet.has(lineKey);
      const wasAlreadyCancelled = line.itemStatus === 'CANCELLED';
      const reasonText = isCancelled
        ? (cancelReasons[lineKey] || '').trim() || 'Not available in inventory'
        : undefined;

      const origOutMov =
        stockMovements.find(
          (m) =>
            m.movementType === 'TRANSFER_OUT' &&
            m.refNumber === target.strRefNumber &&
            m.transferNumber === target.transferNumber &&
            m.branchCode === target.fromBranchCode &&
            (m.description || '').toLowerCase() === (line.description || '').toLowerCase() &&
            (m.batchNo || '').toLowerCase() === (line.batchNo || 'GENERAL').toLowerCase()
        ) ||
        stockMovements.find(
          (m) =>
            m.movementType === 'TRANSFER_OUT' &&
            m.refNumber === target.strRefNumber &&
            m.transferNumber === target.transferNumber &&
            m.branchCode === target.fromBranchCode &&
            (m.description || '').toLowerCase() === (line.description || '').toLowerCase()
        );

      if (origOutMov && isCancelled) {
        updatedMovementsMap.set(origOutMov.id, {
          ...origOutMov,
          status: 'CANCELLED',
        });
      }

      if (isCancelled && !wasAlreadyCancelled && isFromMonitored) {
        const deductedQty = origOutMov
          ? Math.max(0, (Number(origOutMov.previousQty) || 0) - (Number(origOutMov.newQty) || 0))
          : 0;

        if (deductedQty > 0) {
          const issuingIdx = workingInventory.findIndex(
            (i) =>
              (line.itemId && i.id === line.itemId && i.branchCode === target.fromBranchCode) ||
              (i.branchCode === target.fromBranchCode &&
                (i.description || '').toLowerCase() === (line.description || '').toLowerCase() &&
                (i.batchNo || '').toLowerCase() === (line.batchNo || '').toLowerCase())
          );

          if (issuingIdx >= 0) {
            const existingIssuing = workingInventory[issuingIdx];
            const prevQty = Number(existingIssuing.quantity) || 0;
            const newQty = prevQty + deductedQty;
            const restoredItem: WarehouseInventoryItem = {
              ...existingIssuing,
              quantity: newQty,
              updatedAt: nowIso,
              updatedBy: reviewer,
            };
            workingInventory[issuingIdx] = restoredItem;
            itemsToSaveMap.set(restoredItem.id, restoredItem);

            newMovements.push({
              id: `mov-ret-${Date.now()}-${lineIndex}-${Math.random().toString(36).slice(2, 5)}`,
              date: todayDate,
              timestamp: nowIso,
              movementType: 'STOCK_IN',
              status: 'CANCELLED',
              branchCode: target.fromBranchCode,
              branchName: target.fromBranchName,
              fromBranchCode: target.toBranchCode,
              fromBranchName: `${target.toBranchName} (STR Cancelled Item)`,
              toBranchCode: target.fromBranchCode,
              toBranchName: target.fromBranchName,
              itemId: restoredItem.id,
              itemCode: restoredItem.itemCode || line.itemCode,
              description: line.description,
              category: line.category,
              batchNo: line.batchNo || 'GENERAL',
              uom: line.uom,
              unitPrice: line.unitPrice,
              quantity: deductedQty,
              previousQty: prevQty,
              newQty,
              refNumber: target.strRefNumber,
              transferNumber: target.transferNumber,
              performedBy: reviewer,
              notes: `Item cancelled during Super Admin STR review (${reasonText})`,
            });
          }
        }
      }

      if (isCancelled) {
        return {
          ...line,
          id: lineKey,
          itemStatus: 'CANCELLED',
          cancelReason: reasonText,
        };
      }
      const { cancelReason: _removedReason, ...restLine } = line;
      return {
        ...restLine,
        id: lineKey,
        itemStatus: 'APPROVED',
      };
    });

    const allCancelled =
      updatedItems.length > 0 && updatedItems.every((item) => item.itemStatus === 'CANCELLED');
    const cancelledCount = updatedItems.filter((item) => item.itemStatus === 'CANCELLED').length;
    const approvedCount = updatedItems.length - cancelledCount;

    const updatedTransfer: StockTransferRequisition = {
      ...target,
      items: updatedItems,
      status: allCancelled ? 'CANCELLED' : target.status,
      reviewedBy: reviewer,
      reviewedAt: nowIso,
      reviewedByUserId: currentUser?.id,
    };

    const movementsToPersist = [...newMovements, ...Array.from(updatedMovementsMap.values())];
    if (itemsToSaveMap.size > 0) {
      await saveDocuments('warehouseItems', Array.from(itemsToSaveMap.values()));
      setWarehouseItems(workingInventory);
    }
    if (movementsToPersist.length > 0) {
      await saveDocuments('stockMovements', movementsToPersist);
      setStockMovements((prev) => [
        ...newMovements,
        ...prev.map((m) => updatedMovementsMap.get(m.id) || m),
      ]);
    }
    await saveDocument('stockTransfers', updatedTransfer);
    setStockTransfers((prev) =>
      prev.map((t) => (t.id === transferId ? updatedTransfer : t))
    );

    logActivity(
      'SYSTEM_EVENT',
      `Super Admin ${reviewer} reviewed STR ${target.strRefNumber} (${target.fromBranchName} → ${target.toBranchName}): ${approvedCount} approved, ${cancelledCount} cancelled${allCancelled ? ' (STR CANCELLED)' : ''}.`,
      'Warehouse'
    );
  };

  const handleMarkStockTransferReceived = async (transferId: string) => {
    const target = stockTransfers.find((t) => t.id === transferId);
    if (!target || target.status !== 'PENDING') return;

    const nowIso = new Date().toISOString();
    const todayDate = nowIso.slice(0, 10);
    const receiverName = currentUser?.name || 'System User';

    const workingInventory = [...warehouseItems];
    const itemsToSaveMap = new Map<string, WarehouseInventoryItem>();
    const newMovements: StockMovementEntry[] = [];
    const updatedMovementsMap = new Map<string, StockMovementEntry>();
    const isToMonitored = isMonitoredWarehouseBranch(target.toBranchCode);

    (target.items || []).forEach((line, lineIndex) => {
      if (line.itemStatus === 'CANCELLED') return;
      const qty = Number(line.quantity) || 0;
      if (qty <= 0) return;

      const matchingOutMov = stockMovements.find(
        (m) =>
          m.movementType === 'TRANSFER_OUT' &&
          m.refNumber === target.strRefNumber &&
          m.transferNumber === target.transferNumber &&
          (m.description || '').toLowerCase() === (line.description || '').toLowerCase()
      );
      if (matchingOutMov && matchingOutMov.status !== 'CANCELLED') {
        updatedMovementsMap.set(matchingOutMov.id, {
          ...matchingOutMov,
          status: 'RECEIVED',
        });
      }

      const sourceItem = workingInventory.find(
        (i) =>
          (line.itemId && i.id === line.itemId) ||
          (i.branchCode === target.fromBranchCode &&
            (i.description || '').toLowerCase() === (line.description || '').toLowerCase() &&
            (i.batchNo || '').toLowerCase() === (line.batchNo || '').toLowerCase())
      );

      let receivingPrevQty = 0;
      let receivingNewQty = qty;
      let receivingItemId =
        line.itemId ||
        `store-${target.toBranchCode.toLowerCase()}-${Date.now()}-${lineIndex}`;

      const resolvedLineCode =
        (line.itemCode || '').trim() ||
        (sourceItem?.itemCode || '').trim() ||
        findStockReferenceByDescription(
          line.description,
          workingInventory,
          target.fromBranchCode
        )?.itemCode ||
        findStockReferenceByCode(
          line.itemCode || '',
          workingInventory,
          target.fromBranchCode
        )?.itemCode ||
        undefined;

      if (isToMonitored) {
        const receivingIdx = workingInventory.findIndex(
          (i) =>
            i.branchCode === target.toBranchCode &&
            (i.description || '').toLowerCase() === (line.description || '').toLowerCase() &&
            (i.batchNo || '').toLowerCase() === (line.batchNo || '').toLowerCase()
        );

        if (receivingIdx >= 0) {
          const existingReceiving = workingInventory[receivingIdx];
          receivingPrevQty = Number(existingReceiving.quantity) || 0;
          receivingNewQty = receivingPrevQty + qty;
          receivingItemId = existingReceiving.id;

          const updatedReceiving: WarehouseInventoryItem = {
            ...existingReceiving,
            itemCode: existingReceiving.itemCode || resolvedLineCode,
            quantity: receivingNewQty,
            unitPrice: line.unitPrice || existingReceiving.unitPrice,
            updatedAt: nowIso,
            updatedBy: receiverName,
          };
          workingInventory[receivingIdx] = updatedReceiving;
          itemsToSaveMap.set(updatedReceiving.id, updatedReceiving);
        } else {
          receivingItemId = `wh-${target.toBranchCode.toLowerCase()}-${Date.now()}-${lineIndex}-${Math.random().toString(36).slice(2, 5)}`;
          const createdReceiving: WarehouseInventoryItem = {
            id: receivingItemId,
            itemCode: resolvedLineCode,
            description: line.description,
            category: line.category,
            batchNo: line.batchNo || 'GENERAL',
            uom: line.uom,
            unitPrice: line.unitPrice || 0,
            branchCode: target.toBranchCode,
            branchName: target.toBranchName,
            quantity: receivingNewQty,
            reorderLevel: 2,
            updatedAt: nowIso,
            updatedBy: receiverName,
          };
          workingInventory.push(createdReceiving);
          itemsToSaveMap.set(createdReceiving.id, createdReceiving);
        }
      }

      newMovements.push({
        id: `mov-tin-${Date.now()}-${lineIndex}-${Math.random().toString(36).slice(2, 5)}`,
        date: todayDate,
        timestamp: nowIso,
        movementType: 'TRANSFER_IN',
        status: 'RECEIVED',
        branchCode: target.toBranchCode,
        branchName: target.toBranchName,
        counterpartyBranchCode: target.fromBranchCode,
        counterpartyBranchName: target.fromBranchName,
        fromBranchCode: target.fromBranchCode,
        fromBranchName: target.fromBranchName,
        toBranchCode: target.toBranchCode,
        toBranchName: target.toBranchName,
        itemId: receivingItemId,
        itemCode: resolvedLineCode,
        description: line.description,
        category: line.category,
        batchNo: line.batchNo || 'GENERAL',
        uom: line.uom,
        unitPrice: line.unitPrice,
        quantity: qty,
        previousQty: receivingPrevQty,
        newQty: receivingNewQty,
        refNumber: target.strRefNumber,
        transferNumber: target.transferNumber,
        performedBy: receiverName,
        notes:
          target.remarks ||
          (isToMonitored
            ? `Marked received from ${target.fromBranchName}`
            : `Received at store branch ${target.toBranchName} (unmonitored inventory)`),
      });
    });

    const updatedTransfer: StockTransferRequisition = {
      ...target,
      status: 'RECEIVED',
      receivedBy: receiverName,
      receivedAt: nowIso,
      receivedByUserId: currentUser?.id,
      receivedByRole: currentUser?.role,
    };

    const movementsToPersist = [...newMovements, ...Array.from(updatedMovementsMap.values())];
    await saveDocuments('warehouseItems', Array.from(itemsToSaveMap.values()));
    await saveDocuments('stockMovements', movementsToPersist);
    await saveDocument('stockTransfers', updatedTransfer);

    setWarehouseItems(workingInventory);
    setStockMovements((prev) => [
      ...newMovements,
      ...prev.map((m) => updatedMovementsMap.get(m.id) || m),
    ]);
    setStockTransfers((prev) =>
      prev.map((t) => (t.id === transferId ? updatedTransfer : t))
    );

    logActivity(
      'SYSTEM_EVENT',
      `Marked STR ${target.strRefNumber} (${target.fromBranchName} → ${target.toBranchName}) as RECEIVED by ${receiverName}.`,
      'Warehouse'
    );
  };

  // Super Admin Stock Movement Ledger CRUD Handlers
  const handleAddLedgerEntry = async (
    entryData: Omit<StockMovementEntry, 'id' | 'timestamp'>
  ) => {
    if (currentUser?.role !== 'ADMIN') return;
    const nowIso = new Date().toISOString();
    const newEntry: StockMovementEntry = {
      ...entryData,
      id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: nowIso,
    };
    await saveDocument('stockMovements', newEntry);
    setStockMovements((prev) => [newEntry, ...prev]);
    logActivity(
      'SYSTEM_EVENT',
      `Added ledger entry ${newEntry.refNumber} (${newEntry.movementType}) for "${newEntry.description}" at ${newEntry.branchName}.`,
      'Warehouse'
    );
  };

  const handleUpdateLedgerEntry = async (updatedEntry: StockMovementEntry) => {
    if (currentUser?.role !== 'ADMIN') return;
    await saveDocument('stockMovements', updatedEntry);
    setStockMovements((prev) =>
      prev.map((m) => (m.id === updatedEntry.id ? updatedEntry : m))
    );
    logActivity(
      'SYSTEM_EVENT',
      `Updated ledger entry ${updatedEntry.refNumber} for "${updatedEntry.description}".`,
      'Warehouse'
    );
  };

  const handleDeleteLedgerEntry = async (entryId: string) => {
    if (currentUser?.role !== 'ADMIN') return;
    const target = stockMovements.find((m) => m.id === entryId);
    await removeDocument('stockMovements', entryId);
    setStockMovements((prev) => prev.filter((m) => m.id !== entryId));
    if (target) {
      logActivity(
        'SYSTEM_EVENT',
        `Deleted ledger entry ${target.refNumber} (${target.description}).`,
        'Warehouse'
      );
    }
  };

  // Handle Google Sheets Sync Trigger
  const handleSyncGoogleSheets = async () => {
    const confirm = await showSyncConfirmAlert();
    if (!confirm.isConfirmed) return;

    setIsSyncing(true);
    const syncResult = await syncToGoogleSheets(
      summaries,
      users,
      punches,
      currentUser?.name || 'System User'
    );
    setIsSyncing(false);
    setCurrentSyncLog(syncResult);
    setShowSyncModal(true);
  };

  // If not logged in, render locked Access Control Login Screen
  if (!currentUser) {
    return <LoginScreen users={users} onLoginSuccess={handleLoginSuccess} />;
  }

  const pendingDisputesCount = disputes.filter((d) => d.status === 'PENDING').length;
  const pendingWarehouseAlertsCount = visibleAdminAlerts.filter(
    (a) => a.category === 'STR' || a.category === 'LOW_STOCK'
  ).length;
  const currentSheetsPayload = buildGoogleSheetsData(summaries, users, punches);

  const getDashboardRoleInfo = (role: UserRole) => {
    switch (role) {
      case 'ADMIN':
        return {
          title: 'EXECUTIVE OWNER & SYSTEM ADMIN DASHBOARD',
          subtitle: 'Full Control • Biometric File Auditing • Employee Management • Dispute Approvals',
          badge: 'ROLE: OWNER / EXECUTIVE ADMIN',
          icon: '👑',
        };
      case 'SHIFT_MANAGER':
        return {
          title: 'SHIFT MANAGER ATTENDANCE PORTAL',
          subtitle: 'Personal Punch Records • 8-Hour Daily Progress • Shift Breakdown • Dispute Filing',
          badge: 'ROLE: SHIFT MANAGER',
          icon: '👤',
        };
      case 'BRANCH_MANAGER':
        return {
          title: 'STORE OPERATIONS PORTAL',
          subtitle: 'Store Operations • Biometric ZKTeco File Uploads • Dispute Approvals & Shift Monitoring',
          badge: 'ROLE: BRANCH MANAGER',
          icon: '🏪',
        };
      case 'PAYROLL':
        const payrollPosUpper = (currentUser?.position || 'PAYROLL').toUpperCase();
        return {
          title: `${payrollPosUpper} DTR & EXPORT DASHBOARD`,
          subtitle: 'Biometric Attendance Logs • Employee DTR Records • Dispute Audits • Google Sheets Sync',
          badge: `POSITION: ${payrollPosUpper}`,
          icon: '💼',
        };
      case 'STAFF':
        return {
          title: 'STAFF EMPLOYEE ATTENDANCE & FLEXITIME PORTAL',
          subtitle: 'Personal Punch Records • 8-Hour Daily Progress • Shift Breakdown • Dispute Filing',
          badge: 'ROLE: STAFF EMPLOYEE',
          icon: '👤',
        };
    }
  };

  const roleInfo = currentUser ? getDashboardRoleInfo(currentUser.role) : null;
  const isMainDashboardTab =
    activeTab === 'overview' ||
    activeTab === 'dashboard' ||
    (currentUser?.role === 'ADMIN' && (activeTab === 'overview' || activeTab === 'logs')) ||
    (currentUser?.role === 'BRANCH_MANAGER' && (activeTab === 'branch-logs' || activeTab === 'dtr-logs')) ||
    (currentUser?.role === 'PAYROLL' && (activeTab === 'dtr-logs' || activeTab === 'daily-logs')) ||
    ((currentUser?.role === 'STAFF' || currentUser?.role === 'SHIFT_MANAGER') && activeTab === 'my-punches');

  return (
    <div className="min-h-screen bg-[#FAF9F5] text-zinc-900 flex flex-col font-sans overflow-x-clip">
      {/* Top Header Navigation */}
      <Header
        currentUser={currentUser}
        onLogout={handleLogout}
        onSyncGoogleSheets={handleSyncGoogleSheets}
        isSyncing={isSyncing}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        pendingDisputesCount={pendingDisputesCount}
        adminAlerts={visibleAdminAlerts}
        readAlertIds={readAlertIds}
        dismissedCount={dismissedAdminAlertsCount}
        onMarkAlertRead={handleMarkAlertRead}
        onDismissAlert={handleDismissAlert}
        onMarkAllAlertsRead={handleMarkAllAlertsRead}
        onRestoreDismissedAlerts={handleRestoreDismissedAlerts}
      />

      {/* Main Workspace Layout with Professional Sidebar */}
      {currentUser ? (
        <div className="flex-1 max-w-[1600px] w-full mx-auto flex flex-col md:flex-row min-w-0">
          {/* Dashboard Sidebar Component */}
          <Sidebar
            currentUser={currentUser}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            pendingDisputesCount={pendingDisputesCount}
            pendingCtoCount={ctoRequests.filter((r) => r.status === 'PENDING').length}
            pendingWarehouseCount={currentUser.role === 'ADMIN' ? pendingWarehouseAlertsCount : 0}
            onLogout={handleLogout}
            onSyncGoogleSheets={handleSyncGoogleSheets}
            isSyncing={isSyncing}
            onUpdatePin={(newPin) => handleUpdateUserPin(currentUser.id, newPin)}
          />

          {/* Main Content Workspace Area */}
          <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0 overflow-y-auto">
            {/* Prominent User Role Banner - Shown strictly on Main Dashboard tab */}
            {roleInfo && isMainDashboardTab && (
              <div className="mb-6 rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 p-5 border-2 border-zinc-950 shadow-md text-zinc-950 relative overflow-hidden">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-xl bg-zinc-950 text-amber-400 flex items-center justify-center text-2xl shadow-sm border border-amber-300 shrink-0">
                      {roleInfo.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-zinc-950 text-amber-400 tracking-wider uppercase border border-amber-400/30">
                          {roleInfo.badge}
                        </span>
                        <span className="text-xs font-bold text-zinc-900/80 uppercase tracking-wider">
                          LOGGED IN AS: <strong className="text-zinc-950">{currentUser.name}</strong> ({currentUser.position || currentUser.department})
                        </span>
                      </div>
                      <h2 className="text-xl sm:text-2xl font-black text-zinc-950 tracking-tight mt-0.5 uppercase">
                        {roleInfo.title}
                      </h2>
                      <p className="text-xs sm:text-sm font-semibold text-zinc-900/90 mt-0.5">
                        {roleInfo.subtitle}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'warehouse-inventory' &&
            (currentUser.role === 'ADMIN' ||
              currentUser.role === 'BRANCH_MANAGER' ||
              currentUser.role === 'PAYROLL' ||
              currentUser.role === 'SHIFT_MANAGER' ||
              currentUser.role === 'STAFF') ? (
              <WarehouseInventoryDashboard
                currentUser={currentUser}
                categories={warehouseCategories}
                inventoryItems={warehouseItems}
                stockMovements={stockMovements}
                stockTransfers={stockTransfers}
                onAddCategory={handleAddWarehouseCategory}
                onUpdateCategory={handleUpdateWarehouseCategory}
                onDeleteCategory={handleDeleteWarehouseCategory}
                onAddInventoryItem={handleAddWarehouseItem}
                onUpdateInventoryItem={handleUpdateWarehouseItem}
                onDeleteInventoryItem={handleDeleteWarehouseItem}
                onSeedBranchCatalog={handleSeedBranchCatalog}
                onAutoFillMissingCodes={handleAutoFillMissingItemCodes}
                onBulkImportInventoryItems={handleBulkImportWarehouseItems}
                onRecordStockMovement={handleRecordStockMovement}
                onCreateStockTransfer={handleCreateStockTransfer}
                onReviewStockTransfer={handleApproveReviewStockTransfer}
                onMarkStockTransferReceived={handleMarkStockTransferReceived}
                onAddLedgerEntry={handleAddLedgerEntry}
                onUpdateLedgerEntry={handleUpdateLedgerEntry}
                onDeleteLedgerEntry={handleDeleteLedgerEntry}
              />
            ) : (
              <>
                {currentUser.role === 'ADMIN' && (
                  <AdminDashboard
                    users={users}
                    summaries={summaries}
                    disputes={disputes}
                    punches={punches}
                    ctoRequests={ctoRequests}
                    ctoAdjustments={ctoAdjustments}
                    schedules={schedules}
                    onSaveSchedule={handleSaveSchedule}
                    onUploadProcessed={handleUploadProcessed}
                    onUpdateSummaryAnomaly={handleUpdateSummaryAnomaly}
                    onApproveDispute={handleApproveDispute}
                    onRejectDispute={handleRejectDispute}
                    onSubmitDispute={handleSubmitDispute}
                    onApproveCtoRequest={handleApproveCtoRequest}
                    onRejectCtoRequest={handleRejectCtoRequest}
                    onAddUser={handleAddUser}
                    onUpdateUser={handleUpdateUser}
                    onDeleteUser={handleDeleteUser}
                    onDeleteDispute={handleDeleteDispute}
                    onDeleteSummary={handleDeleteSummary}
                    onClearSummaries={handleClearSummaries}
                    onDeleteCtoRequest={handleDeleteCtoRequest}
                    onSyncGoogleSheets={handleSyncGoogleSheets}
                    activityLogs={activityLogs}
                    onClearActivityLogs={handleClearActivityLogs}
                    activeTab={activeTab}
                    onNavigateTab={setActiveTab}
                    adminAlerts={visibleAdminAlerts}
                    readAlertIds={readAlertIds}
                    dismissedAlertCount={dismissedAdminAlertsCount}
                    onMarkAlertRead={handleMarkAlertRead}
                    onDismissAlert={handleDismissAlert}
                    onMarkAllAlertsRead={handleMarkAllAlertsRead}
                    onRestoreDismissedAlerts={handleRestoreDismissedAlerts}
                  />
                )}

                {(currentUser.role === 'STAFF' || currentUser.role === 'SHIFT_MANAGER') && (
                  <StaffDashboard
                    currentUser={currentUser}
                    users={users}
                    summaries={summaries}
                    disputes={disputes}
                    ctoRequests={ctoRequests}
                    ctoAdjustments={ctoAdjustments}
                    schedules={schedules}
                    onUpdateSummaryAnomaly={handleUpdateSummaryAnomaly}
                    onSubmitDispute={handleSubmitDispute}
                    onSubmitCtoRequest={handleSubmitCtoRequest}
                    activityLogs={activityLogs}
                    onClearActivityLogs={handleClearActivityLogs}
                    activeTab={activeTab}
                  />
                )}

                {currentUser.role === 'BRANCH_MANAGER' && (
                  <ManagerDashboard
                    currentUser={currentUser}
                    users={users}
                    summaries={summaries}
                    disputes={disputes}
                    punches={punches}
                    ctoRequests={ctoRequests}
                    ctoAdjustments={ctoAdjustments}
                    schedules={schedules}
                    onSaveSchedule={handleSaveSchedule}
                    onUploadProcessed={handleUploadProcessed}
                    onUpdateSummaryAnomaly={handleUpdateSummaryAnomaly}
                    onApproveDispute={handleApproveDispute}
                    onRejectDispute={handleRejectDispute}
                    onSubmitDispute={handleSubmitDispute}
                    onSubmitCtoRequest={handleSubmitCtoRequest}
                    onApproveCtoRequest={handleApproveCtoRequest}
                    onRejectCtoRequest={handleRejectCtoRequest}
                    onSyncGoogleSheets={handleSyncGoogleSheets}
                    activityLogs={activityLogs}
                    onClearActivityLogs={handleClearActivityLogs}
                    activeTab={activeTab}
                  />
                )}

                {currentUser.role === 'PAYROLL' && (
                  <PayrollDashboard
                    currentUser={currentUser}
                    users={users}
                    summaries={summaries}
                    disputes={disputes}
                    punches={punches}
                    ctoRequests={ctoRequests}
                    ctoAdjustments={ctoAdjustments}
                    schedules={schedules}
                    onSaveSchedule={handleSaveSchedule}
                    onUploadProcessed={handleUploadProcessed}
                    onUpdateSummaryAnomaly={handleUpdateSummaryAnomaly}
                    onApproveDispute={handleApproveDispute}
                    onRejectDispute={handleRejectDispute}
                    onSubmitDispute={handleSubmitDispute}
                    onApproveCtoRequest={handleApproveCtoRequest}
                    onRejectCtoRequest={handleRejectCtoRequest}
                    onAddCtoManualAdjustment={handleAddCtoManualAdjustment}
                    onSyncGoogleSheets={handleSyncGoogleSheets}
                    activityLogs={activityLogs}
                    onClearActivityLogs={handleClearActivityLogs}
                    activeTab={activeTab}
                  />
                )}
              </>
            )}
          </main>
        </div>
      ) : (
        <LoginScreen users={users} onLoginSuccess={handleLoginSuccess} />
      )}

      {/* Footer */}
      <footer className="bg-zinc-950 text-amber-400 border-t-2 border-amber-400 text-center text-xs font-semibold mt-auto">
        <YellowCabCheckerboard height="h-2" />
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            FBC Restaurants Corp • <strong>Yellow Cab Pizza Co.</strong>
          </span>
          <span className="text-zinc-400 text-[11px]">
            Biometric Attendance & Flexitime System • Confidential Internal Tool
          </span>
        </div>
      </footer>

      {/* Google Sheets Sync Modal */}
      <GoogleSheetsSyncModal
        isOpen={showSyncModal}
        onClose={() => setShowSyncModal(false)}
        syncLog={currentSyncLog}
        payload={currentSheetsPayload}
      />
    </div>
  );
}
