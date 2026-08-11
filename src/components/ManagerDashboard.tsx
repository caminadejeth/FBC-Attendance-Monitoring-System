import React, { useState } from 'react';
import { DatePickerInput } from './DatePickerInput';
import { TimeAdjustmentModal } from './TimeAdjustmentModal';
import { DisputeCardDetails } from './DisputeCardDetails';
import {
  AttendanceSummaryDaily,
  CtoManualAdjustment,
  CtoRequest,
  DisputeRequest,
  User,
  BiometricPunch,
  WorkSchedule,
} from '../types';
import { PersonalPunchesTable } from './PersonalPunchesTable';
import { WorkScheduleManager } from './WorkScheduleManager';
import { ZktecoDatUploader } from './ZktecoDatUploader';
import { CtoLeaveDashboard } from './CtoLeaveDashboard';
import { EmployeeDtrSheet } from './EmployeeDtrSheet';
import {
  parseAndCleanBiometricExcel,
  generateSampleBiometricExcel,
} from '../utils/fileProcessor';
import { formatTime12Hr, formatDateWithDay, formatDateMDYY, formatDateMDYYYY, getFilteredSummariesWithAbsents } from '../utils/timeFormatters';
import {
  showUploadProcessingAlert,
  showUploadSuccessAlert,
  showUploadErrorAlert,
  showConfirmDisputeAlert,
  showDisputeSuccessAlert,
  showExportToast,
  showSyncConfirmAlert,
  showRemarkPromptAlert,
  showActionSuccessToast,
  showSuccessAlert,
  showConfirmCtoActionAlert,
} from '../utils/sweetAlerts';
import * as XLSX from 'xlsx';
import {
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Clock,
  PlusCircle,
  Search,
  Filter,
  RefreshCw,
  Building2,
  Users,
  ShieldCheck,
  ChevronRight,
  Sparkles,
  CalendarDays,
  MessageSquare,
  AlertCircle,
  Award,
  Check,
  X,
  User as UserIcon,
} from 'lucide-react';

interface ManagerDashboardProps {
  currentUser: User;
  users: User[];
  summaries: AttendanceSummaryDaily[];
  disputes: DisputeRequest[];
  punches: BiometricPunch[];
  ctoRequests: CtoRequest[];
  ctoAdjustments: CtoManualAdjustment[];
  schedules?: WorkSchedule[];
  onSaveSchedule?: (schedule: WorkSchedule) => void;
  onUploadProcessed: (newSummaries: AttendanceSummaryDaily[]) => void;
  onUpdateSummaryAnomaly?: (summaryId: string, newNote: string) => void;
  onApproveDispute?: (id: string, notes?: string, role?: 'MANAGER' | 'PAYROLL' | 'ADMIN') => void;
  onRejectDispute?: (id: string, notes?: string) => void;
  onSubmitDispute: (dispute: Omit<DisputeRequest, 'id' | 'status' | 'submittedAt'>) => void;
  onSubmitCtoRequest: (req: Omit<CtoRequest, 'id' | 'status' | 'submittedAt'>) => void;
  onApproveCtoRequest?: (id: string, notes?: string, role?: 'MANAGER' | 'PAYROLL' | 'ADMIN') => void;
  onRejectCtoRequest?: (id: string, notes?: string) => void;
  onSyncGoogleSheets?: () => void;
  activeTab: string;
}

