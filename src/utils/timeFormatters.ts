import { AttendanceSummaryDaily, AttendanceStatus, User, BiometricPunch } from '../types';

/**
 * Utility functions for time and date formatting in Attendance & Punch History.
 */

/**
 * Extracts breakOut and breakIn timestamps from raw punches
 */
export function getBreakTimes(punches?: BiometricPunch[]): { breakOut: string; breakIn: string } {
  if (!punches || punches.length === 0) {
    return { breakOut: 'No Data', breakIn: 'No Data' };
  }
  const breakOutPunch = punches.find((p) => p.type === 'BREAK_OUT') || (punches.length >= 3 ? punches[1] : null);
  const breakInPunch = punches.find((p) => p.type === 'BREAK_IN') || (punches.length >= 4 ? punches[2] : null);

  return {
    breakOut: breakOutPunch ? formatTime12Hr(breakOutPunch.timestamp) : 'No Data',
    breakIn: breakInPunch ? formatTime12Hr(breakInPunch.timestamp) : 'No Data',
  };
}

/**
 * Calculates gross elapsed hours between firstIn and lastOut
 */
export function calculateGrossHours(firstIn?: string | null, lastOut?: string | null): number {
  if (!firstIn || !lastOut) return 0;
  const inStr = firstIn.includes(' ') ? firstIn.split(' ')[1] : firstIn;
  const outStr = lastOut.includes(' ') ? lastOut.split(' ')[1] : lastOut;

  const inParts = inStr.split(':').map(Number);
  const outParts = outStr.split(':').map(Number);
  if (inParts.length < 2 || outParts.length < 2) return 0;

  const inMins = inParts[0] * 60 + inParts[1];
  const outMins = outParts[0] * 60 + outParts[1];
  if (outMins < inMins) return 0;
  return Math.max(0, (outMins - inMins) / 60);
}

/**
 * Formats a date string into MM/DD/YYYY format (Month/Day/FullYear).
 * Example: "2026-08-01" -> "08/01/2026"
 */
export function formatDateMDYYYY(dateStr?: string | null): string {
  if (!dateStr || dateStr === '--' || dateStr === 'No Data') return 'No Data';
  const cleanStr = String(dateStr).trim().split(' ')[0];
  const parts = cleanStr.split(/[\/-]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      // YYYY-MM-DD
      const y = parts[0];
      const m = parts[1].padStart(2, '0');
      const d = parts[2].padStart(2, '0');
      return `${m}/${d}/${y}`;
    } else {
      // M/D/YYYY or MM/DD/YYYY
      const m = parts[0].padStart(2, '0');
      const d = parts[1].padStart(2, '0');
      let y = parseInt(parts[2], 10);
      if (y < 100) y += 2000;
      return `${m}/${d}/${y}`;
    }
  }
  // Fallback parsing
  const dObj = new Date(cleanStr.replace(' ', 'T'));
  if (!isNaN(dObj.getTime())) {
    const m = String(dObj.getMonth() + 1).padStart(2, '0');
    const d = String(dObj.getDate()).padStart(2, '0');
    const y = dObj.getFullYear();
    return `${m}/${d}/${y}`;
  }
  return dateStr;
}

/**
 * Formats a date string (YYYY-MM-DD or ISO) into MM/DD/YY format.
 * Example: "2026-08-01" -> "08/01/26"
 */
export function formatDateMDYY(dateStr?: string | null): string {
  if (!dateStr || dateStr === '--' || dateStr === 'No Data') return 'No Data';
  const cleanStr = String(dateStr).trim().split(' ')[0];
  const parts = cleanStr.split(/[\/-]/);
  if (parts.length === 3 && parts[0].length === 4) {
    const y = parts[0].slice(2);
    const m = parts[1].padStart(2, '0');
    const d = parts[2].padStart(2, '0');
    return `${m}/${d}/${y}`;
  }
  // Fallback parsing with Date object
  const dObj = new Date(cleanStr.replace(' ', 'T'));
  if (!isNaN(dObj.getTime())) {
    const m = String(dObj.getMonth() + 1).padStart(2, '0');
    const d = String(dObj.getDate()).padStart(2, '0');
    const y = String(dObj.getFullYear()).slice(2);
    return `${m}/${d}/${y}`;
  }
  return dateStr;
}

