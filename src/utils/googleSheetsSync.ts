import * as XLSX from 'xlsx';
import { AttendanceSummaryDaily, BiometricPunch, PayrollPeriodSummary, SyncLog, User } from '../types';

export interface GoogleSheetsPayload {
  rawLogs: Array<{
    'Punch ID': string;
    'Employee ID': string;
    'Employee Name': string;
    'Timestamp': string;
    'Punch Type': string;
    'Device ID': string;
  }>;
  dailySummaries: Array<{
    'Employee ID': string;
    'Employee Name': string;
    'Department': string;
    'Date': string;
    'Weekday': string;
    'First Clock In': string;
    'Last Clock Out': string;
    'Total Break (Mins)': number;
    'Net Hours Worked': number;
    'Undertime (Hrs)': number;
    'Potential CTO Eligible (Hrs)': number;
    'Flexitime Target (Hrs)': number;
    'Status': string;
    'Anomalies / Notes': string;
  }>;
  payrollSummaries: Array<{
    'Employee ID': string;
    'Employee Name': string;
    'Department': string;
    'Days Worked': number;
    'Regular Hours': number;
    'Undertime Deficit Hours': number;
    'Net Payable Hours': number;
  }>;
}

/**
 * Format data into structured Google Sheets payload
 */
export function buildGoogleSheetsData(
  summaries: AttendanceSummaryDaily[],
  users: User[],
  punches: BiometricPunch[]
): GoogleSheetsPayload {
  const userMap = new Map<string, User>();
  users.forEach((u) => userMap.set(u.employeeId, u));

  // Sheet 1: Raw Logs
  const rawLogs = punches.map((p) => {
    const user = userMap.get(p.employeeId);
    return {
      'Punch ID': p.id,
      'Employee ID': p.employeeId,
      'Employee Name': user ? user.name : `Employee ${p.employeeId}`,
      'Timestamp': p.timestamp,
      'Punch Type': p.type,
      'Device ID': p.deviceId || 'BIO-TERM-01',
    };
  });

  // Sheet 2: Daily Summaries
  const dailySummaries = summaries.map((s) => ({
    'Employee ID': s.employeeId,
    'Employee Name': s.employeeName,
    'Department': s.department,
    'Date': s.date,
    'Weekday': s.weekday,
    'First Clock In': s.firstIn || '--',
    'Last Clock Out': s.lastOut || '--',
    'Total Break (Mins)': s.totalBreakMinutes,
    'Net Hours Worked': Number(s.netHoursWorked.toFixed(2)),
    'Undertime (Hrs)': Number(s.undertimeHours.toFixed(2)),
    'Potential CTO Eligible (Hrs)': Number((s.ctoHoursEarned || 0).toFixed(2)),
    'Flexitime Target (Hrs)': s.targetHours,
    'Status': s.status,
    'Anomalies / Notes': s.anomalies.join(' | ') || 'None',
  }));

  // Sheet 3: Payroll Period Summary (Aggregated per employee)
  const payrollMap = new Map<string, PayrollPeriodSummary>();

  summaries.forEach((s) => {
    const user = userMap.get(s.employeeId);
    const dept = user ? user.department : s.department;

    if (!payrollMap.has(s.employeeId)) {
      payrollMap.set(s.employeeId, {
        employeeId: s.employeeId,
        employeeName: s.employeeName,
        department: dept,
        startDate: s.date,
        endDate: s.date,
        daysWorked: 0,
        regularHours: 0,
        overtimeHours: 0,
        undertimeHours: 0,
        totalNetHours: 0,
        approvedAdjustmentsCount: s.isAdjusted ? 1 : 0,
      });
    }

    const item = payrollMap.get(s.employeeId)!;
    if (s.netHoursWorked > 0 || s.firstIn) {
      item.daysWorked += 1;
    }
    
    const reg = s.netHoursWorked;
    item.regularHours += reg;
    item.overtimeHours = 0;
    item.undertimeHours += s.undertimeHours;
    item.totalNetHours += s.netHoursWorked;

    if (s.date < item.startDate) item.startDate = s.date;
    if (s.date > item.endDate) item.endDate = s.date;
  });

  const payrollSummaries = Array.from(payrollMap.values()).map((p) => {
    return {
      'Employee ID': p.employeeId,
      'Employee Name': p.employeeName,
      'Department': p.department,
      'Days Worked': p.daysWorked,
      'Regular Hours': Number(p.totalNetHours.toFixed(2)),
      'Undertime Deficit Hours': Number(p.undertimeHours.toFixed(2)),
      'Net Payable Hours': Number(p.totalNetHours.toFixed(2)),
    };
  });

  return {
    rawLogs,
    dailySummaries,
    payrollSummaries,
  };
}

/**
 * Execute Sync to Google Sheets / Export Multi-tab Excel file
 */
export async function syncToGoogleSheets(
  summaries: AttendanceSummaryDaily[],
  users: User[],
  punches: BiometricPunch[],
  syncedBy: string
): Promise<SyncLog> {
  const payload = buildGoogleSheetsData(summaries, users, punches);

  // Try calling backend API
  try {
    const res = await fetch('/api/google-sheets/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload, syncedBy }),
    });

    if (res.ok) {
      const json = await res.json();
      return {
        id: `sync-${Date.now()}`,
        syncedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
        syncedBy,
        rawLogsCount: payload.rawLogs.length,
        dailySummariesCount: payload.dailySummaries.length,
        payrollSummariesCount: payload.payrollSummaries.length,
        status: 'SUCCESS',
        sheetUrl: json.sheetUrl || 'https://sheets.google.com',
        message: 'Successfully generated and synced 3 tabs to Google Sheets!',
      };
    }
  } catch (err) {
    // Fallback to client-side sheet builder if offline or local server
  }

  // Client-side multi-sheet Excel download trigger
  const wb = XLSX.utils.book_new();

  const ws1 = XLSX.utils.json_to_sheet(payload.rawLogs.length > 0 ? payload.rawLogs : [{ Note: 'No raw logs' }]);
  const ws2 = XLSX.utils.json_to_sheet(payload.dailySummaries.length > 0 ? payload.dailySummaries : [{ Note: 'No daily summaries' }]);
  const ws3 = XLSX.utils.json_to_sheet(payload.payrollSummaries.length > 0 ? payload.payrollSummaries : [{ Note: 'No payroll summaries' }]);

  XLSX.utils.book_append_sheet(wb, ws1, '1. Raw Logs');
  XLSX.utils.book_append_sheet(wb, ws2, '2. Daily Summaries');
  XLSX.utils.book_append_sheet(wb, ws3, '3. Payroll Period Summary');

  const nowStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `FBC_Attendance_GoogleSheets_Sync_${nowStr}.xlsx`);

  return {
    id: `sync-${Date.now()}`,
    syncedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
    syncedBy,
    rawLogsCount: payload.rawLogs.length,
    dailySummariesCount: payload.dailySummaries.length,
    payrollSummariesCount: payload.payrollSummaries.length,
    status: 'SUCCESS',
    sheetUrl: 'https://sheets.google.com',
    message: 'Successfully exported 3-Sheet Google Sheet-compatible workbook file!',
  };
}
