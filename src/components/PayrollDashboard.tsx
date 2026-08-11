import React, { useState } from 'react';
import { DatePickerInput } from './DatePickerInput';
import { TimeAdjustmentModal } from './TimeAdjustmentModal';
import { ZktecoDatUploader } from './ZktecoDatUploader';
import { EmployeeDtrSheet } from './EmployeeDtrSheet';
import { DisputeCardDetails } from './DisputeCardDetails';
import { WorkScheduleManager } from './WorkScheduleManager';
import { AttendanceSummaryDaily, CtoManualAdjustment, CtoRequest, User, BiometricPunch, DisputeRequest, WorkSchedule } from '../types';
import { buildGoogleSheetsData } from '../utils/googleSheetsSync';
import { getUserCtoStats } from '../utils/ctoHelper';
import { formatDateMDYY, formatDateMDYYYY, formatDateWithDay, formatTime12Hr, getFilteredSummariesWithAbsents, getBreakTimes, calculateGrossHours } from '../utils/timeFormatters';
import {
  parseAndCleanBiometricExcel,
  generateSampleBiometricExcel,
  REQUIRED_HEADERS,
} from '../utils/fileProcessor';
import {
  showExportToast,
  yellowCabSwal,
  showConfirmCtoActionAlert,
  showConfirmDisputeAction,
  showSuccessAlert,
  showErrorAlert,
  showUploadProcessingAlert,
  showUploadSuccessAlert,
  showUploadErrorAlert,
  showRemarkPromptAlert,
} from '../utils/sweetAlerts';
import * as XLSX from 'xlsx';
import {
  Calculator,
  Download,
  FileSpreadsheet,
  FileText,
  DollarSign,
  TrendingUp,
  Filter,
  Calendar,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  Award,
  PlusCircle,
  Edit,
  Check,
  X,
  History,
  Sparkles,
  Upload,
  RefreshCw,
  AlertTriangle,
  Shield,
  CalendarDays,
} from 'lucide-react';

interface PayrollDashboardProps {
  users: User[];
  summaries: AttendanceSummaryDaily[];
  disputes?: DisputeRequest[];
  punches: BiometricPunch[];
  ctoRequests: CtoRequest[];
  ctoAdjustments: CtoManualAdjustment[];
  schedules?: WorkSchedule[];
  onSaveSchedule?: (schedule: WorkSchedule) => void;
  onUploadProcessed?: (newSummaries: AttendanceSummaryDaily[]) => void;
  onUpdateSummaryAnomaly?: (summaryId: string, newNote: string) => void;
  onApproveDispute?: (id: string, notes?: string, role?: 'MANAGER' | 'PAYROLL' | 'ADMIN') => void;
  onRejectDispute?: (id: string, notes?: string) => void;
  onSubmitDispute?: (dispute: Omit<DisputeRequest, 'id' | 'status' | 'submittedAt'>) => void;
  onApproveCtoRequest: (id: string, notes?: string) => void;
  onRejectCtoRequest: (id: string, notes?: string) => void;
  onAddCtoManualAdjustment: (adj: Omit<CtoManualAdjustment, 'id' | 'timestamp'>) => void;
  onSyncGoogleSheets: () => void;
  activeTab: string;
}