/**
 * Converts 24-hour military time string (e.g., "08:00:00", "17:30", "13:00")
 * to 12-hour format with AM/PM (e.g., "08:00 AM", "05:30 PM", "01:00 PM").
 */
export function formatTime12Hr(timeStr?: string | null): string {
  if (!timeStr || timeStr === '--:--' || timeStr === '--' || timeStr === 'MISSING' || timeStr === 'No Data') {
    return 'No Data';
  }

  let str = timeStr.trim();
  // Handle full ISO/timestamp format "2026-08-04 17:30:00"
  if (str.includes(' ')) {
    const parts = str.split(' ');
    str = parts[1] || str;
  }

  const match = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return timeStr;

  let hours = parseInt(match[1], 10);
  const minutes = match[2];
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) hours = 12;

  const hh = hours < 10 ? `0${hours}` : `${hours}`;
  return `${hh}:${minutes} ${ampm}`;
}

/**
 * Gets day of week name from date string YYYY-MM-DD
 */
export function getDayOfWeekName(dateStr: string): string {
  if (!dateStr) return '';
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const [y, m, d] = parts.map(Number);
    const dt = new Date(y, m - 1, d);
    if (!isNaN(dt.getTime())) {
      return days[dt.getDay()];
    }
  }
  const dt = new Date(dateStr);
  if (!isNaN(dt.getTime())) {
    return days[dt.getDay()];
  }
  return '';
}

/**
 * Formats date in M/D/YYYY (Month/Day/FullYear) and displays day of week beside date.
 * Example: "8/1/2026 (Saturday)"
 */
export function formatDateWithDay(dateStr: string, weekday?: string): string {
  if (!dateStr) return '';
  const dayName = weekday || getDayOfWeekName(dateStr);
  const formattedDate = formatDateMDYYYY(dateStr);
  return dayName ? `${formattedDate} (${dayName})` : formattedDate;
}

/**
 * Parses various date formats (e.g. "8/1/26", "08/01/2026", "2026-08-01") to standard "YYYY-MM-DD"
 */
export function parseToYYYYMMDD(str: string): string {
  if (!str) return '';
  str = str.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  const parts = str.split(/[\/\.-]/);
  if (parts.length === 3) {
    let [p1, p2, p3] = parts.map(Number);
    if (!isNaN(p1) && !isNaN(p2) && !isNaN(p3)) {
      if (p1 > 1000) {
        // YYYY MM DD
        const y = p1;
        const m = String(p2).padStart(2, '0');
        const d = String(p3).padStart(2, '0');
        return `${y}-${m}-${d}`;
      } else {
        // M D YY or MM DD YYYY
        let m = p1;
        let d = p2;
        let y = p3;
        if (y < 100) y += 2000;
        const mm = String(m).padStart(2, '0');
        const dd = String(d).padStart(2, '0');
        return `${y}-${mm}-${dd}`;
      }
    }
  }
  return str;
}

/**
 * Generate dates array between startDate and endDate (inclusive)
 */
