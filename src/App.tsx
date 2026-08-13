import React, { useState, useEffect } from 'react';
import {
  ActivityActionType,
  ActivityLog,
  AttendanceStatus,
  AttendanceSummaryDaily,
  BiometricPunch,
  CtoManualAdjustment,
  CtoRequest,
  DisputeRequest,
  SyncLog,
  User,
  UserRole,
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
import { GoogleSheetsSyncModal } from './components/GoogleSheetsSyncModal';
import { buildGoogleSheetsData, syncToGoogleSheets } from './utils/googleSheetsSync';
import { showSyncConfirmAlert } from './utils/sweetAlerts';
import { YellowCabCheckerboard } from './components/YellowCabBrand';
import {
  subscribeCollection,
  saveDocument,
  saveDocuments,
  removeDocument,
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

    return () => {
      unsubUsers();
      unsubSummaries();
      unsubPunches();
      unsubDisputes();
      unsubSchedules();
      unsubCtoReq();
      unsubCtoAdj();
      unsubActivity();
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
          weekday: new Date(target.date).toLocaleDateString('en-US', { weekday: 'long' }),
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
    (currentUser?.role === 'BRANCH_MANAGER' && activeTab === 'branch-logs') ||
    (currentUser?.role === 'PAYROLL' && (activeTab === 'dtr-logs' || activeTab === 'daily-logs')) ||
    ((currentUser?.role === 'STAFF' || currentUser?.role === 'SHIFT_MANAGER') && activeTab === 'my-punches');

  return (
    <div className="min-h-screen bg-[#FAF9F5] text-zinc-900 flex flex-col font-sans">
      {/* Top Header Navigation */}
      <Header
        currentUser={currentUser}
        onLogout={handleLogout}
        onSyncGoogleSheets={handleSyncGoogleSheets}
        isSyncing={isSyncing}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        pendingDisputesCount={pendingDisputesCount}
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
