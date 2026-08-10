import React, { useState } from 'react';
import { DatePickerInput } from './DatePickerInput';
import { TimeAdjustmentModal } from './TimeAdjustmentModal';
import { DisputeCardDetails } from './DisputeCardDetails';
import {
  AttendanceSummaryDaily,
  DisputeRequest,
  User,
  BiometricPunch,
  WorkSchedule,
  CtoRequest,
} from '../types';
import { WorkScheduleManager } from './WorkScheduleManager';
import { ZktecoDatUploader } from './ZktecoDatUploader';
import { EmployeeDtrSheet } from './EmployeeDtrSheet';
import {
  QuickUserImportModal,
  exportUsersToExcel,
} from './QuickUserImportModal';
import {
  parseAndCleanBiometricExcel,
  generateSampleBiometricExcel,
  REQUIRED_HEADERS,
} from '../utils/fileProcessor';
import { formatTime12Hr, formatDateWithDay, formatDateMDYY, formatDateMDYYYY, getFilteredSummariesWithAbsents, getBreakTimes, calculateGrossHours } from '../utils/timeFormatters';
import {
  showUploadProcessingAlert,
  showUploadSuccessAlert,
  showUploadErrorAlert,
  showConfirmDisputeAction,
  showSuccessAlert,
  showErrorAlert,
  showSyncConfirmAlert,
  showRemarkPromptAlert,
  yellowCabSwal,
} from '../utils/sweetAlerts';
import {
  Upload,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  FileSpreadsheet,
  UserPlus,
  Shield,
  Edit,
  UserX,
  Check,
  X,
  RefreshCw,
  Sparkles,
  Zap,
  Camera,
  User as UserIcon,
  CalendarDays,
  PlusCircle,
} from 'lucide-react';