export function getDatesInRange(startDateStr: string, endDateStr: string): string[] {
  const normStart = parseToYYYYMMDD(startDateStr);
  const normEnd = parseToYYYYMMDD(endDateStr);

  const dates: string[] = [];
  const curr = new Date(normStart + 'T00:00:00');
  const end = new Date(normEnd + 'T00:00:00');

  if (isNaN(curr.getTime()) || isNaN(end.getTime()) || curr > end) {
    return dates;
  }

  let count = 0;
  while (curr <= end && count < 60) {
    const y = curr.getFullYear();
    const m = String(curr.getMonth() + 1).padStart(2, '0');
    const d = String(curr.getDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${d}`);
    curr.setDate(curr.getDate() + 1);
    count++;
  }
  return dates;
}

/**
 * Normalizes missing punches or lacking status
 */
export function normalizeLackingStatus(summary: AttendanceSummaryDaily): AttendanceSummaryDaily {
  if (summary.status === 'MISSING_IN' || summary.status === 'MISSING_OUT' || summary.status === 'LACKING') {
    const isMissingIn = summary.status === 'MISSING_IN' || !summary.firstIn;
    const isMissingOut = summary.status === 'MISSING_OUT' || !summary.lastOut;
    const lackingDesc = isMissingIn && isMissingOut
      ? 'Lacking: Missing both clock-in and clock-out punches'
      : isMissingIn
      ? 'Lacking: Missing Clock-In log'
      : 'Lacking: Missing Clock-Out log';

    return {
      ...summary,
      status: 'LACKING',
      anomalies: summary.anomalies.length > 0 ? summary.anomalies : [lackingDesc],
    };
  }
  return summary;
}

/**
 * Filters daily summaries strictly by date range, normalizes LACKING records,
 * and generates ABSENT daily records for active employees for dates in the range with no punches.
 */
export function getFilteredSummariesWithAbsents(
  allSummaries: AttendanceSummaryDaily[],
  usersList: User[],
  startDateStr?: string,
  endDateStr?: string,
  employeeIdFilter?: string
): AttendanceSummaryDaily[] {
  const normStart = startDateStr ? parseToYYYYMMDD(startDateStr) : '';
  const normEnd = endDateStr ? parseToYYYYMMDD(endDateStr) : '';

  // If no date range is set, return existing summaries with Lacking normalized
  if (!normStart || !normEnd) {
    const result = allSummaries.filter((s) => {
      if (employeeIdFilter && s.employeeId !== employeeIdFilter) return false;
      const sNormDate = parseToYYYYMMDD(s.date);
      if (normStart && sNormDate < normStart) return false;
      if (normEnd && sNormDate > normEnd) return false;
      return true;
    });

    return result.map(normalizeLackingStatus);
  }

  const datesInRange = getDatesInRange(normStart, normEnd);
  if (datesInRange.length === 0) {
    return allSummaries
      .filter((s) => {
        if (employeeIdFilter && s.employeeId !== employeeIdFilter) return false;
        const sNormDate = parseToYYYYMMDD(s.date);
        if (normStart && sNormDate < normStart) return false;
        if (normEnd && sNormDate > normEnd) return false;
        return true;
      })
      .map(normalizeLackingStatus);
  }

  // Active users to evaluate
  const activeUsers = usersList.filter(
    (u) => u.status === 'ACTIVE' && (!employeeIdFilter || u.employeeId === employeeIdFilter)
  );

  const existingMap = new Map<string, AttendanceSummaryDaily>();
  allSummaries.forEach((s) => {
    existingMap.set(`${s.employeeId}_${parseToYYYYMMDD(s.date)}`, s);
  });

  const finalSummaries: AttendanceSummaryDaily[] = [];

  for (const date of datesInRange) {
    const weekday = getDayOfWeekName(date);

    for (const user of activeUsers) {
      const key = `${user.employeeId}_${date}`;
      if (existingMap.has(key)) {
        finalSummaries.push(normalizeLackingStatus(existingMap.get(key)!));
      } else {
        // Generate ABSENT record for this day
        finalSummaries.push({
          id: `absent-${key}`,
          employeeId: user.employeeId,
          employeeName: user.name,
          department: user.department,
          date,
          weekday,
          firstIn: null,
          lastOut: null,
          totalBreakMinutes: 0,
          netHoursWorked: 0,
          undertimeHours: 8.0,
          overtimeHours: 0,
          ctoHoursEarned: 0,
          targetHours: 8.0,
          status: 'ABSENT',
          anomalies: ['Absent: No biometric punches recorded for this workday'],
          punches: [],
        });
      }
    }
  }

  return finalSummaries.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.employeeId.localeCompare(b.employeeId);
  });
}
