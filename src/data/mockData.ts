import {
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

