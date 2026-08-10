import React, { useState } from 'react';
import {
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

export default function App() {
  // Authentication & Users State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>(INITIAL_USERS);

  // Attendance & Biometric State
  const [summaries, setSummaries] = useState<AttendanceSummaryDaily[]>(INITIAL_DAILY_SUMMARIES);
  const [punches, setPunches] = useState<BiometricPunch[]>(INITIAL_PUNCHES);
  const [disputes, setDisputes] = useState<DisputeRequest[]>(INITIAL_DISPUTES);

  // Work Schedule Roster State
  const [schedules, setSchedules] = useState<WorkSchedule[]>(INITIAL_SCHEDULES);

  // CTO State
  const [ctoRequests, setCtoRequests] = useState<CtoRequest[]>(INITIAL_CTO_REQUESTS);
  const [ctoAdjustments, setCtoAdjustments] = useState<CtoManualAdjustment[]>(INITIAL_CTO_ADJUSTMENTS);

  const handleUpdateSummaryAnomaly = (summaryId: string, newNote: string) => {
    setSummaries((prev) =>
      prev.map((s) => {
        if (s.id === summaryId) {
          return {
            ...s,
            anomalies: newNote.trim() ? [newNote.trim()] : [],
          };
        }
        return s;
      })
    );
  };

  const handleSaveSchedule = (updatedSchedule: WorkSchedule) => {
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

  // Login handler
  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    if (user.role === 'ADMIN') {
      setActiveTab('overview');
    } else if (user.role === 'BRANCH_MANAGER') {
      setActiveTab('dtr-logs');
    } else if (user.role === 'PAYROLL') {
      setActiveTab('payroll-summary');
    } else {
      setActiveTab('my-punches');
    }
  };

  // Logout handler
  const handleLogout = () => {
    setCurrentUser(null);
  };

  // Handle uploaded biometric file processing
  const handleUploadProcessed = (newSummaries: AttendanceSummaryDaily[]) => {
    // Merge new summaries with existing, overriding matching ID or date+empId
    setSummaries((prev) => {
      const map = new Map<string, AttendanceSummaryDaily>();
      prev.forEach((s) => map.set(`${s.employeeId}_${s.date}`, s));
      newSummaries.forEach((s) => map.set(`${s.employeeId}_${s.date}`, s));
      return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
    });
  };

  // Handle Dispute Approvals & Hours Recalculation
  const handleApproveDispute = (disputeId: string, adminNotes: string) => {
    const currentNow = new Date().toISOString().replace('T', ' ').substring(0, 19);

    setDisputes((prev) =>
      prev.map((d) =>
        d.id === disputeId
          ? {
              ...d,
              status: 'APPROVED',
              adminNotes,
              reviewedBy: currentUser?.name || 'Branch Manager / Admin',
              reviewedAt: currentNow,
              approvedAt: currentNow,
            }
          : d
      )
    );

    // Find the dispute to adjust the daily summary record
    const targetDispute = disputes.find((d) => d.id === disputeId);
    if (targetDispute) {
      const empUser = users.find((u) => u.employeeId === targetDispute.employeeId);
      const empName = targetDispute.employeeName || empUser?.name || 'Staff Member';
      const dept = empUser?.department || 'Operations';

      const targetDate = parseToYYYYMMDD(targetDispute.date);

      const existingSummary = summaries.find(
        (s) => s.employeeId === targetDispute.employeeId && parseToYYYYMMDD(s.date) === targetDate
      );

      const cat = targetDispute.category || targetDispute.type;

      let reqIn = existingSummary?.firstIn || '';
      let reqOut = existingSummary?.lastOut || '';
      let reqBreakOut = existingSummary?.breakOut || '';
      let reqBreakIn = existingSummary?.breakIn || '';

      if (cat === 'Time-in') {
        reqIn = targetDispute.requestedClockIn || reqIn || '08:00:00';
      } else if (cat === 'Time-out') {
        reqOut = targetDispute.requestedClockOut || reqOut || '17:00:00';
      } else if (cat === 'Break-out') {
        reqBreakOut = targetDispute.requestedBreakOut || reqBreakOut;
      } else if (cat === 'Break-in') {
        reqBreakIn = targetDispute.requestedBreakIn || reqBreakIn;
      } else if (cat === 'Full Shift') {
        reqIn = targetDispute.requestedClockIn || reqIn || '08:00:00';
        reqOut = targetDispute.requestedClockOut || reqOut || '17:00:00';
      }

      let reqHours = 0;
      let otHours = 0;
      let utHours = 0;
      let finalStatus: AttendanceStatus = 'ADJUSTED';

      if (reqIn && reqOut) {
        reqHours = targetDispute.requestedHours || calculateGrossHours(reqIn, reqOut) || 0;
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

      const reasonNote = `Time Adjustment (${cat}) Approved: ${targetDispute.reason}${adminNotes ? ` (Notes: ${adminNotes})` : ''}`;

      setSummaries((prev) => {
        let found = false;
        const updated = prev.map((s) => {
          if (s.employeeId === targetDispute.employeeId && parseToYYYYMMDD(s.date) === targetDate) {
            found = true;
            return {
              ...s,
              status: finalStatus,
              firstIn: reqIn,
              lastOut: reqOut,
              breakOut: reqBreakOut || s.breakOut,
              breakIn: reqBreakIn || s.breakIn,
              netHoursWorked: reqHours,
              undertimeHours: utHours,
              overtimeHours: otHours,
              anomalies: [reasonNote],
              isAdjusted: true,
              adjustmentNote: targetDispute.reason,
            };
          }
          return s;
        });

        if (!found) {
          const weekday = getDayOfWeekName(targetDate);
          const newSummary: AttendanceSummaryDaily = {
            id: `summary-adj-${Date.now()}`,
            employeeId: targetDispute.employeeId,
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
            adjustmentNote: targetDispute.reason,
          };
          return [newSummary, ...prev];
        }

        return updated;
      });
    }
  };

  // Handle Dispute Rejection
  const handleRejectDispute = (disputeId: string, adminNotes: string) => {
    const currentNow = new Date().toISOString().replace('T', ' ').substring(0, 19);

    setDisputes((prev) =>
      prev.map((d) =>
        d.id === disputeId
          ? {
              ...d,
              status: 'REJECTED',
              adminNotes,
              reviewedBy: currentUser?.name || 'Branch Manager / Admin',
              reviewedAt: currentNow,
            }
          : d
      )
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
      submittedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
    };
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
      submittedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
    };
    setCtoRequests((prev) => [req, ...prev]);
  };

  const handleApproveCtoRequest = (id: string, notes?: string, approverRole?: 'MANAGER' | 'PAYROLL' | 'ADMIN') => {
    const currentNow = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const role = approverRole || (currentUser?.role === 'BRANCH_MANAGER' || currentUser?.role === 'SHIFT_MANAGER' ? 'MANAGER' : 'PAYROLL');

    let approvedReq: CtoRequest | null = null;

    setCtoRequests((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;

        const isMgr = role === 'MANAGER';
        const isPay = role === 'PAYROLL' || role === 'ADMIN';

        const updatedMgrApp = isMgr ? true : Boolean(r.managerApproved);
        const updatedMgrBy = isMgr ? (currentUser?.name || 'Branch Manager') : r.managerApprovedBy;
        const updatedMgrAt = isMgr ? currentNow : r.managerApprovedAt;

        const updatedPayApp = isPay ? true : Boolean(r.payrollApproved);
        const updatedPayBy = isPay ? (currentUser?.name || 'Payroll Department') : r.payrollApprovedBy;
        const updatedPayAt = isPay ? currentNow : r.payrollApprovedAt;

        // Both approved, or Payroll/Admin final sign-off
        const isFullyApproved = (updatedMgrApp && updatedPayApp) || (isPay && role === 'ADMIN');

        const updated: CtoRequest = {
          ...r,
          status: isFullyApproved ? 'APPROVED' : 'PENDING',
          reviewNotes: notes || r.reviewNotes,
          reviewedBy: currentUser?.name || 'Authorized Approver',
          managerApproved: updatedMgrApp,
          managerApprovedBy: updatedMgrBy,
          managerApprovedAt: updatedMgrAt,
          payrollApproved: updatedPayApp,
          payrollApprovedBy: updatedPayBy,
          payrollApprovedAt: updatedPayAt,
        };

        if (isFullyApproved) {
          approvedReq = updated;
        }

        return updated;
      })
    );

    // If fully approved and it's a LEAVE request, mark Attendance Summary as LEAVE
    if (approvedReq) {
      const target: CtoRequest = approvedReq;
      if (target.requestType !== 'CREDIT') {
        setSummaries((prevSummaries) => {
          const existingIdx = prevSummaries.findIndex(
            (s) => s.employeeId === target.employeeId && s.date === target.date
          );

          if (existingIdx >= 0) {
            const next = [...prevSummaries];
            next[existingIdx] = {
              ...next[existingIdx],
              status: 'LEAVE',
              isAdjusted: true,
              adjustmentNote: `Approved CTO Leave (${target.hoursRequested}h) - Approved by ${target.managerApprovedBy || 'Manager'} & ${target.payrollApprovedBy || 'Payroll'}`,
              anomalies: Array.from(new Set([...(next[existingIdx].anomalies || []), 'Approved CTO Leave'])),
            };
            return next;
          } else {
            const newSummary: AttendanceSummaryDaily = {
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
            return [newSummary, ...prevSummaries];
          }
        });
      }
    }
  };

  const handleRejectCtoRequest = (id: string, notes?: string) => {
    const currentNow = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const rejectorRole = currentUser?.role === 'BRANCH_MANAGER'
      ? `Branch Manager - ${currentUser.branch || 'YC Ebloc'}`
      : currentUser?.role === 'SHIFT_MANAGER'
      ? `Shift Manager - ${currentUser.branch || 'YC Ebloc'}`
      : currentUser?.role === 'PAYROLL'
      ? 'Payroll Specialist'
      : currentUser?.role === 'ADMIN'
      ? 'System Admin'
      : 'Approver';
    
    const rejectorIdentity = currentUser
      ? `${currentUser.name} (${rejectorRole})`
      : 'Branch Manager';

    setCtoRequests((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              status: 'REJECTED',
              reviewNotes: notes || 'CTO Request Disapproved',
              reviewedBy: rejectorIdentity,
              reviewedAt: currentNow,
            }
          : r
      )
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
    setCtoAdjustments((prev) => [record, ...prev]);
  };

  // Add / Edit User handlers
  const handleAddUser = (newUser: User) => {
    setUsers((prev) => [...prev, newUser]);
  };

  const handleUpdateUser = (updatedUser: User) => {
    setUsers((prev) => prev.map((u) => (u.id === updatedUser.id ? updatedUser : u)));
  };

  const handleDeleteUser = (userId: string) => {
    setUsers((prev) => prev.filter((u) => u.id !== userId));
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
      case 'BRANCH_MANAGER':
        return {
          title: 'STORE OPERATIONS & SHIFT MANAGER PORTAL',
          subtitle: 'Store Operations • Biometric ZKTeco File Uploads • Dispute Filing & Shift Monitoring',
          badge: role === 'SHIFT_MANAGER' ? 'ROLE: SHIFT MANAGER' : 'ROLE: BRANCH MANAGER',
          icon: '🏪',
        };
      case 'PAYROLL':
        return {
          title: 'PAYROLL SPECIALIST CALCULATOR & EXPORT DASHBOARD',
          subtitle: 'Regular & OT Wages • Night Differential • Deduction Mapping • Google Sheets Sync',
          badge: 'ROLE: PAYROLL SPECIALIST',
          icon: '🧮',
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
    ((currentUser?.role === 'BRANCH_MANAGER' || currentUser?.role === 'SHIFT_MANAGER') && activeTab === 'branch-logs') ||
    (currentUser?.role === 'PAYROLL' && activeTab === 'payroll-summary') ||
    (currentUser?.role === 'STAFF' && activeTab === 'my-punches');

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
                onSyncGoogleSheets={handleSyncGoogleSheets}
                activeTab={activeTab}
              />
            )}

            {currentUser.role === 'STAFF' && (
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
                activeTab={activeTab}
              />
            )}

            {(currentUser.role === 'BRANCH_MANAGER' || currentUser.role === 'SHIFT_MANAGER') && (
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