interface AdminDashboardProps {
  users: User[];
  summaries: AttendanceSummaryDaily[];
  disputes: DisputeRequest[];
  punches: BiometricPunch[];
  schedules?: WorkSchedule[];
  ctoRequests?: CtoRequest[];
  onSaveSchedule?: (schedule: WorkSchedule) => void;
  onUploadProcessed: (newSummaries: AttendanceSummaryDaily[]) => void;
  onUpdateSummaryAnomaly?: (summaryId: string, newNote: string) => void;
  onApproveDispute: (disputeId: string, adminNotes: string) => void;
  onRejectDispute: (disputeId: string, adminNotes: string) => void;
  onSubmitDispute?: (dispute: Omit<DisputeRequest, 'id' | 'status' | 'submittedAt'>) => void;
  onAddUser: (user: User) => void;
  onUpdateUser: (user: User) => void;
  onDeleteUser?: (userId: string) => void;
  onSyncGoogleSheets: () => void;
  activeTab: string;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  users,
  summaries,
  disputes,
  punches,
  schedules = [],
  ctoRequests = [],
  onSaveSchedule = () => {},
  onUploadProcessed,
  onUpdateSummaryAnomaly,
  onApproveDispute,
  onRejectDispute,
  onSubmitDispute,
  onAddUser,
  onUpdateUser,
  onDeleteUser,
  onSyncGoogleSheets,
  activeTab,
}) => {
  // File upload state
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<{
    type: 'success' | 'error' | 'warning';
    title: string;
    text: string;
    details?: string[];
  } | null>(null);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [activePreset, setActivePreset] = useState<string>('ALL');

  // Time Adjustment Modal State
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);

  // Quick Preset Date Helpers
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

  // Dispute review modal state
  const [selectedDispute, setSelectedDispute] = useState<DisputeRequest | null>(null);
  const [adminNoteInput, setAdminNoteInput] = useState('');

  // Dispute Filter State for Admin
  const [adminDisputeSearch, setAdminDisputeSearch] = useState('');
  const [adminDisputeStatusFilter, setAdminDisputeStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [adminDisputeBranchFilter, setAdminDisputeBranchFilter] = useState('ALL');

  // Handle Remark / Time Concern Prompt
  const handleOpenRemarkPrompt = async (s: AttendanceSummaryDaily) => {
    const existingDispute = disputes.find(
      (d) => d.employeeId === s.employeeId && d.targetDate === s.date
    );
    const existingRemark = existingDispute?.reason || (s.anomalies.length > 0 ? s.anomalies.join(' | ') : '');

    const result = await showRemarkPromptAlert(
      s.employeeName,
      formatDateMDYY(s.date),
      existingRemark
    );

    if (result.isConfirmed && result.value !== undefined) {
      const remarkText = result.value.trim();
      if (onUpdateSummaryAnomaly) {
        onUpdateSummaryAnomaly(s.id, remarkText);
      } else {
        s.anomalies = remarkText ? [remarkText] : [];
      }
      if (onSubmitDispute && remarkText) {
        onSubmitDispute({
          employeeId: s.employeeId,
          employeeName: s.employeeName,
          department: s.department,
          targetDate: s.date,
          disputeType: 'MISSING_PUNCH',
          reason: remarkText,
        });
      }
      showSuccessAlert(
        'Remark Saved & Reflected',
        `Anomalies/Note for ${s.employeeName} on ${formatDateMDYY(s.date)} has been updated.`
      );
    }
  };

  // Add/Edit User Modal State
  const [showUserModal, setShowUserModal] = useState(false);
  const [showQuickUserModal, setShowQuickUserModal] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('ALL');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userFormData, setUserFormData] = useState<Partial<User>>({
    name: '',
    employeeId: '',
    email: '',
    pin: '',
    role: 'STAFF',
    department: 'YC Ebloc',
    position: 'Staff Member',
    hourlyRate: 120,
    status: 'ACTIVE',
  });

  // Handle File Upload Event
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setUploadMessage(null);

    // SweetAlert loading modal
    showUploadProcessingAlert(file.name);

    const result = await parseAndCleanBiometricExcel(file);
    setIsProcessing(false);

    if (result.isValid) {
      onUploadProcessed(result.summaries);
      setUploadMessage({
        type: 'success',
        title: 'Biometric File Successfully Processed & Cleaned!',
        text: `Parsed ${result.rawRowsCount} raw rows into ${result.cleanedPunchesCount} deduplicated punches. Generated ${result.summaries.length} daily employee summaries with 8-hour Flexitime calculations.`,
        details: result.warnings,
      });

      // SweetAlert success modal
      showUploadSuccessAlert(
        result.rawRowsCount,
        result.cleanedPunchesCount,
        result.summaries.length,
        result.warnings
      );
    } else {
      setUploadMessage({
        type: 'error',
        title: 'Biometric File Validation Failed',
        text: 'The uploaded Excel file does not satisfy FBC Restaurants Corp header requirements.',
        details: result.errors,
      });

      // SweetAlert error modal
      showUploadErrorAlert(result.errors);
    }

    e.target.value = '';
  };

  // Base summaries with Absents and Lacking populated for date range
  const rangeSummaries = getFilteredSummariesWithAbsents(
    summaries,
    users,
    startDate,
    endDate
  );

  // Filtered summaries calculation (Sorted ASCENDING by date)
  const filteredSummaries = rangeSummaries
    .filter((s) => {
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

      const matchesDept =
        departmentFilter === 'ALL' || s.department === departmentFilter;

      return matchesSearch && matchesStatus && matchesDept;
    })
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.employeeId.localeCompare(b.employeeId);
    });

  // Unique departments for filter dropdown
  const departments = Array.from(new Set(users.map((u) => u.department)));

  // KPI Metrics
  const totalLogs = summaries.length;
  const completeCount = summaries.filter((s) => s.status === 'COMPLETE').length;
  const undertimeCount = summaries.filter((s) => s.status === 'UNDERTIME').length;
  const overtimeCount = summaries.filter((s) => s.status === 'OVERTIME').length;
  const missingPunchesCount = summaries.filter(
    (s) => s.status === 'MISSING_IN' || s.status === 'MISSING_OUT'
  ).length;

  const pendingDisputes = disputes.filter((d) => d.status === 'PENDING');

  const handleOpenUserModal = (user?: User) => {
    if (user) {
      setEditingUser(user);

      let fName = user.firstName || '';
      let mName = user.middleName || '';
      let lName = user.lastName || '';

      if (!fName && !lName && user.name) {
        const parts = user.name.trim().split(' ');
        if (parts.length === 1) {
          fName = parts[0];
        } else if (parts.length === 2) {
          fName = parts[0];
          lName = parts[1];
        } else {
          fName = parts[0];
          mName = parts.slice(1, -1).join(' ');
          lName = parts[parts.length - 1];
        }
      }

      setUserFormData({
        ...user,
        firstName: fName,
        middleName: mName,
        lastName: lName,
        hourlyRate: user.hourlyRate || 120,
        dateHired: user.dateHired || new Date().toISOString().split('T')[0],
      });
    } else {
      setEditingUser(null);
      setUserFormData({
        firstName: '',
        middleName: '',
        lastName: '',
        name: '',
        employeeId: `EMP-${Math.floor(1000 + Math.random() * 9000)}`,
        email: '',
        pin: `${Math.floor(1000 + Math.random() * 9000)}`,
        role: 'STAFF',
        department: 'YC Main Office',
        position: 'Kitchen Master',
        hourlyRate: 120,
        dateHired: new Date().toISOString().split('T')[0],
        status: 'ACTIVE',
        avatarUrl: '',
      });
    }
    setShowUserModal(true);
  };

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('Image file size must be less than 5MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        if (reader.result) {
          setUserFormData((prev) => ({ ...prev, avatarUrl: reader.result as string }));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();

    const fName = userFormData.firstName?.trim() || '';
    const mName = userFormData.middleName?.trim() || '';
    const lName = userFormData.lastName?.trim() || '';
    const computedName = [fName, mName, lName].filter(Boolean).join(' ') || userFormData.name || 'Staff Member';

    if (!userFormData.employeeId || !userFormData.pin || !fName || !lName) {
      showErrorAlert(
        'Incomplete Form Details',
        'Please fill in First Name, Last Name, Employee ID, and Auth PIN Code.'
      );
      return;
    }

    const hRate = Number(userFormData.hourlyRate) || 0;

    const savedUser: User = {
      id: editingUser ? editingUser.id : `usr-${Date.now()}`,
      employeeId: userFormData.employeeId,
      name: computedName,
      firstName: fName,
      middleName: mName,
      lastName: lName,
      email: userFormData.email || `${fName.toLowerCase() || 'staff'}@fbcrestaurants.com`,
      pin: userFormData.pin,
      role: userFormData.role || 'STAFF',
      department: userFormData.department || 'YC Ebloc',
      position: userFormData.position || 'Staff Member',
      hourlyRate: hRate,
      dateHired: userFormData.dateHired || new Date().toISOString().split('T')[0],
      status: userFormData.status || 'ACTIVE',
      avatarUrl: userFormData.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    };

    if (editingUser) {
      onUpdateUser(savedUser);
      showSuccessAlert(
        'Account Updated!',
        `Employee profile for ${computedName} (${savedUser.employeeId}) has been saved successfully.`
      );
    } else {
      onAddUser(savedUser);
      showSuccessAlert(
        'Account Created!',
        `New employee account for ${computedName} (${savedUser.employeeId}) has been registered.`
      );
    }
    setShowUserModal(false);
  };

  return (
    <div className="space-y-6">
      {/* KPI METRICS OVERVIEW CARDS - Shown strictly on Overview/Logs */}
      {(activeTab === 'overview' || activeTab === 'dashboard' || activeTab === 'logs' || activeTab === 'all') && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4">
          <div className="bg-white p-4 rounded-2xl border border-[#D3D8C8] shadow-xs">
            <div className="flex items-center justify-between text-xs text-[#656D4A] font-bold">
              <span>Total Logs</span>
              <Clock className="w-4 h-4 text-[#808A60]" />
            </div>
            <div className="text-2xl font-extrabold text-[#2C3524] mt-2">{totalLogs}</div>
            <div className="text-[11px] text-gray-500 mt-1">Processed Shifts</div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-[#D3D8C8] shadow-xs">
            <div className="flex items-center justify-between text-xs text-emerald-700 font-bold">
              <span>8h Flexi Compliant</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-extrabold text-emerald-800 mt-2">{completeCount}</div>
            <div className="text-[11px] text-emerald-600 mt-1">Met 8.0h Target</div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-[#D3D8C8] shadow-xs">
            <div className="flex items-center justify-between text-xs text-amber-700 font-bold">
              <span>Undertime Deficit</span>
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-2xl font-extrabold text-amber-800 mt-2">{undertimeCount}</div>
            <div className="text-[11px] text-amber-600 mt-1">&lt; 8.0 Hours Worked</div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-[#D3D8C8] shadow-xs">
            <div className="flex items-center justify-between text-xs text-blue-700 font-bold">
              <span>Overtime Shifts</span>
              <Sparkles className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-2xl font-extrabold text-blue-800 mt-2">{overtimeCount}</div>
            <div className="text-[11px] text-blue-600 mt-1">&gt; 8.0 Hours Worked</div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-[#D3D8C8] shadow-xs col-span-2 md:col-span-1">
            <div className="flex items-center justify-between text-xs text-rose-700 font-bold">
              <span>Missing Punches</span>
              <AlertTriangle className="w-4 h-4 text-rose-600" />
            </div>
            <div className="text-2xl font-extrabold text-rose-800 mt-2">{missingPunchesCount}</div>
            <div className="text-[11px] text-rose-600 mt-1">Requires Approval</div>
          </div>
        </div>
      )}

      {/* SECTION: ZKTECO OLD VERSION .DAT FILE UPLOADER */}
      {activeTab === 'upload-dat' && (
        <div className="space-y-6 animate-in fade-in">
          <ZktecoDatUploader users={users} onUploadProcessed={onUploadProcessed} />
        </div>
      )}

      {/* SECTION 1: BIOMETRIC XLS/XLSX FILE UPLOADER - Dedicated Upload Tab */}
      {(activeTab === 'upload' || activeTab === 'all') && (
        <div className="bg-white rounded-2xl border border-[#D3D8C8] p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
            <div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-bold bg-[#E6E8DE] text-[#656D4A]">
                <Shield className="w-3.5 h-3.5" /> Biometric Data Pipeline
              </span>
              <h2 className="text-lg font-bold text-[#2C3524] mt-1">
                Upload Biometric Excel Logs (.xls / .xlsx)
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Upload raw machine punch logs. Automatically validates strict headers, removes duplicates within 60s, and calculates 8-hour Flexi shifts.
              </p>
            </div>
          </div>

          {/* Drag & Drop Upload Zone */}
          <div className="relative border-2 border-dashed border-[#A4AC86] hover:border-[#656D4A] bg-[#F7F8F5] hover:bg-[#F0F2EB] rounded-2xl p-8 text-center transition-all cursor-pointer group">
            <input
              type="file"
              id="biometric-file-input"
              accept=".xls,.xlsx"
              onChange={handleFileUpload}
              disabled={isProcessing}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="flex flex-col items-center justify-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-[#E6E8DE] text-[#656D4A] flex items-center justify-center group-hover:scale-105 transition-transform">
                {isProcessing ? (
                  <RefreshCw className="w-6 h-6 animate-spin" />
                ) : (
                  <Upload className="w-6 h-6" />
                )}
              </div>
              <div>
                <span className="text-sm font-bold text-[#2C3524]">
                  {isProcessing ? 'Cleaning & Validating Biometric Logs...' : 'Click to upload or drag & drop .xls or .xlsx file'}
                </span>
                <p className="text-xs text-gray-500 mt-1">
                  Strict Header Validation Enabled • Max File Size: 15MB
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-1.5 pt-2">
                {REQUIRED_HEADERS.slice(0, 5).map((hdr) => (
                  <span
                    key={hdr}
                    className="px-2 py-0.5 rounded-md bg-white border border-[#D3D8C8] text-[10px] font-medium text-gray-600"
                  >
                    ✓ {hdr}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Validation Feedback Banner */}
          {uploadMessage && (
            <div
              className={`p-4 rounded-xl border ${
                uploadMessage.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
            >
              <div className="flex items-start gap-3">
                {uploadMessage.type === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <h4 className="text-xs font-bold">{uploadMessage.title}</h4>
                  <p className="text-xs mt-1">{uploadMessage.text}</p>
                  {uploadMessage.details && uploadMessage.details.length > 0 && (
                    <ul className="mt-2 list-disc list-inside text-[11px] space-y-0.5 opacity-90">
                      {uploadMessage.details.map((d, i) => (
                        <li key={i}>{d}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SECTION WORK SCHEDULE ROSTER */}
      {(activeTab === 'schedules' || activeTab === 'all') && (
        <WorkScheduleManager
          currentUser={{ ...users[0], role: 'ADMIN' }}
          users={users}
          schedules={schedules}
          ctoRequests={ctoRequests}
          summaries={summaries}
          onSaveSchedule={onSaveSchedule}
        />
      )}

      {/* SECTION EMPLOYEE DTR LOGS SHEET TEMPLATE */}
      {(activeTab === 'dtr-logs' || activeTab === 'all') && (
        <EmployeeDtrSheet
          users={users}
          summaries={summaries}
          disputes={disputes}
          punches={punches}
          currentUser={users[0]}
        />
      )}

      {/* SECTION 2: BIOMETRIC LOGS & ANOMALY FILTER TABLE */}
      {(activeTab === 'logs' || activeTab === 'dtr-logs' || activeTab === 'overview' || activeTab === 'all') && (
        <div className="bg-white rounded-2xl border border-[#D3D8C8] p-6 shadow-xs space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-[#2C3524]">
                Biometric Daily Attendance Logs
              </h2>
              <p className="text-xs text-gray-500">
                Flexitime 8-Hour schedule tracking and anomaly detection logs ({filteredSummaries.length} Records)
              </p>
            </div>

            <button
              id="btn-admin-request-time-adjustment"
              onClick={() => setShowAdjustmentModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-black text-xs uppercase tracking-wider border border-zinc-950 shadow-xs cursor-pointer shrink-0"
            >
              <PlusCircle className="w-4 h-4" /> Request Time Adjustment
            </button>
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
                  placeholder="Search employee, ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-white border border-gray-300 rounded-xl text-xs font-medium text-gray-900 focus:ring-2 focus:ring-amber-400 focus:outline-hidden"
                />
              </div>

              <div className="flex items-end gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-1/2 px-2.5 py-1.5 border border-gray-300 rounded-xl text-xs font-bold text-gray-700 bg-white"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="COMPLETE">8h Flexi Compliant</option>
                  <option value="ANOMALY">All Anomalies</option>
                  <option value="UNDERTIME">Undertime (&lt; 8.0h)</option>
                  <option value="OVERTIME">Overtime (&gt; 8.0h)</option>
                  <option value="LACKING">Lacking (Missing In/Out)</option>
                  <option value="ABSENT">Absent (No Punches)</option>
                </select>

                <select
                  value={departmentFilter}
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                  className="w-1/2 px-2.5 py-1.5 border border-gray-300 rounded-xl text-xs font-bold text-gray-700 bg-white"
                >
                  <option value="ALL">All Depts</option>
                  {departments.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Logs Table */}
          <div className="overflow-x-auto border border-gray-200 rounded-xl">
            <table className="w-full text-left text-xs min-w-[1200px]">
              <thead className="bg-[#F7F8F5] text-[#4A543E] font-bold uppercase tracking-wider border-b border-gray-200">
                <tr>
                  <th className="p-3">Employee ID</th>
                  <th className="p-3">First Name</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Weekday</th>
                  <th className="p-3">Clock In</th>
                  <th className="p-3">Break Out</th>
                  <th className="p-3">Break In</th>
                  <th className="p-3">Clock Out</th>
                  <th className="p-3 text-center">Break Hours</th>
                  <th className="p-3 text-center">Total Hours</th>
                  <th className="p-3 text-center">Worked Hours</th>
                  <th className="p-3 text-center">Total OT</th>
                  <th className="p-3">Remarks</th>
                  <th className="p-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {filteredSummaries.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="p-8 text-center text-gray-400">
                      No matching attendance records found.
                    </td>
                  </tr>
                ) : (
                  filteredSummaries.map((s) => {
                    const breakTimes = getBreakTimes(s.punches);
                    const grossHours = calculateGrossHours(s.firstIn, s.lastOut);
                    const existingDispute = disputes.find(
                      (d) => d.employeeId === s.employeeId && d.targetDate === s.date
                    );

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
                      <tr key={s.id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="p-3 font-mono text-[11px] font-bold text-gray-600">
                          {s.employeeId}
                        </td>
                        <td className="p-3">
                          <div className="font-bold text-[#2C3524]">{s.employeeName}</div>
                          <div className="text-[10px] text-gray-400 font-medium">{s.department}</div>
                        </td>
                        <td className="p-3 font-mono font-bold text-[#2C3524] whitespace-nowrap">
                          {formatDateMDYYYY(s.date)}
                        </td>
                        <td className="p-3 text-gray-600 whitespace-nowrap">
                          {s.weekday}
                        </td>
                        <td className="p-3 font-mono font-semibold text-gray-700 whitespace-nowrap">
                          {s.firstIn ? formatTime12Hr(s.firstIn) : <span className="text-rose-500 font-bold">No Data</span>}
                        </td>
                        <td className="p-3 font-mono text-gray-600 whitespace-nowrap">
                          {breakTimes.breakOut === '--' || !breakTimes.breakOut || breakTimes.breakOut === 'No Data' ? 'No Data' : breakTimes.breakOut}
                        </td>
                        <td className="p-3 font-mono text-gray-600 whitespace-nowrap">
                          {breakTimes.breakIn === '--' || !breakTimes.breakIn || breakTimes.breakIn === 'No Data' ? 'No Data' : breakTimes.breakIn}
                        </td>
                        <td className="p-3 font-mono font-semibold text-gray-700 whitespace-nowrap">
                          {s.lastOut ? formatTime12Hr(s.lastOut) : <span className="text-rose-500 font-bold">No Data</span>}
                        </td>
                        <td className="p-3 text-center font-mono text-gray-600">
                          {(s.totalBreakMinutes / 60).toFixed(1)}h ({s.totalBreakMinutes}m)
                        </td>
                        <td className="p-3 text-center font-mono font-bold text-gray-700">
                          {grossHours.toFixed(1)} hrs
                        </td>
                        <td className="p-3 text-center font-mono font-bold text-[#2C3524]">
                          {s.netHoursWorked.toFixed(1)} hrs
                        </td>
                        <td className="p-3 text-center font-mono font-bold text-sky-700">
                          {s.overtimeHours > 0 ? `+${s.overtimeHours.toFixed(1)}h` : '0.0h'}
                        </td>
                        <td className="p-3 text-[11px] text-gray-700 min-w-[200px]">
                          <div className="flex flex-col gap-1 items-start">
                            {existingDispute ? (
                              <span
                                className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                                  existingDispute.status === 'APPROVED'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : existingDispute.status === 'REJECTED'
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'bg-amber-100 text-amber-900 border border-amber-300'
                                }`}
                              >
                                📌 {existingDispute.status}: {existingDispute.reason}
                              </span>
                            ) : s.anomalies.length > 0 ? (
                              <span className="text-gray-600 text-[10px]">{s.anomalies.join('; ')}</span>
                            ) : (
                              <span className="text-gray-400 text-[10px] italic">No concerns</span>
                            )}
                            <button
                              onClick={() => handleOpenRemarkPrompt(s)}
                              className="mt-0.5 text-[10px] font-extrabold text-amber-800 hover:text-zinc-950 bg-amber-100 hover:bg-amber-200 px-2.5 py-1 rounded-md border border-amber-400 flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                            >
                              💬 Concern / Remark
                            </button>
                          </div>
                        </td>
                        <td className="p-3 text-center whitespace-nowrap">
                          {isAbsent ? (
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
                          ) : s.status === 'OVERTIME' ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-sky-100 text-sky-900 border border-sky-300">
                              ★ Overtime
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-gray-100 text-gray-800 border border-gray-300">
                              {s.status}
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
        </div>
      )}

      {/* SECTION 3: DISPUTE APPROVALS MODAL & LIST */}
      {(activeTab === 'disputes' || activeTab === 'all') && (() => {
        const filteredAdminDisputes = disputes.filter((d) => {
          const matchSearch =
            !adminDisputeSearch ||
            d.employeeName.toLowerCase().includes(adminDisputeSearch.toLowerCase()) ||
            d.employeeId.toLowerCase().includes(adminDisputeSearch.toLowerCase()) ||
            d.reason.toLowerCase().includes(adminDisputeSearch.toLowerCase());

          const matchStatus =
            adminDisputeStatusFilter === 'ALL' || d.status === adminDisputeStatusFilter;

          const matchBranch =
            adminDisputeBranchFilter === 'ALL' ||
            d.branch === adminDisputeBranchFilter ||
            d.department === adminDisputeBranchFilter;

          return matchSearch && matchStatus && matchBranch;
        });

        const pendingCount = disputes.filter((d) => d.status === 'PENDING').length;
        const approvedCount = disputes.filter((d) => d.status === 'APPROVED').length;
        const rejectedCount = disputes.filter((d) => d.status === 'REJECTED').length;

        const availableBranches = Array.from(
          new Set(
            disputes
              .map((d) => d.branch || d.department)
              .filter((b): b is string => Boolean(b))
          )
        );

        return (
          <div className="bg-white rounded-2xl border border-[#D3D8C8] p-6 shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-zinc-150">
              <div>
                <h2 className="text-base font-bold text-[#2C3524] flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-600" />
                  Branch Time Adjustments & Disputes Audit
                </h2>
                <p className="text-xs text-gray-500">
                  Review staff requests, attached proof files, request history, and exact manager approval timestamps.
                </p>
              </div>
              {pendingCount > 0 && (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                  {pendingCount} Pending Approval
                </span>
              )}
            </div>

            {/* Filters Row */}
            <div className="space-y-3 bg-zinc-50 p-3.5 rounded-xl border border-zinc-200">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={adminDisputeSearch}
                    onChange={(e) => setAdminDisputeSearch(e.target.value)}
                    placeholder="Search by employee name, ID, or reason..."
                    className="w-full pl-9 pr-3 py-2 bg-white border border-zinc-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#656D4A] focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Filter className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                  <select
                    value={adminDisputeBranchFilter}
                    onChange={(e) => setAdminDisputeBranchFilter(e.target.value)}
                    className="bg-white border border-zinc-300 text-zinc-900 text-xs rounded-xl p-2 font-bold focus:ring-2 focus:ring-[#656D4A] focus:outline-none"
                  >
                    <option value="ALL">All Branches / Departments</option>
                    {availableBranches.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Status Filter Tabs */}
              <div className="flex items-center gap-1.5 pt-2 border-t border-zinc-200/60 overflow-x-auto">
                <span className="text-[11px] font-bold text-zinc-500 mr-1 uppercase">Filter Status:</span>
                {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setAdminDisputeStatusFilter(st)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                      adminDisputeStatusFilter === st
                        ? 'bg-[#2C3524] text-white shadow-2xs'
                        : 'bg-zinc-200/70 hover:bg-zinc-200 text-zinc-700'
                    }`}
                  >
                    {st === 'ALL' && `All (${disputes.length})`}
                    {st === 'PENDING' && `Pending (${pendingCount})`}
                    {st === 'APPROVED' && `Approved (${approvedCount})`}
                    {st === 'REJECTED' && `Rejected (${rejectedCount})`}
                  </button>
                ))}
              </div>
            </div>

            {/* List of Dispute Cards */}
            {filteredAdminDisputes.length === 0 ? (
              <div className="p-8 text-center bg-zinc-50 rounded-xl border border-dashed border-zinc-300 text-xs text-zinc-500">
                No time adjustments match the selected search or branch filter.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredAdminDisputes.map((d) => (
                  <div
                    key={d.id}
                    className={`p-4 rounded-xl border transition-all ${
                      d.status === 'PENDING'
                        ? 'border-amber-300 bg-amber-50/50'
                        : d.status === 'APPROVED'
                        ? 'border-emerald-200 bg-emerald-50/30'
                        : 'border-rose-200 bg-rose-50/30'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-xs font-extrabold text-[#2C3524]">{d.employeeName}</h4>
                        <span className="text-[10px] text-gray-500 font-mono font-bold">
                          {d.employeeId} • {d.branch || d.department || 'Branch'} • Target Date: {d.date}
                        </span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          d.status === 'PENDING'
                            ? 'bg-amber-200 text-amber-800'
                            : d.status === 'APPROVED'
                            ? 'bg-emerald-200 text-emerald-800'
                            : 'bg-rose-200 text-rose-800'
                        }`}
                      >
                        {d.status}
                      </span>
                    </div>

                    <DisputeCardDetails dispute={d} />

                    {d.status === 'PENDING' && (
                      <div className="mt-3 flex items-center justify-end gap-2 pt-2 border-t border-amber-200/60">
                        <button
                          id={`btn-reject-dispute-${d.id}`}
                          onClick={async () => {
                            const result = await showConfirmDisputeAction('REJECT', d.employeeName, d.date);
                            if (result.isConfirmed) {
                              onRejectDispute(d.id, result.value || 'Disapproved by Owner/Admin');
                              showSuccessAlert(
                                'Dispute Rejected',
                                `Attendance dispute for ${d.employeeName} on ${d.date} was rejected.`
                              );
                            }
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-lg border border-rose-300 bg-white hover:bg-rose-50 text-rose-700 text-xs font-bold transition-all cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" /> Reject
                        </button>
                        <button
                          id={`btn-approve-dispute-${d.id}`}
                          onClick={async () => {
                            const result = await showConfirmDisputeAction('APPROVE', d.employeeName, d.date);
                            if (result.isConfirmed) {
                              onApproveDispute(d.id, result.value || 'Approved by Owner/Admin');
                              showSuccessAlert(
                                'Dispute Approved!',
                                `Attendance dispute for ${d.employeeName} on ${d.date} was approved and timecard recalculated.`
                              );
                            }
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-[#656D4A] hover:bg-[#4A543E] text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" /> Approve Adjustment
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* SECTION 4: USER ACCOUNTS MANAGEMENT */}
      {(activeTab === 'users' || activeTab === 'all') && (() => {
        const filteredUserAccounts = users.filter((u) => {
          const q = userSearchQuery.trim().toLowerCase();
          const matchesQuery =
            !q ||
            u.name.toLowerCase().includes(q) ||
            u.employeeId.toLowerCase().includes(q) ||
            (u.position && u.position.toLowerCase().includes(q)) ||
            (u.department && u.department.toLowerCase().includes(q)) ||
            (u.role && u.role.toLowerCase().includes(q)) ||
            (u.passcodePin && u.passcodePin.includes(q)) ||
            (u.email && u.email.toLowerCase().includes(q));

          const matchesRole =
            userRoleFilter === 'ALL' || u.role.toUpperCase() === userRoleFilter.toUpperCase();

          return matchesQuery && matchesRole;
        });

        return (
          <div className="bg-white rounded-2xl border border-[#D3D8C8] p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-[#2C3524]">
                  Staff & Employee Account Management
                </h2>
                <p className="text-xs text-gray-500">
                  Configure staff PINs, roles, department assignments, and hire dates ({users.length} accounts total)
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  id="btn-quick-add-users"
                  onClick={() => setShowQuickUserModal(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                  title="Rapid multi-row user creation and batch Excel import modal"
                >
                  <Zap className="w-4 h-4 fill-white text-white" /> Quick Add Users
                </button>

                <button
                  id="btn-add-employee"
                  onClick={() => handleOpenUserModal()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#656D4A] hover:bg-[#4A543E] text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" /> Add Single Account
                </button>
              </div>
            </div>

            {/* User Search Bar & Filter Controls */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#F7F8F5] p-3 rounded-xl border border-[#D3D8C8]">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                <input
                  id="input-search-user-accounts"
                  type="text"
                  placeholder="Search user accounts by name, ID, position, PIN, or role..."
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-1.5 bg-white border border-[#D3D8C8] rounded-xl text-xs font-bold text-[#2C3524] focus:ring-2 focus:ring-[#656D4A] focus:outline-none"
                />
                {userSearchQuery && (
                  <button
                    onClick={() => setUserSearchQuery('')}
                    className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600 font-bold text-xs cursor-pointer"
                    title="Clear search"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                <span className="text-xs font-bold text-gray-600 shrink-0">Role Filter:</span>
                <select
                  value={userRoleFilter}
                  onChange={(e) => setUserRoleFilter(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-[#D3D8C8] rounded-xl text-xs font-bold text-[#2C3524] focus:ring-2 focus:ring-[#656D4A] cursor-pointer"
                >
                  <option value="ALL">All Roles ({users.length})</option>
                  <option value="STAFF">Staff Only</option>
                  <option value="MANAGER">Branch Managers</option>
                  <option value="PAYROLL">Payroll / HR</option>
                  <option value="ADMIN">Administrators</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto border border-gray-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F7F8F5] text-[#4A543E] font-bold uppercase tracking-wider border-b border-gray-200">
                  <tr>
                    <th className="p-3">Name / ID</th>
                    <th className="p-3">Role</th>
                    <th className="p-3">Department</th>
                    <th className="p-3">Position</th>
                    <th className="p-3">Passcode PIN</th>
                    <th className="p-3">Date Hired</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium">
                  {filteredUserAccounts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-gray-500 font-bold bg-white">
                        No user accounts found matching "{userSearchQuery}".
                      </td>
                    </tr>
                  ) : (
                    filteredUserAccounts.map((u) => {
                  return (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="p-3">
                        <div className="flex items-center gap-2.5">
                          {u.avatarUrl ? (
                            <img
                              src={u.avatarUrl}
                              alt={u.name}
                              className="w-8 h-8 rounded-full object-cover border border-[#656D4A] shrink-0"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-amber-200 text-[#2C3524] flex items-center justify-center font-black text-xs shrink-0 border border-amber-400">
                              {u.firstName?.[0] || u.name?.[0] || 'U'}
                            </div>
                          )}
                          <div>
                            <div className="font-bold text-[#2C3524]">{u.name}</div>
                            <div className="text-[10px] text-gray-400 font-mono">{u.employeeId}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E6E8DE] text-[#2C3524]">
                          {u.role}
                        </span>
                      </td>
                      <td className="p-3">
                        {u.role === 'STAFF' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-200/80">
                            Dynamic (Randomly Assigned)
                          </span>
                        ) : (
                          u.department
                        )}
                      </td>
                      <td className="p-3">{u.position}</td>
                      <td className="p-3 font-mono font-bold text-gray-700">{u.pin}</td>
                      <td className="p-3 font-mono font-bold text-gray-600">
                        {u.dateHired || 'N/A'}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            u.status === 'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-gray-200 text-gray-600'
                          }`}
                        >
                          {u.status}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            id={`btn-edit-user-${u.id}`}
                            onClick={() => handleOpenUserModal(u)}
                            className="p-1.5 text-gray-500 hover:text-[#656D4A] rounded-md hover:bg-gray-100 cursor-pointer transition-colors"
                            title="Edit User Details"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          {onDeleteUser && (
                            <button
                              id={`btn-delete-user-${u.id}`}
                              onClick={async () => {
                                const confirm = await yellowCabSwal.fire({
                                  title: 'Delete Employee Account?',
                                  text: `Are you sure you want to permanently delete ${u.name} (${u.employeeId})? This action cannot be undone.`,
                                  icon: 'warning',
                                  showCancelButton: true,
                                  confirmButtonText: 'Yes, Delete Account',
                                  cancelButtonText: 'Cancel',
                                  confirmButtonColor: '#dc2626',
                                });
                                if (confirm.isConfirmed) {
                                  onDeleteUser(u.id);
                                  showSuccessAlert(
                                    'User Account Deleted',
                                    `Employee account for ${u.name} (${u.employeeId}) has been deleted.`
                                  );
                                }
                              }}
                              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-md cursor-pointer transition-colors"
                              title="Delete User Account"
                            >
                              <UserX className="w-4 h-4" />
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
        </div>
      </div>
    );
  })()}

      {/* ADD / EDIT USER MODAL */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-black text-[#2C3524]">
                  {editingUser ? 'Edit Staff Account' : 'Create New Staff Account'}
                </h3>
                <p className="text-xs text-gray-500">
                  Fill in employee profile and onboarding details
                </p>
              </div>
              <button
                onClick={() => setShowUserModal(false)}
                className="text-gray-400 hover:text-gray-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-3.5">
              {/* PROFILE PICTURE UPLOAD */}
              <div className="bg-[#FAF9F5] p-3.5 rounded-xl border border-amber-300/80">
                <label className="block text-xs font-black text-[#2C3524] uppercase tracking-wider mb-2">
                  Employee Profile Picture
                </label>
                <div className="flex items-center gap-4">
                  {/* Avatar Preview */}
                  <div className="relative group shrink-0">
                    {userFormData.avatarUrl ? (
                      <img
                        src={userFormData.avatarUrl}
                        alt="Profile Preview"
                        className="w-16 h-16 rounded-full object-cover border-2 border-[#656D4A] shadow-xs"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-amber-200 text-[#2C3524] flex items-center justify-center font-black text-xl border-2 border-amber-400">
                        {userFormData.firstName?.[0]?.toUpperCase() || (
                          <UserIcon className="w-8 h-8 text-[#656D4A]" />
                        )}
                      </div>
                    )}
                    {userFormData.avatarUrl && (
                      <button
                        type="button"
                        onClick={() => setUserFormData({ ...userFormData, avatarUrl: '' })}
                        className="absolute -top-1 -right-1 bg-rose-600 hover:bg-rose-700 text-white p-1 rounded-full text-xs shadow-xs transition-colors cursor-pointer"
                        title="Remove photo"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Upload Controls */}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <label
                        htmlFor="user-avatar-upload"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#656D4A] hover:bg-[#4A543E] text-white text-xs font-bold cursor-pointer transition-colors shadow-2xs"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>Upload Photo</span>
                        <input
                          id="user-avatar-upload"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleAvatarFileChange}
                        />
                      </label>
                      <span className="text-[11px] text-gray-500 font-medium">PNG, JPG, WebP</span>
                    </div>

                    {/* Or URL input */}
                    <div className="flex items-center gap-1">
                      <input
                        id="input-user-avatar-url"
                        type="text"
                        placeholder="Or paste image URL..."
                        value={userFormData.avatarUrl || ''}
                        onChange={(e) =>
                          setUserFormData({ ...userFormData, avatarUrl: e.target.value })
                        }
                        className="w-full px-2.5 py-1 border border-gray-300 rounded-lg text-[11px] font-mono focus:ring-1 focus:ring-[#656D4A] focus:outline-none bg-white"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* SEPARATED NAME FIELDS */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    First Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="input-user-firstname"
                    type="text"
                    required
                    placeholder="e.g. Maria"
                    value={userFormData.firstName || ''}
                    onChange={(e) =>
                      setUserFormData({ ...userFormData, firstName: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-[#656D4A] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Middle Name <span className="text-gray-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    id="input-user-middlename"
                    type="text"
                    placeholder="e.g. Clara"
                    value={userFormData.middleName || ''}
                    onChange={(e) =>
                      setUserFormData({ ...userFormData, middleName: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-[#656D4A] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Last Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="input-user-lastname"
                    type="text"
                    required
                    placeholder="e.g. Santos"
                    value={userFormData.lastName || ''}
                    onChange={(e) =>
                      setUserFormData({ ...userFormData, lastName: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-[#656D4A] focus:outline-none"
                  />
                </div>
              </div>

              {/* EMPLOYEE ID, AUTH PIN, & DATE HIRED */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Employee ID <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="input-user-employee-id"
                    type="text"
                    required
                    value={userFormData.employeeId || ''}
                    onChange={(e) =>
                      setUserFormData({ ...userFormData, employeeId: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-mono uppercase focus:ring-2 focus:ring-[#656D4A] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Auth PIN Code <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="input-user-pin"
                    type="text"
                    required
                    maxLength={6}
                    value={userFormData.pin || ''}
                    onChange={(e) =>
                      setUserFormData({ ...userFormData, pin: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-[#656D4A] focus:outline-none"
                  />
                </div>

                <div>
                  <DatePickerInput
                    id="input-user-datehired"
                    label="Date Hired"
                    required
                    value={userFormData.dateHired || ''}
                    onChange={(val) =>
                      setUserFormData({ ...userFormData, dateHired: val })
                    }
                  />
                </div>
              </div>

              {/* BRANCH & ROLE */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Branch {userFormData.role === 'STAFF' && <span className="text-gray-400 font-normal">(Dynamic)</span>}
                  </label>
                  {userFormData.role === 'STAFF' ? (
                    <div className="w-full px-3 py-2 border border-amber-200 bg-amber-50/60 rounded-xl text-xs font-semibold text-amber-900 flex items-center gap-1.5 h-[38px]">
                      <span>⚡ No fixed branch (Assigned per shift)</span>
                    </div>
                  ) : (
                    <select
                      id="select-user-department"
                      value={userFormData.department || 'YC Ebloc'}
                      onChange={(e) =>
                        setUserFormData({ ...userFormData, department: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-bold text-gray-800 focus:ring-2 focus:ring-[#656D4A] focus:outline-none"
                    >
                      <option value="YC Main Office">YC Main Office</option>
                      <option value="YC Ebloc">YC Ebloc</option>
                      <option value="YC Ramos">YC Ramos</option>
                      <option value="YC Talisay">YC Talisay</option>
                      <option value="YC SM Seaside">YC SM Seaside</option>
                      <option value="YC Ayala">YC Ayala</option>
                      <option value="YC Banilad">YC Banilad</option>
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Role</label>
                  <select
                    id="select-user-role"
                    value={userFormData.role || 'STAFF'}
                    onChange={(e) => {
                      const newRole = e.target.value as any;
                      setUserFormData({
                        ...userFormData,
                        role: newRole,
                        department: newRole === 'STAFF' ? 'Store Operations' : (userFormData.department || 'YC Ebloc'),
                      });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-bold text-gray-800 focus:ring-2 focus:ring-[#656D4A] focus:outline-none"
                  >
                    <option value="STAFF">STAFF</option>
                    <option value="BRANCH_MANAGER">BRANCH_MANAGER</option>
                    <option value="SHIFT_MANAGER">SHIFT_MANAGER</option>
                    <option value="PAYROLL">PAYROLL</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </div>
              </div>

              {/* POSITION TITLE */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Position Title</label>
                <input
                  id="input-user-position"
                  type="text"
                  placeholder="e.g. Line Cook"
                  value={userFormData.position || ''}
                  onChange={(e) =>
                    setUserFormData({ ...userFormData, position: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-[#656D4A] focus:outline-none"
                />
              </div>

              {/* MODAL ACTION BUTTONS */}
              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-600 rounded-xl hover:bg-gray-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="btn-save-user-account"
                  type="submit"
                  className="px-5 py-2 bg-[#656D4A] hover:bg-[#4A543E] text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  Save Account Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Time Adjustment Request Modal */}
      {onSubmitDispute && (
        <TimeAdjustmentModal
          isOpen={showAdjustmentModal}
          onClose={() => setShowAdjustmentModal(false)}
          users={users}
          onSubmitDispute={onSubmitDispute}
        />
      )}

      {/* Quick Add & Batch Import Users Modal */}
      <QuickUserImportModal
        isOpen={showQuickUserModal}
        onClose={() => setShowQuickUserModal(false)}
        existingUsers={users}
        onAddUser={onAddUser}
        onUpdateUser={onUpdateUser}
      />
    </div>
  );
};
