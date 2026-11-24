import React, { useState } from 'react';
import Swal from 'sweetalert2';
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
  CtoManualAdjustment,
  CtoRequestType,
  CtoStatus,
  ActivityLog,
  ActivityActionType,
  AdminAlertCategoryKey,
  AdminEmailNotificationConfig,
} from '../types';
import { WorkScheduleManager } from './WorkScheduleManager';
import { ZktecoDatUploader } from './ZktecoDatUploader';
import { EmployeeDtrSheet } from './EmployeeDtrSheet';
import { ActivityLogsTable } from './ActivityLogsTable';
import {
  QuickUserImportModal,
  exportUsersToExcel,
} from './QuickUserImportModal';
import {
  parseAndCleanBiometricExcel,
  generateSampleBiometricExcel,
  REQUIRED_HEADERS,
} from '../utils/fileProcessor';
import { formatTime12Hr, formatDateWithDay, formatDateMDYY, formatDateMDYYYY, parseToYYYYMMDD, getFilteredSummariesWithAbsents, getBreakTimes, calculateGrossHours, formatRealtimeTimestamp, resolveSummaryBranch } from '../utils/timeFormatters';
import { getUserCtoStats } from '../utils/ctoHelper';
import { isFieldAdjusted, getAdjustedDisplayTime } from '../utils/adjustmentHelper';
import { exportDisputesToPdf } from '../utils/pdfExportHelper';
import {
  showUploadProcessingAlert,
  showUploadSuccessAlert,
  showUploadErrorAlert,
  showConfirmDisputeAction,
  showConfirmCtoActionAlert,
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
  FileText,
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
  Trash2,
  History,
  Bell,
  CheckCheck,
  ArrowRight,
  Package,
  CalendarClock,
  RotateCcw,
  Award,
  Mail,
  Send,
  Settings,
  Ticket,
  Download,
} from 'lucide-react';
import {
  AdminAlertItem,
  ALL_ADMIN_ALERT_CATEGORIES,
  DEFAULT_ADMIN_ALERT_EMAIL,
  DEFAULT_ADMIN_EMAIL_CONFIG,
  EmailDeliveryStatusResponse,
  formatAlertTimestamp,
  SendAdminAlertEmailsResult,
} from '../utils/adminAlerts';

