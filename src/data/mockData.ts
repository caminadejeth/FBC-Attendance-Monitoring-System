import {
  ActivityLog,
  AttendanceSummaryDaily,
  BiometricPunch,
  CtoManualAdjustment,
  CtoRequest,
  DisputeRequest,
  User,
  WorkSchedule,
} from '../types';

export const INITIAL_USERS: User[] = [
  {
    id: 'usr-admin-387966',
    employeeId: '387966',
    name: 'Jethro',
    firstName: 'Jethro',
    middleName: '',
    lastName: '',
    email: 'jethro@fbcrestaurants.com',
    pin: '7210',
    role: 'ADMIN',
    department: 'Management',
    position: 'General Manager & System Admin',
    hourlyRate: 284,
    dateHired: '2020-01-15',
    status: 'ACTIVE',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  },
];

export const INITIAL_PUNCHES: BiometricPunch[] = [];

export const INITIAL_DAILY_SUMMARIES: AttendanceSummaryDaily[] = [];

export const INITIAL_DISPUTES: DisputeRequest[] = [];

export const INITIAL_CTO_REQUESTS: CtoRequest[] = [];

export const INITIAL_CTO_ADJUSTMENTS: CtoManualAdjustment[] = [];

export const INITIAL_SCHEDULES: WorkSchedule[] = [];

export const INITIAL_ACTIVITY_LOGS: ActivityLog[] = [
  {
    id: 'act-101',
    timestamp: new Date(Date.now() - 3600000 * 5).toISOString(),
    userName: 'Jethro',
    userRole: 'ADMIN',
    actionType: 'SYSTEM_EVENT',
    actionCategory: 'System',
    details: 'Biometric Attendance System initialized with flexitime rules & ZKTeco parser.',
  },
  {
    id: 'act-102',
    timestamp: new Date(Date.now() - 3600000 * 3).toISOString(),
    userName: 'Jethro',
    userRole: 'ADMIN',
    actionType: 'DISPUTE_APPROVAL',
    actionCategory: 'Disputes',
    details: 'Approved Missing Punch dispute for Staff Employee (Juan Dela Cruz) on 2026-08-11.',
  },
  {
    id: 'act-103',
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
    userName: 'Branch Manager',
    userRole: 'BRANCH_MANAGER',
    actionType: 'SCHEDULE_UPDATE',
    actionCategory: 'Schedules',
    details: 'Updated shift schedule roster for YC Ebloc branch (Regular Day Shift).',
  },
  {
    id: 'act-104',
    timestamp: new Date(Date.now() - 3600000 * 1).toISOString(),
    userName: 'Jethro',
    userRole: 'ADMIN',
    actionType: 'MANUAL_ADJUSTMENT',
    actionCategory: 'Adjustments',
    details: 'Executed manual time adjustment for employee #387966 (Clock In: 08:00 AM).',
  },
];


