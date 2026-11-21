import React, { useState } from 'react';
import { ActivityLog, AttendanceSummaryDaily, CtoManualAdjustment, CtoRequest, DisputeRequest, User, WorkSchedule } from '../types';
import { getUserCtoStats } from '../utils/ctoHelper';
import { PersonalPunchesTable } from './PersonalPunchesTable';
import { WorkScheduleManager } from './WorkScheduleManager';
import { CtoLeaveDashboard } from './CtoLeaveDashboard';
import { TimeAdjustmentModal } from './TimeAdjustmentModal';
import { DisputeCardDetails } from './DisputeCardDetails';
import {
  showConfirmDisputeAlert,
  showDisputeSuccessAlert,
  showExportToast,
} from '../utils/sweetAlerts';
import { exportDisputesToPdf } from '../utils/pdfExportHelper';
import { resolveSummaryBranch } from '../utils/timeFormatters';
import * as XLSX from 'xlsx';
import {
  Clock,
  Calendar,
  AlertCircle,
  FileSpreadsheet,
  FileText,
  PlusCircle,
  CheckCircle2,
  AlertTriangle,
  Send,
  X,
  TrendingUp,
  CalendarDays,
  Briefcase,
  Building2,
} from 'lucide-react';

interface StaffDashboardProps {
  currentUser: User;
  users?: User[];
  summaries: AttendanceSummaryDaily[];
  disputes: DisputeRequest[];
  ctoRequests: CtoRequest[];
  ctoAdjustments: CtoManualAdjustment[];
  schedules?: WorkSchedule[];
  onUpdateSummaryAnomaly?: (summaryId: string, newNote: string) => void;
  onSubmitDispute: (dispute: Omit<DisputeRequest, 'id' | 'status' | 'submittedAt'>) => void;
  onSubmitCtoRequest: (req: Omit<CtoRequest, 'id' | 'status' | 'submittedAt'>) => void;
  activityLogs?: ActivityLog[];
  onClearActivityLogs?: () => void;
  activeTab: string;
}

