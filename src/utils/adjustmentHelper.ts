import { AttendanceSummaryDaily, DisputeRequest } from '../types';
import { parseToYYYYMMDD } from './timeFormatters';

export type AdjustedTimeField = 'firstIn' | 'breakOut' | 'breakIn' | 'lastOut';

/**
 * Checks whether a specific time field ('firstIn', 'breakOut', 'breakIn', 'lastOut')
 * on an AttendanceSummaryDaily was adjusted via an approved time adjustment request.
 */
export function isFieldAdjusted(
  summary: AttendanceSummaryDaily,
  fieldName: AdjustedTimeField,
  disputes: DisputeRequest[] = []
): boolean {
  if (!summary) return false;

  // 1. Direct check on summary.adjustedFields if present
  if (summary.adjustedFields && Array.isArray(summary.adjustedFields)) {
    if (summary.adjustedFields.includes(fieldName)) {
      return true;
    }
  }

  // 2. Cross-reference with approved disputes list
  const targetDate = parseToYYYYMMDD(summary.date);
  const matchingApprovedDisputes = disputes.filter(
    (d) =>
      d.employeeId === summary.employeeId &&
      d.status === 'APPROVED' &&
      parseToYYYYMMDD(d.date) === targetDate
  );

  if (matchingApprovedDisputes.length > 0) {
    for (const d of matchingApprovedDisputes) {
      const cat = (d.category || d.type || '').toLowerCase();
      if (fieldName === 'firstIn') {
        if (cat.includes('time-in') || cat.includes('time_in') || cat.includes('full shift') || cat.includes('full_shift') || (d.requestedClockIn && !cat.includes('break'))) {
          return true;
        }
      }
      if (fieldName === 'lastOut') {
        if (cat.includes('time-out') || cat.includes('time_out') || cat.includes('full shift') || cat.includes('full_shift') || (d.requestedClockOut && !cat.includes('break'))) {
          return true;
        }
      }
      if (fieldName === 'breakOut') {
        if (cat.includes('break-out') || cat.includes('break_out') || Boolean(d.requestedBreakOut)) {
          return true;
        }
      }
      if (fieldName === 'breakIn') {
        if (cat.includes('break-in') || cat.includes('break_in') || Boolean(d.requestedBreakIn)) {
          return true;
        }
      }
    }
  }

  // 3. Fallback check if summary.isAdjusted is true and notes mention the specific field
  if (summary.isAdjusted) {
    const note = (summary.adjustmentNote || (summary.anomalies ? summary.anomalies.join(' ') : '')).toLowerCase();
    if (fieldName === 'firstIn' && (note.includes('time-in') || note.includes('clock-in') || note.includes('full shift'))) {
      return true;
    }
    if (fieldName === 'lastOut' && (note.includes('time-out') || note.includes('clock-out') || note.includes('full shift'))) {
      return true;
    }
    if (fieldName === 'breakOut' && note.includes('break-out')) {
      return true;
    }
    if (fieldName === 'breakIn' && note.includes('break-in')) {
      return true;
    }
  }

  return false;
}

/**
 * Retrieves the specific adjusted time string for a given field ('firstIn', 'breakOut', 'breakIn', 'lastOut')
 * prioritizing approved dispute requests, and falling back to the summary field.
 */
export function getAdjustedDisplayTime(
  summary: AttendanceSummaryDaily,
  fieldName: AdjustedTimeField,
  disputes: DisputeRequest[] = []
): string | null {
  if (!summary) return null;

  const targetDate = parseToYYYYMMDD(summary.date);
  const matchingApprovedDisputes = disputes.filter(
    (d) =>
      d.employeeId === summary.employeeId &&
      d.status === 'APPROVED' &&
      parseToYYYYMMDD(d.date) === targetDate
  );

  if (matchingApprovedDisputes.length > 0) {
    for (const d of matchingApprovedDisputes) {
      if (fieldName === 'firstIn' && d.requestedClockIn) {
        return d.requestedClockIn;
      }
      if (fieldName === 'lastOut' && d.requestedClockOut) {
        return d.requestedClockOut;
      }
      if (fieldName === 'breakOut' && d.requestedBreakOut) {
        return d.requestedBreakOut;
      }
      if (fieldName === 'breakIn' && d.requestedBreakIn) {
        return d.requestedBreakIn;
      }
    }
  }

  if (fieldName === 'firstIn') return summary.firstIn || null;
  if (fieldName === 'lastOut') return summary.lastOut || null;
  if (fieldName === 'breakOut') return summary.breakOut || null;
  if (fieldName === 'breakIn') return summary.breakIn || null;

  return null;
}