export const ManagerDashboard: React.FC<ManagerDashboardProps> = ({
  currentUser,
  users,
  summaries,
  disputes,
  punches,
  ctoRequests,
  ctoAdjustments,
  schedules = [],
  onSaveSchedule = () => {},
  onUploadProcessed,
  onUpdateSummaryAnomaly,
  onApproveDispute,
  onRejectDispute,
  onSubmitDispute,
  onSubmitCtoRequest,
  onApproveCtoRequest = (_id: string, _notes?: string, _role?: 'MANAGER' | 'PAYROLL' | 'ADMIN') => {},
  onRejectCtoRequest = (_id: string, _notes?: string) => {},
  onSyncGoogleSheets,
  activeTab,
}) => {
  // Navigation sub-tab inside Manager Dashboard
  const [managerTab, setManagerTab] = useState<'PERSONAL' | 'ZKTECO_UPLOAD' | 'ZKTECO_DAT' | 'BRANCH_LOGS' | 'SCHEDULES' | 'DISPUTES' | 'MY_CTO'>('BRANCH_LOGS');

  // Sync activeTab prop from sidebar navigation
  React.useEffect(() => {
    if (activeTab === 'upload-dat' || activeTab === 'zkteco-dat') {
      setManagerTab('ZKTECO_DAT');
    } else if (activeTab === 'upload' || activeTab === 'zkteco-upload') {
      setManagerTab('ZKTECO_UPLOAD');
    } else if (activeTab === 'branch-logs' || activeTab === 'logs' || activeTab === 'overview' || activeTab === 'dtr-logs') {
      setManagerTab('BRANCH_LOGS');
    } else if (activeTab === 'disputes' || activeTab === 'time-adjustments') {
      setManagerTab('DISPUTES');
    } else if (activeTab === 'schedules') {
      setManagerTab('SCHEDULES');
    } else if (activeTab === 'my-cto') {
      setManagerTab('MY_CTO');
    } else if (activeTab === 'my-punches' || activeTab === 'my-disputes' || activeTab === 'personal') {
      setManagerTab('PERSONAL');
    }
  }, [activeTab]);

  // File Upload State
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<{
    type: 'success' | 'error' | 'warning';
    title: string;
    text: string;
    details?: string[];
  } | null>(null);

  // Search & Filter State for Branch Logs
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [activePreset, setActivePreset] = useState<string>('ALL');

  // Time Adjustment Request Modal State
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);

  // Preset Date Range Helper
  const handlePresetChange = (preset: string) => {
    setActivePreset(preset);
    const today = new Date();
    
    if (preset === 'THIS_PAY_PERIOD') {
      const currentDay = today.getDate();
      const year = today.getFullYear();
      const month = today.getMonth() + 1;
      if (currentDay <= 15) {
        setStartDate(`${month}/1/${year}`);
        setEndDate(`${month}/15/${year}`);
      } else {
        const lastDay = new Date(year, today.getMonth() + 1, 0).getDate();
        setStartDate(`${month}/16/${year}`);
        setEndDate(`${month}/${lastDay}/${year}`);
      }
    } else if (preset === 'LAST_15_DAYS') {
      const past = new Date();
      past.setDate(today.getDate() - 15);
      setStartDate(`${past.getMonth() + 1}/${past.getDate()}/${past.getFullYear()}`);
      setEndDate(`${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`);
    } else if (preset === 'THIS_MONTH') {
      const year = today.getFullYear();
      const month = today.getMonth() + 1;
      const lastDay = new Date(year, today.getMonth() + 1, 0).getDate();
      setStartDate(`${month}/1/${year}`);
      setEndDate(`${month}/${lastDay}/${year}`);
    } else {
      setStartDate('');
      setEndDate('');
    }
  };

  // File Dispute Modal State (for Manager's own disputes)
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [selectedSummaryForDispute, setSelectedSummaryForDispute] = useState<AttendanceSummaryDaily | null>(null);
  const [disputeType, setDisputeType] = useState<DisputeRequest['type']>('MISSING_PUNCH');
  const [disputeReason, setDisputeReason] = useState('');
  const [requestedIn, setRequestedIn] = useState('08:00:00');
  const [requestedOut, setRequestedOut] = useState('17:00:00');

  // Filter personal summaries & disputes for this manager
  const mySummaries = summaries.filter((s) => s.employeeId === currentUser.employeeId);
  const myDisputes = disputes.filter((d) => d.employeeId === currentUser.employeeId);

  // Manager Personal KPI Calculations
  const myDaysWorked = mySummaries.filter((s) => s.netHoursWorked > 0 || s.firstIn).length;
  const myNetHours = mySummaries.reduce((acc, s) => acc + s.netHoursWorked, 0);
  const myOvertime = mySummaries.reduce((acc, s) => acc + s.overtimeHours, 0);
  const myUndertime = mySummaries.reduce((acc, s) => acc + s.undertimeHours, 0);

  // Range summaries with Absents & Lacking populated
  const rangeSummaries = getFilteredSummariesWithAbsents(
    summaries,
    users,
    startDate,
    endDate
  );

  // Branch summaries (all summaries - Sorted ASCENDING by date)
  const branchSummaries = rangeSummaries
    .filter((s) => {
      // Role isolation: BRANCH_MANAGER can only see data they uploaded or matching their branch
      if (currentUser.role === 'BRANCH_MANAGER') {
        const isUploadedByMe = s.uploadedByUserId ? s.uploadedByUserId === currentUser.id : true;
        const isMyBranch = s.branch ? s.branch === currentUser.department : true;
        if (!isUploadedByMe && !isMyBranch) return false;
      }

      const formattedDate = formatDateMDYY(s.date);
      const matchesSearch =
        s.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.date.includes(searchTerm) ||
        formattedDate.includes(searchTerm);

      const matchesStatus =
        statusFilter === 'ALL' ||
        s.status === statusFilter ||
        (statusFilter === 'ANOMALY' && s.status !== 'COMPLETE') ||
        (statusFilter === 'LACKING' && (s.status === 'LACKING' || s.status === 'MISSING_IN' || s.status === 'MISSING_OUT'));

      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.employeeId.localeCompare(b.employeeId);
    });

  // Handle ZKTeco Biometric Excel File Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setUploadMessage(null);

    // Show SweetAlert processing dialog
    showUploadProcessingAlert(file.name);

    const result = await parseAndCleanBiometricExcel(file, users);
    setIsProcessing(false);

    if (result.isValid) {
      const taggedSummaries = result.summaries.map((s) => ({
        ...s,
        uploadedByUserId: currentUser.id,
        branch: s.branch || currentUser.department || 'Main Branch',
      }));
      onUploadProcessed(taggedSummaries);
      setUploadMessage({
        type: 'success',
        title: 'ZKTeco Biometric File Successfully Parsed & Cleaned!',
        text: `Parsed ${result.rawRowsCount} raw rows into ${result.cleanedPunchesCount} deduplicated punches. Generated ${result.summaries.length} daily employee summaries for branch monitoring.`,
        details: result.warnings,
      });

      // Show SweetAlert success modal
      showUploadSuccessAlert(
        result.rawRowsCount,
        result.cleanedPunchesCount,
        result.summaries.length,
        result.warnings
      );
    } else {
      setUploadMessage({
        type: 'error',
        title: 'ZKTeco File Validation Failed',
        text: 'The uploaded file does not match the mandatory ZKTeco biometric export format.',
        details: result.errors,
      });

      // Show SweetAlert error modal
      showUploadErrorAlert(result.errors);
    }

    // Reset file input value so user can re-upload same file if needed
    e.target.value = '';
  };

  // Export Manager's Personal Attendance Summary
  const handleExportMySummary = () => {
    const exportData = mySummaries.map((s) => ({
      'Employee ID': s.employeeId,
      'Employee Name': s.employeeName,
      'Date': s.date,
      'Weekday': s.weekday,
      'Clock In': s.firstIn || 'MISSING',
      'Clock Out': s.lastOut || 'MISSING',
      'Break Duration': `${s.totalBreakMinutes} mins`,
      'Net Hours Worked': s.netHoursWorked,
      'Flexitime Target': '8.0 hrs',
      'Undertime (Hrs)': s.undertimeHours,
      'Potential CTO Eligible (Hrs)': s.ctoHoursEarned || 0,
      'Status': s.status,
      'Anomalies / Remarks': s.anomalies.join(' | ') || 'None',
    }));

    const filename = `${currentUser.employeeId}_Manager_Attendance.xlsx`;
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'My Attendance');
    XLSX.writeFile(wb, filename);

    showExportToast(filename);
  };

  // Export Branch Attendance Summary
  const handleExportBranchSummary = () => {
    const exportData = summaries.map((s) => ({
      'Employee ID': s.employeeId,
      'Employee Name': s.employeeName,
      'Department': s.department,
      'Date': s.date,
      'Weekday': s.weekday,
      'Clock In': s.firstIn || 'MISSING',
      'Clock Out': s.lastOut || 'MISSING',
      'Break Duration': `${s.totalBreakMinutes} mins`,
      'Net Hours Worked': s.netHoursWorked,
      'Flexitime Target': '8.0 hrs',
      'Undertime (Hrs)': s.undertimeHours,
      'Potential CTO Eligible (Hrs)': s.ctoHoursEarned || 0,
      'Status': s.status,
      'Anomalies': s.anomalies.join(' | ') || 'None',
    }));

    const filename = `FBC_Branch_Attendance_${new Date().toISOString().split('T')[0]}.xlsx`;
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Branch Attendance');
    XLSX.writeFile(wb, filename);

    showExportToast(filename);
  };

  const handleOpenDispute = (s?: AttendanceSummaryDaily) => {
    setSelectedSummaryForDispute(s || null);
    if (s) {
      setDisputeType(
        s.status === 'MISSING_IN' || s.status === 'MISSING_OUT'
          ? 'MISSING_PUNCH'
          : s.status === 'UNDERTIME'
          ? 'UNDERTIME_EXPLANATION'
          : 'OVERTIME_CLAIM'
      );
    }
    setDisputeReason('');
    setShowDisputeModal(true);
  };

  const handleFormSubmitDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disputeReason.trim()) return;

    const dateStr = selectedSummaryForDispute?.date || new Date().toISOString().split('T')[0];
    const confirm = await showConfirmDisputeAlert(disputeType, dateStr);

    if (confirm.isConfirmed) {
      onSubmitDispute({
        employeeId: currentUser.employeeId,
        employeeName: currentUser.name,
        date: dateStr,
        type: disputeType,
        reason: disputeReason,
        requestedClockIn: requestedIn,
        requestedClockOut: requestedOut,
        requestedHours: 8.0,
      });

      setShowDisputeModal(false);
      showDisputeSuccessAlert();
    }
  };

  const zktecoHeaders = [
    'Employee ID',
    'First Name',
    'Date',
    'Weekday',
    'Break Duration',
    'Clock In',
    'Clock Out',
    'Total Hours',
    'Worked Hours',
    'Break Out',
    'Break In',
    'Break Hours',
    'Break',
    'Total Hours',
    'Total OT',
  ];

  return (
    <div className="space-y-6">
      {/* MANAGER IDENTITY & ROLE HEADER CARD - Shown strictly on Main Branch Logs tab */}
      {(managerTab === 'BRANCH_LOGS' || activeTab === 'branch-logs' || activeTab === 'overview' || activeTab === 'dashboard') && (
        <div className="bg-white rounded-2xl border-2 border-zinc-950 p-6 shadow-md">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {currentUser.avatarUrl ? (
                <img
                  src={currentUser.avatarUrl}
                  alt={currentUser.name}
                  className="w-16 h-16 rounded-2xl object-cover border-2 border-amber-400 shadow-xs"
                />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-500 text-zinc-950 flex items-center justify-center font-black text-2xl shadow-xs border border-amber-300">
                  {currentUser.name.substring(0, 2).toUpperCase()}
                </div>
              )}

              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-black text-zinc-950">{currentUser.name}</h2>
                  <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-400 text-zinc-950 flex items-center gap-1 shadow-2xs border border-amber-500">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    {currentUser.role === 'BRANCH_MANAGER' ? 'BRANCH MANAGER' : 'SHIFT MANAGER'}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-600 mt-1">
                  <span className="font-mono font-bold text-amber-900">{currentUser.employeeId}</span>
                  <span>•</span>
                  <span className="flex items-center gap-1 font-bold text-zinc-900">
                    <Building2 className="w-3.5 h-3.5 text-amber-600" /> {currentUser.department}
                  </span>
                  <span>•</span>
                  <span className="font-semibold text-zinc-700">{currentUser.position}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleExportMySummary}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-xs font-bold text-zinc-950 transition-colors shadow-2xs"
              >
                <FileSpreadsheet className="w-4 h-4 text-amber-800" />
                Export My Attendance
              </button>
            </div>
          </div>

          {/* Manager Personal KPI Metrics Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 pt-6 border-t border-amber-100">
            <div className="bg-amber-50/80 p-3.5 rounded-xl border border-amber-200">
              <span className="text-[11px] font-bold text-amber-900 uppercase">My Days Worked</span>
              <div className="text-xl font-black text-zinc-950 mt-1">{myDaysWorked} Days</div>
            </div>

            <div className="bg-amber-50/80 p-3.5 rounded-xl border border-amber-200">
              <span className="text-[11px] font-bold text-amber-900 uppercase">My Net Worked Hours</span>
              <div className="text-xl font-black text-zinc-950 mt-1">{myNetHours.toFixed(1)} hrs</div>
            </div>

            <div className="bg-emerald-50 p-3.5 rounded-xl border border-emerald-200">
              <span className="text-[11px] font-bold text-emerald-800 uppercase">My Overtime Credit</span>
              <div className="text-xl font-black text-emerald-900 mt-1">+{myOvertime.toFixed(1)} hrs</div>
            </div>

            <div className="bg-rose-50 p-3.5 rounded-xl border border-rose-200">
              <span className="text-[11px] font-bold text-rose-800 uppercase">My Undertime Deficit</span>
              <div className="text-xl font-black text-rose-900 mt-1">-{myUndertime.toFixed(1)} hrs</div>
            </div>
          </div>
        </div>
      )}



      {/* TAB: EMPLOYEE DTR LOGS SHEET TEMPLATE */}
      {currentUser.role !== 'SHIFT_MANAGER' && (activeTab === 'dtr-logs' || managerTab === 'DTR_LOGS' || activeTab === 'all') && (
        <EmployeeDtrSheet
          users={users}
          summaries={summaries}
          disputes={disputes}
          punches={punches}
          currentUser={currentUser}
        />
      )}

      {/* TAB 0: WORK SCHEDULE ROSTER */}
      {managerTab === 'SCHEDULES' && (
        <div className="space-y-6 animate-in fade-in">
          <WorkScheduleManager
            currentUser={currentUser}
            users={users}
            schedules={schedules}
            ctoRequests={ctoRequests}
            summaries={summaries}
            onSaveSchedule={onSaveSchedule}
          />
        </div>
      )}

      {/* TAB: TIME ADJUSTMENT APPROVALS (BRANCH MANAGER) */}
      {managerTab === 'DISPUTES' && currentUser.role !== 'SHIFT_MANAGER' && (
        <div className="bg-white rounded-2xl border border-[#D3D8C8] p-6 shadow-xs space-y-5 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-600" />
                <h3 className="text-base font-bold text-[#2C3524]">
                  Branch Time Adjustment & Dispute Requests
                </h3>
              </div>
              <p className="text-xs text-zinc-500 mt-1">
                Review and approve/reject employee time adjustment forms. Approved adjustments immediately update the employee's attendance log and reflect their reason in the Note/Anomaly column.
              </p>
            </div>

            <button
              id="btn-manager-new-adjustment"
              onClick={() => setShowAdjustmentModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-black text-xs uppercase tracking-wider border border-zinc-950 shadow-xs cursor-pointer shrink-0"
            >
              <PlusCircle className="w-4 h-4" /> New Time Adjustment Form
            </button>
          </div>

          <div className="space-y-3">
            {disputes.length === 0 ? (
              <div className="p-10 text-center bg-zinc-50 rounded-2xl border border-dashed border-zinc-300 space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                <p className="text-sm font-bold text-zinc-700">No Time Adjustment Requests Found</p>
                <p className="text-xs text-zinc-500">
                  There are currently no time adjustment or dispute tickets waiting for review.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {disputes.map((d) => (
                  <div
                    key={d.id}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      d.status === 'PENDING'
                        ? 'border-amber-400 bg-amber-50/40'
                        : d.status === 'APPROVED'
                        ? 'border-emerald-300 bg-emerald-50/30'
                        : 'border-rose-200 bg-rose-50/30'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-sm text-zinc-950">
                            {d.employeeName}
                          </span>
                          <span className="font-mono text-xs font-bold text-amber-900">
                            ({d.employeeId})
                          </span>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                              d.status === 'PENDING'
                                ? 'bg-amber-400 text-zinc-950'
                                : d.status === 'APPROVED'
                                ? 'bg-emerald-600 text-white'
                                : 'bg-rose-600 text-white'
                            }`}
                          >
                            {d.status}
                          </span>
                        </div>

                        <div className="text-xs text-zinc-600">
                          <span className="font-bold text-zinc-800">
                            Target Date: {formatDateMDYYYY(d.date)}
                          </span>
                        </div>

                        <DisputeCardDetails dispute={d} />
                      </div>

                      {d.status === 'PENDING' && onApproveDispute && onRejectDispute && (
                        <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0">
                          {d.managerApproved ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-bold shadow-2xs">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              Manager Signed Off (Awaiting Payroll)
                            </span>
                          ) : (
                            <>
                              <button
                                onClick={async () => {
                                  const noteRes = await showRemarkPromptAlert(
                                    d.employeeName,
                                    formatDateMDYYYY(d.date),
                                    d.reason
                                  );
                                  const reviewNotes = noteRes.isConfirmed ? noteRes.value : d.reason;
                                  onApproveDispute(d.id, reviewNotes, 'MANAGER');
                                  showSuccessAlert(
                                    'Branch Manager Approval Recorded!',
                                    `Approved adjustment for ${d.employeeName} on ${formatDateMDYYYY(d.date)}. Request forwarded to Payroll Department for final sign-off.`
                                  );
                                }}
                                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-2xs cursor-pointer"
                              >
                                <Check className="w-4 h-4" /> Approve (Branch Manager)
                              </button>

                              <button
                                onClick={async () => {
                                  const noteRes = await showRemarkPromptAlert(
                                    d.employeeName,
                                    formatDateMDYYYY(d.date),
                                    'Reason for rejection'
                                  );
                                  const reviewNotes = noteRes.isConfirmed
                                    ? noteRes.value
                                    : 'Request rejected by Branch Manager';
                                  onRejectDispute(d.id, reviewNotes);
                                }}
                                className="px-3 py-2 rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-800 text-xs font-bold flex items-center gap-1 cursor-pointer"
                              >
                                <X className="w-4 h-4" /> Reject
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: ZKTECO OLD VERSION .DAT UPLOADER */}
      {managerTab === 'ZKTECO_DAT' && (
        <div className="space-y-6 animate-in fade-in">
          <ZktecoDatUploader users={users} currentUser={currentUser} onUploadProcessed={onUploadProcessed} />
        </div>
      )}

      {/* TAB 1: ZKTECO BIOMETRIC UPLOADER */}
      {managerTab === 'ZKTECO_UPLOAD' && (
        <div className="space-y-6 animate-in fade-in">
          {/* ZKTeco Header Spec Banner */}
          <div className="bg-white rounded-2xl border border-[#D3D8C8] p-6 shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-[#2C3524]">
                    ZKTeco Biometric Terminal Data Uploader (.xls / .xlsx)
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#656D4A] text-white">
                    Manager Portal
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Upload daily attendance export files directly from your branch's ZKTeco biometric machine.
                </p>
              </div>

              <button
                id="btn-download-zkteco-template"
                onClick={generateSampleBiometricExcel}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#F7F8F5] border border-[#D3D8C8] hover:bg-[#E6E8DE] text-xs font-bold text-[#2C3524] rounded-xl shadow-2xs transition-colors shrink-0"
              >
                <Download className="w-4 h-4 text-[#656D4A]" />
                Download ZKTeco Sample .xlsx Template
              </button>
            </div>

            {/* Required ZKTeco Header List */}
            <div>
              <div className="text-xs font-bold text-[#2C3524] mb-2 flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-[#656D4A]" />
                Mandatory ZKTeco File Column Header Structure:
              </div>
              <div className="flex flex-wrap gap-1.5 p-3.5 bg-[#F7F8F5] rounded-xl border border-[#D3D8C8]">
                {zktecoHeaders.map((header, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 bg-white border border-[#D3D8C8] text-gray-700 text-[11px] font-mono font-bold rounded-lg shadow-2xs"
                  >
                    {header}
                  </span>
                ))}
              </div>
            </div>

            {/* Dropzone & Upload Button */}
            <div className="relative border-2 border-dashed border-[#A4AC86] bg-[#F7F8F5] hover:bg-[#EFEFEA] rounded-2xl p-8 text-center transition-colors cursor-pointer group">
              <input
                type="file"
                accept=".xls,.xlsx"
                onChange={handleFileUpload}
                disabled={isProcessing}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />

              <div className="flex flex-col items-center justify-center space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-[#656D4A] text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                  {isProcessing ? (
                    <RefreshCw className="w-7 h-7 animate-spin" />
                  ) : (
                    <Upload className="w-7 h-7" />
                  )}
                </div>

                <div>
                  <h4 className="text-sm font-bold text-[#2C3524]">
                    {isProcessing ? 'Processing ZKTeco Biometric File...' : 'Click to Upload ZKTeco Biometric .xls File'}
                  </h4>
                  <p className="text-xs text-gray-500 mt-1">
                    Drag and drop your branch .xls / .xlsx file here or browse files
                  </p>
                </div>

                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#656D4A] text-white text-xs font-bold shadow-xs">
                  <Upload className="w-3.5 h-3.5" />
                  Select ZKTeco File
                </div>
              </div>
            </div>

            {/* Upload Feedback Messages */}
            {uploadMessage && (
              <div
                className={`p-4 rounded-xl border text-xs space-y-2 animate-in fade-in ${
                  uploadMessage.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-sm">
                  {uploadMessage.type === 'success' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-rose-600" />
                  )}
                  {uploadMessage.title}
                </div>
                <p className="text-gray-700">{uploadMessage.text}</p>

                {uploadMessage.details && uploadMessage.details.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-200 space-y-1">
                    <span className="font-bold block">Processing Notes & Data Cleaning Logs:</span>
                    <ul className="list-disc list-inside space-y-0.5 text-gray-600 font-mono text-[11px]">
                      {uploadMessage.details.map((note, i) => (
                        <li key={i}>{note}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: BRANCH EMPLOYEE LOGS */}
      {managerTab === 'BRANCH_LOGS' && (
        <div className="bg-white rounded-2xl border border-[#D3D8C8] p-6 shadow-xs space-y-4 animate-in fade-in">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
            <div>
              <h3 className="text-base font-bold text-[#2C3524]">Branch Employee Attendance Logs</h3>
              <p className="text-xs text-gray-500">
                Processed shift records evaluated against the FBC 8-Hour Flexitime Rule ({branchSummaries.length} Records)
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                id="btn-manager-request-time-adjustment"
                onClick={() => setShowAdjustmentModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-black text-xs uppercase tracking-wider border border-zinc-950 shadow-xs cursor-pointer shrink-0"
              >
                <PlusCircle className="w-4 h-4" /> Request Time Adjustment
              </button>

              <button
                onClick={handleExportBranchSummary}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-[#D3D8C8] bg-[#F7F8F5] hover:bg-[#E6E8DE] text-xs font-bold text-[#2C3524] transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4 text-[#656D4A]" />
                Export (.xlsx)
              </button>
            </div>
          </div>

          {/* Professional Date Range Filter Bar */}
          <div className="bg-[#F7F8F5] rounded-xl border border-[#D3D8C8] p-3.5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-amber-700" />
                <span className="text-xs font-black uppercase tracking-wider text-zinc-900">
                  Filter Date Range
                </span>
              </div>

              {/* Preset Buttons */}
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: 'THIS_PAY_PERIOD', label: 'This Pay Period' },
                  { id: 'LAST_15_DAYS', label: 'Last 15 Days' },
                  { id: 'THIS_MONTH', label: 'This Month' },
                  { id: 'ALL', label: 'All Records' },
                ].map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => handlePresetChange(preset.id)}
                    className={`px-3 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                      activePreset === preset.id
                        ? 'bg-amber-400 text-zinc-950 border border-zinc-950 shadow-2xs'
                        : 'bg-white text-zinc-700 hover:bg-zinc-100 border border-zinc-300'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-zinc-200">
              <DatePickerInput
                label="Start Date (M/D/YYYY)"
                value={startDate}
                onChange={(val) => {
                  setStartDate(val);
                  setActivePreset('CUSTOM');
                }}
              />

              <DatePickerInput
                label="End Date (M/D/YYYY)"
                value={endDate}
                onChange={(val) => {
                  setEndDate(val);
                  setActivePreset('CUSTOM');
                }}
              />

              <div className="relative flex items-end">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 bottom-2.5 z-10" />
                <input
                  type="text"
                  placeholder="Search employee name, ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-white border border-gray-300 rounded-xl text-xs font-medium text-gray-900 focus:ring-2 focus:ring-amber-400 focus:outline-hidden"
                />
              </div>

              <div className="flex items-end">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-bold text-gray-800"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="COMPLETE">8h Flexi Compliant</option>
                  <option value="UNDERTIME">Undertime</option>
                  <option value="OVERTIME">Overtime</option>
                  <option value="LACKING">Lacking (Missing In/Out)</option>
                  <option value="ABSENT">Absent (No Punches)</option>
                  <option value="ANOMALY">Any Anomaly</option>
                </select>
              </div>
            </div>
          </div>

          {/* Branch Logs Table */}
          <div className="overflow-x-auto border border-gray-200 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F7F8F5] text-[#4A543E] font-bold border-b border-gray-200">
                <tr>
                  <th className="p-3">Employee ID</th>
                  <th className="p-3">Name</th>
                  <th className="p-3">Branch</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Clock In</th>
                  <th className="p-3">Break Out (2)</th>
                  <th className="p-3">Break In (3)</th>
                  <th className="p-3">Clock Out</th>
                  <th className="p-3">Break</th>
                  <th className="p-3">Net Hrs</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Anomalies / Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {branchSummaries.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="p-8 text-center text-gray-400">
                      No branch employee attendance records matching filters.
                    </td>
                  </tr>
                ) : (
                  branchSummaries.map((s) => {
                    const isAbsent = s.status === 'ABSENT';
                    const hasClockIn = Boolean(s.firstIn && s.firstIn !== 'No Data' && s.firstIn !== '--');
                    const hasClockOut = Boolean(s.lastOut && s.lastOut !== 'No Data' && s.lastOut !== '--');
                    const hasBreakOut = Boolean(s.breakOut && s.breakOut !== 'No Data' && s.breakOut !== '--');
                    const hasBreakIn = Boolean(s.breakIn && s.breakIn !== 'No Data' && s.breakIn !== '--');

                    const missingPunches: string[] = [];
                    if (!isAbsent) {
                      if (!hasClockIn) missingPunches.push('Clock-In');
                      if (!hasBreakOut) missingPunches.push('Break-Out');
                      if (!hasBreakIn) missingPunches.push('Break-In');
                      if (!hasClockOut) missingPunches.push('Clock-Out');
                    }

                    return (
                      <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                        <td className="p-3 font-mono font-bold text-[#656D4A]">{s.employeeId}</td>
                        <td className="p-3 font-bold text-[#2C3524]">{s.employeeName}</td>
                        <td className="p-3 text-[11px] font-semibold text-zinc-600">{s.branch || s.department || 'Main Branch'}</td>
                        <td className="p-3 font-bold text-[#2C3524]">{formatDateWithDay(s.date, s.weekday)}</td>
                        <td className="p-3 font-mono font-semibold text-gray-700">{s.firstIn ? formatTime12Hr(s.firstIn) : 'No Data'}</td>
                        <td className="p-3 font-mono text-zinc-600">{s.breakOut ? formatTime12Hr(s.breakOut) : 'No Data'}</td>
                        <td className="p-3 font-mono text-zinc-600">{s.breakIn ? formatTime12Hr(s.breakIn) : 'No Data'}</td>
                        <td className="p-3 font-mono font-semibold text-gray-700">{s.lastOut ? formatTime12Hr(s.lastOut) : 'No Data'}</td>
                        <td className="p-3">{s.totalBreakMinutes}m</td>
                        <td className="p-3 font-extrabold text-[#2C3524]">{s.netHoursWorked.toFixed(1)} hrs</td>
                        <td className="p-3">
                          {isAbsent ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                              ✕ Absent
                            </span>
                          ) : missingPunches.length > 0 ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-950 border border-amber-400">
                              ⚡ Missing {missingPunches.join(', ')}
                            </span>
                          ) : s.status === 'COMPLETE' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              ✓ Complete
                            </span>
                          ) : s.status === 'UNDERTIME' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                              ⚠ Undertime (-{s.undertimeHours.toFixed(1)}h)
                            </span>
                          ) : s.status === 'OVERTIME' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
                              ★ Overtime (+{s.overtimeHours.toFixed(1)}h)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-800 border border-gray-300">
                              {s.status}
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-[11px]">
                          <div className="flex items-center justify-between gap-2 min-w-[200px]">
                            <span className="text-gray-600 font-medium truncate max-w-[180px]" title={s.anomalies.length > 0 ? s.anomalies.join(' | ') : 'Normal Shift'}>
                              {s.anomalies.length > 0 ? s.anomalies.join(' | ') : 'Normal Shift'}
                            </span>
                            <button
                              onClick={async () => {
                                const res = await showRemarkPromptAlert(
                                  s.employeeName,
                                  formatDateWithDay(s.date, s.weekday),
                                  s.anomalies.join(' | ')
                                );
                                if (res.isConfirmed && res.value !== undefined) {
                                  if (onUpdateSummaryAnomaly) {
                                    onUpdateSummaryAnomaly(s.id, res.value);
                                  } else {
                                    s.anomalies = [res.value.trim()];
                                  }
                                  showActionSuccessToast('Anomalies / Note updated!');
                                }
                              }}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-[#D3D8C8] hover:bg-[#E6E8DE] text-[10px] font-bold text-[#656D4A] shrink-0 transition-colors shadow-2xs cursor-pointer"
                              title="Add or edit anomalies/notes"
                            >
                              <MessageSquare className="w-3 h-3 text-[#656D4A]" />
                              Notes
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: COMPENSATORY TIME OFF LEAVE REQUESTS & BRANCH STAFF APPROVALS */}
      {managerTab === 'MY_CTO' && (() => {
        // Filter CTO requests for staff members in the manager's department/branch
        const branchStaffCtoRequests = ctoRequests.filter(
          (r) => r.department === currentUser.department || r.branch === currentUser.department || r.employeeId !== currentUser.employeeId
        );

        const pendingManagerApproval = branchStaffCtoRequests.filter(
          (r) => !r.managerApproved && r.status === 'PENDING'
        );

        return (
          <div className="space-y-6 animate-in fade-in">
            {/* Branch Staff CTO Approval Queue for Branch Managers */}
            <div className="bg-white rounded-2xl border border-[#D3D8C8] p-5 md:p-6 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
                <div>
                  <h3 className="text-base font-bold text-[#2C3524] flex items-center gap-2">
                    <Award className="w-5 h-5 text-amber-600" />
                    Branch Staff CTO Requests Approval Queue ({branchStaffCtoRequests.length})
                  </h3>
                  <p className="text-xs text-gray-500">
                    Review and approve staff CTO Leave and Credit requests for <strong>{currentUser.department}</strong>. CTO Leave approval requires authorization from both Branch Manager and Payroll Department.
                  </p>
                </div>
                {pendingManagerApproval.length > 0 && (
                  <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-400 text-zinc-950 border border-zinc-950 shadow-2xs shrink-0">
                    {pendingManagerApproval.length} Requires Your Approval
                  </span>
                )}
              </div>

              {branchStaffCtoRequests.length === 0 ? (
                <div className="p-6 text-center text-gray-400 bg-zinc-50 rounded-xl border border-dashed border-zinc-200 text-xs font-bold">
                  No staff CTO requests found for your branch.
                </div>
              ) : (
                <div className="space-y-3">
                  {branchStaffCtoRequests.map((req) => {
                    const isCredit = req.requestType === 'CREDIT';
                    return (
                      <div
                        key={req.id}
                        className={`p-4 rounded-xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                          req.status === 'APPROVED'
                            ? 'bg-emerald-50/40 border-emerald-300'
                            : req.status === 'REJECTED'
                            ? 'bg-rose-50/40 border-rose-300'
                            : 'bg-amber-50/50 border-amber-300'
                        }`}
                      >
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            {isCredit ? (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-700 text-white shadow-2xs">
                                + CTO CREDIT REQUEST
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500 text-zinc-950 border border-zinc-950 shadow-2xs">
                                - CTO LEAVE REQUEST
                              </span>
                            )}
                            <span className="font-extrabold text-xs text-[#2C3524]">{req.employeeName}</span>
                            <span className="text-xs font-mono font-bold text-gray-500">({req.employeeId})</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-100 text-zinc-800">
                              {req.department}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-3 text-xs">
                            <span className="font-bold text-zinc-800">
                              Target Date: <strong className="text-zinc-950">{req.date}</strong>
                            </span>
                            <span className="font-mono font-black text-amber-900 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                              {isCredit ? '+' : '-'}{req.hoursRequested.toFixed(1)} hrs CTO
                            </span>
                            <span className="text-gray-500 text-[10px]">
                              Submitted: {req.submittedAt}
                            </span>
                          </div>

                          <p className="text-xs text-zinc-800 font-medium bg-white/80 p-2 rounded-lg border border-zinc-200">
                            <span className="font-bold text-zinc-500 text-[10px] uppercase block">Reason:</span>
                            "{req.reason}"
                          </p>

                          {/* Dual Approval Indicators / Rejection Details */}
                          {req.status === 'REJECTED' ? (
                            <div className="mt-2 p-2.5 rounded-xl bg-rose-100/90 border border-rose-300 text-rose-950 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs">
                              <div>
                                <span className="font-black uppercase tracking-wider text-[10px] text-rose-800 block">Rejection Details:</span>
                                <span className="font-bold">Rejected by: <strong className="text-rose-950 underline">{req.reviewedBy || 'Branch Manager'}</strong></span>
                                {req.reviewNotes && <span className="block text-zinc-700 italic text-[11px]">"{req.reviewNotes}"</span>}
                              </div>
                              {req.reviewedAt && (
                                <span className="text-[10px] font-mono font-bold text-rose-800 shrink-0">
                                  {req.reviewedAt}
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Dual Approval Status:</span>
                              {req.managerApproved ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center gap-1">
                                  <Check className="w-3 h-3 text-emerald-700" />
                                  Branch Manager Approved ({req.managerApprovedBy || 'Manager'})
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-200 text-amber-950 border border-amber-300 flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-amber-800" />
                                  Pending Branch Manager Approval
                                </span>
                              )}

                              {req.payrollApproved ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center gap-1">
                                  <Check className="w-3 h-3 text-emerald-700" />
                                  Payroll Department Approved ({req.payrollApprovedBy || 'Payroll'})
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-200 text-amber-950 border border-amber-300 flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-amber-800" />
                                  Pending Payroll Department Approval
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Actions for Manager */}
                        {req.status === 'PENDING' && !req.managerApproved && (
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={async () => {
                                const result = await showConfirmCtoActionAlert('APPROVE', req.employeeName, req.hoursRequested, req.date);
                                if (result.isConfirmed) {
                                  onApproveCtoRequest(req.id, result.value || 'Approved by Branch Manager', 'MANAGER');
                                  showSuccessAlert(
                                    'Branch Manager Approved!',
                                    `CTO request for ${req.employeeName} on ${req.date} was approved by Branch Manager. Awaiting Payroll sign-off.`
                                  );
                                }
                              }}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#656D4A] hover:bg-[#4A543E] text-white text-xs font-black shadow-xs transition-all cursor-pointer"
                            >
                              <Check className="w-4 h-4" /> Approve as Manager
                            </button>
                            <button
                              onClick={async () => {
                                const result = await showConfirmCtoActionAlert('REJECT', req.employeeName, req.hoursRequested, req.date);
                                if (result.isConfirmed) {
                                  onRejectCtoRequest(req.id, result.value || 'Rejected by Branch Manager');
                                  showSuccessAlert(
                                    'CTO Request Rejected',
                                    `CTO request for ${req.employeeName} was rejected.`
                                  );
                                }
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 text-xs font-bold transition-all cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" /> Reject
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Personal CTO Leave Dashboard */}
            <CtoLeaveDashboard
              currentUser={currentUser}
              summaries={summaries}
              ctoRequests={ctoRequests}
              ctoAdjustments={ctoAdjustments}
              onSubmitCtoRequest={onSubmitCtoRequest}
            />
          </div>
        );
      })()}

      {/* TAB 3: PERSONAL PUNCHES & DISPUTES */}
      {managerTab === 'PERSONAL' && (
        <div className="space-y-6 animate-in fade-in">
          {/* PERSONAL PUNCHES TABLE WITH CTO & DATE RANGE */}
          <PersonalPunchesTable
            currentUser={currentUser}
            summaries={summaries}
            ctoRequests={ctoRequests}
            ctoAdjustments={ctoAdjustments}
            onSubmitCtoRequest={onSubmitCtoRequest}
            onUpdateSummaryAnomaly={onUpdateSummaryAnomaly}
            onSubmitDispute={onSubmitDispute}
          />

          {/* MY DISPUTES TRACKER */}
          <div className="bg-white rounded-2xl border border-[#D3D8C8] p-6 shadow-xs space-y-4">
            <h3 className="text-base font-bold text-[#2C3524]">My Dispute & Adjustment Tickets</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {myDisputes.length === 0 ? (
                <div className="col-span-2 p-8 text-center text-gray-400">
                  You have not submitted any dispute tickets.
                </div>
              ) : (
                myDisputes.map((d) => (
                  <div key={d.id} className="p-4 rounded-xl border border-gray-200 bg-white space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#2C3524]">{d.date}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          d.status === 'PENDING'
                            ? 'bg-amber-100 text-amber-800'
                            : d.status === 'APPROVED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {d.status}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-[#656D4A]">
                      Type: {d.type.replace('_', ' ')}
                    </div>
                    <div className="text-xs text-gray-600 bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                      "{d.reason}"
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* FILE DISPUTE MODAL */}
      {showDisputeModal && (
        <TimeAdjustmentModal
          isOpen={showDisputeModal}
          onClose={() => setShowDisputeModal(false)}
          users={users}
          currentUser={currentUser}
          preselectedSummary={selectedSummaryForDispute}
          onSubmitDispute={onSubmitDispute}
        />
      )}

      {/* Time Adjustment Modal */}
      <TimeAdjustmentModal
        isOpen={showAdjustmentModal}
        onClose={() => setShowAdjustmentModal(false)}
        users={users}
        currentUser={currentUser}
        onSubmitDispute={onSubmitDispute}
      />
    </div>
  );
};
