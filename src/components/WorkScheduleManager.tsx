import React, { useState } from 'react';
import { CtoRequest, AttendanceSummaryDaily, User, WorkSchedule } from '../types';
import { showSuccessAlert, showActionSuccessToast } from '../utils/sweetAlerts';
import { formatDateMDYY } from '../utils/timeFormatters';
import { DatePickerInput } from './DatePickerInput';
import { TablePagination } from './TablePagination';
import {
  Clock,
  Plus,
  Edit3,
  Building2,
  Store,
  Search,
  Check,
  X,
  Briefcase,
  CalendarDays,
  Sparkles,
  Sliders,
  Settings,
  Award,
  AlertCircle,
  Calendar,
} from 'lucide-react';

interface WorkScheduleManagerProps {
  currentUser: User;
  users: User[];
  schedules: WorkSchedule[];
  ctoRequests?: CtoRequest[];
  summaries?: AttendanceSummaryDaily[];
  onSaveSchedule: (schedule: WorkSchedule) => void;
  isReadOnly?: boolean;
}

const ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const WorkScheduleManager: React.FC<WorkScheduleManagerProps> = ({
  currentUser,
  users,
  schedules,
  ctoRequests = [],
  summaries = [],
  onSaveSchedule,
  isReadOnly = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [selectedBranch, setSelectedBranch] = useState(currentUser.branch || 'ALL');
  const [weekOffset, setWeekOffset] = useState<number>(0); // 0 = Current Week, 1 = Next Week (Advance), -1 = Prev Week

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Standard store branches list
  const STORE_BRANCHES = ['YC Ebloc', 'YC Ramos', 'YC Talisay', 'YC SM Seaside', 'YC Ayala', 'YC Banilad'];

  // Helper to calculate Monday of a week offset relative to today
  const getMondayOfWeek = (offsetWeeks: number = 0) => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 is Sun, 1 is Mon...
    const distanceToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + distanceToMonday + offsetWeeks * 7);
    return monday;
  };

  const currentMonday = getMondayOfWeek(weekOffset);
  const currentSunday = new Date(currentMonday);
  currentSunday.setDate(currentMonday.getDate() + 6);

  const weekDaysDates = ALL_DAYS.map((day, idx) => {
    const d = new Date(currentMonday);
    d.setDate(currentMonday.getDate() + idx);
    return {
      dayName: day,
      dateObj: d,
      dateStr: d.toISOString().split('T')[0],
      formattedShort: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    };
  });

  // Modal State for full schedule edit
  const [showModal, setShowModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Partial<WorkSchedule>>({
    employeeId: '',
    shiftName: 'Regular Day Shift',
    startTime: '08:00',
    endTime: '17:00',
    workDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    effectiveDate: new Date().toISOString().split('T')[0],
    notes: '',
  });

  // Cell Time Editor Modal State (for quick editing a specific day's shift)
  const [editingDayCell, setEditingDayCell] = useState<{
    sch: WorkSchedule;
    day: string;
    startTime: string;
    endTime: string;
    isOff: boolean;
    branch?: string;
  } | null>(null);

  // Filter users relevant to Branch Manager or Admin (excluding inactive and Payroll department/role)
  const availableUsers = users.filter(
    (u) =>
      u.status === 'ACTIVE' &&
      u.role !== 'PAYROLL' &&
      !u.department?.toLowerCase().includes('payroll')
  );

  // Build full list of schedules mapped against available users for the selected week
  const currentMondayStr = currentMonday.toISOString().split('T')[0];

  const filteredSchedules = availableUsers
    .map((u) => {
      const userSchedules = schedules.filter((s) => s.employeeId === u.employeeId);
      let existing = userSchedules.find((s) => s.effectiveDate === currentMondayStr);
      if (!existing && userSchedules.length > 0) {
        const validSchedules = userSchedules
          .filter((s) => !s.effectiveDate || s.effectiveDate <= currentMondayStr)
          .sort((a, b) => (b.effectiveDate || '').localeCompare(a.effectiveDate || ''));
        if (validSchedules.length > 0) {
          // Clone the fallback schedule with the current view's Monday date as effectiveDate template
          existing = {
            ...validSchedules[0],
            effectiveDate: currentMondayStr,
            id: `sch-${u.employeeId}-${currentMondayStr}`,
          };
        }
      }
      if (existing) return existing;
      // Fallback default schedule if none assigned yet (Defaults to "No Schedule")
      return {
        id: `default-${u.employeeId}-${currentMondayStr}`,
        employeeId: u.employeeId,
        employeeName: u.name,
        department: u.department,
        branch: u.branch || 'YC Ebloc',
        shiftName: 'No Schedule',
        startTime: '08:00',
        endTime: '17:00',
        workDays: [],
        effectiveDate: currentMondayStr,
        notes: 'No schedule set yet',
        updatedAt: '2026-01-01 08:00:00',
        updatedBy: 'System',
      } as WorkSchedule;
    })
    .filter((sch) => {
      const userObj = users.find((u) => u.employeeId === sch.employeeId);
      const assignedBranch = sch.branch || userObj?.branch || '';
      const dailyBranches = Object.values(sch.dailyShifts || {})
        .map((ds: { branch?: string } | undefined) => ds?.branch)
        .filter(Boolean) as string[];

      const deptMatch =
        selectedDept === 'ALL' ||
        sch.department === selectedDept ||
        userObj?.department === selectedDept;

      // Check if employee has at least one active working day schedule assigned to selectedBranch
      const hasActiveWeekdayScheduleForSelectedBranch = ALL_DAYS.some((day) => {
        const customShift = sch.dailyShifts?.[day];
        const isWorkDay = (sch.workDays || []).includes(day);
        const isOff = customShift ? customShift.isOff : !isWorkDay;
        const dayBranch = customShift?.branch || sch.branch || userObj?.branch || '';
        return !isOff && dayBranch === selectedBranch;
      });

      const branchMatch =
        selectedBranch === 'ALL' || hasActiveWeekdayScheduleForSelectedBranch;

      const searchMatch =
        sch.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sch.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sch.shiftName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sch.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
        assignedBranch.toLowerCase().includes(searchTerm.toLowerCase()) ||
        dailyBranches.some((b) => b.toLowerCase().includes(searchTerm.toLowerCase()));

      return deptMatch && branchMatch && searchMatch;
    });

  // Get list of unique departments
  const departments = Array.from(new Set(users.map((u) => u.department).filter(Boolean)));

  // Get list of unique store branches
  const allBranches = Array.from(
    new Set([
      ...STORE_BRANCHES,
      ...users.map((u) => u.branch).filter(Boolean),
      ...schedules.map((s) => s.branch).filter(Boolean),
    ])
  ) as string[];

  const handleOpenEdit = (sch?: WorkSchedule) => {
    if (sch) {
      const userObj = users.find((u) => u.employeeId === sch.employeeId);
      setEditingSchedule({
        ...sch,
        id: sch.effectiveDate === currentMondayStr ? sch.id : `sch-${sch.employeeId}-${currentMondayStr}`,
        effectiveDate: currentMondayStr,
        branch: sch.branch || userObj?.branch || 'YC Ebloc',
      });
    } else {
      const firstUser = availableUsers[0];
      setEditingSchedule({
        id: `sch-${firstUser ? firstUser.employeeId : 'emp'}-${currentMondayStr}`,
        employeeId: firstUser ? firstUser.employeeId : '',
        employeeName: firstUser ? firstUser.name : '',
        department: firstUser ? firstUser.department : 'General',
        branch: firstUser?.branch || 'YC Ebloc',
        shiftName: 'Regular Day Shift',
        startTime: '08:00',
        endTime: '17:00',
        workDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
        effectiveDate: currentMondayStr,
        notes: weekOffset > 0 ? `Advance schedule for week starting ${currentMondayStr}` : '',
      });
    }
    setShowModal(true);
  };

  const handleCreateAdvanceScheduleForNextWeek = () => {
    setWeekOffset(1); // Switch view to Next Week
    const nextMonday = getMondayOfWeek(1);
    const nextMondayStr = nextMonday.toISOString().split('T')[0];

    const firstUser = availableUsers[0];
    const existingForNextWeek = schedules.find(
      (s) => s.employeeId === firstUser?.employeeId && s.effectiveDate === nextMondayStr
    );

    if (existingForNextWeek) {
      setEditingSchedule({ ...existingForNextWeek });
    } else {
      setEditingSchedule({
        id: `sch-${firstUser ? firstUser.employeeId : 'adv'}-${nextMondayStr}`,
        employeeId: firstUser ? firstUser.employeeId : '',
        employeeName: firstUser ? firstUser.name : '',
        department: firstUser ? firstUser.department : 'General',
        branch: firstUser?.branch || 'YC Ebloc',
        shiftName: 'Advance Next Week Shift',
        startTime: '08:00',
        endTime: '17:00',
        workDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
        effectiveDate: nextMondayStr,
        notes: `Advance schedule for week starting ${nextMondayStr}`,
      });
    }
    setShowModal(true);
    showActionSuccessToast(`Switched to Next Week Advance Schedule (${nextMondayStr})`);
  };

  const handleCopyCurrentWeekToNextWeek = () => {
    const nextMonday = getMondayOfWeek(1);
    const nextMondayStr = nextMonday.toISOString().split('T')[0];

    filteredSchedules.forEach((sch) => {
      const advanceSchedule: WorkSchedule = {
        ...sch,
        id: `sch-${sch.employeeId}-${nextMondayStr}`,
        effectiveDate: nextMondayStr,
        notes: `Advance schedule copied for week starting ${nextMondayStr}`,
        updatedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
        updatedBy: currentUser.name,
      };
      onSaveSchedule(advanceSchedule);
    });

    setWeekOffset(1);
    showSuccessAlert(
      'Advance Schedule Created!',
      `Successfully copied current week work schedule roster to Next Week (${nextMondayStr}).`
    );
  };

  const handleToggleDayInModal = (day: string) => {
    const currentDays = editingSchedule.workDays || [];
    const isCurrentlySelected = currentDays.includes(day);
    const updatedDays = isCurrentlySelected
      ? currentDays.filter((d) => d !== day)
      : [...currentDays, day];

    const currentDailyShifts = { ...(editingSchedule.dailyShifts || {}) };
    const userObj = users.find((u) => u.employeeId === editingSchedule.employeeId);
    const targetBranch = currentDailyShifts[day]?.branch || editingSchedule.branch || userObj?.branch || 'YC Ebloc';

    currentDailyShifts[day] = {
      startTime: currentDailyShifts[day]?.startTime || editingSchedule.startTime || '08:00',
      endTime: currentDailyShifts[day]?.endTime || editingSchedule.endTime || '17:00',
      isOff: isCurrentlySelected,
      branch: targetBranch,
    };

    setEditingSchedule({
      ...editingSchedule,
      workDays: updatedDays,
      dailyShifts: currentDailyShifts,
    });
  };

  const handleSelectDaysPreset = (preset: 'MON_FRI' | 'MON_SAT' | 'TUE_SUN' | 'ALL') => {
    if (preset === 'MON_FRI') {
      setEditingSchedule({
        ...editingSchedule,
        workDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      });
    } else if (preset === 'MON_SAT') {
      setEditingSchedule({
        ...editingSchedule,
        workDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      });
    } else if (preset === 'TUE_SUN') {
      setEditingSchedule({
        ...editingSchedule,
        workDays: ['Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      });
    } else {
      setEditingSchedule({
        ...editingSchedule,
        workDays: [...ALL_DAYS],
      });
    }
  };

  // Toggle Day Working/OFF directly in the tabular cell
  const handleDirectToggleDay = (sch: WorkSchedule, day: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isReadOnly) return;

    const currentWorkDays = sch.workDays || [];
    const isWorking = currentWorkDays.includes(day);
    let updatedWorkDays: string[];

    if (isWorking) {
      updatedWorkDays = currentWorkDays.filter((d) => d !== day);
    } else {
      updatedWorkDays = [...currentWorkDays, day];
    }

    const currentDailyShifts = { ...(sch.dailyShifts || {}) };
    const userObj = users.find((u) => u.employeeId === sch.employeeId);
    const targetBranch = currentDailyShifts[day]?.branch || sch.branch || userObj?.branch || 'YC Ebloc';

    currentDailyShifts[day] = {
      startTime: currentDailyShifts[day]?.startTime || sch.startTime || '08:00',
      endTime: currentDailyShifts[day]?.endTime || sch.endTime || '17:00',
      isOff: isWorking,
      branch: targetBranch,
    };

    const updatedShiftName =
      updatedWorkDays.length === 0
        ? 'No Schedule'
        : sch.shiftName === 'No Schedule'
        ? 'Custom Shift'
        : sch.shiftName;

    const updatedSchedule: WorkSchedule = {
      ...sch,
      id: sch.effectiveDate === currentMondayStr ? sch.id : `sch-${sch.employeeId}-${currentMondayStr}`,
      effectiveDate: currentMondayStr,
      shiftName: updatedShiftName,
      workDays: updatedWorkDays,
      dailyShifts: currentDailyShifts,
      updatedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
      updatedBy: currentUser.name,
    };

    onSaveSchedule(updatedSchedule);
    showActionSuccessToast(
      `${sch.employeeName}: ${day} set to ${!isWorking ? 'WORKING' : 'REST DAY (OFF)'}`
    );
  };

  // Open Quick Day Shift Time & Branch Editor
  const handleOpenDayCellEditor = (sch: WorkSchedule, day: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isReadOnly) return;

    const customDay = sch.dailyShifts?.[day];
    const isWorking = (sch.workDays || []).includes(day);
    const userObj = users.find((u) => u.employeeId === sch.employeeId);
    const initialBranch = customDay?.branch || sch.branch || userObj?.branch || 'YC Ebloc';

    setEditingDayCell({
      sch,
      day,
      startTime: customDay?.startTime || sch.startTime || '08:00',
      endTime: customDay?.endTime || sch.endTime || '17:00',
      isOff: !isWorking || !!customDay?.isOff,
      branch: initialBranch,
    });
  };

  const handleSaveDayCell = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDayCell) return;

    const { sch, day, startTime, endTime, isOff, branch } = editingDayCell;
    const currentDailyShifts = { ...(sch.dailyShifts || {}) };
    let currentWorkDays = [...(sch.workDays || [])];
    const targetBranch = branch || sch.branch || 'YC Ebloc';

    if (isOff) {
      currentWorkDays = currentWorkDays.filter((d) => d !== day);
      currentDailyShifts[day] = { startTime, endTime, isOff: true, branch: targetBranch };
    } else {
      if (!currentWorkDays.includes(day)) {
        currentWorkDays.push(day);
      }
      currentDailyShifts[day] = { startTime, endTime, isOff: false, branch: targetBranch };
    }

    const updatedShiftName =
      currentWorkDays.length === 0
        ? 'No Schedule'
        : sch.shiftName === 'No Schedule'
        ? 'Custom Shift'
        : sch.shiftName;

    const updatedSchedule: WorkSchedule = {
      ...sch,
      id: sch.effectiveDate === currentMondayStr ? sch.id : `sch-${sch.employeeId}-${currentMondayStr}`,
      effectiveDate: currentMondayStr,
      shiftName: updatedShiftName,
      workDays: currentWorkDays,
      dailyShifts: currentDailyShifts,
      updatedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
      updatedBy: currentUser.name,
    };

    onSaveSchedule(updatedSchedule);
    setEditingDayCell(null);
    showActionSuccessToast(`Updated ${sch.employeeName}'s ${day} schedule: ${isOff ? 'OFF' : `${startTime} - ${endTime}`} [${targetBranch}]`);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSchedule.employeeId) return;

    const targetUser = users.find((u) => u.employeeId === editingSchedule.employeeId);
    const updatedWorkDays = editingSchedule.workDays || [];
    const updatedShiftName =
      updatedWorkDays.length === 0
        ? 'No Schedule'
        : editingSchedule.shiftName === 'No Schedule'
        ? 'Regular Day Shift'
        : editingSchedule.shiftName || 'Regular Day Shift';

    const targetEffectiveDate = editingSchedule.effectiveDate || currentMondayStr;

    const finalSchedule: WorkSchedule = {
      id: editingSchedule.id && editingSchedule.effectiveDate === targetEffectiveDate
        ? editingSchedule.id
        : `sch-${editingSchedule.employeeId}-${targetEffectiveDate}`,
      employeeId: editingSchedule.employeeId,
      employeeName: targetUser ? targetUser.name : editingSchedule.employeeName || 'Staff Member',
      department: targetUser ? targetUser.department : editingSchedule.department || 'Branch',
      branch: editingSchedule.branch || targetUser?.branch || 'YC Ebloc',
      shiftName: updatedShiftName,
      startTime: editingSchedule.startTime || '08:00',
      endTime: editingSchedule.endTime || '17:00',
      workDays: updatedWorkDays,
      dailyShifts: editingSchedule.dailyShifts || {},
      effectiveDate: targetEffectiveDate,
      notes: editingSchedule.notes || '',
      updatedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
      updatedBy: currentUser.name,
    };

    onSaveSchedule(finalSchedule);
    setShowModal(false);

    showSuccessAlert(
      'Work Schedule Saved!',
      `Shift schedule for ${finalSchedule.employeeName} (${finalSchedule.shiftName}) updated successfully.`
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-[#D3D8C8] p-4 md:p-6 shadow-xs space-y-5">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-gray-100 pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base md:text-lg font-extrabold text-[#2C3524] flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-[#656D4A]" />
              Work Schedule Roster
            </h2>
            {weekOffset === 0 ? (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300">
                CURRENT WEEK
              </span>
            ) : weekOffset > 0 ? (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-zinc-950 border border-zinc-950 shadow-2xs">
                ADVANCE SCHEDULE (+{weekOffset} {weekOffset === 1 ? 'WEEK' : 'WEEKS'})
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-zinc-100 text-zinc-700">
                PAST WEEK ({Math.abs(weekOffset)} WEEKS AGO)
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Schedule Period: <strong className="text-zinc-900 font-mono">{formatDateMDYY(currentMonday.toISOString().split('T')[0])}</strong> to <strong className="text-zinc-900 font-mono">{formatDateMDYY(currentSunday.toISOString().split('T')[0])}</strong>
          </p>
        </div>

        {/* Week Selector Controls & Advance Schedule Action */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center rounded-xl bg-zinc-100 p-1 border border-zinc-200 shadow-2xs">
            <button
              onClick={() => setWeekOffset(weekOffset - 1)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-zinc-700 hover:bg-white hover:text-zinc-950 transition-all cursor-pointer flex items-center gap-1"
              title="View Previous Week Schedule"
            >
              ‹ Prev Week
            </button>
            <button
              onClick={() => setWeekOffset(0)}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                weekOffset === 0
                  ? 'bg-[#656D4A] text-white shadow-2xs'
                  : 'text-zinc-700 hover:bg-white'
              }`}
            >
              Current Week
            </button>
            <button
              onClick={() => setWeekOffset(1)}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                weekOffset === 1
                  ? 'bg-amber-400 text-zinc-950 shadow-2xs border border-zinc-950'
                  : 'text-zinc-700 hover:bg-white'
              }`}
            >
              Next Week (Advance) ›
            </button>
          </div>

          {!isReadOnly && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyCurrentWeekToNextWeek}
                title="Copy current roster work days & shift times into next week's schedule"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-amber-300 font-bold text-xs shadow-xs cursor-pointer shrink-0 border border-zinc-700"
              >
                <Plus className="w-3.5 h-3.5 text-amber-300" /> Copy Roster to Next Wk
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Filters & Quick Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search staff name, ID, or department..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-[#F7F8F5] border border-[#D3D8C8] rounded-xl text-xs font-bold focus:ring-2 focus:ring-[#656D4A]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Store className="w-4 h-4 text-[#656D4A]" />
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="px-3 py-1.5 bg-[#F7F8F5] border border-[#D3D8C8] rounded-xl text-xs font-bold"
            >
              <option value="ALL">All Store Branches</option>
              {allBranches.map((branch) => (
                <option key={branch} value={branch}>
                  {branch}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <Building2 className="w-4 h-4 text-[#656D4A]" />
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="px-3 py-1.5 bg-[#F7F8F5] border border-[#D3D8C8] rounded-xl text-xs font-bold"
            >
              <option value="ALL">All Departments</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Approved & Filed CTO Leave Roster Banner for Team Visibility */}
      {ctoRequests.length > 0 && (
        <div className="bg-amber-50/90 rounded-xl border border-amber-200 p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-amber-950 uppercase tracking-wider flex items-center gap-1.5">
              <Award className="w-4 h-4 text-amber-700" />
              Filed & Approved CTO Leave Roster (Team Schedule Visibility)
            </h3>
            <span className="text-[10px] font-bold text-amber-900 bg-amber-200/80 px-2 py-0.5 rounded-full border border-amber-300">
              {ctoRequests.filter((r) => r.requestType !== 'CREDIT').length} Leave Requests
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
            {ctoRequests
              .filter((r) => r.requestType !== 'CREDIT')
              .slice(0, 6)
              .map((r) => (
                <div
                  key={r.id}
                  className={`p-2.5 rounded-lg border text-xs flex items-start justify-between gap-2 ${
                    r.status === 'APPROVED'
                      ? 'bg-amber-100/90 border-amber-300 text-amber-950 shadow-2xs'
                      : r.status === 'PENDING'
                      ? 'bg-white border-amber-200 text-zinc-900'
                      : 'bg-rose-50 border-rose-200 text-rose-900'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="font-extrabold text-[#2C3524] truncate">{r.employeeName}</div>
                    <div className="text-[10px] text-gray-700 font-mono font-bold">
                      Date: <span className="text-amber-950 font-black">{r.date}</span> ({r.hoursRequested}h CTO)
                    </div>
                    <div className="text-[10px] text-gray-500 truncate mt-0.5" title={r.reason}>
                      "{r.reason}"
                    </div>
                    {r.status === 'REJECTED' && (
                      <div className="text-[9px] font-bold text-rose-800 mt-1">
                        Rejected by: {r.reviewedBy || 'Branch Manager'}
                      </div>
                    )}
                  </div>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase shrink-0 ${
                      r.status === 'APPROVED'
                        ? 'bg-amber-400 text-zinc-950 border border-amber-600'
                        : r.status === 'PENDING'
                        ? 'bg-amber-200 text-amber-900'
                        : 'bg-rose-200 text-rose-900'
                    }`}
                  >
                    {r.status === 'APPROVED' ? 'LEAVE APPROVED' : r.status}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Tabular Work Schedule Roster */}
      <div className="overflow-x-auto rounded-xl border border-[#D3D8C8] shadow-2xs">
        <table className="w-full text-left border-collapse min-w-[900px]">
          <thead>
            <tr className="bg-[#656D4A] text-white text-[11px] font-bold uppercase tracking-wider">
              <th className="p-2 md:p-2.5 border-b border-[#4A543E] min-w-[180px]">
                Names / Staff
              </th>
              {weekDaysDates.map((wDay) => (
                <th
                  key={wDay.dayName}
                  className="p-2 md:p-2.5 text-center border-b border-[#4A543E] min-w-[100px]"
                >
                  <div className="font-extrabold">{wDay.dayName}</div>
                  <div className="text-[9px] font-mono font-normal opacity-90">{wDay.formattedShort}</div>
                </th>
              ))}
              <th className="p-2 md:p-2.5 text-center border-b border-[#4A543E] min-w-[120px]">
                Shift Title
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-xs">
            {filteredSchedules.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-8 text-center text-gray-500 font-bold">
                  {selectedBranch !== 'ALL'
                    ? `No staff scheduled to work at ${selectedBranch} for this week.`
                    : 'No staff schedules found matching your query.'}
                </td>
              </tr>
            ) : (
              filteredSchedules
                .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                .map((sch) => {
                const userObj = users.find((u) => u.employeeId === sch.employeeId);
                return (
                  <tr
                    key={sch.id}
                    className="hover:bg-[#F9FAF6] transition-colors group"
                  >
                    {/* Names Column */}
                    <td className="p-2 md:p-2.5 bg-white group-hover:bg-[#F9FAF6]">
                      <div className="flex items-center gap-2">
                        {userObj?.avatarUrl ? (
                          <img
                            src={userObj.avatarUrl}
                            alt={sch.employeeName}
                            className="w-7 h-7 rounded-lg object-cover border border-[#A4AC86] shrink-0"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-lg bg-[#656D4A] text-white font-bold flex items-center justify-center text-[10px] shrink-0">
                            {sch.employeeName.substring(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="font-bold text-[#2C3524] truncate text-xs">
                            {sch.employeeName}
                          </div>
                          <div className="text-[10px] text-gray-500 font-mono font-bold truncate flex items-center gap-1 flex-wrap">
                            <span>{sch.employeeId}</span>
                            <span>•</span>
                            <span className="text-[#656D4A] font-extrabold">{userObj?.position || sch.department}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Monday to Sunday Columns */}
                    {ALL_DAYS.map((day, dayIndex) => {
                      const targetDateStr = weekDaysDates[dayIndex].dateStr;

                      const approvedCto = ctoRequests.find((r) => {
                        if (r.employeeId !== sch.employeeId || r.requestType === 'CREDIT') return false;
                        if (r.status !== 'APPROVED') return false;
                        const reqDayName = new Date(r.date).toLocaleDateString('en-US', { weekday: 'long' });
                        return r.date === targetDateStr || reqDayName === day;
                      });

                      const pendingCto = ctoRequests.find((r) => {
                        if (r.employeeId !== sch.employeeId || r.requestType === 'CREDIT') return false;
                        if (r.status !== 'PENDING') return false;
                        const reqDayName = new Date(r.date).toLocaleDateString('en-US', { weekday: 'long' });
                        return r.date === targetDateStr || reqDayName === day;
                      });

                      const leaveSummary = summaries.find(
                        (s) =>
                          s.employeeId === sch.employeeId &&
                          s.status === 'LEAVE' &&
                          (s.date === targetDateStr ||
                            new Date(s.date).toLocaleDateString('en-US', { weekday: 'long' }) === day)
                      );

                      const isWorkDay = sch.workDays.includes(day);
                      const customShift = sch.dailyShifts?.[day];
                      const isOff = customShift ? customShift.isOff : !isWorkDay;
                      const startTime = customShift?.startTime || sch.startTime || '08:00';
                      const endTime = customShift?.endTime || sch.endTime || '17:00';
                      const dayBranch = customShift?.branch || sch.branch || userObj?.branch || 'YC Ebloc';
                      const isNoSchedule = (sch.shiftName === 'No Schedule' || (!sch.workDays || sch.workDays.length === 0)) && !customShift;

                      return (
                        <td
                          key={day}
                          onClick={(e) => {
                            if (!approvedCto) handleDirectToggleDay(sch, day, e);
                          }}
                          title={
                            approvedCto
                              ? `Approved CTO Leave for ${sch.employeeName} on ${approvedCto.date} (${approvedCto.reason})`
                              : pendingCto
                              ? `Pending CTO Leave request for ${sch.employeeName} on ${pendingCto.date}`
                              : `Click to toggle ${day} for ${sch.employeeName}`
                          }
                          className="p-1.5 md:p-2 text-center align-middle transition-all hover:bg-gray-100/70"
                        >
                          <div className="flex items-center justify-center gap-1 group/cell relative">
                            {approvedCto || leaveSummary ? (
                              <div className="w-full py-1 px-1 rounded-lg bg-amber-400 text-zinc-950 border-2 border-amber-600 shadow-2xs font-black flex flex-col items-center justify-center text-[10px] leading-tight cursor-default">
                                <span className="flex items-center gap-0.5 uppercase tracking-wider font-black text-[9.5px]">
                                  <Award className="w-3 h-3 text-zinc-950 shrink-0" />
                                  CTO LEAVE
                                </span>
                                <span className="text-[9px] font-mono font-extrabold text-zinc-900">
                                  ({approvedCto?.hoursRequested || 8.0}h)
                                </span>
                              </div>
                            ) : pendingCto ? (
                              <div className="w-full py-1 px-1 rounded-lg bg-amber-100 text-amber-900 border border-amber-400 shadow-2xs font-bold flex flex-col items-center justify-center text-[10px] leading-tight cursor-default">
                                <span className="flex items-center gap-0.5 uppercase tracking-wider font-bold text-[9px]">
                                  <Clock className="w-3 h-3 text-amber-700 shrink-0" />
                                  CTO FILED
                                </span>
                                <span className="text-[8.5px] font-semibold text-amber-800">
                                  Pending Appr.
                                </span>
                              </div>
                            ) : !isOff ? (
                              <div className="w-full py-1 px-1 rounded-lg bg-[#EAF0DE] text-[#2C3524] border border-[#A4AC86] shadow-2xs hover:bg-[#656D4A] hover:text-white transition-all flex flex-col items-center justify-center gap-0.5 group/shift">
                                <div className="flex items-center justify-between w-full gap-0.5 px-0.5">
                                  <span className="font-mono text-[9.5px] font-bold tracking-tight mx-auto">
                                    {startTime} - {endTime}
                                  </span>
                                  {!isReadOnly && (
                                    <button
                                      type="button"
                                      onClick={(e) => handleOpenDayCellEditor(sch, day, e)}
                                      className="p-0.5 rounded hover:bg-[#4A543E] text-[#656D4A] hover:text-white transition-colors"
                                      title="Edit shift time and branch for this day"
                                    >
                                      <Settings className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                                <span className="text-[8.5px] font-black px-1.5 py-0.2 rounded bg-[#656D4A]/15 text-[#3A422A] group-hover/shift:bg-white/25 group-hover/shift:text-white border border-[#656D4A]/20 transition-colors font-sans truncate max-w-full">
                                  {dayBranch}
                                </span>
                              </div>
                            ) : isNoSchedule ? (
                              <div className="w-full py-1 px-1 rounded-lg bg-zinc-50/80 text-zinc-400 border border-dashed border-zinc-300 hover:bg-amber-50 hover:text-amber-800 hover:border-amber-300 transition-all flex flex-col items-center justify-center gap-0.5">
                                <div className="flex items-center justify-between w-full gap-0.5 px-0.5">
                                  <span className="font-sans text-[8.5px] font-bold uppercase mx-auto tracking-wider text-zinc-400">
                                    No schedule
                                  </span>
                                  {!isReadOnly && (
                                    <button
                                      type="button"
                                      onClick={(e) => handleOpenDayCellEditor(sch, day, e)}
                                      className="p-0.5 rounded hover:bg-amber-200 text-zinc-400 hover:text-amber-800 transition-colors"
                                      title="Set shift schedule for this day"
                                    >
                                      <Settings className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                                <span className="text-[8px] font-bold text-zinc-400/70 truncate">
                                  {dayBranch}
                                </span>
                              </div>
                            ) : (
                              <div className="w-full py-1 px-1 rounded-lg bg-zinc-100 text-zinc-400 border border-zinc-200 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-300 transition-all flex flex-col items-center justify-center gap-0.5">
                                <div className="flex items-center justify-between w-full gap-0.5 px-0.5">
                                  <span className="font-mono text-[9.5px] font-bold uppercase mx-auto tracking-wider">
                                    OFF
                                  </span>
                                  {!isReadOnly && (
                                    <button
                                      type="button"
                                      onClick={(e) => handleOpenDayCellEditor(sch, day, e)}
                                      className="p-0.5 rounded hover:bg-amber-200 text-zinc-400 hover:text-amber-800 transition-colors"
                                      title="Custom shift time and branch for this day"
                                    >
                                      <Settings className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                                <span className="text-[8px] font-bold text-zinc-400/80 truncate">
                                  {dayBranch}
                                </span>
                              </div>
                            )}
                          </div>
                        </td>
                      );
                    })}

                    {/* Shift Title & Edit Action Column */}
                    <td className="p-1.5 md:p-2 text-center align-middle bg-white group-hover:bg-[#F9FAF6]">
                      <div className="flex items-center justify-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#F4F6F0] text-[#2C3524] border border-[#D3D8C8] truncate max-w-[90px]">
                          {sch.shiftName}
                        </span>
                        {!isReadOnly && (
                          <button
                            onClick={() => handleOpenEdit(sch)}
                            className="p-1 rounded-lg bg-white border border-[#D3D8C8] hover:bg-[#656D4A] hover:text-white text-gray-700 transition-colors shadow-2xs"
                            title="Configure Schedule"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        <TablePagination
          currentPage={currentPage}
          totalPages={Math.ceil(filteredSchedules.length / pageSize)}
          pageSize={pageSize}
          totalItems={filteredSchedules.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          pageSizeOptions={[5, 10, 20, 50]}
        />
      </div>

      {/* Roster Legend & Tips */}
      <div className="flex flex-wrap items-center justify-between text-[11px] text-gray-500 bg-[#F7F8F5] p-3 rounded-xl border border-[#D3D8C8] gap-2">
        <div className="flex items-center gap-4">
          <span className="font-bold text-[#2C3524]">Legend:</span>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-[#EAF0DE] border border-[#A4AC86] inline-block"></span>
            <span>Working Day Shift (Click cell to toggle OFF)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-zinc-100 border border-zinc-300 inline-block"></span>
            <span>Rest Day / OFF (Click cell to plot Working)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Settings className="w-3 h-3 text-[#656D4A]" />
            <span>Gear icon to edit specific start/end times per day</span>
          </div>
        </div>

        <span className="font-mono text-[10px] text-gray-400">
          Showing {filteredSchedules.length} staff member(s)
        </span>
      </div>

      {/* Quick Day Cell Time Editor Modal */}
      {editingDayCell && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-gray-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-sm font-bold text-[#2C3524]">
                  Plot {editingDayCell.day} Shift
                </h3>
                <p className="text-[11px] text-gray-500 font-bold">
                  {editingDayCell.sch.employeeName} ({editingDayCell.sch.employeeId})
                </p>
              </div>
              <button
                onClick={() => setEditingDayCell(null)}
                className="text-gray-400 hover:text-gray-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveDayCell} className="space-y-4">
              <div className="flex items-center justify-between bg-gray-50 p-2.5 rounded-xl border">
                <span className="text-xs font-bold text-gray-700">Set as Rest Day (OFF)</span>
                <input
                  type="checkbox"
                  checked={editingDayCell.isOff}
                  onChange={(e) =>
                    setEditingDayCell({ ...editingDayCell, isOff: e.target.checked })
                  }
                  className="w-4 h-4 accent-[#656D4A] rounded"
                />
              </div>

              {/* Store Branch Selection for this shift/day */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1.5">
                  <Store className="w-3.5 h-3.5 text-[#656D4A]" />
                  Assigned Store Branch
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mb-2">
                  {STORE_BRANCHES.map((b) => {
                    const isSelected = (editingDayCell.branch || 'YC Ebloc') === b;
                    return (
                      <button
                        key={b}
                        type="button"
                        onClick={() => setEditingDayCell({ ...editingDayCell, branch: b })}
                        className={`px-2 py-1.5 rounded-lg text-xs font-bold border transition-all text-left flex items-center justify-between ${
                          isSelected
                            ? 'bg-[#656D4A] text-white border-[#656D4A] shadow-xs'
                            : 'bg-[#F7F8F5] text-gray-700 border-[#D3D8C8] hover:bg-gray-100'
                        }`}
                      >
                        <span className="truncate">{b}</span>
                        {isSelected && <Check className="w-3 h-3 shrink-0 ml-1 text-white" />}
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-500 font-bold shrink-0">Branch:</span>
                  <select
                    value={editingDayCell.branch || 'YC Ebloc'}
                    onChange={(e) => setEditingDayCell({ ...editingDayCell, branch: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs font-bold bg-white"
                  >
                    {allBranches.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {!editingDayCell.isOff && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">
                      Start Time
                    </label>
                    <input
                      type="time"
                      required
                      value={editingDayCell.startTime}
                      onChange={(e) =>
                        setEditingDayCell({ ...editingDayCell, startTime: e.target.value })
                      }
                      className="w-full px-2.5 py-1.5 border border-gray-300 rounded-xl text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">
                      End Time
                    </label>
                    <input
                      type="time"
                      required
                      value={editingDayCell.endTime}
                      onChange={(e) =>
                        setEditingDayCell({ ...editingDayCell, endTime: e.target.value })
                      }
                      className="w-full px-2.5 py-1.5 border border-gray-300 rounded-xl text-xs font-mono font-bold"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setEditingDayCell(null)}
                  className="px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-[#656D4A] text-white text-xs font-bold rounded-xl shadow-xs"
                >
                  Save Shift
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main Edit Schedule Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-[#656D4A]" />
                <div>
                  <h3 className="text-base font-bold text-[#2C3524]">
                    {editingSchedule.effectiveDate && editingSchedule.effectiveDate > getMondayOfWeek(0).toISOString().split('T')[0]
                      ? 'Set Advance Work Schedule'
                      : 'Assign / Edit Employee Work Schedule'}
                  </h3>
                  {editingSchedule.effectiveDate && (
                    <p className="text-[11px] text-[#656D4A] font-extrabold font-mono">
                      Effective Week Starting: {editingSchedule.effectiveDate}
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="space-y-4">
              {/* Select Employee */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Select Employee / Staff Member
                </label>
                <select
                  value={editingSchedule.employeeId}
                  onChange={(e) => {
                    const selUser = users.find((u) => u.employeeId === e.target.value);
                    setEditingSchedule({
                      ...editingSchedule,
                      employeeId: e.target.value,
                      employeeName: selUser ? selUser.name : '',
                      department: selUser ? selUser.department : '',
                      branch: selUser?.branch || editingSchedule.branch || 'YC Ebloc',
                    });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-bold"
                  required
                >
                  <option value="">-- Select Employee --</option>
                  {availableUsers.map((u) => (
                    <option key={u.id} value={u.employeeId}>
                      {u.employeeId} - {u.name} ({u.position || u.department}) {u.branch ? `[${u.branch}]` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Store Branch Selection */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1.5">
                  <Store className="w-3.5 h-3.5 text-[#656D4A]" />
                  Store Branch Assignment
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mb-2">
                  {STORE_BRANCHES.map((b) => {
                    const isSelected = (editingSchedule.branch || 'YC Ebloc') === b;
                    return (
                      <button
                        key={b}
                        type="button"
                        onClick={() => setEditingSchedule({ ...editingSchedule, branch: b })}
                        className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all text-left flex items-center justify-between ${
                          isSelected
                            ? 'bg-[#656D4A] text-white border-[#656D4A] shadow-xs'
                            : 'bg-[#F7F8F5] text-gray-700 border-[#D3D8C8] hover:bg-gray-100'
                        }`}
                      >
                        <span className="truncate">{b}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 shrink-0 ml-1 text-white" />}
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-500 font-bold shrink-0">Selected Store Branch:</span>
                  <select
                    value={editingSchedule.branch || 'YC Ebloc'}
                    onChange={(e) => setEditingSchedule({ ...editingSchedule, branch: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs font-bold bg-white"
                  >
                    {allBranches.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Shift Name */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Shift Name / Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Regular Day Shift, Store Opening Shift, Kitchen Morning Duty"
                  value={editingSchedule.shiftName || ''}
                  onChange={(e) =>
                    setEditingSchedule({ ...editingSchedule, shiftName: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-bold"
                />
              </div>

              {/* Shift Timing */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Default Shift Start Time
                  </label>
                  <input
                    type="time"
                    required
                    value={editingSchedule.startTime || '08:00'}
                    onChange={(e) =>
                      setEditingSchedule({ ...editingSchedule, startTime: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Default Shift End Time
                  </label>
                  <input
                    type="time"
                    required
                    value={editingSchedule.endTime || '17:00'}
                    onChange={(e) =>
                      setEditingSchedule({ ...editingSchedule, endTime: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-mono font-bold"
                  />
                </div>
              </div>

              {/* Work Days Selection */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-gray-700">
                    Assigned Work Days
                  </label>
                  <div className="flex gap-1 text-[10px] font-bold text-[#656D4A]">
                    <button
                      type="button"
                      onClick={() => handleSelectDaysPreset('MON_FRI')}
                      className="hover:underline"
                    >
                      Mon-Fri
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={() => handleSelectDaysPreset('MON_SAT')}
                      className="hover:underline"
                    >
                      Mon-Sat
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={() => handleSelectDaysPreset('TUE_SUN')}
                      className="hover:underline"
                    >
                      Tue-Sun
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 pt-1">
                  {ALL_DAYS.map((day) => {
                    const isChecked = (editingSchedule.workDays || []).includes(day);
                    return (
                      <button
                        type="button"
                        key={day}
                        onClick={() => handleToggleDayInModal(day)}
                        className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border text-center transition-colors ${
                          isChecked
                            ? 'bg-[#656D4A] border-[#656D4A] text-white shadow-2xs'
                            : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        {day.substring(0, 3)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Effective Date & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <DatePickerInput
                    label="Effective Date"
                    value={editingSchedule.effectiveDate || ''}
                    onChange={(val) =>
                      setEditingSchedule({ ...editingSchedule, effectiveDate: val })
                    }
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Shift Instructions / Notes
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Includes 1hr lunch break"
                    value={editingSchedule.notes || ''}
                    onChange={(e) =>
                      setEditingSchedule({ ...editingSchedule, notes: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-600 rounded-xl hover:bg-gray-100 cursor-pointer flex items-center gap-1.5"
                >
                  <X className="w-3.5 h-3.5 text-gray-500" />
                  Close
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#656D4A] hover:bg-[#4A543E] text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5 text-white" />
                  Save & Close
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
