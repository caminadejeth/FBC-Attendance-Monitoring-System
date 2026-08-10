import React, { useState, useMemo } from 'react';
import { User, AttendanceSummaryDaily, DisputeRequest, BiometricPunch } from '../types';
import {
  formatDateMDYYYY,
  formatDateMDYY,
  formatTime12Hr,
  getBreakTimes,
  calculateGrossHours,
  getFilteredSummariesWithAbsents,
  parseToYYYYMMDD,
} from '../utils/timeFormatters';
import { showExportToast, yellowCabSwal } from '../utils/sweetAlerts';
import * as XLSX from 'xlsx';
import {
  Search,
  Printer,
  Download,
  UserCheck,
  Calendar,
  Clock,
  Building2,
  CheckCircle2,
  AlertCircle,
  FileText,
  Filter,
  Award,
  ChevronDown,
} from 'lucide-react';

interface EmployeeDtrSheetProps {
  users: User[];
  summaries: AttendanceSummaryDaily[];
  disputes?: DisputeRequest[];
  punches?: BiometricPunch[];
  currentUser?: User;
}

export const EmployeeDtrSheet: React.FC<EmployeeDtrSheetProps> = ({
  users,
  summaries,
  disputes = [],
  currentUser,
}) => {
  // Default selected user to current user or first active employee
  const activeUsers = useMemo(() => users.filter((u) => u.status === 'ACTIVE'), [users]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(
    currentUser?.employeeId || activeUsers[0]?.employeeId || ''
  );

  // Search input term for employee selection
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState<string>('');
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState<boolean>(false);

  // Date Range Presets
  const [payPeriodPreset, setPayPeriodPreset] = useState<string>('ALL_UPLOADED');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Currently selected user object
  const selectedUser = useMemo(() => {
    return (
      users.find((u) => u.employeeId === selectedEmployeeId) ||
      users[0] || {
        id: '1',
        employeeId: 'YC-1000',
        name: 'Employee',
        email: 'employee@yellowcab.ph',
        pin: '1234',
        role: 'STAFF',
        department: 'Operations',
        position: 'Staff',
        hourlyRate: 85,
        status: 'ACTIVE',
      }
    );
  }, [users, selectedEmployeeId]);

  // Filtered employees list for dropdown search
  const filteredUsersForSearch = useMemo(() => {
    if (!employeeSearchTerm.trim()) return activeUsers;
    const term = employeeSearchTerm.toLowerCase();
    return activeUsers.filter(
      (u) =>
        u.name.toLowerCase().includes(term) ||
        u.employeeId.toLowerCase().includes(term) ||
        u.department.toLowerCase().includes(term)
    );
  }, [activeUsers, employeeSearchTerm]);

  // Preset Date Helper
  const handlePresetChange = (preset: string) => {
    setPayPeriodPreset(preset);
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    const monthStr = month < 10 ? `0${month}` : `${month}`;

    if (preset === '1ST_HALF') {
      setStartDate(`${year}-${monthStr}-01`);
      setEndDate(`${year}-${monthStr}-15`);
    } else if (preset === '2ND_HALF') {
      const lastDay = new Date(year, today.getMonth() + 1, 0).getDate();
      setStartDate(`${year}-${monthStr}-16`);
      setEndDate(`${year}-${monthStr}-${lastDay}`);
    } else if (preset === 'THIS_MONTH') {
      const lastDay = new Date(year, today.getMonth() + 1, 0).getDate();
      setStartDate(`${year}-${monthStr}-01`);
      setEndDate(`${year}-${monthStr}-${lastDay}`);
    } else if (preset === 'ALL_UPLOADED') {
      setStartDate('');
      setEndDate('');
    }
  };

  // Get employee daily DTR summaries filtered by selected employee and date range
  const employeeDtrLogs = useMemo(() => {
    if (!selectedUser) return [];

    // Filter summaries for this specific employee
    let empSummaries = summaries.filter((s) => s.employeeId === selectedUser.employeeId);

    if (startDate && endDate) {
      empSummaries = getFilteredSummariesWithAbsents(
        empSummaries,
        [selectedUser],
        startDate,
        endDate,
        selectedUser.employeeId
      );
    }

    // Sort chronologically (oldest to newest for DTR sheet view)
    return empSummaries.sort((a, b) => a.date.localeCompare(b.date));
  }, [summaries, selectedUser, startDate, endDate]);

  // Calculate totals for selected employee DTR
  const totalDaysWorked = employeeDtrLogs.filter(
    (s) => s.status !== 'ABSENT' && (s.firstIn || s.lastOut || s.netHoursWorked > 0)
  ).length;

  const totalNetHours = employeeDtrLogs.reduce((acc, s) => acc + (s.netHoursWorked || 0), 0);
  const totalOvertimeHours = employeeDtrLogs.reduce((acc, s) => acc + (s.overtimeHours || 0), 0);
  const totalUndertimeHours = employeeDtrLogs.reduce((acc, s) => acc + (s.undertimeHours || 0), 0);

  // Handle Print Action
  const handlePrintDtr = () => {
    window.print();
  };

  // Handle Export Excel Action
  const handleExportExcel = () => {
    if (!selectedUser || employeeDtrLogs.length === 0) {
      yellowCabSwal.fire({
        icon: 'warning',
        title: 'No Data to Export',
        text: 'Please select an employee with recorded attendance logs.',
      });
      return;
    }

    const exportRows = employeeDtrLogs.map((s) => {
      const breakTimes = getBreakTimes(s.punches);
      const grossHours = calculateGrossHours(s.firstIn, s.lastOut);

      const isAbsent = s.status === 'ABSENT';
      const hasClockIn = Boolean(s.firstIn && s.firstIn !== 'No Data' && s.firstIn !== '--');
      const hasClockOut = Boolean(s.lastOut && s.lastOut !== 'No Data' && s.lastOut !== '--');
      const isPresent = !isAbsent && (hasClockIn || hasClockOut || (s.netHoursWorked && s.netHoursWorked > 0));

      const hasBreakOut = Boolean(breakTimes.breakOut && breakTimes.breakOut !== 'No Data' && breakTimes.breakOut !== '--');
      const hasBreakIn = Boolean(breakTimes.breakIn && breakTimes.breakIn !== 'No Data' && breakTimes.breakIn !== '--');

      const isMissingBreakOut = isPresent && !hasBreakOut;
      const isMissingBreakIn = isPresent && !hasBreakIn;

      const breakOutStr = isMissingBreakOut ? 'Missing Break-Out' : breakTimes.breakOut === 'No Data' || !breakTimes.breakOut ? 'No Data' : breakTimes.breakOut;
      const breakInStr = isMissingBreakIn ? 'Missing Break-In' : breakTimes.breakIn === 'No Data' || !breakTimes.breakIn ? 'No Data' : breakTimes.breakIn;

      const breakStatusNote = isMissingBreakOut && isMissingBreakIn
        ? 'Missing Break-In/Out'
        : isMissingBreakOut
        ? 'Missing Break-Out'
        : isMissingBreakIn
        ? 'Missing Break-In'
        : null;

      return {
        'Employee ID': selectedUser.employeeId,
        'Employee Name': selectedUser.name,
        Department: selectedUser.department,
        Date: formatDateMDYYYY(s.date),
        Day: s.weekday,
        'Clock In (Time-In)': s.firstIn ? formatTime12Hr(s.firstIn) : 'No Data',
        'Break Out': breakOutStr,
        'Break In': breakInStr,
        'Clock Out (Time-Out)': s.lastOut ? formatTime12Hr(s.lastOut) : 'No Data',
        'Total Break (Mins)': `${s.totalBreakMinutes}m`,
        'Gross Hours': grossHours.toFixed(1),
        'Worked Hours (Net)': s.netHoursWorked.toFixed(1),
        'Undertime Deficit': s.undertimeHours > 0 ? `-${s.undertimeHours.toFixed(1)}h` : '0.0h',
        'Overtime Hours': s.overtimeHours > 0 ? `+${s.overtimeHours.toFixed(1)}h` : '0.0h',
        Status: breakStatusNote || s.status,
        Remarks: [breakStatusNote, ...s.anomalies].filter(Boolean).join('; ') || 'OK',
      };
    });

    const filename = `DTR_${selectedUser.employeeId}_${selectedUser.name.replace(/\s+/g, '_')}.xlsx`;
    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Daily Time Record');
    XLSX.writeFile(wb, filename);

    showExportToast(filename);
  };

  return (
    <div className="space-y-6">
      {/* Printable CSS Injection */}
      <style>{`
        @media print {
          @page {
            size: portrait;
            margin: 10mm;
          }
          body {
            background: white !important;
            color: black !important;
          }
          header, footer, nav, sidebar, aside, .no-print {
            display: none !important;
          }
          #printable-dtr-sheet {
            display: block !important;
            visibility: visible !important;
            position: static !important;
            width: 100% !important;
            box-shadow: none !important;
            border: 1px solid #222 !important;
            padding: 15px !important;
            margin: 0 !important;
          }
          #printable-dtr-sheet * {
            visibility: visible !important;
          }
        }
      `}</style>

      {/* SEARCH & CONTROLS HEADER BAR (Screen Only) */}
      <div className="bg-white rounded-2xl border border-[#D3D8C8] p-5 shadow-xs space-y-4 no-print">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-gray-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                <Clock className="w-3.5 h-3.5 text-amber-800" /> Daily Time Record (DTR) Form Generator
              </span>
            </div>
            <h1 className="text-xl font-black text-[#2C3524] mt-1 flex items-center gap-2">
              Official Employee DTR Sheet & Audit Logs
            </h1>
            <p className="text-xs text-gray-500">
              Search employee name or ID to generate their printable DTR statement with Time-In, Break-Out, Break-In, Time-Out, and computed hours.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handlePrintDtr}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-black text-xs uppercase tracking-wider border border-zinc-950 shadow-xs transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" /> Print DTR Sheet
            </button>
            <button
              onClick={handleExportExcel}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-gray-800 font-bold text-xs shadow-2xs transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4 text-emerald-700" /> Export Excel
            </button>
          </div>
        </div>

        {/* SEARCH EMPLOYEE & PAY PERIOD CONTROLS */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          {/* Employee Search & Select Box */}
          <div className="md:col-span-5 relative">
            <label className="block text-xs font-black text-gray-700 uppercase tracking-wider mb-1">
              Search Employee Name / ID:
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3 z-10" />
              <input
                type="text"
                value={employeeSearchTerm}
                onFocus={() => setShowEmployeeDropdown(true)}
                onChange={(e) => {
                  setEmployeeSearchTerm(e.target.value);
                  setShowEmployeeDropdown(true);
                }}
                placeholder="Search employee name or ID (e.g. Juan, YC-1002)..."
                className="w-full pl-9 pr-9 py-2 border-2 border-amber-300 rounded-xl text-xs font-bold text-gray-900 bg-amber-50/30 focus:ring-2 focus:ring-amber-500 focus:bg-white focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowEmployeeDropdown(!showEmployeeDropdown)}
                className="absolute right-3 top-2.5 text-gray-500 hover:text-gray-800 cursor-pointer"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>

            {/* Dropdown Results */}
            {showEmployeeDropdown && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white border-2 border-gray-200 rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto divide-y divide-gray-100">
                {filteredUsersForSearch.length === 0 ? (
                  <div className="p-3 text-xs text-gray-400 text-center">No employee found matching query</div>
                ) : (
                  filteredUsersForSearch.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => {
                        setSelectedEmployeeId(user.employeeId);
                        setEmployeeSearchTerm(`${user.name} (${user.employeeId})`);
                        setShowEmployeeDropdown(false);
                      }}
                      className={`w-full text-left p-2.5 flex items-center justify-between hover:bg-amber-50 transition-colors cursor-pointer ${
                        user.employeeId === selectedEmployeeId ? 'bg-amber-100/60 font-bold' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-amber-400 text-zinc-950 flex items-center justify-center font-black text-xs border border-zinc-900">
                          {user.name.charAt(0)}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-gray-900">{user.name}</div>
                          <div className="text-[10px] text-gray-500">{user.department} • {user.position}</div>
                        </div>
                      </div>
                      <span className="font-mono text-[11px] font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                        {user.employeeId}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Pay Period Range Selection */}
          <div className="md:col-span-7 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-black text-gray-700 uppercase tracking-wider">
                Pay Period Range Selection:
              </label>
              {(startDate || endDate) && (
                <button
                  type="button"
                  onClick={() => handlePresetChange('ALL_UPLOADED')}
                  className="text-[11px] font-bold text-amber-800 hover:underline cursor-pointer"
                >
                  Clear Date Filter
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'ALL_UPLOADED', label: 'All Uploaded Logs' },
                { id: '1ST_HALF', label: '1st - 15th' },
                { id: '2ND_HALF', label: '16th - End' },
                { id: 'THIS_MONTH', label: 'This Month' },
              ].map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handlePresetChange(preset.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                    payPeriodPreset === preset.id
                      ? 'bg-amber-400 text-zinc-950 border border-zinc-950 shadow-2xs'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Custom Date Pickers */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[11px] font-bold text-gray-500">Custom Range:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPayPeriodPreset('CUSTOM');
                }}
                className="px-2.5 py-1 border border-gray-300 rounded-lg text-xs font-semibold text-gray-800 bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none"
              />
              <span className="text-xs text-gray-400 font-bold">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPayPeriodPreset('CUSTOM');
                }}
                className="px-2.5 py-1 border border-gray-300 rounded-lg text-xs font-semibold text-gray-800 bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* OFFICIAL DTR SHEET TEMPLATE CARD (Print Target) */}
      <div
        id="printable-dtr-sheet"
        className="bg-white rounded-2xl border-2 border-[#18181b] p-6 sm:p-8 shadow-md space-y-6 text-[#18181b]"
      >
        {/* OFFICIAL DTR FORM HEADER */}
        <div className="border-b-2 border-zinc-900 pb-5">
          <div className="flex flex-col sm:flex-row items-center justify-between text-center sm:text-left gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-amber-400 text-zinc-950 flex items-center justify-center font-black text-xl border-2 border-zinc-950 shadow-sm shrink-0">
                YC
              </div>
              <div>
                <h2 className="text-lg font-black tracking-tight uppercase text-zinc-950">
                  FBC RESTAURANTS CORP. / YELLOW CAB PIZZA CO.
                </h2>
                <h3 className="text-sm font-extrabold text-amber-900 tracking-wider uppercase">
                  DAILY TIME RECORD (DTR) SHEET
                </h3>
              </div>
            </div>

            <div className="text-center sm:text-right font-mono text-xs">
              <div className="inline-block px-3 py-1 bg-zinc-950 text-amber-400 font-bold rounded-lg uppercase tracking-wider text-[11px]">
                Biometric ZKTeco Verified Log
              </div>
              <div className="text-[11px] text-gray-500 mt-1">
                Generated: {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
            </div>
          </div>
        </div>

        {/* EMPLOYEE METADATA GRID BOX */}
        <div className="bg-[#F7F8F5] rounded-xl border-2 border-zinc-900 p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-semibold">
          <div>
            <span className="text-[10px] uppercase font-black text-gray-500 tracking-wider block">Employee Name:</span>
            <span className="text-sm font-black text-zinc-950 uppercase">{selectedUser.name}</span>
          </div>

          <div>
            <span className="text-[10px] uppercase font-black text-gray-500 tracking-wider block">Employee ID:</span>
            <span className="text-sm font-mono font-black text-amber-900">{selectedUser.employeeId}</span>
          </div>

          <div>
            <span className="text-[10px] uppercase font-black text-gray-500 tracking-wider block">Department / Branch:</span>
            <span className="text-sm font-bold text-zinc-800">{selectedUser.department}</span>
          </div>

          <div>
            <span className="text-[10px] uppercase font-black text-gray-500 tracking-wider block">Official Shift Target:</span>
            <span className="text-sm font-bold text-zinc-800">8.0 Hrs / Flexitime</span>
          </div>
        </div>

        {/* DTR ATTENDANCE LOG TABLE */}
        <div className="overflow-x-auto border-2 border-zinc-900 rounded-xl">
          <table className="w-full text-left text-xs min-w-[900px]">
            <thead className="bg-zinc-900 text-amber-400 font-black uppercase text-[11px] tracking-wider border-b-2 border-zinc-900">
              <tr>
                <th className="p-2.5">Date</th>
                <th className="p-2.5">Day</th>
                <th className="p-2.5 text-center">Clock In (Time-In)</th>
                <th className="p-2.5 text-center">Break Out</th>
                <th className="p-2.5 text-center">Break In</th>
                <th className="p-2.5 text-center">Clock Out (Time-Out)</th>
                <th className="p-2.5 text-center">Worked Hrs</th>
                <th className="p-2.5 text-center">Undertime</th>
                <th className="p-2.5 text-center">Overtime</th>
                <th className="p-2.5">Status / Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 font-medium">
              {employeeDtrLogs.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-gray-400 italic font-bold">
                    No attendance logs recorded for this employee during selected date range.
                  </td>
                </tr>
              ) : (
                employeeDtrLogs.map((s) => {
                  const breakTimes = getBreakTimes(s.punches);
                  const isAbsent = s.status === 'ABSENT';
                  const hasClockIn = Boolean(s.firstIn && s.firstIn !== 'No Data' && s.firstIn !== '--');
                  const hasClockOut = Boolean(s.lastOut && s.lastOut !== 'No Data' && s.lastOut !== '--');
                  const hasBreakOut = Boolean(breakTimes.breakOut && breakTimes.breakOut !== 'No Data' && breakTimes.breakOut !== '--');
                  const hasBreakIn = Boolean(breakTimes.breakIn && breakTimes.breakIn !== 'No Data' && breakTimes.breakIn !== '--');

                  const missingPunches: string[] = [];
                  if (!isAbsent) {
                    if (!hasClockIn) missingPunches.push('Clock-In');
                    if (!hasBreakOut) missingPunches.push('Break-Out');
                    if (!hasBreakIn) missingPunches.push('Break-In');
                    if (!hasClockOut) missingPunches.push('Clock-Out');
                  }

                  return (
                    <tr key={s.id} className="hover:bg-amber-50/50 transition-colors">
                      <td className="p-2.5 font-mono font-bold text-zinc-950 whitespace-nowrap">
                        {formatDateMDYYYY(s.date)}
                      </td>
                      <td className="p-2.5 font-bold text-zinc-700 whitespace-nowrap">
                        {s.weekday}
                      </td>
                      <td className="p-2.5 text-center font-mono font-bold text-zinc-900 whitespace-nowrap">
                        {s.firstIn ? (
                          formatTime12Hr(s.firstIn)
                        ) : (
                          <span className="text-rose-600 font-bold text-[11px]">No Data</span>
                        )}
                      </td>
                      <td className="p-2.5 text-center font-mono text-zinc-700 whitespace-nowrap">
                        {breakTimes.breakOut && breakTimes.breakOut !== 'No Data' && breakTimes.breakOut !== '--' ? (
                          breakTimes.breakOut
                        ) : (
                          <span className="font-bold text-gray-400">No Data</span>
                        )}
                      </td>
                      <td className="p-2.5 text-center font-mono text-zinc-700 whitespace-nowrap">
                        {breakTimes.breakIn && breakTimes.breakIn !== 'No Data' && breakTimes.breakIn !== '--' ? (
                          breakTimes.breakIn
                        ) : (
                          <span className="font-bold text-gray-400">No Data</span>
                        )}
                      </td>
                      <td className="p-2.5 text-center font-mono font-bold text-zinc-900 whitespace-nowrap">
                        {s.lastOut ? (
                          formatTime12Hr(s.lastOut)
                        ) : (
                          <span className="text-rose-600 font-bold text-[11px]">No Data</span>
                        )}
                      </td>
                      <td className="p-2.5 text-center font-mono font-black text-zinc-950">
                        {s.netHoursWorked ? `${s.netHoursWorked.toFixed(1)} hrs` : '0.0 hrs'}
                      </td>
                      <td className="p-2.5 text-center font-mono font-bold text-amber-800">
                        {s.undertimeHours > 0 ? `-${s.undertimeHours.toFixed(1)}h` : '0.0h'}
                      </td>
                      <td className="p-2.5 text-center font-mono font-bold text-sky-800">
                        {s.overtimeHours > 0 ? `+${s.overtimeHours.toFixed(1)}h` : '0.0h'}
                      </td>
                      <td className="p-2.5 text-[11px]">
                        {isAbsent ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-black bg-rose-100 text-rose-900 border border-rose-300">
                            ✕ Absent
                          </span>
                        ) : missingPunches.length > 0 ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-100 text-amber-950 border border-amber-400">
                            ⚡ Missing {missingPunches.join(', ')}
                          </span>
                        ) : s.status === 'COMPLETE' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300">
                            ✓ Complete
                          </span>
                        ) : s.status === 'OVERTIME' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-black bg-sky-100 text-sky-900 border border-sky-300">
                            ★ Overtime (+{s.overtimeHours.toFixed(1)}h)
                          </span>
                        ) : s.status === 'UNDERTIME' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300">
                            ⚠ Undertime (-{s.undertimeHours.toFixed(1)}h)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-black bg-orange-100 text-orange-950 border border-orange-300">
                            ⚡ {s.status}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* DTR SUMMARY & OFFICIAL CERTIFICATION SIGNATURE FOOTER */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pt-2 items-stretch">
          {/* Summary Totals Box */}
          <div className="md:col-span-5 bg-[#F7F8F5] rounded-xl border-2 border-zinc-900 p-4 space-y-2">
            <h4 className="text-xs font-black uppercase text-zinc-900 tracking-wider border-b border-zinc-300 pb-1">
              Period Attendance Summary
            </h4>
            <div className="grid grid-cols-2 gap-2 text-xs font-bold">
              <div className="bg-white p-2 rounded-lg border border-zinc-300">
                <span className="text-[10px] text-gray-500 block uppercase">Days Worked:</span>
                <span className="text-sm font-black text-zinc-950">{totalDaysWorked} Days</span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-zinc-300">
                <span className="text-[10px] text-gray-500 block uppercase">Total Net Hours:</span>
                <span className="text-sm font-black text-emerald-800">{totalNetHours.toFixed(1)} hrs</span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-zinc-300">
                <span className="text-[10px] text-gray-500 block uppercase">Total Overtime:</span>
                <span className="text-sm font-black text-sky-800">+{totalOvertimeHours.toFixed(1)} hrs</span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-zinc-300">
                <span className="text-[10px] text-gray-500 block uppercase">Undertime Deficit:</span>
                <span className="text-sm font-black text-amber-800">-{totalUndertimeHours.toFixed(1)} hrs</span>
              </div>
            </div>
          </div>

          {/* Official Oath & Signatures */}
          <div className="md:col-span-7 border-2 border-zinc-900 rounded-xl p-4 flex flex-col justify-between text-[11px] space-y-4">
            <p className="italic font-medium text-zinc-800 text-center leading-relaxed">
              "I CERTIFY on my honor that the above is a true and correct record of the hours of work performed,
              record of which was made daily at the time of arrival and departure from office."
            </p>

            <div className="grid grid-cols-2 gap-6 pt-4 text-center">
              <div className="space-y-1">
                <div className="border-b-2 border-zinc-900 h-6"></div>
                <span className="font-black text-zinc-950 uppercase text-[10px] block">
                  {selectedUser.name}
                </span>
                <span className="text-[9px] text-gray-500 block uppercase font-bold">
                  Employee Signature
                </span>
              </div>

              <div className="space-y-1">
                <div className="border-b-2 border-zinc-900 h-6"></div>
                <span className="font-black text-zinc-950 uppercase text-[10px] block">
                  Payroll / Store Manager
                </span>
                <span className="text-[9px] text-gray-500 block uppercase font-bold">
                  Verified as to Prescribed Office Hours
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
