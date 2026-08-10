import { AttendanceSummaryDaily, CtoManualAdjustment, CtoRequest } from '../types';

export interface UserCtoStats {
  earnedFromAttendance: number; // Potential CTO eligible from attendance logs
  creditedApproved: number;     // Approved CTO Credit requests
  manualAdjustments: number;    // Manual adjustments by Payroll
  usedApproved: number;         // Approved CTO Leave requests
  pendingRequests: number;
  availableBalance: number;     // creditedApproved + manualAdjustments - usedApproved
}

/**
 * Calculates current CTO balance and breakdown for a given employee.
 * Note: CTO is NOT auto-applied from attendance logs. It is credited only after
 * a "CTO Credit Request" is approved by Payroll, or via manual balance adjustment.
 */
export function getUserCtoStats(
  employeeId: string,
  summaries: AttendanceSummaryDaily[],
  ctoRequests: CtoRequest[],
  ctoAdjustments: CtoManualAdjustment[]
): UserCtoStats {
  const empSummaries = summaries.filter((s) => s.employeeId === employeeId);
  const empRequests = ctoRequests.filter((r) => r.employeeId === employeeId);
  const empAdjustments = ctoAdjustments.filter((a) => a.employeeId === employeeId);

  const earnedFromAttendance = empSummaries.reduce((sum, s) => sum + (s.ctoHoursEarned || 0), 0);
  
  // Approved CTO Credit Requests (requestType === 'CREDIT')
  const creditedApproved = empRequests
    .filter((r) => r.requestType === 'CREDIT' && r.status === 'APPROVED')
    .reduce((sum, r) => sum + r.hoursRequested, 0);

  // Manual Adjustments from Payroll (+ or -)
  const manualAdjustments = empAdjustments.reduce((sum, a) => sum + a.amount, 0);

  // Approved CTO Leave Requests (requestType !== 'CREDIT')
  const usedApproved = empRequests
    .filter((r) => r.requestType !== 'CREDIT' && r.status === 'APPROVED')
    .reduce((sum, r) => sum + r.hoursRequested, 0);

  const pendingRequests = empRequests
    .filter((r) => r.status === 'PENDING')
    .reduce((sum, r) => sum + r.hoursRequested, 0);

  // Available Balance strictly from Approved Credits + Manual Adjustments - Approved Leaves
  const availableBalance = Math.max(0, creditedApproved + manualAdjustments - usedApproved);

  return {
    earnedFromAttendance: Math.round(earnedFromAttendance * 100) / 100,
    creditedApproved: Math.round(creditedApproved * 100) / 100,
    manualAdjustments: Math.round(manualAdjustments * 100) / 100,
    usedApproved: Math.round(usedApproved * 100) / 100,
    pendingRequests: Math.round(pendingRequests * 100) / 100,
    availableBalance: Math.round(availableBalance * 100) / 100,
  };
}