export const PayrollDashboard: React.FC<PayrollDashboardProps> = ({
  users,
  summaries,
  disputes = [],
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
  onApproveCtoRequest,
  onRejectCtoRequest,
  onAddCtoManualAdjustment,
  onSyncGoogleSheets,
  activeTab,
}) => {
  // File upload state for Payroll department
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<{
    type: 'success' | 'error' | 'warning';
    title: string;
    text: string;
    details?: string[];
  } | null>(null);

  // Pay Period Filters - Default to ALL so all uploaded biometric logs are shown
  const [payPeriodStart, setPayPeriodStart] = useState<string>('');
  const [payPeriodEnd, setPayPeriodEnd] = useState<string>('');
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [activePreset, setActivePreset] = useState<string>('ALL');

  // Pagination State (Page Limiter)
  const [dailyPage, setDailyPage] = useState<number>(1);
  const [dailyItemsPerPage, setDailyItemsPerPage] = useState<number>(25);
  const [payrollPage, setPayrollPage] = useState<number>(1);
  const [payrollItemsPerPage, setPayrollItemsPerPage] = useState<number>(25);

  // Time Adjustment Request Modal State
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);

  // Dispute & Time Adjustment Filter State for Payroll
  const [disputeSearch, setDisputeSearch] = useState<string>('');
  const [disputeStatusFilter, setDisputeStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [disputeBranchFilter, setDisputeBranchFilter] = useState<string>('ALL');

  // Preset Date Helper for Payroll
  const handlePresetChange = (preset: string) => {
    setActivePreset(preset);
    const today = new Date();
    
    if (preset === 'THIS_PAY_PERIOD') {
      const currentDay = today.getDate();
      const year = today.getFullYear();
      const month = today.getMonth() + 1;
      if (currentDay <= 15) {
        setPayPeriodStart(`${year}-${month < 10 ? '0' + month : month}-01`);
        setPayPeriodEnd(`${year}-${month < 10 ? '0' + month : month}-15`);
      } else {
        const lastDay = new Date(year, today.getMonth() + 1, 0).getDate();
        setPayPeriodStart(`${year}-${month < 10 ? '0' + month : month}-16`);
        setPayPeriodEnd(`${year}-${month < 10 ? '0' + month : month}-${lastDay}`);
      }
    } else if (preset === 'LAST_15_DAYS') {
      const past = new Date();
      past.setDate(today.getDate() - 15);
      setPayPeriodStart(past.toISOString().split('T')[0]);
      setPayPeriodEnd(today.toISOString().split('T')[0]);
    } else if (preset === 'THIS_MONTH') {
      const year = today.getFullYear();
      const month = today.getMonth() + 1;
      const lastDay = new Date(year, today.getMonth() + 1, 0).getDate();
      setPayPeriodStart(`${year}-${month < 10 ? '0' + month : month}-01`);
      setPayPeriodEnd(`${year}-${month < 10 ? '0' + month : month}-${lastDay}`);
    } else {
      setPayPeriodStart('');
      setPayPeriodEnd('');
    }
  };

  // Handle Remark / Time Concern Prompt for Payroll
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

  // Handle ZKTeco Biometric Excel File Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setUploadMessage(null);

    // Show SweetAlert processing dialog
    showUploadProcessingAlert(file.name);

    const result = await parseAndCleanBiometricExcel(file);
    setIsProcessing(false);

    if (result.isValid) {
      if (onUploadProcessed) {
        onUploadProcessed(result.summaries);
      }
      // Ensure all uploaded logs are displayed immediately without date filter clipping
      setActivePreset('ALL');
      setPayPeriodStart('');
      setPayPeriodEnd('');
      setUploadMessage({
        type: 'success',
        title: 'ZKTeco Biometric File Successfully Parsed & Cleaned by Payroll!',
        text: `Parsed ${result.rawRowsCount} raw rows into ${result.cleanedPunchesCount} deduplicated punches. Generated ${result.summaries.length} daily employee summaries for payroll processing.`,
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
        title: 'Biometric File Validation Failed',
        text: 'The uploaded Excel file does not satisfy biometric header requirements.',
        details: result.errors,
      });

      // Show SweetAlert error modal
      showUploadErrorAlert(result.errors);
    }

    e.target.value = '';
  };

  // Manual CTO Edit Modal state
  const [selectedUserForCto, setSelectedUserForCto] = useState<User | null>(null);
  const [adjustmentType, setAdjustmentType] = useState<'ADDITION' | 'DEDUCTION'>('ADDITION');
  const [adjustmentAmount, setAdjustmentAmount] = useState<number>(1.0);
  const [adjustmentReason, setAdjustmentReason] = useState<string>('');

  // Pending CTO requests
  const pendingCtoRequests = ctoRequests.filter((r) => r.status === 'PENDING');

  // Submit Manual CTO Adjustment
  const handleSaveCtoAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForCto || !adjustmentReason.trim() || adjustmentAmount <= 0) return;

    const finalAmount = adjustmentType === 'ADDITION' ? Math.abs(adjustmentAmount) : -Math.abs(adjustmentAmount);

    onAddCtoManualAdjustment({
      employeeId: selectedUserForCto.employeeId,
      employeeName: selectedUserForCto.name,
      amount: finalAmount,
      type: adjustmentType,
      reason: adjustmentReason,
      adjustedBy: 'Payroll Department',
    });

    yellowCabSwal.fire({
      icon: 'success',
      iconColor: '#d97706',
      title: 'CTO Balance Updated',
      text: `${adjustmentType === 'ADDITION' ? 'Added' : 'Deducted'} ${Math.abs(finalAmount)} hours for ${selectedUserForCto.name}`,
    });

    setSelectedUserForCto(null);
    setAdjustmentReason('');
    setAdjustmentAmount(1.0);
  };

  // Filter summaries based on date range with Absents & Lacking generated
  const rangeSummaries = getFilteredSummariesWithAbsents(
    summaries,
    users,
    payPeriodStart,
    payPeriodEnd
  );

  const filteredSummaries = rangeSummaries.filter((s) => {
    const inDept = selectedDept === 'ALL' || s.department === selectedDept;
    const matchesSearch =
      s.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.employeeId.toLowerCase().includes(searchTerm.toLowerCase());
    return inDept && matchesSearch;
  });

  // Calculate aggregated payroll per employee
  const payloadData = buildGoogleSheetsData(filteredSummaries, users, punches);
  const payrollItems = payloadData.payrollSummaries;

  // Aggregate Total Payroll Hours Figures
  const totalRegularHours = payrollItems.reduce((acc, p) => acc + p['Regular Hours'], 0);
  const totalUndertimeHours = payrollItems.reduce((acc, p) => acc + p['Undertime Deficit Hours'], 0);
  const totalDaysWorkedSum = payrollItems.reduce((acc, p) => acc + p['Days Worked'], 0);

  // Export Attendance Hours Summary File
  const handleExportPayslipSummary = () => {
    const filename = `FBC_Attendance_Hours_Summary_${payPeriodStart}_to_${payPeriodEnd}.xlsx`;
    const ws = XLSX.utils.json_to_sheet(payrollItems);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Attendance Hours Summary');
    XLSX.writeFile(wb, filename);

    showExportToast(filename);
  };

  const departments = Array.from(new Set(users.map((u) => u.department)));

  return (
    <div className="space-y-6">
      {/* WORK SCHEDULE ROSTER TAB FOR PAYROLL */}
      {activeTab === 'schedules' && (
        <div className="space-y-6">
          <WorkScheduleManager
            currentUser={users[0]}
            users={users}
            schedules={schedules}
            ctoRequests={ctoRequests}
            summaries={summaries}
            onSaveSchedule={onSaveSchedule}
            isReadOnly={true}
          />
        </div>
      )}

      {/* EMPLOYEE DTR LOGS SHEET TEMPLATE SECTION */}
      {(activeTab === 'dtr-logs' || activeTab === 'all') && (
        <EmployeeDtrSheet
          users={users}
          summaries={summaries}
          disputes={disputes}
          punches={punches}
        />
      )}

      {/* ZKTECO OLD VERSION .DAT FILE UPLOADER FOR PAYROLL */}
      {activeTab === 'upload-dat' && (
        <div className="space-y-6 animate-in fade-in">
          <ZktecoDatUploader users={users} onUploadProcessed={onUploadProcessed || (() => {})} />
        </div>
      )}

      {/* ZKTECO BIOMETRIC FILE UPLOAD SECTION FOR PAYROLL */}
      {(activeTab === 'upload' || activeTab === 'zkteco-upload' || activeTab === 'all') && (
        <div className="bg-white rounded-2xl border border-[#D3D8C8] p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
            <div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                <Upload className="w-3.5 h-3.5 text-amber-800" /> Payroll Biometric Data Ingestion
              </span>
              <h2 className="text-lg font-bold text-[#2C3524] mt-1">
                Upload ZKTeco Biometric Excel Logs (.xls / .xlsx)
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Upload raw machine punch logs directly into the payroll system. Validates headers, removes duplicate punches within 60s, and calculates net payroll hours.
              </p>
            </div>
          </div>

          {/* Drag & Drop Upload Zone */}
          <div className="relative border-2 border-dashed border-[#A4AC86] hover:border-[#656D4A] bg-[#F7F8F5] hover:bg-[#F0F2EB] rounded-2xl p-8 text-center transition-all cursor-pointer group">
            <input
              type="file"
              id="payroll-biometric-file-input"
              accept=".xls,.xlsx"
              onChange={handleFileUpload}
              disabled={isProcessing}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="flex flex-col items-center justify-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-900 flex items-center justify-center group-hover:scale-105 transition-transform border border-amber-300">
                {isProcessing ? (
                  <RefreshCw className="w-6 h-6 animate-spin" />
                ) : (
                  <Upload className="w-6 h-6" />
                )}
              </div>
              <div>
                <span className="text-sm font-bold text-[#2C3524]">
                  {isProcessing ? 'Processing & Validating Biometric Logs...' : 'Click to upload or drag & drop ZKTeco .xls / .xlsx file'}
                </span>
                <p className="text-xs text-gray-500 mt-1">
                  Biometric Header Validation Active • Max File Size: 15MB
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

      {/* ATTENDANCE HOURS KPI OVERVIEW */}
      {(activeTab === 'dtr-logs' || activeTab === 'daily-logs' || activeTab === 'overview' || activeTab === 'dashboard' || activeTab === 'all') && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-[#D3D8C8] shadow-xs">
            <span className="text-xs font-bold text-[#656D4A] uppercase tracking-wider">Total Days Worked</span>
            <div className="text-2xl font-black text-[#2C3524] mt-1">{totalDaysWorkedSum} Days</div>
            <div className="text-[11px] text-gray-500 mt-1">Total Attendance Days</div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-[#D3D8C8] shadow-xs">
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Total Regular Hours</span>
            <div className="text-2xl font-black text-emerald-800 mt-1">{totalRegularHours.toFixed(1)} hrs</div>
            <div className="text-[11px] text-emerald-600 mt-1">Net Regular Attendance Hours</div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-[#D3D8C8] shadow-xs">
            <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">Undertime Deficit Hours</span>
            <div className="text-2xl font-black text-amber-800 mt-1">-{totalUndertimeHours.toFixed(1)} hrs</div>
            <div className="text-[11px] text-amber-600 mt-1">Total Undertime Deficit Hours</div>
          </div>
        </div>
      )}

      {/* PAY PERIOD FILTER & EXPORT BAR */}
      {activeTab !== 'dtr-logs' && activeTab !== 'schedules' && (
        <div className="bg-white rounded-2xl border border-[#D3D8C8] p-5 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-amber-700" />
              <span className="text-xs font-black uppercase tracking-wider text-zinc-900">
                Pay Period Range Selection
              </span>
            </div>

            {/* Presets */}
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
                      : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 border border-zinc-300'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pt-2 border-t border-zinc-200">
            <div className="flex flex-wrap items-end gap-3 flex-1">
              <DatePickerInput
                label="Pay Period Start"
                value={payPeriodStart}
                onChange={(val) => {
                  setPayPeriodStart(val);
                  setActivePreset('CUSTOM');
                }}
              />

              <DatePickerInput
                label="Pay Period End"
                value={payPeriodEnd}
                onChange={(val) => {
                  setPayPeriodEnd(val);
                  setActivePreset('CUSTOM');
                }}
              />

              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-xl text-xs font-bold text-gray-700 bg-white"
              >
                <option value="ALL">All Departments</option>
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>

              <div className="relative flex-1 min-w-[180px]">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-3 z-10" />
                <input
                  type="text"
                  placeholder="Search employee or ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-amber-400 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {onSubmitDispute && (
                <button
                  id="btn-payroll-request-time-adjustment"
                  onClick={() => setShowAdjustmentModal(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-black text-xs uppercase tracking-wider border border-zinc-950 shadow-xs cursor-pointer shrink-0"
                >
                  <PlusCircle className="w-4 h-4" /> Request Time Adjustment
                </button>
              )}

              <button
                id="btn-export-payslip-summary"
                onClick={handleExportPayslipSummary}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#D3D8C8] bg-[#F7F8F5] hover:bg-[#E6E8DE] text-xs font-bold text-[#2C3524] transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4 text-[#656D4A]" />
                Export Hours Summary
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BIOMETRIC DAILY ATTENDANCE LOGS TABLE */}
      {(activeTab === 'daily-logs' || activeTab === 'logs') && (() => {
        const totalDailyPages = dailyItemsPerPage === -1 ? 1 : Math.ceil(filteredSummaries.length / (dailyItemsPerPage || 25));
        const currentDailyPage = Math.min(dailyPage, totalDailyPages || 1);
        const paginatedDailySummaries = dailyItemsPerPage === -1
          ? filteredSummaries
          : filteredSummaries.slice((currentDailyPage - 1) * dailyItemsPerPage, currentDailyPage * dailyItemsPerPage);

        return (
          <div className="bg-white rounded-2xl border border-[#D3D8C8] p-4 sm:p-5 shadow-xs space-y-3">
            {/* Table Header & Page Limiter Top Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-gray-100 pb-3">
              <div>
                <h2 className="text-base font-bold text-[#2C3524] flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#656D4A]" />
                  Biometric Daily Attendance Logs
                </h2>
                <p className="text-xs text-gray-500">
                  Parsed ZKTeco daily punches, break durations, overtime, missing punches ("Lacking"), and absents
                </p>
              </div>

              {/* Page Limiter Dropdown & Navigation */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-bold text-gray-600">Rows per page:</span>
                <select
                  value={dailyItemsPerPage}
                  onChange={(e) => {
                    setDailyItemsPerPage(Number(e.target.value));
                    setDailyPage(1);
                  }}
                  className="bg-white border border-gray-300 rounded-lg px-2 py-1 font-mono font-bold text-gray-800 shadow-2xs focus:ring-1 focus:ring-amber-500 cursor-pointer"
                >
                  <option value={10}>10 rows</option>
                  <option value={25}>25 rows</option>
                  <option value={50}>50 rows</option>
                  <option value={100}>100 rows</option>
                  <option value={-1}>Show All ({filteredSummaries.length})</option>
                </select>

                <span className="font-mono text-gray-500 text-[11px] bg-gray-50 px-2 py-1 rounded border border-gray-200">
                  {filteredSummaries.length === 0 ? 0 : (currentDailyPage - 1) * (dailyItemsPerPage === -1 ? filteredSummaries.length : dailyItemsPerPage) + 1}-
                  {dailyItemsPerPage === -1 ? filteredSummaries.length : Math.min(currentDailyPage * dailyItemsPerPage, filteredSummaries.length)} of {filteredSummaries.length}
                </span>

                {dailyItemsPerPage !== -1 && totalDailyPages > 1 && (
                  <div className="flex items-center gap-1 font-mono">
                    <button
                      disabled={currentDailyPage <= 1}
                      onClick={() => setDailyPage((p) => Math.max(1, p - 1))}
                      className="px-2 py-1 rounded-lg border border-gray-300 bg-white hover:bg-gray-100 disabled:opacity-40 font-bold transition-colors cursor-pointer"
                    >
                      ‹
                    </button>
                    <span className="px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg font-bold text-[#2C3524]">
                      {currentDailyPage}/{totalDailyPages}
                    </span>
                    <button
                      disabled={currentDailyPage >= totalDailyPages}
                      onClick={() => setDailyPage((p) => Math.min(totalDailyPages, p + 1))}
                      className="px-2 py-1 rounded-lg border border-gray-300 bg-white hover:bg-gray-100 disabled:opacity-40 font-bold transition-colors cursor-pointer"
                    >
                      ›
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Table Area Maximized with Compact Padding */}
            <div className="overflow-x-auto border border-gray-200 rounded-xl shadow-2xs">
              <table className="w-full text-left text-xs min-w-[1350px]">
                <thead className="bg-[#F7F8F5] text-[#4A543E] font-bold uppercase tracking-wider border-b border-gray-200 text-[11px]">
                  <tr>
                    <th className="px-2.5 py-2">ID</th>
                    <th className="px-2.5 py-2">Employee Name</th>
                    <th className="px-2.5 py-2">Branch</th>
                    <th className="px-2.5 py-2">Date</th>
                    <th className="px-2.5 py-2">Day</th>
                    <th className="px-2.5 py-2">Clock In</th>
                    <th className="px-2.5 py-2">Break Out</th>
                    <th className="px-2.5 py-2">Break In</th>
                    <th className="px-2.5 py-2">Clock Out</th>
                    <th className="px-2.5 py-2 text-center">Break Min</th>
                    <th className="px-2.5 py-2 text-center">Break Hrs</th>
                    <th className="px-2.5 py-2 text-center">Gross Hrs</th>
                    <th className="px-2.5 py-2 text-center">Worked Hrs</th>
                    <th className="px-2.5 py-2 text-center">OT Hrs</th>
                    <th className="px-2.5 py-2">Remarks / Discrepancies</th>
                    <th className="px-2.5 py-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium">
                  {paginatedDailySummaries.length === 0 ? (
                    <tr>
                      <td colSpan={16} className="p-8 text-center text-gray-400">
                        No matching attendance records found for selected period.
                      </td>
                    </tr>
                  ) : (
                    paginatedDailySummaries.map((s) => {
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
                        <tr key={s.id} className="hover:bg-amber-50/40 transition-colors">
                          <td className="px-2.5 py-2 font-mono text-[11px] font-bold text-gray-600">
                            {s.employeeId}
                          </td>
                          <td className="px-2.5 py-2">
                            <div className="font-bold text-[#2C3524] text-xs">{s.employeeName}</div>
                            <div className="text-[10px] text-gray-400 font-medium">{s.department}</div>
                          </td>
                          <td className="px-2.5 py-2 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-[11px] font-bold text-amber-900">
                              {s.branch || s.department || 'Main Branch'}
                            </span>
                          </td>
                          <td className="px-2.5 py-2 font-mono font-bold text-[#2C3524] whitespace-nowrap text-[11px]">
                            {formatDateMDYYYY(s.date)}
                          </td>
                          <td className="px-2.5 py-2 text-gray-600 whitespace-nowrap text-[11px]">
                            {s.weekday}
                          </td>
                          <td className="px-2.5 py-2 font-mono font-semibold text-gray-700 whitespace-nowrap text-[11px]">
                            {s.firstIn ? formatTime12Hr(s.firstIn) : <span className="text-rose-500 font-bold">No Data</span>}
                          </td>
                          <td className="px-2.5 py-2 font-mono text-gray-600 whitespace-nowrap text-[11px]">
                            {breakTimes.breakOut && breakTimes.breakOut !== 'No Data' && breakTimes.breakOut !== '--' ? (
                              breakTimes.breakOut
                            ) : (
                              <span className="font-bold text-gray-400">No Data</span>
                            )}
                          </td>
                          <td className="px-2.5 py-2 font-mono text-gray-600 whitespace-nowrap text-[11px]">
                            {breakTimes.breakIn && breakTimes.breakIn !== 'No Data' && breakTimes.breakIn !== '--' ? (
                              breakTimes.breakIn
                            ) : (
                              <span className="font-bold text-gray-400">No Data</span>
                            )}
                          </td>
                          <td className="px-2.5 py-2 font-mono font-semibold text-gray-700 whitespace-nowrap text-[11px]">
                            {s.lastOut ? formatTime12Hr(s.lastOut) : <span className="text-rose-500 font-bold">No Data</span>}
                          </td>
                          <td className="px-2.5 py-2 text-center font-mono text-gray-600 text-[11px]">
                            {s.totalBreakMinutes}m
                          </td>
                          <td className="px-2.5 py-2 text-center font-mono text-gray-600 text-[11px]">
                            {(s.totalBreakMinutes / 60).toFixed(1)}h
                          </td>
                          <td className="px-2.5 py-2 text-center font-mono font-bold text-gray-700 text-[11px]">
                            {grossHours.toFixed(1)} hrs
                          </td>
                          <td className="px-2.5 py-2 text-center font-mono font-bold text-[#2C3524] text-[11px]">
                            {s.netHoursWorked.toFixed(1)} hrs
                          </td>
                          <td className="px-2.5 py-2 text-center font-mono font-bold text-sky-700 text-[11px]">
                            {s.overtimeHours > 0 ? `+${s.overtimeHours.toFixed(1)}h` : '0.0h'}
                          </td>
                          <td className="px-2.5 py-2 text-[11px] text-gray-700 min-w-[180px]">
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
                              ) : missingPunches.length > 0 ? (
                                <span className="px-2 py-0.5 rounded-md font-extrabold text-[10px] bg-amber-100 text-amber-950 border border-amber-300">
                                  ⚡ Missing {missingPunches.join(', ')}
                                </span>
                              ) : s.anomalies.length > 0 ? (
                                <span className="text-gray-600 text-[10px]">{s.anomalies.join('; ')}</span>
                              ) : (
                                <span className="text-gray-400 text-[10px] italic">No concerns</span>
                              )}
                              <button
                                onClick={() => handleOpenRemarkPrompt(s)}
                                className="mt-0.5 text-[10px] font-extrabold text-amber-800 hover:text-zinc-950 bg-amber-100 hover:bg-amber-200 px-2 py-0.5 rounded-md border border-amber-400 flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                              >
                                💬 Concern / Remark
                              </button>
                            </div>
                          </td>
                          <td className="px-2.5 py-2 text-center whitespace-nowrap">
                            {isAbsent ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-950 border border-rose-300">
                                ✕ Absent
                              </span>
                            ) : missingPunches.length > 0 ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-950 border border-amber-400">
                                ⚡ Missing {missingPunches.join(', ')}
                              </span>
                            ) : s.status === 'COMPLETE' ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300">
                                ✓ Complete
                              </span>
                            ) : s.status === 'UNDERTIME' ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300">
                                ⚠ Undertime
                              </span>
                            ) : s.status === 'OVERTIME' ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-sky-100 text-sky-900 border border-sky-300">
                                ★ Overtime
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-gray-100 text-gray-800 border border-gray-300">
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
        );
      })()}

      {/* COMPENSATORY TIME OFF (CTO) MANAGEMENT SECTION */}
      {(activeTab === 'cto-management' || activeTab === 'all') && (
        <div id="cto-management-section" className="space-y-6">
          {/* Header & Pending Alert */}
          <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 rounded-2xl border-2 border-zinc-950 p-6 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-200" />
                <h2 className="text-lg font-black uppercase tracking-tight">
                  CTO (Compensatory Time Off) Governance & Manual Adjustments
                </h2>
              </div>
              <p className="text-xs text-amber-100 max-w-2xl">
                Review and approve employee CTO Credit requests (for work beyond 10 hours) or CTO Leave requests (for planned absences), or manually adjust CTO balances for any staff member.
              </p>
            </div>

            <div className="bg-zinc-950 text-white rounded-xl px-4 py-2.5 border border-amber-300/30 flex items-center gap-3">
              <span className="text-2xl font-black text-amber-400 font-mono">
                {pendingCtoRequests.length}
              </span>
              <span className="text-xs font-extrabold uppercase text-amber-100">
                Pending CTO Requests
              </span>
            </div>
          </div>

          {/* Pending CTO Request Approval Queue */}
          <div className="bg-white rounded-2xl border-2 border-zinc-950 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600" />
                <h3 className="font-black text-xs uppercase tracking-wider text-zinc-900">
                  Pending CTO Requests ({pendingCtoRequests.length})
                </h3>
              </div>
              <span className="text-[11px] text-zinc-500 font-bold">Action Required by Payroll Dept</span>
            </div>

            {pendingCtoRequests.length === 0 ? (
              <div className="p-6 text-center text-zinc-500 bg-zinc-50 rounded-xl border border-zinc-200">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto mb-1" />
                <p className="font-extrabold text-xs text-zinc-800">All CTO requests have been reviewed!</p>
                <p className="text-[11px] text-zinc-500">No pending credit or leave requests awaiting approval.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingCtoRequests.map((req) => {
                  const empStats = getUserCtoStats(req.employeeId, summaries, ctoRequests, ctoAdjustments);
                  const isCredit = req.requestType === 'CREDIT';

                  return (
                    <div
                      key={req.id}
                      className={`border rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                        isCredit ? 'bg-emerald-50/60 border-emerald-300' : 'bg-amber-50/60 border-amber-300'
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          {isCredit ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-600 text-white shadow-2xs">
                              + CTO CREDIT REQUEST
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500 text-zinc-950 shadow-2xs">
                              - CTO LEAVE REQUEST
                            </span>
                          )}
                          <span className="font-black text-xs text-zinc-950">{req.employeeName}</span>
                          <span className="text-xs font-mono font-bold text-zinc-500">({req.employeeId})</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-200 text-zinc-950">
                            {req.department}
                          </span>

                          {/* Dual Approval Indicators */}
                          <div className="flex items-center gap-1.5 ml-auto">
                            {req.managerApproved ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center gap-1">
                                <Check className="w-3 h-3 text-emerald-700" />
                                Branch Mgr Approved
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                                <Clock className="w-3 h-3 text-amber-700" />
                                Pending Branch Mgr
                              </span>
                            )}

                            {req.payrollApproved ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center gap-1">
                                <Check className="w-3 h-3 text-emerald-700" />
                                Payroll Approved
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                                <Clock className="w-3 h-3 text-amber-700" />
                                Pending Payroll
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 text-xs">
                          <span className="font-bold text-zinc-900">
                            {isCredit ? 'Work / Shift Date:' : 'Leave Date:'} <strong className="text-zinc-950">{req.date}</strong>
                          </span>
                          <span className={`font-mono font-black px-2 py-0.5 rounded border ${
                            isCredit ? 'bg-emerald-100 text-emerald-950 border-emerald-300' : 'bg-amber-100 text-amber-950 border-amber-300'
                          }`}>
                            {isCredit ? '+' : '-'}{req.hoursRequested.toFixed(1)} hrs CTO
                          </span>
                          <span className="text-zinc-500 text-[10px]">
                            Current Available Balance: {empStats.availableBalance.toFixed(1)} hrs
                          </span>
                        </div>

                        <p className="text-xs text-zinc-800 font-medium bg-white/80 p-2 rounded-lg border border-zinc-200">
                          <span className="font-bold text-zinc-500 text-[10px] uppercase block">Employee Reason:</span>
                          "{req.reason}"
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={async () => {
                            const result = await showConfirmCtoActionAlert('APPROVE', req.employeeName, req.hoursRequested, req.date);
                            if (result.isConfirmed) {
                              onApproveCtoRequest(req.id, result.value || 'Approved by Payroll Department');
                              showSuccessAlert(
                                `CTO ${isCredit ? 'Credit' : 'Leave'} Approved`,
                                `Approved ${req.hoursRequested}h CTO ${isCredit ? 'credit' : 'leave'} for ${req.employeeName} on ${req.date}`
                              );
                            }
                          }}
                          className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase px-4 py-2.5 rounded-xl border border-zinc-950 cursor-pointer shadow-md transition-all active:scale-95"
                        >
                          <Check className="w-4 h-4" /> Approve & {isCredit ? 'Credit' : 'Deduct'} Balance
                        </button>

                        <button
                          onClick={async () => {
                            const result = await showConfirmCtoActionAlert('REJECT', req.employeeName, req.hoursRequested, req.date);
                            if (result.isConfirmed) {
                              onRejectCtoRequest(req.id, result.value || 'Declined by Payroll');
                              showSuccessAlert(
                                `CTO ${isCredit ? 'Credit' : 'Leave'} Rejected`,
                                `Declined CTO request for ${req.employeeName}`
                              );
                            }
                          }}
                          className="flex items-center gap-1 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs uppercase px-3 py-2.5 rounded-xl border border-zinc-950 cursor-pointer transition-all"
                        >
                          <X className="w-3.5 h-3.5" /> Reject
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Employee CTO Balances & Manual Edit Directory */}
          <div className="bg-white rounded-2xl border-2 border-zinc-950 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
              <div>
                <h3 className="font-black text-xs uppercase tracking-wider text-zinc-950">
                  Employee CTO Directory & Manual Balance Controls
                </h3>
                <p className="text-[11px] text-zinc-500">
                  View and manually credit or deduct CTO balances for each employee
                </p>
              </div>
            </div>

            <div className="overflow-x-auto border border-zinc-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-900 text-amber-400 font-extrabold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="p-3">Employee</th>
                    <th className="p-3">Department</th>
                    <th className="p-3 text-center">Earned (Logs)</th>
                    <th className="p-3 text-center">Manual Adj.</th>
                    <th className="p-3 text-center">Used (Approved)</th>
                    <th className="p-3 text-center">Available CTO Balance</th>
                    <th className="p-3 text-center">Payroll Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 font-medium text-zinc-800">
                  {users.map((u) => {
                    const stats = getUserCtoStats(u.employeeId, summaries, ctoRequests, ctoAdjustments);
                    return (
                      <tr key={u.id} className="hover:bg-amber-50/40 transition-colors">
                        <td className="p-3 font-bold text-zinc-950">
                          <div>{u.name}</div>
                          <div className="text-[10px] text-zinc-500 font-mono">{u.employeeId}</div>
                        </td>
                        <td className="p-3">{u.department}</td>
                        <td className="p-3 text-center font-mono font-bold text-zinc-700">
                          +{stats.earnedFromAttendance.toFixed(1)} h
                        </td>
                        <td className="p-3 text-center font-mono font-bold">
                          <span className={stats.manualAdjustments >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                            {stats.manualAdjustments >= 0 ? `+${stats.manualAdjustments.toFixed(1)}` : stats.manualAdjustments.toFixed(1)} h
                          </span>
                        </td>
                        <td className="p-3 text-center font-mono font-bold text-amber-800">
                          -{stats.usedApproved.toFixed(1)} h
                        </td>
                        <td className="p-3 text-center font-mono font-black text-sm">
                          <span className="bg-amber-100 text-amber-950 px-3 py-1 rounded-full border border-amber-300">
                            {stats.availableBalance.toFixed(1)} hrs
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <button
                            id={`btn-edit-cto-${u.employeeId}`}
                            onClick={() => setSelectedUserForCto(u)}
                            className="inline-flex items-center gap-1 bg-amber-400 hover:bg-amber-300 text-zinc-950 font-black text-[11px] uppercase tracking-wider px-3 py-1.5 rounded-lg border border-zinc-950 transition-all cursor-pointer"
                          >
                            <Edit className="w-3 h-3" /> Edit CTO Balance
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* CTO Adjustments Audit Log */}
          {ctoAdjustments.length > 0 && (
            <div className="bg-white rounded-2xl border-2 border-zinc-950 p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-2 border-b border-zinc-200 pb-2">
                <History className="w-4 h-4 text-zinc-700" />
                <h4 className="font-black text-xs uppercase tracking-wider text-zinc-900">
                  Manual CTO Adjustment Audit Log ({ctoAdjustments.length})
                </h4>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-medium">
                  <thead>
                    <tr className="bg-zinc-100 text-zinc-700 font-extrabold uppercase text-[10px]">
                      <th className="p-2">Timestamp</th>
                      <th className="p-2">Employee</th>
                      <th className="p-2">Type</th>
                      <th className="p-2">Amount</th>
                      <th className="p-2">Reason / Audit Notes</th>
                      <th className="p-2">Adjusted By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {ctoAdjustments.map((adj) => (
                      <tr key={adj.id} className="hover:bg-zinc-50">
                        <td className="p-2 font-mono text-[10px] text-zinc-500">{adj.timestamp}</td>
                        <td className="p-2 font-bold text-zinc-900">{adj.employeeName} ({adj.employeeId})</td>
                        <td className="p-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black ${adj.type === 'ADDITION' ? 'bg-emerald-100 text-emerald-900' : 'bg-rose-100 text-rose-900'}`}>
                            {adj.type}
                          </span>
                        </td>
                        <td className="p-2 font-mono font-bold">
                          {adj.amount >= 0 ? `+${adj.amount.toFixed(1)}` : adj.amount.toFixed(1)} hrs
                        </td>
                        <td className="p-2 text-zinc-700">{adj.reason}</td>
                        <td className="p-2 text-zinc-500">{adj.adjustedBy}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Manual CTO Edit Modal */}
      {selectedUserForCto && (
        <div className="fixed inset-0 z-50 bg-zinc-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border-2 border-zinc-950 max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
              <div>
                <h3 className="font-black text-sm uppercase tracking-tight text-zinc-950">
                  Manual CTO Balance Adjustment
                </h3>
                <p className="text-xs text-zinc-500 font-bold">
                  {selectedUserForCto.name} ({selectedUserForCto.employeeId})
                </p>
              </div>
              <button
                onClick={() => setSelectedUserForCto(null)}
                className="text-zinc-400 hover:text-zinc-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCtoAdjustment} className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase text-zinc-700 mb-1">
                  Adjustment Action
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustmentType('ADDITION')}
                    className={`py-2 px-3 rounded-xl text-xs font-black uppercase transition-all cursor-pointer ${
                      adjustmentType === 'ADDITION'
                        ? 'bg-emerald-500 text-white border border-zinc-950 shadow-xs'
                        : 'bg-zinc-100 text-zinc-700 border border-zinc-200'
                    }`}
                  >
                    + Add CTO Hours
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustmentType('DEDUCTION')}
                    className={`py-2 px-3 rounded-xl text-xs font-black uppercase transition-all cursor-pointer ${
                      adjustmentType === 'DEDUCTION'
                        ? 'bg-rose-500 text-white border border-zinc-950 shadow-xs'
                        : 'bg-zinc-100 text-zinc-700 border border-zinc-200'
                    }`}
                  >
                    - Deduct CTO Hours
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-zinc-700 mb-1">
                  Hours to {adjustmentType === 'ADDITION' ? 'Credit' : 'Deduct'}
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="100"
                  value={adjustmentAmount}
                  onChange={(e) => setAdjustmentAmount(Number(e.target.value))}
                  required
                  className="w-full bg-zinc-50 border border-zinc-300 rounded-xl p-2.5 text-xs font-mono font-bold text-zinc-900 focus:ring-2 focus:ring-amber-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-zinc-700 mb-1">
                  Mandatory Audit Reason / Note
                </label>
                <textarea
                  value={adjustmentReason}
                  onChange={(e) => setAdjustmentReason(e.target.value)}
                  placeholder="e.g., Holiday shift bonus credit, manual correction, or absence deduction..."
                  rows={3}
                  required
                  className="w-full bg-zinc-50 border border-zinc-300 rounded-xl p-2.5 text-xs font-medium text-zinc-900 focus:ring-2 focus:ring-amber-400 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setSelectedUserForCto(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-600 bg-zinc-100 hover:bg-zinc-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-zinc-950 bg-amber-400 hover:bg-amber-300 border border-zinc-950 shadow-xs cursor-pointer"
                >
                  Save Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BRANCH TIME ADJUSTMENTS & DISPUTES SECTION FOR PAYROLL & ADMIN */}
      {(activeTab === 'disputes' || activeTab === 'all') && (() => {
        const filteredList = disputes.filter((d) => {
          const matchSearch =
            !disputeSearch ||
            d.employeeName.toLowerCase().includes(disputeSearch.toLowerCase()) ||
            d.employeeId.toLowerCase().includes(disputeSearch.toLowerCase()) ||
            d.reason.toLowerCase().includes(disputeSearch.toLowerCase());

          const matchStatus =
            disputeStatusFilter === 'ALL' || d.status === disputeStatusFilter;

          const matchBranch =
            disputeBranchFilter === 'ALL' ||
            d.branch === disputeBranchFilter ||
            d.department === disputeBranchFilter;

          return matchSearch && matchStatus && matchBranch;
        });

        const pendingCount = disputes.filter((d) => d.status === 'PENDING').length;
        const approvedCount = disputes.filter((d) => d.status === 'APPROVED').length;
        const rejectedCount = disputes.filter((d) => d.status === 'REJECTED').length;

        // Unique branches for filter dropdown
        const availableBranches = Array.from(
          new Set(
            disputes
              .map((d) => d.branch || d.department)
              .filter((b): b is string => Boolean(b))
          )
        );

        return (
          <div id="payroll-disputes-section" className="space-y-6">
            {/* Banner Header */}
            <div className="bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 rounded-2xl border-2 border-amber-400 p-6 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-400" />
                  <h2 className="text-lg font-black uppercase tracking-tight text-white">
                    Branch Time Adjustments & Dispute History
                  </h2>
                </div>
                <p className="text-xs text-zinc-300 max-w-2xl">
                  Comprehensive audit view for Payroll & Management. Audit all branch manager time approvals, employee punch dispute attachments, and exact approval timestamps.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowAdjustmentModal(true)}
                  className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-zinc-950 font-black text-xs uppercase tracking-wider rounded-xl border border-zinc-950 shadow-md flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <PlusCircle className="w-4 h-4 text-zinc-950" />
                  File Adjustment
                </button>
              </div>
            </div>

            {/* Summary Stat Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-2xs space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Total Adjustments</p>
                <p className="text-2xl font-black text-zinc-900 font-mono">{disputes.length}</p>
              </div>
              <div className="bg-amber-50 p-4 rounded-xl border border-amber-300 shadow-2xs space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800">Pending Review</p>
                <p className="text-2xl font-black text-amber-900 font-mono">{pendingCount}</p>
              </div>
              <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-300 shadow-2xs space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">Approved by Manager</p>
                <p className="text-2xl font-black text-emerald-900 font-mono">{approvedCount}</p>
              </div>
              <div className="bg-rose-50 p-4 rounded-xl border border-rose-300 shadow-2xs space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-rose-800">Rejected Requests</p>
                <p className="text-2xl font-black text-rose-900 font-mono">{rejectedCount}</p>
              </div>
            </div>

            {/* Filters Bar */}
            <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-2xs space-y-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                {/* Search Input */}
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={disputeSearch}
                    onChange={(e) => setDisputeSearch(e.target.value)}
                    placeholder="Search by employee name, ID, or reason..."
                    className="w-full pl-9 pr-3 py-2 bg-zinc-50 border border-zinc-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-amber-400 focus:outline-none"
                  />
                </div>

                {/* Branch Filter */}
                <div className="flex items-center gap-2">
                  <Filter className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                  <select
                    value={disputeBranchFilter}
                    onChange={(e) => setDisputeBranchFilter(e.target.value)}
                    className="bg-zinc-50 border border-zinc-300 text-zinc-900 text-xs rounded-xl p-2 font-bold focus:ring-2 focus:ring-amber-400 focus:outline-none"
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
              <div className="flex items-center gap-1.5 pt-2 border-t border-zinc-100 overflow-x-auto">
                <span className="text-[11px] font-bold text-zinc-500 mr-1 uppercase">Filter Status:</span>
                {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setDisputeStatusFilter(st)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                      disputeStatusFilter === st
                        ? 'bg-zinc-900 text-white shadow-2xs'
                        : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
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

            {/* List of Dispute Request Cards */}
            {filteredList.length === 0 ? (
              <div className="p-10 text-center bg-zinc-50 rounded-2xl border border-dashed border-zinc-300 space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                <p className="text-sm font-bold text-zinc-700">No Branch Time Adjustments Match Filters</p>
                <p className="text-xs text-zinc-500">Try adjusting your search criteria or branch filter.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredList.map((d) => (
                  <div
                    key={d.id}
                    className={`p-4 rounded-2xl border-2 transition-all shadow-xs space-y-3 ${
                      d.status === 'PENDING'
                        ? 'border-amber-400 bg-amber-50/40'
                        : d.status === 'APPROVED'
                        ? 'border-emerald-300 bg-emerald-50/30'
                        : 'border-rose-200 bg-rose-50/30'
                    }`}
                  >
                    {/* Top row with name, ID, branch & status */}
                    <div className="flex items-start justify-between gap-2 border-b border-zinc-200/80 pb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-extrabold text-sm text-zinc-950">{d.employeeName}</h3>
                          <span className="font-mono text-xs font-bold text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-300/80">
                            {d.employeeId}
                          </span>
                        </div>
                        <div className="text-[11px] font-semibold text-zinc-600 mt-0.5">
                          <span>{d.branch || d.department || 'Main Branch'}</span>
                          <span className="mx-1">•</span>
                          <span className="font-bold text-zinc-800">Target Date: {formatDateMDYYYY(d.date)}</span>
                        </div>
                      </div>

                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shrink-0 ${
                          d.status === 'PENDING'
                            ? 'bg-amber-400 text-zinc-950 border border-amber-500'
                            : d.status === 'APPROVED'
                            ? 'bg-emerald-600 text-white shadow-2xs'
                            : 'bg-rose-600 text-white shadow-2xs'
                        }`}
                      >
                        {d.status}
                      </span>
                    </div>

                    {/* Full Card Details including Proof Attachment & Manager Approval Timestamp */}
                    <DisputeCardDetails dispute={d} />

                    {/* Action buttons if Payroll / Admin wants to approve */}
                    {d.status === 'PENDING' && onApproveDispute && onRejectDispute && (
                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-amber-300/60">
                        {d.payrollApproved ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-bold shadow-2xs">
                            <Check className="w-4 h-4 text-emerald-600" />
                            Payroll Signed Off (Awaiting Manager)
                          </span>
                        ) : (
                          <>
                            <button
                              onClick={async () => {
                                const result = await showConfirmDisputeAction('REJECT', d.employeeName, d.date);
                                if (result.isConfirmed) {
                                  onRejectDispute(d.id, result.value || 'Rejected by Payroll');
                                  showSuccessAlert(
                                    'Dispute Rejected',
                                    `Time adjustment request for ${d.employeeName} on ${d.date} was rejected.`
                                  );
                                }
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-rose-300 bg-white hover:bg-rose-50 text-rose-700 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                            >
                              <X className="w-3.5 h-3.5" /> Reject
                            </button>
                            <button
                              onClick={async () => {
                                const result = await showConfirmDisputeAction('APPROVE', d.employeeName, d.date);
                                if (result.isConfirmed) {
                                  onApproveDispute(d.id, result.value || 'Approved by Payroll Department', 'PAYROLL');
                                  if (d.managerApproved) {
                                    showSuccessAlert(
                                      'Time Adjustment Fully Approved!',
                                      `Dual approval complete (Branch Manager & Payroll). Time adjustment for ${d.employeeName} on ${d.date} has updated the DTR.`
                                    );
                                  } else {
                                    showSuccessAlert(
                                      'Payroll Approval Recorded!',
                                      `Payroll approval logged for ${d.employeeName} on ${d.date}. Pending Branch Manager sign-off.`
                                    );
                                  }
                                }
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" /> Approve (Payroll Dept)
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* Time Adjustment Modal for Payroll */}
      {onSubmitDispute && (
        <TimeAdjustmentModal
          isOpen={showAdjustmentModal}
          onClose={() => setShowAdjustmentModal(false)}
          users={users}
          onSubmitDispute={onSubmitDispute}
        />
      )}
    </div>
  );
};
