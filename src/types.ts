export type UserRole = 'ADMIN' | 'STAFF' | 'PAYROLL' | 'SHIFT_MANAGER' | 'BRANCH_MANAGER';

export interface User {
  id: string;
  employeeId: string;
  name: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  email: string;
  pin: string;
  role: UserRole;
  department: string;
  branch?: string;
  position: string;
  hourlyRate: number;
  dateHired?: string;
  status: 'ACTIVE' | 'INACTIVE';
  avatarUrl?: string;
}

export type PunchType = 'IN' | 'OUT' | 'BREAK_OUT' | 'BREAK_IN';

export interface BiometricPunch {
  id: string;
  employeeId: string;
  timestamp: string; // YYYY-MM-DD HH:mm:ss
  type: PunchType;
  deviceId?: string;
}

export interface RawBiometricRow {
  employeeId: string;
  firstName: string;
  date: string;
  weekday: string;
  breakDuration: string | number;
  clockIn: string;
  clockOut: string;
  totalHours: number;
  workedHours: number;
  breakOut?: string;
  breakIn?: string;
  breakHours?: number;
  totalOT?: number;
}

export type AttendanceStatus =
  | 'COMPLETE'
  | 'UNDERTIME'
  | 'OVERTIME'
  | 'OVERBREAK'
  | 'MISSING_IN'
  | 'MISSING_OUT'
  | 'LACKING'
  | 'ABSENT'
  | 'DISPUTED'
  | 'ADJUSTED'
  | 'LEAVE';

export interface AttendanceSummaryDaily {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  date: string; // YYYY-MM-DD
  weekday: string;
  firstIn: string | null; // YYYY-MM-DD HH:mm:ss or HH:mm
  breakOut?: string | null;
  breakIn?: string | null;
  lastOut: string | null;
  totalBreakMinutes: number;
  netHoursWorked: number;
  undertimeHours: number; // e.g. 0.8 if 7.2 hrs worked
  overtimeHours: number; // e.g. 2.0 if 10.0 hrs worked
  ctoHoursEarned?: number; // CTO earned if netHoursWorked > 10 hrs (excess beyond 10h threshold)
  targetHours: number;    // Always 8.0 for Flexitime
  status: AttendanceStatus;
  anomalies: string[];
  punches: BiometricPunch[];
  isAdjusted?: boolean;
  adjustmentNote?: string;
  adjustedFields?: string[];
  uploadedByUserId?: string;
  branch?: string;
}

export type CtoStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type CtoRequestType = 'LEAVE' | 'CREDIT';

export interface CtoRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  branch?: string;
  date: string; // YYYY-MM-DD
  hoursRequested: number; // e.g. 8.0 for leave, or 1.5 for CTO credit
  requestType?: CtoRequestType; // 'CREDIT' (Earn CTO) or 'LEAVE' (Use CTO)
  reason: string;
  status: CtoStatus;
  submittedAt: string;
  reviewedBy?: string;
  reviewNotes?: string;
  managerApproved?: boolean;
  managerApprovedBy?: string;
  managerApprovedAt?: string;
  payrollApproved?: boolean;
  payrollApprovedBy?: string;
  payrollApprovedAt?: string;
}

export interface CtoManualAdjustment {
  id: string;
  employeeId: string;
  employeeName: string;
  amount: number; // positive to add, negative to deduct
  type: 'ADDITION' | 'DEDUCTION';
  reason: string;
  adjustedBy: string;
  timestamp: string;
}

export type DisputeType =
  | 'MISSING_PUNCH'
  | 'OVERTIME_CLAIM'
  | 'UNDERTIME_EXPLANATION'
  | 'INCORRECT_HOURS'
  | 'Time-in'
  | 'Time-out'
  | 'Break-in'
  | 'Break-out'
  | 'Full Shift';

export type DisputeStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface DisputeRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  department?: string;
  branch?: string;
  date: string;
  type: DisputeType | string;
  category?: 'Time-in' | 'Time-out' | 'Break-in' | 'Break-out' | 'Full Shift' | string;
  reason: string;
  requestedClockIn?: string;
  requestedClockOut?: string;
  requestedBreakOut?: string;
  requestedBreakIn?: string;
  requestedHours?: number;
  attachmentName?: string;
  attachmentUrl?: string; // base64 data URL
  status: DisputeStatus;
  submittedAt: string;
  adminNotes?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  approvedAt?: string;
  managerApproved?: boolean;
  managerApprovedBy?: string;
  managerApprovedAt?: string;
  payrollApproved?: boolean;
  payrollApprovedBy?: string;
  payrollApprovedAt?: string;
}

export interface PayrollPeriodSummary {
  employeeId: string;
  employeeName: string;
  department: string;
  startDate: string;
  endDate: string;
  daysWorked: number;
  regularHours: number;
  overtimeHours: number;
  undertimeHours: number;
  totalNetHours: number;
  approvedAdjustmentsCount: number;
}

export interface GoogleSheetsSyncConfig {
  sheetId: string;
  sheetUrl: string;
  lastSyncedAt?: string;
  autoSyncEnabled: boolean;
}

export type ActivityActionType =
  | 'DISPUTE_APPROVAL'
  | 'DISPUTE_REJECTION'
  | 'DISPUTE_FILING'
  | 'CTO_FILING'
  | 'CTO_APPROVAL'
  | 'CTO_REJECTION'
  | 'MANUAL_ADJUSTMENT'
  | 'CTO_ADJUSTMENT'
  | 'DATA_CLEAR'
  | 'SCHEDULE_UPDATE'
  | 'USER_MANAGEMENT'
  | 'BIOMETRIC_UPLOAD'
  | 'AUTH'
  | 'SYSTEM_EVENT';

export interface ActivityLog {
  id: string;
  timestamp: string; // ISO string or readable format
  userName: string;
  userRole: UserRole | string;
  userEmail?: string;
  actionType: ActivityActionType;
  actionCategory?: string; // e.g. 'Disputes', 'Data Clear', 'Adjustments', 'Schedules', 'Users', 'Biometrics'
  details: string;
  targetId?: string;
}

export interface SyncLog {
  id: string;
  syncedAt: string;
  syncedBy: string;
  rawLogsCount: number;
  dailySummariesCount: number;
  payrollSummariesCount: number;
  status: 'SUCCESS' | 'FAILED';
  sheetUrl: string;
  message: string;
}

export interface WorkSchedule {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  branch?: string;
  shiftName: string; // e.g. "Regular Day Shift", "Morning Shift", "Evening Shift"
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  workDays: string[]; // e.g. ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
  dailyShifts?: Record<string, { startTime: string; endTime: string; isOff: boolean; branch?: string }>;
  effectiveDate?: string; // YYYY-MM-DD
  notes?: string;
  updatedAt: string;
  updatedBy: string;
}
