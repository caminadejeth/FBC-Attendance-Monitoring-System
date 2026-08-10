import React, { useState } from 'react';
import { DatePickerInput } from './DatePickerInput';
import { AttendanceSummaryDaily, CtoManualAdjustment, CtoRequest, DisputeRequest, User } from '../types';
import { TimeAdjustmentModal } from './TimeAdjustmentModal';
import { getUserCtoStats } from '../utils/ctoHelper';
import { formatTime12Hr, formatDateWithDay, formatDateMDYY, formatDateMDYYYY, getFilteredSummariesWithAbsents, parseToYYYYMMDD } from '../utils/timeFormatters';
import {
  showConfirmDisputeAlert,
  showDisputeSuccessAlert,
  showExportToast,
  showSuccessAlert,
  showErrorAlert,
  showRemarkPromptAlert,
  showActionSuccessToast,
} from '../utils/sweetAlerts';
import {
  Calendar,
  Clock,
  PlusCircle,
  FileText,
  CheckCircle2,
  AlertCircle,
  Clock3,
  CalendarDays,
  Filter,
  Award,
  Download,
  Sparkles,
  ArrowUpRight,
  ShieldAlert,
  MessageSquare,
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface PersonalPunchesTableProps {
  currentUser: User;
  summaries: AttendanceSummaryDaily[];
  ctoRequests: CtoRequest[];
  ctoAdjustments: CtoManualAdjustment[];
  onSubmitCtoRequest: (req: Omit<CtoRequest, 'id' | 'status' | 'submittedAt'>) => void;
  onUpdateSummaryAnomaly?: (summaryId: string, newNote: string) => void;
  onSubmitDispute?: (dispute: Omit<DisputeRequest, 'id' | 'status' | 'submittedAt'>) => void;
}

export const PersonalPunchesTable: React.FC<PersonalPunchesTableProps> = ({
  currentUser,
  summaries,
  ctoRequests,
  ctoAdjustments,
  onSubmitCtoRequest,
  onUpdateSummaryAnomaly,
  onSubmitDispute,
}) => {
  // Personal summaries for this user
  const mySummaries = summaries.filter((s) => s.employeeId === currentUser.employeeId);
  const myCtoRequests = ctoRequests.filter((r) => r.employeeId === currentUser.employeeId);

  // Date Range filter states
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [activePreset, setActivePreset] = useState<string>('ALL');

  // CTO Request Modal State
  const [showCtoModal, setShowCtoModal] = useState<boolean>(false);
  const [ctoRequestType, setCtoRequestType] = useState<'LEAVE' | 'CREDIT'>('CREDIT');
  const [ctoDate, setCtoDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [ctoHours, setCtoHours] = useState<number>(1.5);
  const [ctoReason, setCtoReason] = useState<string>('');

  // Time Adjustment / Dispute Modal State
  const [showDisputeModal, setShowDisputeModal] = useState<boolean>(false);
  const [selectedSummaryForDispute, setSelectedSummaryForDispute] = useState<AttendanceSummaryDaily | null>(null);

  // Calculate CTO Stats for current user
  const ctoStats = getUserCtoStats(currentUser.employeeId, summaries, ctoRequests, ctoAdjustments);

  // Quick Preset Date Helpers
  const handlePresetChange = (preset: string) => {
    setActivePreset(preset);
    const today = new Date();
    
    if (preset === 'THIS_PAY_PERIOD') {
      // 1-15 or 16-end
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
      // ALL
      setStartDate('');
      setEndDate('');
    }
  };

  // Filter summaries based on date range with Absent & Lacking detection
  const filteredSummaries = getFilteredSummariesWithAbsents(
    mySummaries,
    [currentUser],
    startDate,
    endDate,
    currentUser.employeeId
  );

  // Calculate totals for filtered range
  const totalCtoFiltered = filteredSummaries.reduce((sum, s) => sum + (s.ctoHoursEarned || 0), 0);
  const totalWorkedFiltered = filteredSummaries.reduce((sum, s) => sum + (s.netHoursWorked || 0), 0);

  // Submit CTO Request (Credit or Leave)
  const handleFormSubmitCto = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ctoReason.trim()) {
      showErrorAlert('Missing Reason', `Please enter a reason for your CTO ${ctoRequestType === 'CREDIT' ? 'credit' : 'leave'} request.`);
      return;
    }

    if (ctoRequestType === 'LEAVE' && ctoHours > ctoStats.availableBalance) {
      showErrorAlert(
        'Insufficient Balance Warning',
        `You requested ${ctoHours} hrs leave, but only have ${ctoStats.availableBalance.toFixed(1)} hrs available CTO balance. Your request will require special Payroll approval.`
      );
    }

    onSubmitCtoRequest({
      employeeId: currentUser.employeeId,
      employeeName: currentUser.name,
      department: currentUser.department,
      date: ctoDate,
      hoursRequested: Number(ctoHours),
      requestType: ctoRequestType,
      reason: ctoReason,
    });

    setShowCtoModal(false);
    setCtoReason('');
    showSuccessAlert(
      `CTO ${ctoRequestType === 'CREDIT' ? 'Credit' : 'Leave'} Request Transmitted!`,
      `Your CTO ${ctoRequestType === 'CREDIT' ? 'credit' : 'leave'} request for ${ctoDate} (${ctoHours} hrs) has been submitted for Payroll Department approval.`
    );
  };

  const handleOpenCreditModal = (s?: AttendanceSummaryDaily) => {
    setCtoRequestType('CREDIT');
    if (s) {
      setCtoDate(s.date);
      setCtoHours(s.ctoHoursEarned && s.ctoHoursEarned > 0 ? s.ctoHoursEarned : 1.5);
      setCtoReason(`Shift on ${formatDateWithDay(s.date, s.weekday)} extended beyond 10 hours (Worked ${s.netHoursWorked.toFixed(1)} hrs). Requesting CTO credit.`);
    } else {
      setCtoDate(new Date().toISOString().split('T')[0]);
      setCtoHours(1.5);
      setCtoReason('Requesting CTO credit for hours worked beyond 10 hours.');
    }
    setShowCtoModal(true);
  };

  // Export Personal Log Excel
  const handleExportPersonalLogs = () => {
    const exportData = filteredSummaries.map((s) => ({
      Date: s.date,
      Weekday: s.weekday,
      'Time-In': s.firstIn || '--',
      'Break-Out': s.breakOut || '--',
      'Break-In': s.breakIn || '--',
      'Time-Out': s.lastOut || '--',
      'Worked Hours': s.netHoursWorked.toFixed(1),
      OT: (s.overtimeHours || 0).toFixed(1),
      CTO: (s.ctoHoursEarned || 0).toFixed(1),
      Status: s.status,
      Remarks: s.anomalies.join(' | ') || 'Normal Shift',
    }));

    const filename = `${currentUser.employeeId}_Personal_Punches_${new Date().toISOString().split('T')[0]}.xlsx`;
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Personal Logs');
    XLSX.writeFile(wb, filename);

    showExportToast(filename);
  };

  return (
    <div className="space-y-6">
      {/* CTO Balance Banner & Action Header */}
      <div className="bg-gradient-to-r from-zinc-900 via-zinc-950 to-zinc-900 rounded-2xl border-2 border-zinc-950 p-5 sm:p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center relative z-10">
          {/* Left: Balance Card */}
          <div className="lg:col-span-7 space-y-3">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-400 text-zinc-950">
                Compensatory Time Off (CTO)
              </span>
              <span className="text-xs text-zinc-400 font-mono">ID: {currentUser.employeeId}</span>
            </div>

            <div className="flex items-baseline gap-3">
              <h3 className="text-3xl sm:text-4xl font-black tracking-tight text-amber-400 font-mono">
                {ctoStats.availableBalance.toFixed(1)}{' '}
                <span className="text-lg font-bold text-zinc-300 font-sans">hrs</span>
              </h3>
              <p className="text-xs text-zinc-300 font-medium">Available CTO Balance</p>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed max-w-xl">
              All staff time beyond <strong className="text-amber-300">10 net worked hours</strong> (with 1.0 hr automatic break deduction) is subject to CTO. Submit a <strong className="text-amber-300">Request CTO Credit</strong> with reason for Payroll approval before hours are added to your balance.
            </p>

            {/* Breakdown stats */}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-zinc-800 text-xs">
              <div>
                <span className="text-zinc-500 block text-[10px] font-semibold uppercase">Approved CTO Credits</span>
                <span className="font-bold font-mono text-emerald-400">+{ctoStats.creditedApproved.toFixed(1)} hrs</span>
              </div>
              <div>
                <span className="text-zinc-500 block text-[10px] font-semibold uppercase">Payroll Adjustments</span>
                <span className={`font-bold font-mono ${ctoStats.manualAdjustments >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {ctoStats.manualAdjustments >= 0 ? `+${ctoStats.manualAdjustments.toFixed(1)}` : ctoStats.manualAdjustments.toFixed(1)} hrs
                </span>
              </div>
              <div>
                <span className="text-zinc-500 block text-[10px] font-semibold uppercase">Used / Approved Leaves</span>
                <span className="font-bold font-mono text-amber-300">-{ctoStats.usedApproved.toFixed(1)} hrs</span>
              </div>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="lg:col-span-5 flex flex-col sm:flex-row lg:flex-col gap-2 justify-center items-stretch border-t lg:border-t-0 lg:border-l border-zinc-800 pt-4 lg:pt-0 lg:pl-6">
            <button
              id="btn-request-cto-credit"
              onClick={() => handleOpenCreditModal()}
              className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black text-xs uppercase tracking-wider py-2.5 px-4 rounded-xl border border-zinc-950 shadow-md transition-all cursor-pointer active:scale-95"
            >
              <Sparkles className="w-4 h-4 text-zinc-950" /> Request CTO Credit
            </button>

            <button
              id="btn-file-cto-leave"
              onClick={() => {
                setCtoRequestType('LEAVE');
                setCtoHours(8.0);
                setCtoDate(new Date().toISOString().split('T')[0]);
                setCtoReason('');
                setShowCtoModal(true);
              }}
              className="flex items-center justify-center gap-2 bg-amber-400 hover:bg-amber-300 text-zinc-950 font-black text-xs uppercase tracking-wider py-2 px-4 rounded-xl border border-zinc-950 transition-all cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" /> File CTO Leave Request
            </button>

            {onSubmitDispute && (
              <button
                id="btn-file-time-adjustment-personal"
                onClick={() => {
                  setSelectedSummaryForDispute(null);
                  setShowDisputeModal(true);
                }}
                className="flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs py-2 px-4 rounded-xl border border-zinc-700 transition-all cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5" /> File Time Adjustment
              </button>
            )}

            <button
              id="btn-export-personal-punches"
              onClick={handleExportPersonalLogs}
              className="flex items-center justify-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 font-bold text-[11px] py-1.5 px-4 rounded-xl border border-zinc-800 transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> Export Excel Log
            </button>
          </div>
        </div>
      </div>

      {/* Date Range Filter Bar */}
      <div className="bg-white rounded-2xl border-2 border-zinc-950 p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-amber-600" />
            <h4 className="text-xs font-black uppercase tracking-wider text-zinc-900">
              Filter Date Range
            </h4>
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
                    ? 'bg-amber-400 text-zinc-950 border border-zinc-950 shadow-xs'
                    : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 border border-zinc-200'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Start & End Date Pickers */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-zinc-100">
          <DatePickerInput
            label="Start Date (Month/Day/Year)"
            value={startDate}
            onChange={(val) => {
              setStartDate(val);
              setActivePreset('CUSTOM');
            }}
          />

          <DatePickerInput
            label="End Date (Month/Day/Year)"
            value={endDate}
            onChange={(val) => {
              setEndDate(val);
              setActivePreset('CUSTOM');
            }}
          />

          <div className="sm:col-span-2 lg:col-span-2 flex items-end justify-between bg-amber-50/80 border border-amber-200 rounded-xl p-2.5 text-xs">
            <div>
              <span className="text-[10px] font-black uppercase text-amber-800 block">
                Filtered Summary Totals {startDate && endDate ? `(${formatDateMDYYYY(startDate)} – ${formatDateMDYYYY(endDate)})` : ''}
              </span>
              <div className="flex gap-4 font-mono font-bold text-zinc-900 text-xs mt-0.5">
                <span>Total Net Hours: <strong className="text-zinc-950">{totalWorkedFiltered.toFixed(1)}h</strong></span>
                <span>Potential CTO Eligible: <strong className="text-emerald-700">+{totalCtoFiltered.toFixed(1)}h</strong></span>
              </div>
            </div>

            {(startDate || endDate) && (
              <button
                onClick={() => handlePresetChange('ALL')}
                className="text-[10px] font-extrabold text-amber-900 underline hover:text-amber-700 cursor-pointer"
              >
                Clear Filter
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Personal Attendance Log Table */}
      <div className="bg-white rounded-2xl border-2 border-zinc-950 overflow-hidden shadow-xl">
        <div className="p-4 bg-zinc-900 text-white flex items-center justify-between border-b-2 border-zinc-950">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            <h3 className="font-black uppercase tracking-tight text-xs text-amber-400">
              Personal Attendance & Punch History ({filteredSummaries.length} Records)
            </h3>
          </div>
          <span className="text-[10px] font-mono font-semibold text-zinc-400">
            FBC Standard 8-Hour Target (1.0 Hr Mandatory Break Deducted)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table id="personal-punches-table" className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-amber-400 text-zinc-950 font-black uppercase text-[11px] border-b-2 border-zinc-950 tracking-wider">
                <th className="py-3 px-4 border-r border-zinc-950/20">Date</th>
                <th className="py-3 px-4 border-r border-zinc-950/20">Branch</th>
                <th className="py-3 px-4 border-r border-zinc-950/20">Time-In</th>
                <th className="py-3 px-4 border-r border-zinc-950/20">Break-Out</th>
                <th className="py-3 px-4 border-r border-zinc-950/20">Break-In</th>
                <th className="py-3 px-4 border-r border-zinc-950/20">Time-Out</th>
                <th className="py-3 px-4 border-r border-zinc-950/20 text-center">Status</th>
                <th className="py-3 px-4 border-r border-zinc-950/20 text-center">CTO Eligible</th>
                <th className="py-3 px-4 text-center">Anomalies / Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 font-medium text-zinc-800">
              {filteredSummaries.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-zinc-500 bg-zinc-50">
                    <p className="font-extrabold text-sm text-zinc-700">No attendance logs found for selected date range.</p>
                    <p className="text-xs mt-1 text-zinc-500">Try adjusting your date filters or upload recent ZKTeco biometric exports.</p>
                  </td>
                </tr>
              ) : (
                filteredSummaries.map((s) => {
                  const hasCto = (s.ctoHoursEarned || 0) > 0;
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
                    <tr key={s.id} className="hover:bg-amber-50/50 transition-colors">
                      {/* Date */}
                      <td className="py-3 px-4 font-bold text-zinc-950 whitespace-nowrap">
                        {formatDateWithDay(s.date, s.weekday)}
                      </td>

                      {/* Branch */}
                      <td className="py-3 px-4 text-xs font-semibold text-zinc-800 whitespace-nowrap">
                        <span className="bg-zinc-100 text-zinc-800 px-2 py-0.5 rounded border border-zinc-300 font-medium">
                          {s.branch || s.department || 'Main Branch'}
                        </span>
                      </td>

                      {/* Time-In */}
                      <td className="py-3 px-4 font-mono font-semibold whitespace-nowrap text-zinc-900">
                        {s.firstIn ? (
                          <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            {formatTime12Hr(s.firstIn)}
                          </span>
                        ) : (
                          <span className="text-rose-500 font-bold">No Data</span>
                        )}
                      </td>

                      {/* Break-Out */}
                      <td className="py-3 px-4 font-mono text-zinc-700 whitespace-nowrap">
                        {s.breakOut ? formatTime12Hr(s.breakOut) : 'No Data'}
                      </td>

                      {/* Break-In */}
                      <td className="py-3 px-4 font-mono text-zinc-700 whitespace-nowrap">
                        {s.breakIn ? formatTime12Hr(s.breakIn) : 'No Data'}
                      </td>

                      {/* Time-Out */}
                      <td className="py-3 px-4 font-mono font-semibold whitespace-nowrap text-zinc-900">
                        {s.lastOut ? (
                          <span className="text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            {formatTime12Hr(s.lastOut)}
                          </span>
                        ) : (
                          <span className="text-rose-500 font-bold">No Data</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {s.status === 'LEAVE' ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-400 text-zinc-950 border-2 border-amber-600 shadow-2xs flex items-center justify-center gap-1">
                            <Award className="w-3.5 h-3.5 text-zinc-950" />
                            Leave (CTO)
                          </span>
                        ) : isAbsent ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-950 border border-rose-300">
                            ✕ Absent
                          </span>
                        ) : missingPunches.length > 0 ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-950 border border-amber-400">
                            ⚡ Missing {missingPunches.join(', ')}
                          </span>
                        ) : s.status === 'COMPLETE' ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300">
                            ✓ Complete
                          </span>
                        ) : s.status === 'UNDERTIME' ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300">
                            ⚠ Undertime
                          </span>
                        ) : s.status === 'OVERBREAK' ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-950 border border-rose-400">
                            ⚡ Overbreak
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-gray-100 text-gray-800 border border-gray-300">
                            {s.status}
                          </span>
                        )}
                      </td>

                      {/* CTO Eligible */}
                      <td className="py-3 px-4 text-center whitespace-nowrap font-mono font-bold">
                        {hasCto ? (
                          <button
                            onClick={() => handleOpenCreditModal(s)}
                            className="inline-flex items-center gap-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-950 px-2.5 py-1 rounded-full border border-emerald-300 text-[11px] font-black shadow-2xs transition-colors cursor-pointer"
                            title="Click to request CTO credit approval"
                          >
                            <Sparkles className="w-3 h-3 text-emerald-600" />
                            +{(s.ctoHoursEarned || 0).toFixed(1)} h Credit
                          </button>
                        ) : (
                          <span className="text-zinc-400 font-normal">--</span>
                        )}
                      </td>

                      {/* Anomalies / Notes */}
                      <td className="py-3 px-4 text-xs font-medium">
                        <div className="flex items-center justify-between gap-2 min-w-[200px]">
                          <span className="text-zinc-700 text-[11px] font-semibold" title={s.anomalies.length > 0 ? s.anomalies.join(' | ') : 'Normal Shift'}>
                            {s.anomalies.length > 0 ? s.anomalies.join(' | ') : 'Normal Shift'}
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {onSubmitDispute && (
                              <button
                                onClick={() => {
                                  setSelectedSummaryForDispute(s);
                                  setShowDisputeModal(true);
                                }}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 border border-amber-300 text-[10px] font-bold text-amber-950 transition-colors shadow-2xs cursor-pointer"
                                title="File time adjustment request for this date"
                              >
                                <AlertCircle className="w-3 h-3 text-amber-800" />
                                Adjust
                              </button>
                            )}

                            <button
                              onClick={async () => {
                                const res = await showRemarkPromptAlert(
                                  s.employeeName || currentUser.name,
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
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-amber-100 border border-zinc-300 text-[10px] font-bold text-zinc-900 shrink-0 transition-colors shadow-2xs cursor-pointer"
                              title="Add or edit anomalies/notes"
                            >
                              <MessageSquare className="w-3 h-3 text-amber-600" />
                              Notes
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {filteredSummaries.length > 0 && (
              <tfoot>
                <tr className="bg-zinc-950 text-white font-black uppercase text-xs border-t-2 border-zinc-950">
                  <td colSpan={6} className="py-3 px-4 text-right tracking-wider">
                    Total Potential CTO Eligible:
                  </td>
                  <td className="py-3 px-4 text-center font-mono text-emerald-400">
                    +{totalCtoFiltered.toFixed(1)} hrs
                  </td>
                  <td className="py-3 px-4"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* CTO Request Status List */}
      <div className="bg-white rounded-2xl border-2 border-zinc-950 p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-amber-600" />
            <h4 className="font-black text-xs uppercase tracking-wider text-zinc-950">
              My CTO Requests ({myCtoRequests.length})
            </h4>
          </div>
          <span className="text-xs text-zinc-500">Subject to Payroll Approval</span>
        </div>

        {myCtoRequests.length === 0 ? (
          <p className="text-xs text-zinc-500 italic py-2">
            No CTO credit or leave requests filed yet. Use "Request CTO Credit" for extra hours or "File CTO Leave Request" when planning time off.
          </p>
        ) : (
          <div className="space-y-2">
            {myCtoRequests.map((req) => (
              <div
                key={req.id}
                className="bg-zinc-50 border border-zinc-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {req.requestType === 'CREDIT' ? (
                      <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 font-black text-[10px] px-2 py-0.5 rounded-full uppercase">
                        + CTO Credit Request
                      </span>
                    ) : (
                      <span className="bg-amber-100 text-amber-900 border border-amber-300 font-black text-[10px] px-2 py-0.5 rounded-full uppercase">
                        - CTO Leave Request
                      </span>
                    )}
                    <span className="font-extrabold text-xs text-zinc-950">{req.date}</span>
                    <span className="bg-zinc-200 text-zinc-900 font-mono font-bold text-[10px] px-2 py-0.5 rounded-full">
                      {req.hoursRequested.toFixed(1)} hrs
                    </span>
                  </div>
                  <p className="text-xs text-zinc-700">{req.reason}</p>
                  <p className="text-[10px] text-zinc-400">Submitted on: {req.submittedAt}</p>
                </div>

                <div className="flex items-center gap-2">
                  {req.status === 'PENDING' && (
                    <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black uppercase px-3 py-1 rounded-full">
                      <Clock3 className="w-3 h-3" /> Pending Payroll Review
                    </span>
                  )}
                  {req.status === 'APPROVED' && (
                    <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] font-black uppercase px-3 py-1 rounded-full">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Approved by {req.reviewedBy || 'Payroll'}
                    </span>
                  )}
                  {req.status === 'REJECTED' && (
                    <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-900 border border-rose-300 text-[10px] font-black uppercase px-3 py-1 rounded-full">
                      <AlertCircle className="w-3 h-3 text-rose-600" /> Rejected by {req.reviewedBy || 'Branch Manager'}{req.reviewNotes ? ` - "${req.reviewNotes}"` : ''}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CTO Request Modal (Credit / Leave) */}
      {showCtoModal && (
        <div className="fixed inset-0 z-50 bg-zinc-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border-2 border-zinc-950 max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-500" />
                <h3 className="font-black text-sm uppercase tracking-tight text-zinc-950">
                  Compensatory Time Off (CTO) Request
                </h3>
              </div>
              <button
                onClick={() => setShowCtoModal(false)}
                className="text-zinc-400 hover:text-zinc-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Type Selector Tabs */}
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-zinc-100 rounded-xl text-xs font-black">
              <button
                type="button"
                onClick={() => {
                  setCtoRequestType('CREDIT');
                  setCtoHours(1.5);
                }}
                className={`py-2 px-3 rounded-lg text-center transition-all cursor-pointer ${
                  ctoRequestType === 'CREDIT'
                    ? 'bg-emerald-500 text-zinc-950 shadow-xs border border-zinc-950'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                + Request CTO Credit
              </button>
              <button
                type="button"
                onClick={() => {
                  setCtoRequestType('LEAVE');
                  setCtoHours(8.0);
                }}
                className={`py-2 px-3 rounded-lg text-center transition-all cursor-pointer ${
                  ctoRequestType === 'LEAVE'
                    ? 'bg-amber-400 text-zinc-950 shadow-xs border border-zinc-950'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                - File CTO Leave Request
              </button>
            </div>

            <form onSubmit={handleFormSubmitCto} className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs space-y-1">
                <span className="font-bold text-amber-900 block">Current Available CTO Balance:</span>
                <span className="font-mono text-xl font-black text-amber-950">
                  {ctoStats.availableBalance.toFixed(1)} hours
                </span>
                <p className="text-[10px] text-amber-800 leading-tight">
                  {ctoRequestType === 'CREDIT'
                    ? 'Hours will be added to your balance once approved by the Payroll department.'
                    : 'Hours will be deducted from your balance once approved by the Payroll department.'}
                </p>
              </div>

              <div>
                <DatePickerInput
                  label={ctoRequestType === 'CREDIT' ? 'Date of Work / Shift' : 'Date of Absence / Leave'}
                  value={ctoDate}
                  onChange={(val) => setCtoDate(val)}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-zinc-700 mb-1">
                  {ctoRequestType === 'CREDIT' ? 'CTO Hours to Request Credit' : 'CTO Hours to Deduct'}
                </label>
                {ctoRequestType === 'CREDIT' ? (
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="24"
                    value={ctoHours}
                    onChange={(e) => setCtoHours(Number(e.target.value))}
                    className="w-full bg-zinc-50 border border-zinc-300 rounded-xl p-2.5 text-xs font-bold text-zinc-900 focus:ring-2 focus:ring-amber-400 focus:outline-none"
                    required
                  />
                ) : (
                  <select
                    value={ctoHours}
                    onChange={(e) => setCtoHours(Number(e.target.value))}
                    className="w-full bg-zinc-50 border border-zinc-300 rounded-xl p-2.5 text-xs font-bold text-zinc-900 focus:ring-2 focus:ring-amber-400 focus:outline-none"
                  >
                    <option value={8.0}>8.0 Hours (Full Day Shift Leave)</option>
                    <option value={4.0}>4.0 Hours (Half Day Shift Leave)</option>
                    <option value={2.0}>2.0 Hours (Early Off / Late In)</option>
                    <option value={1.0}>1.0 Hour (Partial Leave)</option>
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-zinc-700 mb-1">
                  Reason for Request <span className="text-rose-600">*</span>
                </label>
                <textarea
                  value={ctoReason}
                  onChange={(e) => setCtoReason(e.target.value)}
                  placeholder={
                    ctoRequestType === 'CREDIT'
                      ? 'e.g. Worked shift beyond 10 hours due to evening rush and restocking...'
                      : 'e.g. Personal family errand / medical appointment...'
                  }
                  rows={3}
                  required
                  className="w-full bg-zinc-50 border border-zinc-300 rounded-xl p-2.5 text-xs font-medium text-zinc-900 focus:ring-2 focus:ring-amber-400 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowCtoModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-600 bg-zinc-100 hover:bg-zinc-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-zinc-950 border border-zinc-950 shadow-xs cursor-pointer ${
                    ctoRequestType === 'CREDIT' ? 'bg-emerald-400 hover:bg-emerald-300' : 'bg-amber-400 hover:bg-amber-300'
                  }`}
                >
                  Transmit to Payroll
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Time Adjustment / Dispute Modal */}
      {showDisputeModal && onSubmitDispute && (
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