export const StaffDashboard: React.FC<StaffDashboardProps> = ({
  currentUser,
  users = [],
  summaries,
  disputes,
  ctoRequests,
  ctoAdjustments,
  schedules = [],
  onUpdateSummaryAnomaly,
  onSubmitDispute,
  onSubmitCtoRequest,
  activityLogs = [],
  onClearActivityLogs,
  activeTab,
}) => {
  // Find staff member's assigned work schedule
  const mySchedule = schedules.find((s) => s.employeeId === currentUser.employeeId) || {
    id: `default-${currentUser.employeeId}`,
    employeeId: currentUser.employeeId,
    employeeName: currentUser.name,
    department: currentUser.department,
    shiftName: 'Regular Day Shift',
    startTime: '08:00',
    endTime: '17:00',
    workDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    effectiveDate: '2026-01-01',
    notes: 'Default branch operational shift',
    updatedAt: '2026-01-01 08:00:00',
    updatedBy: 'Branch Manager',
  };
  // Filter summaries & disputes strictly for THIS staff member
  const mySummaries = summaries.filter((s) => s.employeeId === currentUser.employeeId);
  const myDisputes = disputes.filter((d) => d.employeeId === currentUser.employeeId);

  // File Dispute Modal & Filter State
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [staffDisputeFilter, setStaffDisputeFilter] = useState<'PENDING' | 'HISTORY' | 'ALL'>('PENDING');
  const [selectedSummaryForDispute, setSelectedSummaryForDispute] = useState<AttendanceSummaryDaily | null>(null);
  const [disputeType, setDisputeType] = useState<DisputeRequest['type']>('MISSING_PUNCH');
  const [disputeReason, setDisputeReason] = useState('');
  const [requestedIn, setRequestedIn] = useState('08:00:00');
  const [requestedOut, setRequestedOut] = useState('17:00:00');

  // Role guard: STAFF role does not have access to CTO leave requests or balances
  const canAccessCto = currentUser.role !== 'STAFF';

  // Personal Totals Calculations
  const myCtoStats = getUserCtoStats(currentUser.employeeId, mySummaries, ctoRequests, ctoAdjustments);
  const totalDaysWorked = mySummaries.filter((s) => (Number(s.netHoursWorked) || 0) > 0 || s.firstIn).length;
  const totalNetHours = mySummaries.reduce((acc, s) => acc + (Number(s.netHoursWorked) || 0), 0);
  const totalOvertime = mySummaries.reduce((acc, s) => acc + (Number(s.overtimeHours) || 0), 0);
  const totalUndertime = mySummaries.reduce((acc, s) => acc + (Number(s.undertimeHours) || 0), 0);

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
      const payload: Omit<DisputeRequest, 'id' | 'status' | 'submittedAt'> = {
        employeeId: currentUser.employeeId,
        employeeName: currentUser.name,
        date: dateStr,
        type: disputeType,
        reason: disputeReason,
        requestedHours: 8.0,
      };
      if (requestedIn) payload.requestedClockIn = requestedIn;
      if (requestedOut) payload.requestedClockOut = requestedOut;

      onSubmitDispute(payload);

      setShowDisputeModal(false);
      showDisputeSuccessAlert();
    }
  };

  // Export Individual Attendance Summary
  const handleExportMySummary = () => {
    const exportData = mySummaries.map((s) => {
      const baseRow: Record<string, string | number> = {
        'Employee ID': s.employeeId,
        'Employee Name': s.employeeName,
        'Branch': resolveSummaryBranch(s, users, currentUser),
        'Date': s.date,
        'Weekday': s.weekday,
        'Clock In': s.firstIn || 'MISSING',
        'Clock Out': s.lastOut || 'MISSING',
        'Break Duration': `${s.totalBreakMinutes || 0} mins`,
        'Net Hours Worked': s.netHoursWorked || 0,
        'Flexitime Target': '8.0 hrs',
        'Undertime (Hrs)': s.undertimeHours || 0,
      };
      if (canAccessCto) {
        baseRow['Potential CTO Eligible (Hrs)'] = s.ctoHoursEarned || 0;
      }
      baseRow['Status'] = s.status;
      baseRow['Anomalies / Remarks'] = (s.anomalies || []).join(' | ') || 'None';
      return baseRow;
    });

    const filename = `${currentUser.employeeId}_Attendance_Summary.xlsx`;
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'My Attendance');
    XLSX.writeFile(wb, filename);

    showExportToast(filename);
  };

  return (
    <div className="space-y-6">
      {/* PERSONAL PROFILE & FLEXITIME KPI CARDS - Strictly shown on My Punches / Overview */}
      {(activeTab === 'my-punches' || activeTab === 'overview' || activeTab === 'dashboard' || activeTab === 'all') && (
        <div className="bg-white rounded-2xl border border-[#D3D8C8] p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {currentUser.avatarUrl ? (
                <img
                  src={currentUser.avatarUrl}
                  alt={currentUser.name}
                  className="w-14 h-14 rounded-2xl object-cover border-2 border-[#A4AC86]"
                />
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-[#656D4A] text-white flex items-center justify-center font-bold text-xl">
                  {(currentUser.name || 'U').substring(0, 2).toUpperCase()}
                </div>
              )}
              <div>
                <h2 className="text-xl font-extrabold text-[#2C3524]">{currentUser.name}</h2>
                <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                  <span className="font-mono font-bold text-[#656D4A]">{currentUser.employeeId}</span>
                  <span>•</span>
                  <span className="font-bold text-[#2C3524]">{currentUser.position || 'Staff Member'}</span>
                </div>
              </div>
            </div>

            <button
              id="btn-export-my-attendance"
              onClick={handleExportMySummary}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#D3D8C8] bg-[#F7F8F5] hover:bg-[#E6E8DE] text-xs font-bold text-[#2C3524] transition-colors shadow-xs"
            >
              <FileSpreadsheet className="w-4 h-4 text-[#656D4A]" />
              Export My Attendance Summary
            </button>
          </div>

          {/* Flexitime Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 pt-6 border-t border-gray-100">
            <div className="bg-[#F7F8F5] p-3.5 rounded-xl border border-[#D3D8C8]">
              <span className="text-[11px] font-bold text-[#656D4A] uppercase">Days Worked</span>
              <div className="text-xl font-extrabold text-[#2C3524] mt-1">{totalDaysWorked} Days</div>
            </div>

            <div className="bg-[#F7F8F5] p-3.5 rounded-xl border border-[#D3D8C8]">
              <span className="text-[11px] font-bold text-[#656D4A] uppercase">Net Worked Hours</span>
              <div className="text-xl font-extrabold text-[#2C3524] mt-1">{totalNetHours.toFixed(1)} hrs</div>
            </div>

            {canAccessCto ? (
              <div className="bg-amber-50 p-3.5 rounded-xl border border-amber-200">
                <span className="text-[11px] font-bold text-amber-800 uppercase">Available CTO Balance</span>
                <div className="text-xl font-extrabold text-amber-950 mt-1">{myCtoStats.availableBalance.toFixed(1)} hrs</div>
              </div>
            ) : (
              <div className="bg-sky-50 p-3.5 rounded-xl border border-sky-200">
                <span className="text-[11px] font-bold text-sky-800 uppercase">Overtime Hours</span>
                <div className="text-xl font-extrabold text-sky-900 mt-1">+{totalOvertime.toFixed(1)} hrs</div>
              </div>
            )}

            <div className="bg-amber-50 p-3.5 rounded-xl border border-amber-100">
              <span className="text-[11px] font-bold text-amber-700 uppercase">Undertime Deficit</span>
              <div className="text-xl font-extrabold text-amber-800 mt-1">-{totalUndertime.toFixed(1)} hrs</div>
            </div>
          </div>
        </div>
      )}

      {/* MY ASSIGNED WORK SCHEDULE IN TABULAR ROSTER FORM */}
      {(activeTab === 'my-schedule' || activeTab === 'all') && (
        <div className="space-y-4">
          <WorkScheduleManager
            currentUser={currentUser}
            users={users.length > 0 ? users : [currentUser]}
            schedules={schedules}
            ctoRequests={ctoRequests}
            summaries={summaries}
            isReadOnly={true}
          />
        </div>
      )}

      {/* COMPENSATORY TIME OFF (CTO LEAVE REQUESTS & BALANCES) - Restricted from STAFF */}
      {canAccessCto && (activeTab === 'my-cto' || activeTab === 'all') && (
        <CtoLeaveDashboard
          currentUser={currentUser}
          summaries={summaries}
          ctoRequests={ctoRequests}
          ctoAdjustments={ctoAdjustments}
          onSubmitCtoRequest={onSubmitCtoRequest}
        />
      )}

      {/* MY PUNCHES & DAILY FLEXITIME TRACKER WITH CTO & DATE RANGE */}
      {(activeTab === 'my-punches' || activeTab === 'all') && (
        <PersonalPunchesTable
          currentUser={currentUser}
          users={users}
          summaries={summaries}
          disputes={disputes}
          ctoRequests={ctoRequests}
          ctoAdjustments={ctoAdjustments}
          onSubmitCtoRequest={onSubmitCtoRequest}
          onUpdateSummaryAnomaly={onUpdateSummaryAnomaly}
          onSubmitDispute={onSubmitDispute}
        />
      )}

      {/* MY SUBMITTED DISPUTES TRACKER */}
      {(activeTab === 'my-disputes' || activeTab === 'all') && (
        <div className="bg-white rounded-2xl border border-[#D3D8C8] p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-[#2C3524]">My Dispute & Adjustment Tickets</h3>
              <p className="text-xs text-gray-500">Track status of submitted time adjustments and view approved adjustment history</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                id="btn-export-pdf-disputes-staff"
                onClick={() => {
                  const pendingItems = myDisputes.filter((d) => d.status === 'PENDING');
                  const historyItems = myDisputes.filter((d) => d.status !== 'PENDING');
                  const activeList =
                    staffDisputeFilter === 'PENDING'
                      ? pendingItems
                      : staffDisputeFilter === 'HISTORY'
                      ? historyItems
                      : myDisputes;
                  const itemsToExport = activeList.length > 0 ? activeList : myDisputes;
                  exportDisputesToPdf(itemsToExport, currentUser.branch || currentUser.department || 'Personal');
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-amber-400 text-xs font-extrabold border border-zinc-950 shadow-2xs transition-colors cursor-pointer shrink-0"
              >
                <FileText className="w-4 h-4 text-amber-400" />
                Export PDF (4/Page)
              </button>
              <button
                id="btn-file-time-adjustment-staff"
                onClick={() => handleOpenDispute()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 text-xs font-extrabold border border-zinc-950 shadow-2xs transition-colors cursor-pointer shrink-0"
              >
                <PlusCircle className="w-4 h-4" />
                File Time Adjustment Request
              </button>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 p-1 bg-zinc-100 rounded-xl text-xs font-bold border border-zinc-200">
            <button
              type="button"
              onClick={() => setStaffDisputeFilter('PENDING')}
              className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                staffDisputeFilter === 'PENDING'
                  ? 'bg-amber-400 text-zinc-950 font-black shadow-2xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Pending ({myDisputes.filter((d) => d.status === 'PENDING').length})
            </button>
            <button
              type="button"
              onClick={() => setStaffDisputeFilter('HISTORY')}
              className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                staffDisputeFilter === 'HISTORY'
                  ? 'bg-emerald-600 text-white font-black shadow-2xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Adjustment History ({myDisputes.filter((d) => d.status !== 'PENDING').length})
            </button>
            <button
              type="button"
              onClick={() => setStaffDisputeFilter('ALL')}
              className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                staffDisputeFilter === 'ALL'
                  ? 'bg-zinc-900 text-white font-black shadow-2xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              All ({myDisputes.length})
            </button>
          </div>

          <div>
            {(() => {
              const pendingItems = myDisputes.filter((d) => d.status === 'PENDING');
              const historyItems = myDisputes.filter((d) => d.status !== 'PENDING');
              const displayList =
                staffDisputeFilter === 'PENDING'
                  ? pendingItems
                  : staffDisputeFilter === 'HISTORY'
                  ? historyItems
                  : myDisputes;

              if (displayList.length === 0) {
                return (
                  <div className="p-8 text-center bg-zinc-50 rounded-2xl border border-dashed border-zinc-300 space-y-1">
                    <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto" />
                    <p className="text-xs font-bold text-zinc-700">
                      {staffDisputeFilter === 'PENDING'
                        ? 'No Pending Adjustment Tickets'
                        : staffDisputeFilter === 'HISTORY'
                        ? 'No Adjustment History Records'
                        : 'No Dispute Requests Filed'}
                    </p>
                    <p className="text-[11px] text-zinc-500">
                      {staffDisputeFilter === 'PENDING'
                        ? 'All your filed requests have been processed. Check "Adjustment History" to view past approvals.'
                        : 'You currently have no historical time adjustment tickets.'}
                    </p>
                  </div>
                );
              }

              const renderCard = (d: DisputeRequest) => (
                <div
                  key={d.id}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    d.status === 'PENDING'
                      ? 'border-amber-300 bg-amber-50/40'
                      : d.status === 'APPROVED'
                      ? 'border-emerald-300 bg-emerald-50/30'
                      : 'border-rose-200 bg-rose-50/30'
                  }`}
                >
                  <div className="flex items-center justify-between pb-2 border-b border-zinc-200/60">
                    <span className="text-xs font-extrabold text-[#2C3524]">Target Date: {d.date}</span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        d.status === 'PENDING'
                          ? 'bg-amber-400 text-zinc-950'
                          : d.status === 'APPROVED'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-rose-600 text-white'
                      }`}
                    >
                      {d.status === 'APPROVED' ? 'APPROVED (HISTORY)' : d.status === 'REJECTED' ? 'REJECTED (HISTORY)' : d.status}
                    </span>
                  </div>

                  <DisputeCardDetails dispute={d} />

                  {d.adminNotes && (
                    <div className="text-[11px] text-[#656D4A] font-semibold italic pt-1">
                      Note: {d.adminNotes}
                    </div>
                  )}
                </div>
              );

              if (staffDisputeFilter === 'ALL') {
                return (
                  <div className="space-y-6">
                    {pendingItems.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-black uppercase text-amber-900 tracking-wider flex items-center gap-1.5 border-b pb-1">
                          <Clock className="w-3.5 h-3.5 text-amber-600" /> Pending Tickets ({pendingItems.length})
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {pendingItems.map(renderCard)}
                        </div>
                      </div>
                    )}
                    {historyItems.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-black uppercase text-emerald-900 tracking-wider flex items-center gap-1.5 border-b pb-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Time Adjustment History ({historyItems.length})
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {historyItems.map(renderCard)}
                        </div>
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {displayList.map(renderCard)}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* FILE DISPUTE MODAL */}
      {showDisputeModal && (
        <TimeAdjustmentModal
          isOpen={showDisputeModal}
          onClose={() => setShowDisputeModal(false)}
          users={[currentUser]}
          currentUser={currentUser}
          preselectedSummary={selectedSummaryForDispute}
          onSubmitDispute={onSubmitDispute}
        />
      )}
    </div>
  );
};
