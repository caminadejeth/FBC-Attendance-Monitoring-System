import React, { useState } from 'react';
import { AttendanceSummaryDaily, CtoManualAdjustment, CtoRequest, DisputeRequest, User, WorkSchedule } from '../types';
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
import * as XLSX from 'xlsx';
import {
  Clock,
  Calendar,
  AlertCircle,
  FileSpreadsheet,
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

  // File Dispute Modal State
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [selectedSummaryForDispute, setSelectedSummaryForDispute] = useState<AttendanceSummaryDaily | null>(null);
  const [disputeType, setDisputeType] = useState<DisputeRequest['type']>('MISSING_PUNCH');
  const [disputeReason, setDisputeReason] = useState('');
  const [requestedIn, setRequestedIn] = useState('08:00:00');
  const [requestedOut, setRequestedOut] = useState('17:00:00');

  // Personal Totals Calculations
  const myCtoStats = getUserCtoStats(currentUser.employeeId, mySummaries, ctoRequests, ctoAdjustments);
  const totalDaysWorked = mySummaries.filter((s) => s.netHoursWorked > 0 || s.firstIn).length;
  const totalNetHours = mySummaries.reduce((acc, s) => acc + s.netHoursWorked, 0);
  const totalUndertime = mySummaries.reduce((acc, s) => acc + s.undertimeHours, 0);

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

  // Export Individual Attendance Summary
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
                  {currentUser.name.substring(0, 2).toUpperCase()}
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

            <div className="bg-amber-50 p-3.5 rounded-xl border border-amber-200">
              <span className="text-[11px] font-bold text-amber-800 uppercase">Available CTO Balance</span>
              <div className="text-xl font-extrabold text-amber-950 mt-1">{myCtoStats.availableBalance.toFixed(1)} hrs</div>
            </div>

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

      {/* COMPENSATORY TIME OFF (CTO LEAVE REQUESTS & BALANCES) */}
      {(activeTab === 'my-cto' || activeTab === 'all') && (
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
          summaries={summaries}
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
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-[#2C3524]">My Dispute & Adjustment Tickets</h3>
              <p className="text-xs text-gray-500">Track status of submitted disputes with management</p>
            </div>
            <button
              id="btn-file-time-adjustment-staff"
              onClick={() => handleOpenDispute()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 text-xs font-extrabold border border-zinc-950 shadow-2xs transition-colors cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              File Time Adjustment Request
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {myDisputes.length === 0 ? (
              <div className="col-span-2 p-8 text-center text-gray-400">
                You have not filed any dispute requests yet.
              </div>
            ) : (
              myDisputes.map((d) => (
                <div
                  key={d.id}
                  className="p-4 rounded-xl border border-gray-200 bg-white space-y-2"
                >
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

                  <DisputeCardDetails dispute={d} />

                  {d.adminNotes && (
                    <div className="text-[11px] text-[#656D4A] font-semibold italic">
                      Admin Note: {d.adminNotes}
                    </div>
                  )}
                </div>
              ))
            )}
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