interface AdminDashboardProps {
  users: User[];
  summaries: AttendanceSummaryDaily[];
  disputes: DisputeRequest[];
  punches: BiometricPunch[];
  schedules?: WorkSchedule[];
  ctoRequests?: CtoRequest[];
  ctoAdjustments?: CtoManualAdjustment[];
  activityLogs?: ActivityLog[];
  onSaveSchedule?: (schedule: WorkSchedule) => void;
  onUploadProcessed: (newSummaries: AttendanceSummaryDaily[]) => void;
  onUpdateSummaryAnomaly?: (summaryId: string, newNote: string) => void;
  onApproveDispute: (disputeId: string, adminNotes: string, approverRole?: 'MANAGER' | 'PAYROLL' | 'ADMIN') => void;
  onRejectDispute: (disputeId: string, adminNotes: string) => void;
  onSubmitDispute?: (dispute: Omit<DisputeRequest, 'id' | 'status' | 'submittedAt'>) => void;
  onApproveCtoRequest?: (id: string, notes?: string, approverRole?: 'MANAGER' | 'PAYROLL' | 'ADMIN') => void;
  onRejectCtoRequest?: (id: string, notes?: string) => void;
  onUpdateCtoRequest?: (updatedCto: CtoRequest) => Promise<boolean> | boolean | void;
  onSubmitCtoRequest?: (req: Omit<CtoRequest, 'id' | 'status' | 'submittedAt'>) => void;
  onAddUser: (user: User) => Promise<boolean> | boolean | void;
  onUpdateUser: (user: User) => Promise<boolean> | boolean | void;
  onDeleteUser?: (userId: string) => void;
  onDeleteDispute?: (disputeId: string) => void;
  onDeleteSummary?: (summaryId: string) => void;
  onClearSummaries?: (summaryIdsToClear?: string[]) => void;
  onDeleteCtoRequest?: (ctoId: string) => void;
  onClearActivityLogs?: () => void;
  onSyncGoogleSheets: () => void;
  activeTab: string;
  onNavigateTab?: (tab: string) => void;
  adminAlerts?: AdminAlertItem[];
  readAlertIds?: Set<string>;
  dismissedAlertCount?: number;
  onMarkAlertRead?: (alertId: string) => void;
  onDismissAlert?: (alertId: string) => void;
  onMarkAllAlertsRead?: () => void;
  onRestoreDismissedAlerts?: () => void;
  adminEmailConfig?: AdminEmailNotificationConfig;
  emailDeliveryStatus?: EmailDeliveryStatusResponse;
  onSaveAdminEmailConfig?: (updated: AdminEmailNotificationConfig) => Promise<boolean>;
  onSendTestAdminEmail?: (recipientEmail: string) => Promise<SendAdminAlertEmailsResult>;
  onEmailActiveAlertsNow?: () => Promise<SendAdminAlertEmailsResult>;
  onExportSystemBackup?: () => void;
  onRestoreSystemBackup?: (
    jsonText: string
  ) => Promise<{ totalRestored: number; collectionsRestored: number }>;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  users,
  summaries,
  disputes,
  punches,
  schedules = [],
  ctoRequests = [],
  ctoAdjustments = [],
  activityLogs = [],
  onSaveSchedule = () => {},
  onUploadProcessed,
  onUpdateSummaryAnomaly,
  onApproveDispute,
  onRejectDispute,
  onSubmitDispute,
  onApproveCtoRequest,
  onRejectCtoRequest,
  onUpdateCtoRequest,
  onSubmitCtoRequest,
  onAddUser,
  onUpdateUser,
  onDeleteUser,
  onDeleteDispute,
  onDeleteSummary,
  onClearSummaries,
  onDeleteCtoRequest,
  onClearActivityLogs,
  onSyncGoogleSheets,
  activeTab,
  onNavigateTab,
  adminAlerts = [],
  readAlertIds = new Set<string>(),
  dismissedAlertCount = 0,
  onMarkAlertRead,
  onDismissAlert,
  onMarkAllAlertsRead,
  onRestoreDismissedAlerts,
  adminEmailConfig = DEFAULT_ADMIN_EMAIL_CONFIG,
  emailDeliveryStatus,
  onSaveAdminEmailConfig,
  onSendTestAdminEmail,
  onEmailActiveAlertsNow,
  onExportSystemBackup,
  onRestoreSystemBackup,
}) => {
  // Alert Center filter state
  const [alertFilter, setAlertFilter] = useState<
    'ALL' | 'WAREHOUSE' | 'DISPUTE' | 'ATTENDANCE' | 'TICKET'
  >('ALL');
  const [showAllAlerts, setShowAllAlerts] = useState(false);
  const [isRestoringBackup, setIsRestoringBackup] = useState(false);
  const backupFileInputRef = React.useRef<HTMLInputElement | null>(null);

  const handleBackupFileSelected = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !onRestoreSystemBackup) return;
    try {
      setIsRestoringBackup(true);
      const text = await file.text();
      const res = await onRestoreSystemBackup(text);
      showSuccessAlert(
        'Backup Restored',
        `Successfully restored ${res.totalRestored} record(s) across ${res.collectionsRestored} collection(s) into local persistent cache and Firestore.`
      );
    } catch (err) {
      showErrorAlert(
        'Restore Failed',
        err instanceof Error
          ? err.message
          : 'Could not read or restore the selected backup JSON file.'
      );
    } finally {
      setIsRestoringBackup(false);
    }
  };

  // Super Admin Email Notification Modal State
  const [showEmailSettingsModal, setShowEmailSettingsModal] = useState(false);
  const [emailDraftEnabled, setEmailDraftEnabled] = useState<boolean>(
    adminEmailConfig.enabled
  );
  const [emailDraftRecipient, setEmailDraftRecipient] = useState<string>(
    adminEmailConfig.recipientEmail || DEFAULT_ADMIN_ALERT_EMAIL
  );
  const [emailDraftCategories, setEmailDraftCategories] = useState<AdminAlertCategoryKey[]>(
    adminEmailConfig.enabledCategories || ALL_ADMIN_ALERT_CATEGORIES
  );
  const [isSavingEmailConfig, setIsSavingEmailConfig] = useState(false);
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
  const [isSendingDigestEmail, setIsSendingDigestEmail] = useState(false);
  const [emailActionFeedback, setEmailActionFeedback] = useState<{
    type: 'success' | 'warning' | 'error';
    text: string;
  } | null>(null);

  const ALERT_CATEGORY_LABELS: Record<AdminAlertCategoryKey, string> = {
    STR: 'Stock Transfer Requisitions (STR)',
    LOW_STOCK: 'Low & Out-of-Stock Branches',
    NEAR_EXPIRY: 'Near-Expiry & Expired Inventory',
    DISPUTE: 'Timecard Disputes & Adjustments',
    CTO: 'CTO Leave & Credit Requests',
    ATTENDANCE: 'Missing Biometric Punches',
    TICKET: 'Store Concern Tickets',
  };

  const handleOpenEmailSettingsModal = () => {
    setEmailDraftEnabled(adminEmailConfig.enabled);
    setEmailDraftRecipient(adminEmailConfig.recipientEmail || DEFAULT_ADMIN_ALERT_EMAIL);
    setEmailDraftCategories(
      adminEmailConfig.enabledCategories && adminEmailConfig.enabledCategories.length > 0
        ? adminEmailConfig.enabledCategories
        : [...ALL_ADMIN_ALERT_CATEGORIES]
    );
    setEmailActionFeedback(null);
    setShowEmailSettingsModal(true);
  };

  const handleToggleDraftCategory = (category: AdminAlertCategoryKey) => {
    setEmailDraftCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
  };

  const handleSaveEmailSettingsForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSaveAdminEmailConfig || isSavingEmailConfig) return;
    const trimmedEmail = emailDraftRecipient.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setEmailActionFeedback({
        type: 'error',
        text: 'Please enter a valid Super Admin email address.',
      });
      return;
    }
    if (emailDraftEnabled && emailDraftCategories.length === 0) {
      setEmailActionFeedback({
        type: 'error',
        text: 'Select at least one alert category while auto-email is enabled.',
      });
      return;
    }

    setIsSavingEmailConfig(true);
    setEmailActionFeedback(null);
    try {
      const ok = await onSaveAdminEmailConfig({
        ...adminEmailConfig,
        id: adminEmailConfig.id || 'superadmin',
        enabled: emailDraftEnabled,
        recipientEmail: trimmedEmail,
        enabledCategories: emailDraftCategories,
        updatedAt: new Date().toISOString(),
      });
      if (ok) {
        setEmailActionFeedback({
          type: 'success',
          text: `Saved email notification settings for ${trimmedEmail}.`,
        });
      } else {
        setEmailActionFeedback({
          type: 'error',
          text: 'Could not save email notification settings. Please try again.',
        });
      }
    } finally {
      setIsSavingEmailConfig(false);
    }
  };

  const handleTriggerTestEmail = async () => {
    if (!onSendTestAdminEmail || isSendingTestEmail) return;
    const trimmedEmail = emailDraftRecipient.trim() || DEFAULT_ADMIN_ALERT_EMAIL;
    setIsSendingTestEmail(true);
    setEmailActionFeedback(null);
    try {
      const res = await onSendTestAdminEmail(trimmedEmail);
      if (res.success) {
        setEmailActionFeedback({
          type: 'success',
          text: `Test notification email sent to ${res.recipient || trimmedEmail}.`,
        });
      } else if (res.code === 'EMAIL_NOT_CONFIGURED') {
        setEmailActionFeedback({
          type: 'warning',
          text:
            res.message ||
            'Server email transport is not configured yet. Add SMTP_USER/SMTP_PASS or RESEND_API_KEY in Environment Secrets.',
        });
      } else {
        setEmailActionFeedback({
          type: 'error',
          text: res.error || res.message || 'Failed to send test email.',
        });
      }
    } finally {
      setIsSendingTestEmail(false);
    }
  };

  const handleTriggerDigestEmail = async () => {
    if (!onEmailActiveAlertsNow || isSendingDigestEmail) return;
    setIsSendingDigestEmail(true);
    setEmailActionFeedback(null);
    try {
      const res = await onEmailActiveAlertsNow();
      if (res.success) {
        setEmailActionFeedback({
          type: 'success',
          text: `Active alerts email sent (${res.sentCount || 0} alert${
            res.sentCount === 1 ? '' : 's'
          }) to ${res.recipient || adminEmailConfig.recipientEmail}.`,
        });
      } else if (res.code === 'EMAIL_NOT_CONFIGURED') {
        setEmailActionFeedback({
          type: 'warning',
          text:
            res.message ||
            'Server email transport is not configured yet. Add SMTP_USER/SMTP_PASS or RESEND_API_KEY in Environment Secrets.',
        });
      } else {
        setEmailActionFeedback({
          type: 'error',
          text: res.error || res.message || 'Could not send active alerts email.',
        });
      }
    } finally {
      setIsSendingDigestEmail(false);
    }
  };

  // Activity Log Search & Filter State
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [logCategoryFilter, setLogCategoryFilter] = useState('ALL');

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

  // CTO Leave & Credit Management State for Admin
  const [adminCtoSearch, setAdminCtoSearch] = useState('');
  const [adminCtoStatusFilter, setAdminCtoStatusFilter] = useState<'ALL' | CtoStatus>('ALL');
  const [adminCtoTypeFilter, setAdminCtoTypeFilter] = useState<'ALL' | CtoRequestType>('ALL');
  const [showCtoModal, setShowCtoModal] = useState(false);
  const [editingCtoRequest, setEditingCtoRequest] = useState<CtoRequest | null>(null);
  const [isSavingCto, setIsSavingCto] = useState(false);
  const [ctoFormData, setCtoFormData] = useState<{
    employeeId: string;
    requestType: CtoRequestType;
    date: string;
    hoursRequested: number;
    status: CtoStatus;
    department: string;
    reason: string;
    reviewNotes: string;
  }>({
    employeeId: '',
    requestType: 'LEAVE',
    date: new Date().toISOString().split('T')[0],
    hoursRequested: 8.0,
    status: 'PENDING',
    department: '',
    reason: '',
    reviewNotes: '',
  });

  const handleOpenCtoEditModal = (req: CtoRequest) => {
    setEditingCtoRequest(req);
    setCtoFormData({
      employeeId: req.employeeId,
      requestType: req.requestType === 'CREDIT' ? 'CREDIT' : 'LEAVE',
      date: req.date || new Date().toISOString().split('T')[0],
      hoursRequested: Number(req.hoursRequested) || 8.0,
      status: req.status || 'PENDING',
      department: req.department || req.branch || '',
      reason: req.reason || '',
      reviewNotes: req.reviewNotes || '',
    });
    setShowCtoModal(true);
  };

  const handleOpenCtoCreateModal = () => {
    const defaultEmp = users.find((u) => u.status === 'ACTIVE') || users[0];
    setEditingCtoRequest(null);
    setCtoFormData({
      employeeId: defaultEmp?.employeeId || '',
      requestType: 'LEAVE',
      date: new Date().toISOString().split('T')[0],
      hoursRequested: 8.0,
      status: 'PENDING',
      department: defaultEmp?.department || 'YC Ebloc',
      reason: '',
      reviewNotes: '',
    });
    setShowCtoModal(true);
  };

  const handleSaveCtoModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingCto) return;

    if (!ctoFormData.date.trim() || !ctoFormData.reason.trim() || !ctoFormData.employeeId.trim()) {
      showErrorAlert(
        'Incomplete CTO Details',
        'Please select an employee, date, hours, and enter a reason.'
      );
      return;
    }

    const parsedHours = Number(ctoFormData.hoursRequested);
    if (!Number.isFinite(parsedHours) || parsedHours <= 0) {
      showErrorAlert('Invalid Hours', 'Hours requested must be greater than 0.');
      return;
    }

    const normalizedDate = parseToYYYYMMDD(ctoFormData.date.trim()) || ctoFormData.date.trim();

    setIsSavingCto(true);
    try {
      if (editingCtoRequest) {
        if (!onUpdateCtoRequest) return;
        const matchedEmp = users.find((u) => u.employeeId === ctoFormData.employeeId);
        const nowIso = new Date().toISOString();
        const updatedCto: CtoRequest = {
          ...editingCtoRequest,
          employeeId: ctoFormData.employeeId,
          employeeName: matchedEmp?.name || editingCtoRequest.employeeName,
          department: ctoFormData.department.trim() || matchedEmp?.department || editingCtoRequest.department,
          branch: ctoFormData.department.trim() || editingCtoRequest.branch || editingCtoRequest.department,
          requestType: ctoFormData.requestType,
          date: normalizedDate,
          hoursRequested: parsedHours,
          status: ctoFormData.status,
          reason: ctoFormData.reason.trim(),
          reviewNotes: ctoFormData.reviewNotes.trim() || undefined,
          reviewedBy:
            ctoFormData.status !== 'PENDING'
              ? editingCtoRequest.reviewedBy || 'Super Admin'
              : editingCtoRequest.reviewedBy,
          reviewedAt:
            ctoFormData.status !== 'PENDING'
              ? editingCtoRequest.reviewedAt || nowIso
              : editingCtoRequest.reviewedAt,
          managerApproved: ctoFormData.status === 'APPROVED' ? true : ctoFormData.status === 'REJECTED' ? false : editingCtoRequest.managerApproved,
          payrollApproved: ctoFormData.status === 'APPROVED' ? true : ctoFormData.status === 'REJECTED' ? false : editingCtoRequest.payrollApproved,
        };

        const ok = await onUpdateCtoRequest(updatedCto);
        if (ok === false) {
          showErrorAlert('Update Failed', 'Could not save changes to this CTO request. Please try again.');
          return;
        }
        showSuccessAlert(
          'CTO Request Updated',
          `CTO request for ${updatedCto.employeeName} on ${updatedCto.date} (${updatedCto.hoursRequested}h) has been updated.`
        );
      } else if (onSubmitCtoRequest) {
        const matchedEmp = users.find((u) => u.employeeId === ctoFormData.employeeId);
        onSubmitCtoRequest({
          employeeId: ctoFormData.employeeId,
          employeeName: matchedEmp?.name || ctoFormData.employeeId,
          department: ctoFormData.department.trim() || matchedEmp?.department || 'YC Ebloc',
          branch: ctoFormData.department.trim() || matchedEmp?.branch || matchedEmp?.department,
          date: normalizedDate,
          hoursRequested: parsedHours,
          requestType: ctoFormData.requestType,
          reason: ctoFormData.reason.trim(),
        });
        showSuccessAlert(
          'CTO Request Created',
          `Filed CTO ${ctoFormData.requestType === 'CREDIT' ? 'Credit' : 'Leave'} request for ${matchedEmp?.name || ctoFormData.employeeId}.`
        );
      }
      setShowCtoModal(false);
    } finally {
      setIsSavingCto(false);
    }
  };

  const handleDeleteCtoClick = async (req: CtoRequest) => {
    if (!onDeleteCtoRequest) return;
    const confirm = await yellowCabSwal.fire({
      title: 'Delete CTO Request?',
      html: `<div style="text-align: left; font-size: 13px;">
        <p style="margin-bottom: 6px;">Are you sure you want to permanently delete this CTO ${req.requestType === 'CREDIT' ? 'Credit' : 'Leave'} request?</p>
        <p><strong>Employee:</strong> ${req.employeeName} (${req.employeeId})</p>
        <p><strong>Date &amp; Hours:</strong> ${req.date} (${req.hoursRequested}h)</p>
        <p style="color: #dc2626; font-weight: 700; margin-top: 8px;">This action removes the record from the cloud database and cannot be undone.</p>
      </div>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, Delete Request',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#dc2626',
    });

    if (confirm.isConfirmed) {
      onDeleteCtoRequest(req.id);
      showSuccessAlert(
        'CTO Request Deleted',
        `CTO request for ${req.employeeName} on ${req.date} has been permanently deleted.`
      );
    }
  };

  // Handle Remark / Time Concern Prompt
  const handleOpenRemarkPrompt = async (s: AttendanceSummaryDaily) => {
    const existingDispute = disputes.find(
      (d) => d.employeeId === s.employeeId && d.targetDate === s.date
    );
    const existingRemark = existingDispute?.reason || ((s.anomalies || []).length > 0 ? (s.anomalies || []).join(' | ') : '');

    const result = await showRemarkPromptAlert(
      s.employeeName,
      formatDateMDYY(s.date),
      existingRemark
    );

    if (result.isConfirmed && result.value !== undefined) {
      const remarkText = result.value.trim();
      if (onUpdateSummaryAnomaly) {
        onUpdateSummaryAnomaly(s.id, remarkText);
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

  const handleDeleteDisputeClick = async (dispute: DisputeRequest) => {
    const result = await yellowCabSwal.fire({
      title: 'Delete Dispute Record?',
      html: `Are you sure you want to permanently delete the time adjustment/dispute ticket for <b>${dispute.employeeName}</b> on date <b>${dispute.date}</b>?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, Delete Record',
      cancelButtonText: 'Cancel',
    });
    if (result.isConfirmed && onDeleteDispute) {
      onDeleteDispute(dispute.id);
      showSuccessAlert('Record Deleted', `Dispute ticket for ${dispute.employeeName} has been permanently removed.`);
    }
  };

  const handleDeleteSummaryClick = async (s: AttendanceSummaryDaily) => {
    const result = await yellowCabSwal.fire({
      title: 'Delete Daily Attendance Record?',
      html: `Are you sure you want to permanently delete the attendance record for <b>${s.employeeName}</b> on <b>${s.date}</b>?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, Delete Log',
      cancelButtonText: 'Cancel',
    });
    if (result.isConfirmed && onDeleteSummary) {
      onDeleteSummary(s.id);
      showSuccessAlert('Record Deleted', `Daily attendance log for ${s.employeeName} on ${s.date} has been removed.`);
    }
  };

  const handleClearUploadedLogs = async () => {
    if (!summaries || summaries.length === 0) {
      showErrorAlert('No Uploaded Logs', 'There are no uploaded attendance logs in the database to clear.');
      return;
    }

    const isFiltered = filteredSummaries.length !== summaries.length && filteredSummaries.length > 0;

    const result = await yellowCabSwal.fire({
      title: 'CLEAR UPLOADED LOGS',
      html: `
        <div class="text-left space-y-3 text-xs text-zinc-800">
          <p class="font-bold text-rose-700">⚠️ WARNING: This action will delete uploaded biometric attendance logs from the system database.</p>
          <p>Please select what scope of logs you wish to clear:</p>
          <div class="space-y-2 bg-zinc-100 p-3 rounded-xl border border-zinc-300">
            ${
              isFiltered
                ? `
              <label class="flex items-center gap-2 cursor-pointer font-bold text-zinc-900">
                <input type="radio" name="clearScope" value="FILTERED" checked class="accent-amber-500" />
                <span>Clear Current Filtered Subset (${filteredSummaries.length} Records)</span>
              </label>
            `
                : ''
            }
            <label class="flex items-center gap-2 cursor-pointer font-bold text-rose-700">
              <input type="radio" name="clearScope" value="ALL" ${!isFiltered ? 'checked' : ''} class="accent-rose-600" />
              <span>Clear ALL Uploaded Attendance Logs (${summaries.length} Total Records)</span>
            </label>
          </div>
          <div class="bg-amber-50 border border-amber-200 p-2.5 rounded-lg text-[11px] text-amber-900 font-semibold">
            🛡️ <strong>Preserved Data:</strong> Employee profiles, work schedules, and approved disputes/CTO records will remain untouched.
          </div>
          <p class="font-bold text-zinc-900">Type <span class="text-rose-700 font-mono underline">CLEAR</span> below to confirm deletion:</p>
        </div>
      `,
      input: 'text',
      inputPlaceholder: 'Type CLEAR to confirm...',
      showCancelButton: true,
      confirmButtonText: '🗑️ YES, CLEAR LOGS',
      confirmButtonColor: '#dc2626',
      cancelButtonText: 'CANCEL',
      preConfirm: (inputValue) => {
        if (inputValue !== 'CLEAR') {
          Swal.showValidationMessage('Please type CLEAR exactly to confirm deletion.');
          return false;
        }
        const radio = document.querySelector('input[name="clearScope"]:checked') as HTMLInputElement;
        return radio ? radio.value : 'ALL';
      },
    });

    if (result.isConfirmed) {
      const scope = result.value;
      try {
        if (scope === 'FILTERED') {
          const idsToClear = filteredSummaries.map((s) => s.id);
          if (onClearSummaries) {
            await onClearSummaries(idsToClear);
          }
          showSuccessAlert('Filtered Logs Cleared', `Successfully cleared ${idsToClear.length} attendance log records.`);
        } else {
          if (onClearSummaries) {
            await onClearSummaries();
          }
          showSuccessAlert('All Logs Cleared', `Successfully cleared all ${summaries.length} uploaded attendance logs and biometric punch data.`);
        }
      } catch (err) {
        showErrorAlert('Error Clearing Logs', 'An unexpected error occurred while clearing logs.');
      }
    }
  };

  // Add/Edit User Modal State
  const [showUserModal, setShowUserModal] = useState(false);
  const [showQuickUserModal, setShowQuickUserModal] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('ALL');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isSavingUser, setIsSavingUser] = useState(false);
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

  const BRANCH_DEPARTMENT_OPTIONS = [
    'YC Main Office',
    'YC Ebloc',
    'YC Ramos',
    'YC Talisay',
    'YC SM Seaside',
    'YC Ayala',
    'YC Banilad',
    'Management',
  ];

  const normalizeUserRole = (rawRole?: string): User['role'] => {
    const cleaned = String(rawRole || 'STAFF').trim().toUpperCase().replace(/\s+/g, '_');
    const validRoles: User['role'][] = [
      'ADMIN',
      'STAFF',
      'PAYROLL',
      'SHIFT_MANAGER',
      'BRANCH_MANAGER',
    ];
    return validRoles.includes(cleaned as User['role']) ? (cleaned as User['role']) : 'STAFF';
  };

  const compressImageDataUrl = (dataUrl: string, maxDim = 256, quality = 0.82): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            if (width >= height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, width);
          canvas.height = Math.max(1, height);
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(dataUrl);
            return;
          }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = () => reject(new Error('Failed to load image for compression'));
      img.src = dataUrl;
    });
  };

  // Handle File Upload Event
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setUploadMessage(null);

    // SweetAlert loading modal
    showUploadProcessingAlert(file.name);

    const result = await parseAndCleanBiometricExcel(file, users);
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
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        (s.employeeName || '').toLowerCase().includes(q) ||
        (s.employeeId || '').toLowerCase().includes(q) ||
        (s.date || '').includes(searchTerm) ||
        formattedDate.includes(searchTerm);

      const matchesStatus =
        statusFilter === 'ALL' ||
        s.status === statusFilter ||
        (statusFilter === 'ANOMALY' && s.status !== 'COMPLETE') ||
        (statusFilter === 'LACKING' && (s.status === 'LACKING' || s.status === 'MISSING_IN' || s.status === 'MISSING_OUT'));

      const resolvedBranch = resolveSummaryBranch(s, users);
      const matchesDept =
        departmentFilter === 'ALL' ||
        resolvedBranch === departmentFilter ||
        s.department === departmentFilter;

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

      let fName = user.firstName?.trim() || '';
      let mName = user.middleName?.trim() || '';
      let lName = user.lastName?.trim() || '';

      if (!fName && !lName && user.name) {
        const parts = user.name.trim().split(/\s+/);
        if (parts.length === 1) {
          fName = parts[0];
        } else if (parts.length === 2) {
          fName = parts[0];
          lName = parts[1];
        } else if (parts.length > 2) {
          fName = parts[0];
          mName = parts.slice(1, -1).join(' ');
          lName = parts[parts.length - 1];
        }
      }

      const normalizedRole = normalizeUserRole(user.role);
      const isShiftBased = normalizedRole === 'STAFF' || normalizedRole === 'SHIFT_MANAGER';
      const rawDept = (user.department || user.branch || '').trim();
      const normalizedDept = isShiftBased
        ? 'No fixed branch (Assigned per shift)'
        : (rawDept &&
           rawDept !== 'No fixed branch (Assigned per shift)' &&
           rawDept !== 'Store Operations'
            ? rawDept
            : 'YC Ebloc');

      setUserFormData({
        ...user,
        role: normalizedRole,
        department: normalizedDept,
        branch: isShiftBased ? '' : normalizedDept,
        firstName: fName,
        middleName: mName,
        lastName: lName,
        email: user.email || '',
        pin: user.pin || '',
        position: user.position || 'Staff Member',
        hourlyRate: typeof user.hourlyRate === 'number' && Number.isFinite(user.hourlyRate) ? user.hourlyRate : 120,
        dateHired: user.dateHired || new Date().toISOString().split('T')[0],
        status: user.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
        avatarUrl: user.avatarUrl || '',
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
        department: 'No fixed branch (Assigned per shift)',
        branch: '',
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
        showErrorAlert('File Too Large', 'Image file size must be less than 5MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = async () => {
        if (typeof reader.result === 'string') {
          try {
            const compressed = await compressImageDataUrl(reader.result, 256, 0.82);
            setUserFormData((prev) => ({ ...prev, avatarUrl: compressed }));
          } catch {
            if (reader.result.length > 400_000) {
              showErrorAlert('Image Too Large', 'Could not compress image under Firestore size limits. Please choose a smaller image.');
              return;
            }
            setUserFormData((prev) => ({ ...prev, avatarUrl: reader.result as string }));
          }
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingUser) return;

    const fName = (userFormData.firstName || '').trim();
    const mName = (userFormData.middleName || '').trim();
    const lName = (userFormData.lastName || '').trim();
    const empId = (userFormData.employeeId || '').trim();
    const pinCode = (userFormData.pin || '').trim();
    const computedName = [fName, mName, lName].filter(Boolean).join(' ') || (userFormData.name || '').trim() || 'Staff Member';

    if (!empId || !pinCode || (!fName && !computedName)) {
      showErrorAlert(
        'Incomplete Form Details',
        'Please fill in First Name, Employee ID, and Auth PIN Code.'
      );
      return;
    }

    const hRate = Number(userFormData.hourlyRate);
    const safeHourlyRate = Number.isFinite(hRate) && hRate >= 0 ? hRate : 120;

    const resolvedRole = normalizeUserRole(userFormData.role);
    const isShiftBasedRole = resolvedRole === 'STAFF' || resolvedRole === 'SHIFT_MANAGER';
    const rawDept = (userFormData.department || '').trim();
    const resolvedDepartment = isShiftBasedRole
      ? 'No fixed branch (Assigned per shift)'
      : (rawDept &&
         rawDept !== 'No fixed branch (Assigned per shift)' &&
         rawDept !== 'Store Operations'
          ? rawDept
          : 'YC Ebloc');

    let safeAvatarUrl =
      (userFormData.avatarUrl || '').trim() ||
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80';

    if (safeAvatarUrl.startsWith('data:image/') && safeAvatarUrl.length > 350_000) {
      try {
        safeAvatarUrl = await compressImageDataUrl(safeAvatarUrl, 256, 0.8);
      } catch {
        showErrorAlert(
          'Profile Picture Too Large',
          'The selected profile image is too large to save to the database. Please remove or upload a smaller photo.'
        );
        return;
      }
    }

    const savedUser: User = {
      id: editingUser?.id || `usr-${Date.now()}`,
      employeeId: empId,
      name: computedName,
      firstName: fName || computedName,
      middleName: mName,
      lastName: lName,
      email: (userFormData.email || '').trim() || `${(fName || 'staff').toLowerCase().replace(/\s+/g, '')}@fbcrestaurants.com`,
      pin: pinCode,
      role: resolvedRole,
      department: resolvedDepartment,
      branch: isShiftBasedRole ? '' : resolvedDepartment,
      position: (userFormData.position || '').trim() || 'Staff Member',
      hourlyRate: safeHourlyRate,
      dateHired: (userFormData.dateHired || '').trim() || new Date().toISOString().split('T')[0],
      status: userFormData.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
      avatarUrl: safeAvatarUrl,
    };

    setIsSavingUser(true);
    try {
      if (editingUser) {
        const result = await onUpdateUser(savedUser);
        if (result === false) {
          showErrorAlert(
            'Unable to Apply Changes',
            `Could not save changes for ${computedName} (${savedUser.employeeId}) to the cloud database. Please check your connection or image size and try again.`
          );
          return;
        }
        showSuccessAlert(
          'Account Updated!',
          `Employee profile for ${computedName} (${savedUser.employeeId}) has been saved successfully.`
        );
      } else {
        const result = await onAddUser(savedUser);
        if (result === false) {
          showErrorAlert(
            'Unable to Create Account',
            `Could not save new account for ${computedName} (${savedUser.employeeId}) to the cloud database. Please try again.`
          );
          return;
        }
        showSuccessAlert(
          'Account Created!',
          `New employee account for ${computedName} (${savedUser.employeeId}) has been registered.`
        );
      }
      setShowUserModal(false);
    } finally {
      setIsSavingUser(false);
    }
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

      {/* ADMIN ACTION ALERTS CENTER - Overview Tab */}
      {(activeTab === 'overview' || activeTab === 'dashboard' || activeTab === 'all') && (() => {
        const unreadAlertsCount = adminAlerts.filter((a) => !readAlertIds.has(a.id)).length;
        const criticalAlertsCount = adminAlerts.filter((a) => a.severity === 'critical').length;
        const filteredOverviewAlerts = adminAlerts.filter((a) => {
          if (alertFilter === 'WAREHOUSE') {
            return a.category === 'STR' || a.category === 'LOW_STOCK' || a.category === 'NEAR_EXPIRY';
          }
          if (alertFilter === 'DISPUTE') return a.category === 'DISPUTE';
          if (alertFilter === 'ATTENDANCE') return a.category === 'ATTENDANCE' || a.category === 'CTO';
          if (alertFilter === 'TICKET') return a.category === 'TICKET';
          return true;
        });
        const visibleAlerts = showAllAlerts
          ? filteredOverviewAlerts
          : filteredOverviewAlerts.slice(0, 6);

        return (
          <section
            aria-label="Admin Alert Notifications"
            className="bg-white rounded-2xl border border-[#D3D8C8] p-5 shadow-xs space-y-4"
          >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-zinc-100">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-zinc-950 text-amber-400 flex items-center justify-center shrink-0">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base font-extrabold text-[#2C3524]">
                      Admin Alert Notifications
                    </h2>
                    <span className="text-xs font-bold text-zinc-500 tabular-nums">
                      · {unreadAlertsCount} unread · {criticalAlertsCount} critical
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Live queue for pending STR reviews, monitored branch low stock &amp; near-expiry items, store concern tickets, disputes, and missing punches.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex flex-wrap items-center gap-1 bg-zinc-100 p-1 rounded-xl border border-zinc-200">
                  {(
                    [
                      { id: 'ALL', label: `All (${adminAlerts.length})` },
                      {
                        id: 'WAREHOUSE',
                        label: `STR & Stock (${
                          adminAlerts.filter(
                            (a) =>
                              a.category === 'STR' ||
                              a.category === 'LOW_STOCK' ||
                              a.category === 'NEAR_EXPIRY'
                          ).length
                        })`,
                      },
                      {
                        id: 'TICKET',
                        label: `Tickets (${adminAlerts.filter((a) => a.category === 'TICKET').length})`,
                      },
                      {
                        id: 'DISPUTE',
                        label: `Disputes (${adminAlerts.filter((a) => a.category === 'DISPUTE').length})`,
                      },
                      {
                        id: 'ATTENDANCE',
                        label: `Attendance (${
                          adminAlerts.filter((a) => a.category === 'ATTENDANCE' || a.category === 'CTO').length
                        })`,
                      },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setAlertFilter(tab.id)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap shrink-0 cursor-pointer transition-colors tabular-nums ${
                        alertFilter === tab.id
                          ? 'bg-zinc-900 text-amber-400'
                          : 'text-zinc-600 hover:text-zinc-900'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <button
                  id="btn-admin-email-alert-settings"
                  type="button"
                  onClick={handleOpenEmailSettingsModal}
                  title={`Super Admin Alert Email: ${adminEmailConfig.recipientEmail || DEFAULT_ADMIN_ALERT_EMAIL}`}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                    adminEmailConfig.enabled
                      ? emailDeliveryStatus?.configured
                        ? 'border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-900'
                        : 'border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900'
                      : 'border-zinc-300 bg-zinc-50 hover:bg-zinc-100 text-zinc-700'
                  }`}
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>
                    {adminEmailConfig.enabled ? 'Auto-Email: ON' : 'Auto-Email: OFF'}
                  </span>
                </button>

                {unreadAlertsCount > 0 && onMarkAllAlertsRead && (
                  <button
                    type="button"
                    onClick={onMarkAllAlertsRead}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-800 text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                  >
                    <CheckCheck className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Mark all read</span>
                  </button>
                )}

                {dismissedAlertCount > 0 && onRestoreDismissedAlerts && (
                  <button
                    type="button"
                    onClick={onRestoreDismissedAlerts}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restore ({dismissedAlertCount})</span>
                  </button>
                )}

                {onExportSystemBackup && (
                  <button
                    id="btn-export-system-backup"
                    type="button"
                    onClick={onExportSystemBackup}
                    title="Download a full JSON backup of all users, attendance logs, warehouse stock, STRs, and store tickets"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-800 text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                  >
                    <Download className="w-3.5 h-3.5 text-[#656D4A]" />
                    <span>Backup Data</span>
                  </button>
                )}

                {onRestoreSystemBackup && (
                  <>
                    <input
                      ref={backupFileInputRef}
                      type="file"
                      accept=".json,application/json"
                      onChange={handleBackupFileSelected}
                      className="hidden"
                    />
                    <button
                      id="btn-restore-system-backup"
                      type="button"
                      disabled={isRestoringBackup}
                      onClick={() => backupFileInputRef.current?.click()}
                      title="Restore system data from a previously exported FBC backup .json file"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-800 text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5 text-[#656D4A]" />
                      <span>{isRestoringBackup ? 'Restoring...' : 'Restore Backup'}</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {filteredOverviewAlerts.length === 0 ? (
              <div className="py-8 px-4 rounded-xl border border-dashed border-zinc-200 bg-zinc-50/70 text-center space-y-1.5">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto" />
                <p className="text-xs font-bold text-zinc-800">
                  No active alerts in this view
                </p>
                <p className="text-[11px] text-zinc-500">
                  Pending STR requisitions, low stock &amp; near-expiry thresholds, store concern tickets, and employee disputes will surface here automatically.
                </p>
              </div>
            ) : (
              <div className="border border-zinc-200 rounded-xl divide-y divide-zinc-100 overflow-hidden">
                {visibleAlerts.map((alert) => {
                  const isRead = readAlertIds.has(alert.id);
                  const sevText =
                    alert.severity === 'critical'
                      ? 'text-rose-700'
                      : alert.severity === 'warning'
                      ? 'text-amber-800'
                      : 'text-sky-700';
                  const iconBox =
                    alert.severity === 'critical'
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : alert.severity === 'warning'
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : 'bg-sky-50 text-sky-700 border-sky-200';

                  const IconComponent =
                    alert.category === 'STR' || alert.category === 'LOW_STOCK'
                      ? Package
                      : alert.category === 'TICKET'
                      ? Ticket
                      : alert.category === 'DISPUTE'
                      ? Clock
                      : alert.category === 'CTO' || alert.category === 'NEAR_EXPIRY'
                      ? CalendarClock
                      : AlertTriangle;

                  return (
                    <div
                      key={alert.id}
                      className={`px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                        isRead ? 'bg-white opacity-75' : 'bg-amber-50/35 hover:bg-amber-50/60'
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 ${iconBox}`}>
                          <IconComponent className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[10px] font-black uppercase tracking-wider ${sevText}`}>
                              {alert.severity === 'critical'
                                ? 'Critical'
                                : alert.severity === 'warning'
                                ? 'Action Needed'
                                : 'Notice'}{' '}
                              · {alert.category.replace('_', ' ')}
                            </span>
                            <span className="text-[10px] font-mono text-zinc-500 tabular-nums">
                              {formatAlertTimestamp(alert.timestamp)}
                            </span>
                            {!isRead && (
                              <span className="text-[10px] font-extrabold text-rose-700 uppercase tracking-wider">
                                · Unread
                              </span>
                            )}
                          </div>
                          <div className="text-xs font-extrabold text-zinc-900 mt-0.5">
                            {alert.title}
                          </div>
                          <p className="text-[11px] text-zinc-600 mt-0.5">
                            {alert.description}
                          </p>
                          <div className="text-[10px] text-zinc-500 font-medium mt-0.5">
                            {alert.meta}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            if (onMarkAlertRead) onMarkAlertRead(alert.id);
                            if (onNavigateTab) onNavigateTab(alert.targetTab);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 border border-zinc-950 text-xs font-black whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                        >
                          <span>{alert.actionLabel}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                        {onDismissAlert && (
                          <button
                            type="button"
                            onClick={() => onDismissAlert(alert.id)}
                            title="Dismiss alert"
                            aria-label={`Dismiss ${alert.title}`}
                            className="p-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-100 text-zinc-500 hover:text-zinc-800 cursor-pointer transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {filteredOverviewAlerts.length > 6 && (
              <div className="flex justify-center pt-1">
                <button
                  type="button"
                  onClick={() => setShowAllAlerts((prev) => !prev)}
                  className="text-xs font-bold text-amber-800 hover:text-zinc-950 cursor-pointer tabular-nums"
                >
                  {showAllAlerts
                    ? 'Show fewer alerts'
                    : `Show all ${filteredOverviewAlerts.length} alerts`}
                </button>
              </div>
            )}
          </section>
        );
      })()}

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

            <div className="flex items-center gap-2 shrink-0">
              <button
                id="btn-admin-clear-uploaded-logs-uploader"
                onClick={handleClearUploadedLogs}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-extrabold text-xs uppercase tracking-wider border border-rose-300 shadow-2xs cursor-pointer transition-colors"
                title="Clear uploaded biometric logs from system memory"
              >
                <Trash2 className="w-4 h-4 text-rose-600" />
                Clear Uploaded Logs ({summaries.length})
              </button>
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
        <div className={`bg-white rounded-2xl border border-[#D3D8C8] p-6 shadow-xs space-y-4 ${activeTab === 'dtr-logs' ? 'print:hidden no-print' : ''}`}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-[#2C3524]">
                Biometric Daily Attendance Logs
              </h2>
              <p className="text-xs text-gray-500">
                Flexitime 8-Hour schedule tracking and anomaly detection logs ({filteredSummaries.length} Records)
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                id="btn-admin-clear-uploaded-logs-table"
                onClick={handleClearUploadedLogs}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-extrabold text-xs uppercase tracking-wider border border-rose-300 shadow-2xs cursor-pointer transition-colors whitespace-nowrap"
              >
                <Trash2 className="w-4 h-4 text-rose-600" /> Clear Uploaded Logs
              </button>
              <button
                id="btn-admin-request-time-adjustment"
                onClick={() => setShowAdjustmentModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-black text-xs uppercase tracking-wider border border-zinc-950 shadow-xs cursor-pointer shrink-0 whitespace-nowrap"
              >
                <PlusCircle className="w-4 h-4" /> Request Time Adjustment
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

          {/* Mobile Attendance Log Cards */}
          <div className="md:hidden space-y-2.5">
            {filteredSummaries.length === 0 ? (
              <div className="p-6 text-center text-xs text-gray-400 border border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                No matching attendance records found.
              </div>
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
                const clockInVal = getAdjustedDisplayTime(s, 'firstIn', disputes) || s.firstIn;
                const breakOutVal = getAdjustedDisplayTime(s, 'breakOut', disputes) || s.breakOut;
                const breakInVal = getAdjustedDisplayTime(s, 'breakIn', disputes) || s.breakIn;
                const clockOutVal = getAdjustedDisplayTime(s, 'lastOut', disputes) || s.lastOut;

                return (
                  <div key={`mob-log-${s.id}`} className="rounded-xl border border-gray-200 bg-white p-3.5 space-y-2.5 shadow-2xs">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-extrabold text-sm text-[#2C3524] truncate">{s.employeeName}</div>
                        <div className="text-[11px] font-mono text-gray-500">
                          {s.employeeId} · {resolveSummaryBranch(s, users)}
                        </div>
                        <div className="text-[11px] font-mono font-bold text-[#2C3524] mt-0.5">
                          {formatDateMDYYYY(s.date)} · {s.weekday}
                        </div>
                      </div>
                      <div className="shrink-0">
                        {isAbsent ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-950 border border-rose-300 whitespace-nowrap">
                            ✕ Absent
                          </span>
                        ) : missingPunches.length > 0 ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-950 border border-amber-400">
                            ⚡ Missing {missingPunches.length}
                          </span>
                        ) : s.status === 'COMPLETE' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300 whitespace-nowrap">
                            ✓ Complete
                          </span>
                        ) : s.status === 'UNDERTIME' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300 whitespace-nowrap">
                            ⚠ Undertime
                          </span>
                        ) : s.status === 'OVERTIME' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-sky-100 text-sky-900 border border-sky-300 whitespace-nowrap">
                            ★ Overtime
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-gray-100 text-gray-800 border border-gray-300 whitespace-nowrap">
                            {s.status}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 text-[11px] font-mono bg-[#F7F8F5] p-2 rounded-lg border border-[#D3D8C8]/70">
                      <div>
                        <span className="text-[9.5px] font-sans font-bold uppercase text-gray-500 block">Clock In</span>
                        {isFieldAdjusted(s, 'firstIn', disputes) ? (
                          <span className="adjusted-time-blinking">{clockInVal ? formatTime12Hr(clockInVal) : '08:00 AM'} Adj</span>
                        ) : clockInVal ? formatTime12Hr(clockInVal) : <span className="text-rose-500 font-bold">No Data</span>}
                      </div>
                      <div>
                        <span className="text-[9.5px] font-sans font-bold uppercase text-gray-500 block">Clock Out</span>
                        {isFieldAdjusted(s, 'lastOut', disputes) ? (
                          <span className="adjusted-time-blinking">{clockOutVal ? formatTime12Hr(clockOutVal) : '05:00 PM'} Adj</span>
                        ) : clockOutVal ? formatTime12Hr(clockOutVal) : <span className="text-rose-500 font-bold">No Data</span>}
                      </div>
                      <div>
                        <span className="text-[9.5px] font-sans font-bold uppercase text-gray-500 block">Break Out</span>
                        {isFieldAdjusted(s, 'breakOut', disputes) ? (
                          <span className="adjusted-time-blinking">{breakOutVal ? formatTime12Hr(breakOutVal) : '12:00 PM'} Adj</span>
                        ) : breakOutVal ? formatTime12Hr(breakOutVal) : breakTimes.breakOut && breakTimes.breakOut !== '--' && breakTimes.breakOut !== 'No Data' ? breakTimes.breakOut : 'No Data'}
                      </div>
                      <div>
                        <span className="text-[9.5px] font-sans font-bold uppercase text-gray-500 block">Break In</span>
                        {isFieldAdjusted(s, 'breakIn', disputes) ? (
                          <span className="adjusted-time-blinking">{breakInVal ? formatTime12Hr(breakInVal) : '01:00 PM'} Adj</span>
                        ) : breakInVal ? formatTime12Hr(breakInVal) : breakTimes.breakIn && breakTimes.breakIn !== '--' && breakTimes.breakIn !== 'No Data' ? breakTimes.breakIn : 'No Data'}
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-1 text-center text-[11px] font-mono bg-gray-50 rounded-lg p-1.5 border border-gray-200">
                      <div>
                        <span className="block text-[9px] font-sans text-gray-500 uppercase">Break</span>
                        <span className="font-bold text-gray-700">{s.totalBreakMinutes || 0}m</span>
                      </div>
                      <div>
                        <span className="block text-[9px] font-sans text-gray-500 uppercase">Gross</span>
                        <span className="font-bold text-gray-700">{(Number(grossHours) || 0).toFixed(1)}h</span>
                      </div>
                      <div>
                        <span className="block text-[9px] font-sans text-gray-500 uppercase">Worked</span>
                        <span className="font-extrabold text-[#2C3524]">{(Number(s.netHoursWorked) || 0).toFixed(1)}h</span>
                      </div>
                      <div>
                        <span className="block text-[9px] font-sans text-gray-500 uppercase">OT</span>
                        <span className="font-bold text-sky-700">{(Number(s.overtimeHours) || 0) > 0 ? `+${(Number(s.overtimeHours) || 0).toFixed(1)}h` : '0.0h'}</span>
                      </div>
                    </div>

                    <div className="text-[11px]">
                      {existingDispute ? (
                        <div className={`px-2 py-1 rounded-md font-bold text-[10px] ${existingDispute.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' : existingDispute.status === 'REJECTED' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-900 border border-amber-300'}`}>
                          📌 {existingDispute.status}: {existingDispute.reason}
                        </div>
                      ) : (s.anomalies || []).length > 0 ? (
                        <div className="text-gray-600 text-[10px]">{(s.anomalies || []).join('; ')}</div>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-gray-100">
                      <button
                        type="button"
                        onClick={() => handleOpenRemarkPrompt(s)}
                        className="text-[11px] font-extrabold text-amber-800 hover:text-zinc-950 bg-amber-100 hover:bg-amber-200 px-2.5 py-1 rounded-md border border-amber-400 inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                      >
                        💬 Concern / Remark
                      </button>
                      {onDeleteSummary && (
                        <button
                          type="button"
                          onClick={() => handleDeleteSummaryClick(s)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-bold cursor-pointer whitespace-nowrap"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Logs Table (Desktop) */}
          <div className="hidden md:block overflow-x-auto border border-gray-200 rounded-xl">
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
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {filteredSummaries.length === 0 ? (
                  <tr>
                    <td colSpan={15} className="p-8 text-center text-gray-400">
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

                    const clockInVal = getAdjustedDisplayTime(s, 'firstIn', disputes) || s.firstIn;
                    const breakOutVal = getAdjustedDisplayTime(s, 'breakOut', disputes) || s.breakOut;
                    const breakInVal = getAdjustedDisplayTime(s, 'breakIn', disputes) || s.breakIn;
                    const clockOutVal = getAdjustedDisplayTime(s, 'lastOut', disputes) || s.lastOut;

                    return (
                      <tr key={s.id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="p-3 font-mono text-[11px] font-bold text-gray-600">
                          {s.employeeId}
                        </td>
                        <td className="p-3">
                          <div className="font-bold text-[#2C3524]">{s.employeeName}</div>
                          <div className="text-[10px] text-gray-400 font-medium">{resolveSummaryBranch(s, users)}</div>
                        </td>
                        <td className="p-3 font-mono font-bold text-[#2C3524] whitespace-nowrap">
                          {formatDateMDYYYY(s.date)}
                        </td>
                        <td className="p-3 text-gray-600 whitespace-nowrap">
                          {s.weekday}
                        </td>
                        <td className="p-3 font-mono text-xs whitespace-nowrap">
                          {isFieldAdjusted(s, 'firstIn', disputes) ? (
                            <span className="adjusted-time-blinking" title="Clock In Adjusted via Approved Request">
                              {clockInVal ? formatTime12Hr(clockInVal) : '08:00 AM'}
                              <span className="text-[8px] bg-emerald-700 text-white px-1 rounded font-black tracking-tight uppercase">Adj</span>
                            </span>
                          ) : clockInVal ? (
                            formatTime12Hr(clockInVal)
                          ) : (
                            <span className="text-rose-500 font-bold">No Data</span>
                          )}
                        </td>
                        <td className="p-3 font-mono text-xs whitespace-nowrap">
                          {isFieldAdjusted(s, 'breakOut', disputes) ? (
                            <span className="adjusted-time-blinking" title="Break Out Adjusted via Approved Request">
                              {breakOutVal ? formatTime12Hr(breakOutVal) : (breakTimes.breakOut && breakTimes.breakOut !== 'No Data' && breakTimes.breakOut !== '--' ? breakTimes.breakOut : '12:00 PM')}
                              <span className="text-[8px] bg-emerald-700 text-white px-1 rounded font-black tracking-tight uppercase">Adj</span>
                            </span>
                          ) : breakOutVal ? (
                            formatTime12Hr(breakOutVal)
                          ) : breakTimes.breakOut === '--' || !breakTimes.breakOut || breakTimes.breakOut === 'No Data' ? (
                            'No Data'
                          ) : (
                            breakTimes.breakOut
                          )}
                        </td>
                        <td className="p-3 font-mono text-xs whitespace-nowrap">
                          {isFieldAdjusted(s, 'breakIn', disputes) ? (
                            <span className="adjusted-time-blinking" title="Break In Adjusted via Approved Request">
                              {breakInVal ? formatTime12Hr(breakInVal) : (breakTimes.breakIn && breakTimes.breakIn !== 'No Data' && breakTimes.breakIn !== '--' ? breakTimes.breakIn : '01:00 PM')}
                              <span className="text-[8px] bg-emerald-700 text-white px-1 rounded font-black tracking-tight uppercase">Adj</span>
                            </span>
                          ) : breakInVal ? (
                            formatTime12Hr(breakInVal)
                          ) : breakTimes.breakIn === '--' || !breakTimes.breakIn || breakTimes.breakIn === 'No Data' ? (
                            'No Data'
                          ) : (
                            breakTimes.breakIn
                          )}
                        </td>
                        <td className="p-3 font-mono text-xs whitespace-nowrap">
                          {isFieldAdjusted(s, 'lastOut', disputes) ? (
                            <span className="adjusted-time-blinking" title="Clock Out Adjusted via Approved Request">
                              {clockOutVal ? formatTime12Hr(clockOutVal) : '05:00 PM'}
                              <span className="text-[8px] bg-emerald-700 text-white px-1 rounded font-black tracking-tight uppercase">Adj</span>
                            </span>
                          ) : clockOutVal ? (
                            formatTime12Hr(clockOutVal)
                          ) : (
                            <span className="text-rose-500 font-bold">No Data</span>
                          )}
                        </td>
                        <td className="p-3 text-center font-mono text-gray-600">
                          {((Number(s.totalBreakMinutes) || 0) / 60).toFixed(1)}h ({s.totalBreakMinutes || 0}m)
                        </td>
                        <td className="p-3 text-center font-mono font-bold text-gray-700">
                          {(Number(grossHours) || 0).toFixed(1)} hrs
                        </td>
                        <td className="p-3 text-center font-mono font-bold text-[#2C3524]">
                          {(Number(s.netHoursWorked) || 0).toFixed(1)} hrs
                        </td>
                        <td className="p-3 text-center font-mono font-bold text-sky-700">
                          {(Number(s.overtimeHours) || 0) > 0 ? `+${(Number(s.overtimeHours) || 0).toFixed(1)}h` : '0.0h'}
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
                            ) : (s.anomalies || []).length > 0 ? (
                              <span className="text-gray-600 text-[10px]">{(s.anomalies || []).join('; ')}</span>
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
                        <td className="p-3 text-center whitespace-nowrap">
                          {onDeleteSummary && (
                            <button
                              id={`btn-delete-summary-${s.id}`}
                              onClick={() => handleDeleteSummaryClick(s)}
                              title="Delete record manually"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-bold transition-all cursor-pointer shadow-2xs"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Delete
                            </button>
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
          const q = adminDisputeSearch.toLowerCase();
          const matchSearch =
            !adminDisputeSearch ||
            (d.employeeName || '').toLowerCase().includes(q) ||
            (d.employeeId || '').toLowerCase().includes(q) ||
            (d.reason || '').toLowerCase().includes(q);

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
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-zinc-200">
              <div>
                <h2 className="text-base font-bold text-[#2C3524] flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-600" />
                  Branch Time Adjustments & Disputes Audit
                </h2>
                <p className="text-xs text-gray-500">
                  Review staff requests, attached proof files, request history, and exact manager approval timestamps.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  id="btn-export-pdf-disputes-admin"
                  onClick={() => exportDisputesToPdf(filteredAdminDisputes, adminDisputeBranchFilter)}
                  className="px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-amber-400 font-black text-xs uppercase tracking-wider rounded-xl border border-zinc-950 shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
                >
                  <FileText className="w-4 h-4 text-amber-400" />
                  Export PDF (4/Page)
                </button>
                {pendingCount > 0 && (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 whitespace-nowrap">
                    {pendingCount} Pending Approval
                  </span>
                )}
              </div>
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
                    {st === 'APPROVED' && `History / Approved (${approvedCount})`}
                    {st === 'REJECTED' && `History / Rejected (${rejectedCount})`}
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
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            d.status === 'PENDING'
                              ? 'bg-amber-200 text-amber-800'
                              : d.status === 'APPROVED'
                              ? 'bg-emerald-200 text-emerald-800'
                              : 'bg-rose-200 text-rose-800'
                          }`}
                        >
                          {d.status === 'APPROVED' ? 'APPROVED (HISTORY)' : d.status === 'REJECTED' ? 'REJECTED (HISTORY)' : d.status}
                        </span>
                        {onDeleteDispute && (
                          <button
                            id={`btn-delete-dispute-${d.id}`}
                            onClick={() => handleDeleteDisputeClick(d)}
                            title="Remove dispute record permanently"
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-300 text-[10px] font-extrabold transition-all cursor-pointer shadow-2xs"
                          >
                            <Trash2 className="w-3 h-3" /> Remove
                          </button>
                        )}
                      </div>
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
                              onApproveDispute(d.id, result.value || 'Approved by Owner/Admin', 'ADMIN');
                              showSuccessAlert(
                                'Dispute Approved!',
                                `Attendance dispute for ${d.employeeName} on ${d.date} was approved and timecard recalculated.`
                              );
                            }
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-[#656D4A] hover:bg-[#4A543E] text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" /> Approve Adjustment (Admin)
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

      {/* SECTION 3B: CTO LEAVE & CREDIT REQUESTS MANAGEMENT (SUPER ADMIN) */}
      {(activeTab === 'cto-management' || activeTab === 'all') && (() => {
        const ctoPendingCount = ctoRequests.filter((r) => r.status === 'PENDING').length;
        const ctoApprovedCount = ctoRequests.filter((r) => r.status === 'APPROVED').length;
        const ctoRejectedCount = ctoRequests.filter((r) => r.status === 'REJECTED').length;

        const filteredCtoRequests = ctoRequests.filter((r) => {
          const q = adminCtoSearch.trim().toLowerCase();
          const matchesSearch =
            !q ||
            (r.employeeName || '').toLowerCase().includes(q) ||
            (r.employeeId || '').toLowerCase().includes(q) ||
            (r.department || '').toLowerCase().includes(q) ||
            (r.branch || '').toLowerCase().includes(q) ||
            (r.reason || '').toLowerCase().includes(q) ||
            (r.date || '').includes(q);

          const matchesStatus =
            adminCtoStatusFilter === 'ALL' || r.status === adminCtoStatusFilter;

          const reqType: CtoRequestType = r.requestType === 'CREDIT' ? 'CREDIT' : 'LEAVE';
          const matchesType =
            adminCtoTypeFilter === 'ALL' || reqType === adminCtoTypeFilter;

          return matchesSearch && matchesStatus && matchesType;
        });

        return (
          <div id="admin-cto-management-section" className="space-y-6">
            <div className="bg-white rounded-2xl border border-[#D3D8C8] p-6 shadow-xs space-y-4">
              {/* Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-zinc-200">
                <div>
                  <h2 className="text-base font-bold text-[#2C3524] flex items-center gap-2">
                    <Award className="w-5 h-5 text-amber-600" />
                    CTO Leave &amp; Credit Requests Management
                  </h2>
                  <p className="text-xs text-gray-500">
                    Super Admin governance: review, approve, reject, edit, or delete employee CTO leave and credit requests.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {ctoPendingCount > 0 && (
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 whitespace-nowrap">
                      {ctoPendingCount} Pending Review
                    </span>
                  )}
                  {onSubmitCtoRequest && (
                    <button
                      id="btn-admin-new-cto"
                      type="button"
                      onClick={handleOpenCtoCreateModal}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#656D4A] hover:bg-[#4A543E] text-white text-xs font-bold shadow-xs transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <PlusCircle className="w-4 h-4" />
                      File CTO Request
                    </button>
                  )}
                </div>
              </div>

              {/* KPI Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl border border-[#D3D8C8] bg-[#F7F8F5]">
                  <span className="text-[10px] font-black uppercase text-gray-500 tracking-wider block">Total Requests</span>
                  <div className="text-xl font-black text-[#2C3524] font-mono mt-0.5">{ctoRequests.length}</div>
                </div>
                <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50">
                  <span className="text-[10px] font-black uppercase text-amber-800 tracking-wider block">Pending</span>
                  <div className="text-xl font-black text-amber-900 font-mono mt-0.5">{ctoPendingCount}</div>
                </div>
                <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50">
                  <span className="text-[10px] font-black uppercase text-emerald-800 tracking-wider block">Approved</span>
                  <div className="text-xl font-black text-emerald-900 font-mono mt-0.5">{ctoApprovedCount}</div>
                </div>
                <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50">
                  <span className="text-[10px] font-black uppercase text-rose-800 tracking-wider block">Rejected</span>
                  <div className="text-xl font-black text-rose-900 font-mono mt-0.5">{ctoRejectedCount}</div>
                </div>
              </div>

              {/* Search & Filter Bar */}
              <div className="space-y-3 bg-zinc-50 p-3.5 rounded-xl border border-zinc-200">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="input-search-cto-admin"
                      type="text"
                      value={adminCtoSearch}
                      onChange={(e) => setAdminCtoSearch(e.target.value)}
                      placeholder="Search by employee name, ID, branch, date, or reason..."
                      className="w-full pl-9 pr-8 py-2 bg-white border border-zinc-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#656D4A] focus:outline-none"
                    />
                    {adminCtoSearch && (
                      <button
                        type="button"
                        onClick={() => setAdminCtoSearch('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 text-xs font-bold cursor-pointer"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Filter className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                    <select
                      value={adminCtoTypeFilter}
                      onChange={(e) => setAdminCtoTypeFilter(e.target.value as 'ALL' | CtoRequestType)}
                      className="bg-white border border-zinc-300 text-zinc-900 text-xs rounded-xl p-2 font-bold focus:ring-2 focus:ring-[#656D4A] focus:outline-none cursor-pointer"
                    >
                      <option value="ALL">All Request Types</option>
                      <option value="LEAVE">CTO Leave (-)</option>
                      <option value="CREDIT">CTO Credit (+)</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 pt-2 border-t border-zinc-200/60 overflow-x-auto">
                  <span className="text-[11px] font-bold text-zinc-500 mr-1 uppercase">Filter Status:</span>
                  {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setAdminCtoStatusFilter(st)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                        adminCtoStatusFilter === st
                          ? 'bg-[#2C3524] text-white shadow-2xs'
                          : 'bg-zinc-200/70 hover:bg-zinc-200 text-zinc-700'
                      }`}
                    >
                      {st === 'ALL' && `All (${ctoRequests.length})`}
                      {st === 'PENDING' && `Pending (${ctoPendingCount})`}
                      {st === 'APPROVED' && `Approved (${ctoApprovedCount})`}
                      {st === 'REJECTED' && `Rejected (${ctoRejectedCount})`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mobile CTO Cards */}
              <div className="md:hidden space-y-3">
                {filteredCtoRequests.length === 0 ? (
                  <div className="p-8 text-center bg-zinc-50 rounded-xl border border-dashed border-zinc-300 text-xs text-zinc-500 font-bold">
                    No CTO leave or credit requests match the selected filters.
                  </div>
                ) : (
                  filteredCtoRequests.map((req) => {
                    const isCredit = req.requestType === 'CREDIT';
                    return (
                      <div
                        key={`mob-cto-req-${req.id}`}
                        className={`p-3.5 rounded-xl border space-y-2.5 ${
                          req.status === 'PENDING'
                            ? 'border-amber-300 bg-amber-50/40'
                            : req.status === 'APPROVED'
                            ? 'border-emerald-200 bg-emerald-50/30'
                            : 'border-rose-200 bg-rose-50/30'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-bold text-sm text-[#2C3524] truncate">{req.employeeName}</div>
                            <div className="text-[11px] font-mono text-gray-500">
                              {req.employeeId} · {req.branch || req.department}
                            </div>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase shrink-0 ${
                              req.status === 'PENDING'
                                ? 'bg-amber-200 text-amber-900'
                                : req.status === 'APPROVED'
                                ? 'bg-emerald-200 text-emerald-900'
                                : 'bg-rose-200 text-rose-900'
                            }`}
                          >
                            {req.status}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 text-xs">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                              isCredit
                                ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                : 'bg-amber-100 text-amber-900 border border-amber-300'
                            }`}
                          >
                            {isCredit ? '+ CTO Credit' : '- CTO Leave'}
                          </span>
                          <span className="font-mono font-bold text-[#2C3524]">{req.date}</span>
                          <span className="font-mono font-black bg-white px-2 py-0.5 rounded border border-zinc-200">
                            {(Number(req.hoursRequested) || 0).toFixed(1)}h
                          </span>
                        </div>

                        <p className="text-xs text-zinc-700 bg-white p-2 rounded-lg border border-zinc-200">
                          {req.reason}
                        </p>

                        {req.reviewNotes && (
                          <div className="text-[11px] text-zinc-600 italic">
                            Note: {req.reviewNotes}
                          </div>
                        )}

                        <div className="flex flex-wrap items-center justify-end gap-1.5 pt-2 border-t border-zinc-200/70">
                          {req.status === 'PENDING' && onApproveCtoRequest && (
                            <button
                              type="button"
                              onClick={async () => {
                                const result = await showConfirmCtoActionAlert('APPROVE', req.employeeName, req.hoursRequested, req.date);
                                if (result.isConfirmed) {
                                  onApproveCtoRequest(req.id, result.value || 'Approved by Super Admin', 'ADMIN');
                                  showSuccessAlert(
                                    `CTO ${isCredit ? 'Credit' : 'Leave'} Approved`,
                                    `Approved ${req.hoursRequested}h CTO ${isCredit ? 'credit' : 'leave'} for ${req.employeeName} on ${req.date}.`
                                  );
                                }
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#656D4A] hover:bg-[#4A543E] text-white text-xs font-bold cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" /> Approve
                            </button>
                          )}
                          {req.status === 'PENDING' && onRejectCtoRequest && (
                            <button
                              type="button"
                              onClick={async () => {
                                const result = await showConfirmCtoActionAlert('REJECT', req.employeeName, req.hoursRequested, req.date);
                                if (result.isConfirmed) {
                                  onRejectCtoRequest(req.id, result.value || 'Declined by Super Admin');
                                  showSuccessAlert('CTO Request Rejected', `Declined CTO request for ${req.employeeName}.`);
                                }
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-rose-300 bg-white hover:bg-rose-50 text-rose-700 text-xs font-bold cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" /> Reject
                            </button>
                          )}
                          {onUpdateCtoRequest && (
                            <button
                              type="button"
                              onClick={() => handleOpenCtoEditModal(req)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-700 text-xs font-bold cursor-pointer"
                            >
                              <Edit className="w-3.5 h-3.5" /> Edit
                            </button>
                          )}
                          {onDeleteCtoRequest && (
                            <button
                              type="button"
                              onClick={() => handleDeleteCtoClick(req)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Delete
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto border border-gray-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F7F8F5] text-[#4A543E] font-bold uppercase tracking-wider border-b border-gray-200">
                    <tr>
                      <th className="p-3">Employee</th>
                      <th className="p-3">Type</th>
                      <th className="p-3">Target Date</th>
                      <th className="p-3 text-center">Hours</th>
                      <th className="p-3">Reason / Notes</th>
                      <th className="p-3">Status &amp; Approval</th>
                      <th className="p-3 text-right">Admin Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium">
                    {filteredCtoRequests.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-gray-500 font-bold bg-white">
                          No CTO leave or credit requests match the selected filters.
                        </td>
                      </tr>
                    ) : (
                      filteredCtoRequests.map((req) => {
                        const isCredit = req.requestType === 'CREDIT';
                        return (
                          <tr key={req.id} className="hover:bg-gray-50/80">
                            <td className="p-3">
                              <div className="font-bold text-[#2C3524]">{req.employeeName}</div>
                              <div className="text-[10px] text-gray-500 font-mono">
                                {req.employeeId} · {req.branch || req.department}
                              </div>
                            </td>
                            <td className="p-3">
                              {isCredit ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300 whitespace-nowrap">
                                  + CTO Credit
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300 whitespace-nowrap">
                                  - CTO Leave
                                </span>
                              )}
                            </td>
                            <td className="p-3 font-mono font-bold text-[#2C3524] whitespace-nowrap">
                              {req.date}
                            </td>
                            <td className="p-3 text-center font-mono font-black text-zinc-900">
                              {(Number(req.hoursRequested) || 0).toFixed(1)}h
                            </td>
                            <td className="p-3 max-w-[240px]">
                              <div className="text-zinc-800 truncate" title={req.reason}>
                                {req.reason}
                              </div>
                              {req.reviewNotes && (
                                <div className="text-[10px] text-zinc-500 italic truncate" title={req.reviewNotes}>
                                  Note: {req.reviewNotes}
                                </div>
                              )}
                            </td>
                            <td className="p-3">
                              <div className="space-y-1">
                                <span
                                  className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                    req.status === 'PENDING'
                                      ? 'bg-amber-200 text-amber-900'
                                      : req.status === 'APPROVED'
                                      ? 'bg-emerald-200 text-emerald-900'
                                      : 'bg-rose-200 text-rose-900'
                                  }`}
                                >
                                  {req.status}
                                </span>
                                <div className="text-[10px] text-gray-500 font-mono">
                                  {req.reviewedBy ? `By ${req.reviewedBy}` : formatRealtimeTimestamp(req.submittedAt)}
                                </div>
                              </div>
                            </td>
                            <td className="p-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                {req.status === 'PENDING' && onApproveCtoRequest && (
                                  <button
                                    id={`btn-admin-approve-cto-${req.id}`}
                                    type="button"
                                    onClick={async () => {
                                      const result = await showConfirmCtoActionAlert('APPROVE', req.employeeName, req.hoursRequested, req.date);
                                      if (result.isConfirmed) {
                                        onApproveCtoRequest(req.id, result.value || 'Approved by Super Admin', 'ADMIN');
                                        showSuccessAlert(
                                          `CTO ${isCredit ? 'Credit' : 'Leave'} Approved`,
                                          `Approved ${req.hoursRequested}h CTO ${isCredit ? 'credit' : 'leave'} for ${req.employeeName} on ${req.date}.`
                                        );
                                      }
                                    }}
                                    title="Approve CTO Request"
                                    className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-md cursor-pointer transition-colors"
                                  >
                                    <Check className="w-4 h-4" />
                                  </button>
                                )}
                                {req.status === 'PENDING' && onRejectCtoRequest && (
                                  <button
                                    id={`btn-admin-reject-cto-${req.id}`}
                                    type="button"
                                    onClick={async () => {
                                      const result = await showConfirmCtoActionAlert('REJECT', req.employeeName, req.hoursRequested, req.date);
                                      if (result.isConfirmed) {
                                        onRejectCtoRequest(req.id, result.value || 'Declined by Super Admin');
                                        showSuccessAlert('CTO Request Rejected', `Declined CTO request for ${req.employeeName}.`);
                                      }
                                    }}
                                    title="Reject CTO Request"
                                    className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-md cursor-pointer transition-colors"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                )}
                                {onUpdateCtoRequest && (
                                  <button
                                    id={`btn-admin-edit-cto-${req.id}`}
                                    type="button"
                                    onClick={() => handleOpenCtoEditModal(req)}
                                    title="Edit CTO Request"
                                    className="p-1.5 text-gray-500 hover:text-[#656D4A] hover:bg-gray-100 rounded-md cursor-pointer transition-colors"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>
                                )}
                                {onDeleteCtoRequest && (
                                  <button
                                    id={`btn-admin-delete-cto-${req.id}`}
                                    type="button"
                                    onClick={() => handleDeleteCtoClick(req)}
                                    title="Delete CTO Request"
                                    className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-md cursor-pointer transition-colors"
                                  >
                                    <Trash2 className="w-4 h-4" />
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

            {/* Employee CTO Balance Overview */}
            <div className="bg-white rounded-2xl border border-[#D3D8C8] p-6 shadow-xs space-y-3">
              <div>
                <h3 className="text-sm font-bold text-[#2C3524]">
                  Employee CTO Balance Summary
                </h3>
                <p className="text-xs text-gray-500">
                  Live CTO hours earned, manual adjustments, approved leave used, and available balances.
                </p>
              </div>
              <div className="overflow-x-auto border border-gray-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F7F8F5] text-[#4A543E] font-bold uppercase tracking-wider border-b border-gray-200">
                    <tr>
                      <th className="p-3">Employee</th>
                      <th className="p-3">Department</th>
                      <th className="p-3 text-center">Credited</th>
                      <th className="p-3 text-center">Manual Adj.</th>
                      <th className="p-3 text-center">Used Leave</th>
                      <th className="p-3 text-center">Available Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium">
                    {users.map((u) => {
                      const stats = getUserCtoStats(u.employeeId, summaries, ctoRequests, ctoAdjustments);
                      return (
                        <tr key={`admin-cto-bal-${u.id}`} className="hover:bg-gray-50">
                          <td className="p-3">
                            <div className="font-bold text-[#2C3524]">{u.name}</div>
                            <div className="text-[10px] text-gray-400 font-mono">{u.employeeId}</div>
                          </td>
                          <td className="p-3 text-gray-600">{u.department}</td>
                          <td className="p-3 text-center font-mono font-bold text-emerald-700">
                            +{stats.creditedApproved.toFixed(1)}h
                          </td>
                          <td className="p-3 text-center font-mono font-bold">
                            <span className={stats.manualAdjustments >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                              {stats.manualAdjustments >= 0 ? `+${stats.manualAdjustments.toFixed(1)}` : stats.manualAdjustments.toFixed(1)}h
                            </span>
                          </td>
                          <td className="p-3 text-center font-mono font-bold text-amber-800">
                            -{stats.usedApproved.toFixed(1)}h
                          </td>
                          <td className="p-3 text-center">
                            <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-950 border border-amber-300 font-mono font-black">
                              {stats.availableBalance.toFixed(1)} hrs
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

      {/* SECTION 4: USER ACCOUNTS MANAGEMENT */}
      {(activeTab === 'users' || activeTab === 'all') && (() => {
        const filteredUserAccounts = users.filter((u) => {
          const q = userSearchQuery.trim().toLowerCase();
          const matchesQuery =
            !q ||
            (u.name || '').toLowerCase().includes(q) ||
            (u.employeeId || '').toLowerCase().includes(q) ||
            (u.position && u.position.toLowerCase().includes(q)) ||
            (u.department && u.department.toLowerCase().includes(q)) ||
            (u.role && u.role.toLowerCase().includes(q)) ||
            (u.pin && u.pin.includes(q)) ||
            (u.email && u.email.toLowerCase().includes(q));

          const roleUpper = (u.role || '').toUpperCase();
          const matchesRole =
            userRoleFilter === 'ALL'
              ? true
              : userRoleFilter === 'MANAGER'
              ? roleUpper === 'BRANCH_MANAGER' || roleUpper === 'SHIFT_MANAGER'
              : roleUpper === userRoleFilter.toUpperCase();

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
                  <option value="MANAGER">All Managers (Branch & Shift)</option>
                  <option value="BRANCH_MANAGER">Branch Managers Only</option>
                  <option value="SHIFT_MANAGER">Shift Managers Only</option>
                  <option value="PAYROLL">Payroll / HR</option>
                  <option value="ADMIN">Administrators</option>
                </select>
              </div>
            </div>

            {/* Mobile User Account Cards */}
            <div className="md:hidden space-y-2.5">
              {filteredUserAccounts.length === 0 ? (
                <div className="p-6 text-center text-xs text-gray-500 font-bold border border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                  {userSearchQuery.trim()
                    ? `No user accounts found matching "${userSearchQuery}".`
                    : 'No user accounts match the selected role filter.'}
                </div>
              ) : (
                filteredUserAccounts.map((u) => (
                  <div key={`mob-usr-${u.id}`} className="rounded-xl border border-gray-200 bg-white p-3.5 space-y-2.5 shadow-2xs">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {u.avatarUrl ? (
                          <img
                            src={u.avatarUrl}
                            alt={u.name}
                            className="w-9 h-9 rounded-full object-cover border border-[#656D4A] shrink-0"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-amber-200 text-[#2C3524] flex items-center justify-center font-black text-xs shrink-0 border border-amber-400">
                            {u.firstName?.[0] || u.name?.[0] || 'U'}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="font-bold text-sm text-[#2C3524] truncate">{u.name}</div>
                          <div className="text-[11px] text-gray-500 font-mono">{u.employeeId}</div>
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                          u.status === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-gray-200 text-gray-600'
                        }`}
                      >
                        {u.status}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E6E8DE] text-[#2C3524]">
                        {u.role}
                      </span>
                      {u.role === 'STAFF' || u.role === 'SHIFT_MANAGER' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-200/80">
                          No fixed branch (Assigned per shift)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-700">
                          {u.department}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-[11px] bg-[#F7F8F5] p-2 rounded-lg border border-[#D3D8C8]/70">
                      <div>
                        <span className="block text-[9.5px] text-gray-500 uppercase font-bold">Position</span>
                        <span className="font-semibold text-gray-800 truncate block">{u.position}</span>
                      </div>
                      <div>
                        <span className="block text-[9.5px] text-gray-500 uppercase font-bold">PIN</span>
                        <span className="font-mono font-bold text-gray-800">{u.pin}</span>
                      </div>
                      <div>
                        <span className="block text-[9.5px] text-gray-500 uppercase font-bold">Hired</span>
                        <span className="font-mono font-bold text-gray-700">{u.dateHired || 'N/A'}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1.5 border-t border-gray-100">
                      <button
                        type="button"
                        onClick={() => handleOpenUserModal(u)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-xs font-bold cursor-pointer"
                      >
                        <Edit className="w-3.5 h-3.5" /> Edit
                      </button>
                      {onDeleteUser && (
                        <button
                          type="button"
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
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold cursor-pointer"
                        >
                          <UserX className="w-3.5 h-3.5" /> Delete
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="hidden md:block overflow-x-auto border border-gray-200 rounded-xl">
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
                        {userSearchQuery.trim()
                          ? `No user accounts found matching "${userSearchQuery}".`
                          : 'No user accounts match the selected role filter.'}
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
                        {u.role === 'STAFF' || u.role === 'SHIFT_MANAGER' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-200/80">
                            No fixed branch (Assigned per shift)
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

      {/* ACTIVITY LOGS TAB */}
      {(activeTab === 'activity-logs' || activeTab === 'all') && (
        <ActivityLogsTable
          activityLogs={activityLogs}
          onClearActivityLogs={onClearActivityLogs}
        />
      )}

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
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
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
                    Last Name <span className="text-gray-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    id="input-user-lastname"
                    type="text"
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Branch {(userFormData.role === 'STAFF' || userFormData.role === 'SHIFT_MANAGER') && <span className="text-gray-400 font-normal">(Dynamic)</span>}
                  </label>
                  {(userFormData.role === 'STAFF' || userFormData.role === 'SHIFT_MANAGER') ? (
                    <div className="w-full px-3 py-2 border border-amber-200 bg-amber-50/60 rounded-xl text-xs font-semibold text-amber-900 flex items-center gap-1.5 min-h-[38px]">
                      <span>⚡ No fixed branch (Assigned per shift)</span>
                    </div>
                  ) : (() => {
                    const currentDept =
                      userFormData.department &&
                      userFormData.department !== 'No fixed branch (Assigned per shift)' &&
                      userFormData.department !== 'Store Operations'
                        ? userFormData.department
                        : 'YC Ebloc';
                    const deptOptions = BRANCH_DEPARTMENT_OPTIONS.includes(currentDept)
                      ? BRANCH_DEPARTMENT_OPTIONS
                      : [currentDept, ...BRANCH_DEPARTMENT_OPTIONS];
                    return (
                      <select
                        id="select-user-department"
                        value={currentDept}
                        onChange={(e) =>
                          setUserFormData({
                            ...userFormData,
                            department: e.target.value,
                            branch: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-bold text-gray-800 focus:ring-2 focus:ring-[#656D4A] focus:outline-none"
                      >
                        {deptOptions.map((dept) => (
                          <option key={dept} value={dept}>
                            {dept}
                          </option>
                        ))}
                      </select>
                    );
                  })()}
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Role</label>
                  <select
                    id="select-user-role"
                    value={normalizeUserRole(userFormData.role)}
                    onChange={(e) => {
                      const newRole = normalizeUserRole(e.target.value);
                      const isShiftBased = newRole === 'STAFF' || newRole === 'SHIFT_MANAGER';
                      const nextDept = isShiftBased
                        ? 'No fixed branch (Assigned per shift)'
                        : (userFormData.department &&
                           userFormData.department !== 'No fixed branch (Assigned per shift)' &&
                           userFormData.department !== 'Store Operations'
                            ? userFormData.department
                            : 'YC Ebloc');
                      setUserFormData({
                        ...userFormData,
                        role: newRole,
                        department: nextDept,
                        branch: isShiftBased ? '' : nextDept,
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

              {/* POSITION TITLE & ACCOUNT STATUS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Account Status</label>
                  <select
                    id="select-user-status"
                    value={userFormData.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE'}
                    onChange={(e) =>
                      setUserFormData({
                        ...userFormData,
                        status: e.target.value === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-bold text-gray-800 focus:ring-2 focus:ring-[#656D4A] focus:outline-none"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
              </div>

              {/* EMAIL & HOURLY RATE */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Email Address</label>
                  <input
                    id="input-user-email"
                    type="email"
                    placeholder="staff@fbcrestaurants.com"
                    value={userFormData.email || ''}
                    onChange={(e) =>
                      setUserFormData({ ...userFormData, email: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-[#656D4A] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Hourly Rate (PHP)</label>
                  <input
                    id="input-user-hourly-rate"
                    type="number"
                    min="0"
                    step="0.01"
                    value={userFormData.hourlyRate ?? 120}
                    onChange={(e) =>
                      setUserFormData({
                        ...userFormData,
                        hourlyRate: e.target.value === '' ? 0 : Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-[#656D4A] focus:outline-none"
                  />
                </div>
              </div>

              {/* MODAL ACTION BUTTONS */}
              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  disabled={isSavingUser}
                  onClick={() => setShowUserModal(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-600 rounded-xl hover:bg-gray-100 cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  id="btn-save-user-account"
                  type="submit"
                  disabled={isSavingUser}
                  className="px-5 py-2 bg-[#656D4A] hover:bg-[#4A543E] text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer disabled:opacity-60"
                >
                  {isSavingUser ? 'Saving Changes...' : 'Save Account Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT / CREATE CTO REQUEST MODAL (SUPER ADMIN) */}
      {showCtoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-600" />
                <div>
                  <h3 className="text-base font-black text-[#2C3524]">
                    {editingCtoRequest ? 'Edit CTO Request' : 'File New CTO Request'}
                  </h3>
                  <p className="text-xs text-gray-500">
                    Modify request date, hours, type, status, or remarks
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCtoModal(false)}
                className="text-gray-400 hover:text-gray-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCtoModal} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Employee <span className="text-rose-500">*</span>
                </label>
                <select
                  id="select-admin-cto-employee"
                  value={ctoFormData.employeeId}
                  disabled={Boolean(editingCtoRequest)}
                  onChange={(e) => {
                    const emp = users.find((u) => u.employeeId === e.target.value);
                    setCtoFormData({
                      ...ctoFormData,
                      employeeId: e.target.value,
                      department: emp?.department || ctoFormData.department,
                    });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-bold text-gray-800 focus:ring-2 focus:ring-[#656D4A] focus:outline-none disabled:bg-gray-100"
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.employeeId}>
                      {u.name} ({u.employeeId})
                    </option>
                  ))}
                  {editingCtoRequest &&
                    !users.some((u) => u.employeeId === editingCtoRequest.employeeId) && (
                      <option value={editingCtoRequest.employeeId}>
                        {editingCtoRequest.employeeName} ({editingCtoRequest.employeeId})
                      </option>
                    )}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Request Type</label>
                  <select
                    id="select-admin-cto-type"
                    value={ctoFormData.requestType}
                    onChange={(e) =>
                      setCtoFormData({
                        ...ctoFormData,
                        requestType: e.target.value === 'CREDIT' ? 'CREDIT' : 'LEAVE',
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-bold text-gray-800 focus:ring-2 focus:ring-[#656D4A] focus:outline-none"
                  >
                    <option value="LEAVE">- CTO Leave Request</option>
                    <option value="CREDIT">+ CTO Credit Request</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Status</label>
                  <select
                    id="select-admin-cto-status"
                    value={ctoFormData.status}
                    disabled={!editingCtoRequest}
                    onChange={(e) =>
                      setCtoFormData({
                        ...ctoFormData,
                        status: e.target.value as CtoStatus,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-bold text-gray-800 focus:ring-2 focus:ring-[#656D4A] focus:outline-none disabled:bg-gray-100"
                  >
                    <option value="PENDING">PENDING</option>
                    <option value="APPROVED">APPROVED</option>
                    <option value="REJECTED">REJECTED</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <DatePickerInput
                    id="input-admin-cto-date"
                    label="Target Date"
                    required
                    value={ctoFormData.date}
                    onChange={(val) => setCtoFormData({ ...ctoFormData, date: val })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Hours Requested <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="input-admin-cto-hours"
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="48"
                    required
                    value={ctoFormData.hoursRequested}
                    onChange={(e) =>
                      setCtoFormData({
                        ...ctoFormData,
                        hoursRequested: e.target.value === '' ? 0 : Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-[#656D4A] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Branch / Department</label>
                <input
                  id="input-admin-cto-department"
                  type="text"
                  value={ctoFormData.department}
                  onChange={(e) =>
                    setCtoFormData({ ...ctoFormData, department: e.target.value })
                  }
                  placeholder="e.g. YC Ebloc"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-[#656D4A] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Reason / Purpose <span className="text-rose-500">*</span>
                </label>
                <textarea
                  id="input-admin-cto-reason"
                  rows={3}
                  required
                  value={ctoFormData.reason}
                  onChange={(e) => setCtoFormData({ ...ctoFormData, reason: e.target.value })}
                  placeholder="Enter reason for CTO leave or overtime credit..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-[#656D4A] focus:outline-none"
                />
              </div>

              {editingCtoRequest && (
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Approver / Admin Notes
                  </label>
                  <input
                    id="input-admin-cto-notes"
                    type="text"
                    value={ctoFormData.reviewNotes}
                    onChange={(e) =>
                      setCtoFormData({ ...ctoFormData, reviewNotes: e.target.value })
                    }
                    placeholder="Optional review or edit remarks..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-[#656D4A] focus:outline-none"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  disabled={isSavingCto}
                  onClick={() => setShowCtoModal(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-600 rounded-xl hover:bg-gray-100 cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  id="btn-save-admin-cto"
                  type="submit"
                  disabled={isSavingCto}
                  className="px-5 py-2 bg-[#656D4A] hover:bg-[#4A543E] text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer disabled:opacity-60"
                >
                  {isSavingCto ? 'Saving...' : editingCtoRequest ? 'Save CTO Changes' : 'Submit CTO Request'}
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

      {/* Super Admin Automatic Email Notification Settings Modal */}
      {showEmailSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-zinc-200 overflow-hidden max-h-[92vh] flex flex-col">
            <div className="bg-zinc-950 text-amber-400 px-5 py-4 border-b-4 border-amber-400 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-400 text-zinc-950 flex items-center justify-center">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wide text-white">
                    Super Admin Email Notifications
                  </h3>
                  <p className="text-[11px] text-amber-300/90 font-medium">
                    Automatic alerts forwarded directly to your inbox
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEmailSettingsModal(false)}
                className="text-zinc-400 hover:text-white text-sm font-bold cursor-pointer p-1"
                aria-label="Close email notification settings"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={handleSaveEmailSettingsForm}
              className="p-5 space-y-4 overflow-y-auto flex-1"
            >
              {/* Server Mailer Connection Status */}
              {emailDeliveryStatus?.configured ? (
                <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50 flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                  <div className="text-xs text-emerald-900">
                    <div className="font-extrabold">
                      Email Service Active ({emailDeliveryStatus.provider.toUpperCase()})
                    </div>
                    <p className="text-[11px] text-emerald-800 mt-0.5">
                      New system alerts will be emailed automatically without manual action.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl border border-amber-300 bg-amber-50 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-extrabold text-amber-950">
                    <Settings className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>Server Email Transport Setup Needed</span>
                  </div>
                  <p className="text-[11px] text-amber-900 leading-relaxed">
                    Your preferences and recipient (<strong>{emailDraftRecipient}</strong>) are saved in the database. To deliver live emails, add server credentials in your hosting/environment secrets:
                  </p>
                  <ul className="text-[11px] text-amber-900 list-disc pl-4 space-y-0.5 font-medium">
                    <li>
                      For Gmail SMTP: set <code className="font-mono bg-amber-100 px-1 rounded">SMTP_USER</code> and a Gmail App Password in <code className="font-mono bg-amber-100 px-1 rounded">SMTP_PASS</code>
                    </li>
                    <li>
                      Or set <code className="font-mono bg-amber-100 px-1 rounded">RESEND_API_KEY</code> for Resend email delivery
                    </li>
                    <li>Restart the server, then click &ldquo;Send Test Email&rdquo; below</li>
                  </ul>
                </div>
              )}

              {/* Master Toggle */}
              <label className="flex items-center justify-between gap-3 p-3.5 rounded-xl border border-zinc-200 bg-zinc-50 cursor-pointer">
                <div>
                  <div className="text-xs font-extrabold text-zinc-900">
                    Enable Automatic Alert Emails
                  </div>
                  <div className="text-[11px] text-zinc-500">
                    Sends an email once per newly triggered alert across all branches &amp; users
                  </div>
                </div>
                <input
                  id="checkbox-admin-email-enabled"
                  type="checkbox"
                  checked={emailDraftEnabled}
                  onChange={(e) => setEmailDraftEnabled(e.target.checked)}
                  className="w-4 h-4 accent-[#656D4A] cursor-pointer"
                />
              </label>

              {/* Recipient Email */}
              <div>
                <label
                  htmlFor="input-superadmin-alert-email"
                  className="block text-xs font-bold text-gray-700 mb-1"
                >
                  Super Admin Recipient Email <span className="text-rose-500">*</span>
                </label>
                <input
                  id="input-superadmin-alert-email"
                  type="email"
                  required
                  value={emailDraftRecipient}
                  onChange={(e) => setEmailDraftRecipient(e.target.value)}
                  placeholder={DEFAULT_ADMIN_ALERT_EMAIL}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-semibold text-zinc-900 focus:ring-2 focus:ring-[#656D4A] focus:outline-none"
                />
              </div>

              {/* Alert Categories */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-700">
                    Alert Categories to Email ({emailDraftCategories.length}/{ALL_ADMIN_ALERT_CATEGORIES.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => setEmailDraftCategories([...ALL_ADMIN_ALERT_CATEGORIES])}
                    className="text-[11px] font-bold text-[#656D4A] hover:underline cursor-pointer"
                  >
                    Select All
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {ALL_ADMIN_ALERT_CATEGORIES.map((cat) => {
                    const checked = emailDraftCategories.includes(cat);
                    return (
                      <label
                        key={cat}
                        className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs cursor-pointer transition-colors ${
                          checked
                            ? 'border-[#656D4A] bg-[#F7F8F5] text-zinc-900 font-bold'
                            : 'border-zinc-200 bg-white text-zinc-600'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => handleToggleDraftCategory(cat)}
                          className="accent-[#656D4A] cursor-pointer"
                        />
                        <span className="leading-tight">{ALERT_CATEGORY_LABELS[cat]}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Delivery Status Metadata */}
              {(adminEmailConfig.lastSentAt || adminEmailConfig.lastError) && (
                <div className="text-[11px] text-zinc-500 bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 space-y-0.5">
                  {adminEmailConfig.lastSentAt && (
                    <div>
                      Last dispatch attempt: <span className="font-mono font-semibold text-zinc-700">{formatRealtimeTimestamp(adminEmailConfig.lastSentAt)}</span> ({adminEmailConfig.lastStatus || 'SENT'})
                    </div>
                  )}
                  {adminEmailConfig.lastError && adminEmailConfig.lastStatus === 'ERROR' && (
                    <div className="text-rose-700 font-medium">
                      Last notice: {adminEmailConfig.lastError}
                    </div>
                  )}
                </div>
              )}

              {/* Action Feedback */}
              {emailActionFeedback && (
                <div
                  className={`p-3 rounded-xl border text-xs font-semibold ${
                    emailActionFeedback.type === 'success'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : emailActionFeedback.type === 'warning'
                      ? 'bg-amber-50 border-amber-300 text-amber-950'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}
                >
                  {emailActionFeedback.text}
                </div>
              )}

              {/* Footer Actions */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-zinc-200">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    id="btn-send-test-admin-email"
                    type="button"
                    disabled={isSendingTestEmail}
                    onClick={handleTriggerTestEmail}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-800 text-xs font-bold cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5 text-amber-600" />
                    <span>{isSendingTestEmail ? 'Sending Test...' : 'Send Test Email'}</span>
                  </button>
                  <button
                    id="btn-email-active-alerts-now"
                    type="button"
                    disabled={isSendingDigestEmail || adminAlerts.length === 0}
                    onClick={handleTriggerDigestEmail}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-amber-400 bg-amber-100 hover:bg-amber-200 text-zinc-950 text-xs font-bold cursor-pointer disabled:opacity-50"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>
                      {isSendingDigestEmail
                        ? 'Sending...'
                        : `Email Active Alerts (${adminAlerts.length})`}
                    </span>
                  </button>
                </div>

                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => setShowEmailSettingsModal(false)}
                    className="px-3.5 py-2 text-xs font-bold text-gray-600 rounded-xl hover:bg-gray-100 cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    id="btn-save-admin-email-settings"
                    type="submit"
                    disabled={isSavingEmailConfig}
                    className="px-4 py-2 bg-[#656D4A] hover:bg-[#4A543E] text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer disabled:opacity-60"
                  >
                    {isSavingEmailConfig ? 'Saving...' : 'Save Settings'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
