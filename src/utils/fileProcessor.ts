import * as XLSX from 'xlsx';
import {
  AttendanceStatus,
  AttendanceSummaryDaily,
  BiometricPunch,
  RawBiometricRow,
  User,
} from '../types';

export interface FileValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  rawRowsCount: number;
  cleanedPunchesCount: number;
  summaries: AttendanceSummaryDaily[];
}

// Expected mandatory headers for biometric logs
export function cleanAndDeduplicateName(rawName: string): string {
  if (!rawName) return '';
  const trimmed = rawName.trim().replace(/\s+/g, ' ');
  const words = trimmed.split(' ');
  
  // Check if first half equals second half (e.g. "Maria Santos Maria Santos")
  if (words.length >= 2 && words.length % 2 === 0) {
    const half = words.length / 2;
    const firstHalf = words.slice(0, half).join(' ');
    const secondHalf = words.slice(half).join(' ');
    if (firstHalf.toLowerCase() === secondHalf.toLowerCase()) {
      return firstHalf;
    }
  }

  // Deduplicate adjacent word repetitions e.g. "Maria Maria Santos"
  const cleanWords: string[] = [];
  words.forEach((w) => {
    if (cleanWords.length === 0 || cleanWords[cleanWords.length - 1].toLowerCase() !== w.toLowerCase()) {
      cleanWords.push(w);
    }
  });

  return cleanWords.join(' ');
}

export function resolveEmployeeName(empId: string, rawNameFromFile?: string, usersList?: User[]): string {
  if (usersList && usersList.length > 0) {
    const numOnly = empId.replace(/\D/g, '');
    const matchedUser = usersList.find((u) => {
      const uNumOnly = u.employeeId.replace(/\D/g, '');
      return u.employeeId.toUpperCase() === empId.toUpperCase() || (numOnly && uNumOnly === numOnly);
    });
    if (matchedUser && matchedUser.name) {
      return cleanAndDeduplicateName(matchedUser.name);
    }
  }
  if (rawNameFromFile) {
    return cleanAndDeduplicateName(rawNameFromFile);
  }
  return `Employee ${empId}`;
}

export const REQUIRED_HEADERS = [
  'Employee ID',
  'First Name',
  'Date',
  'Weekday',
  'Clock In',
  'Clock Out',
  'Worked Hours',
];

export const ALL_EXPECTED_HEADERS = [
  'Employee ID',
  'First Name',
  'Date',
  'Weekday',
  'Break Duration',
  'Clock In',
  'Clock Out',
  'Total Hours',
  'Worked Hours',
  'Break Out',
  'Break In',
  'Break Hours',
  'Break',
  'Total OT',
];

/**
 * Standardize timestamp strings to YYYY-MM-DD HH:mm:ss
 */
export function formatTimestamp(dateStr: string, timeStr?: string): string {
  if (!dateStr) return '';
  
  // Handle Excel date serial numbers if passed as numbers
  let baseDateStr = String(dateStr).trim();
  let baseTimeStr = timeStr ? String(timeStr).trim() : '';

  // If time is already embedded in dateStr (e.g. "2026-08-04 08:30:00")
  if (baseDateStr.includes(' ') && baseDateStr.includes(':')) {
    const parts = baseDateStr.split(' ');
    baseDateStr = parts[0];
    baseTimeStr = parts[1];
  }

  // Standardize YYYY-MM-DD
  let formattedDate = baseDateStr;

  // 1. Check Excel serial date number (e.g. 46237)
  if (/^\d{5}(\.\d+)?$/.test(baseDateStr)) {
    const serial = parseFloat(baseDateStr);
    const utc_days = Math.floor(serial - 25569);
    const utc_value = utc_days * 86400;
    const date_info = new Date(utc_value * 1000);
    const y = date_info.getUTCFullYear();
    const m = String(date_info.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date_info.getUTCDate()).padStart(2, '0');
    formattedDate = `${y}-${m}-${d}`;
  } else {
    // 2. Try YYYY-MM-DD
    const dateMatchISO = baseDateStr.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (dateMatchISO) {
      const [, y, m, d] = dateMatchISO;
      formattedDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    } else {
      // 3. Try MM/DD/YYYY or M/D/YYYY
      const dateMatchUS = baseDateStr.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
      if (dateMatchUS) {
        let [, m, d, y] = dateMatchUS;
        if (y.length === 2) y = `20${y}`;
        formattedDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }
    }
  }

  if (!baseTimeStr) {
    return `${formattedDate} 00:00:00`;
  }

  // Standardize HH:mm:ss
  let formattedTime = baseTimeStr;
  const timeMatch = baseTimeStr.match(/(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
  if (timeMatch) {
    const [, h, m, s = '00'] = timeMatch;
    formattedTime = `${h.padStart(2, '0')}:${m.padStart(2, '0')}:${s.padStart(2, '0')}`;
  }

  return `${formattedDate} ${formattedTime}`;
}

/**
 * Parse date string and return time difference in seconds
 */
function getSecondsDifference(ts1: string, ts2: string): number {
  const d1 = new Date(ts1.replace(' ', 'T')).getTime();
  const d2 = new Date(ts2.replace(' ', 'T')).getTime();
  return Math.abs((d2 - d1) / 1000);
}

interface ShiftGroup {
  empId: string;
  name: string;
  date: string; // YYYY-MM-DD shift start date
  weekday: string;
  punches: BiometricPunch[];
}

/**
 * Groups raw/cleaned biometric punches into shift buckets.
 * Automatically handles overnight closing shifts (e.g. clock-out after midnight 12 AM - 7 AM).
 */
function groupPunchesIntoShiftBuckets(
  cleanedPunches: BiometricPunch[],
  usersList?: User[],
  nameLookupMap?: Map<string, string>
): ShiftGroup[] {
  const employeePunchesMap = new Map<string, BiometricPunch[]>();
  cleanedPunches.forEach((p) => {
    if (!employeePunchesMap.has(p.employeeId)) {
      employeePunchesMap.set(p.employeeId, []);
    }
    employeePunchesMap.get(p.employeeId)!.push(p);
  });

  const shiftGroups: ShiftGroup[] = [];
  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const getWeekdayStr = (dateStr: string) => {
    const dObj = new Date(dateStr);
    return isNaN(dObj.getTime()) ? 'Workday' : weekdays[dObj.getDay()];
  };

  employeePunchesMap.forEach((punches, empId) => {
    punches.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    const empName = resolveEmployeeName(empId, nameLookupMap?.get(empId), usersList);

    let currentGroup: ShiftGroup | null = null;

    punches.forEach((punch) => {
      const [pDate] = punch.timestamp.split(' ');
      const punchDateObj = new Date(punch.timestamp.replace(' ', 'T'));
      const hour = punchDateObj.getHours();

      if (!currentGroup) {
        currentGroup = {
          empId,
          name: empName,
          date: pDate,
          weekday: getWeekdayStr(pDate),
          punches: [punch],
        };
        return;
      }

      const firstPunchInGroup = currentGroup.punches[0];
      const firstPunchDateObj = new Date(firstPunchInGroup.timestamp.replace(' ', 'T'));
      const hoursDiff = (punchDateObj.getTime() - firstPunchDateObj.getTime()) / (1000 * 60 * 60);
      const groupStartDate = currentGroup.date;

      if (pDate === groupStartDate) {
        currentGroup.punches.push(punch);
      } else {
        // Punch is on a subsequent calendar date
        // Overnight shift criteria: punch occurs on next day within 16 hours of shift start AND before 07:00 AM
        const isNextDay = hoursDiff > 0 && hoursDiff <= 16;
        const isEarlyMorning = hour < 7;

        if (isNextDay && isEarlyMorning) {
          currentGroup.punches.push(punch);
        } else {
          shiftGroups.push(currentGroup);
          currentGroup = {
            empId,
            name: empName,
            date: pDate,
            weekday: getWeekdayStr(pDate),
            punches: [punch],
          };
        }
      }
    });

    if (currentGroup) {
      shiftGroups.push(currentGroup);
    }
  });

  return shiftGroups;
}

/**
 * Creates AttendanceSummaryDaily objects from grouped shift buckets.
 * Ensures strict column separation (no wrong column assignment for missing logs).
 */
function createDailySummariesFromShiftGroups(shiftGroups: ShiftGroup[]): AttendanceSummaryDaily[] {
  const summaries: AttendanceSummaryDaily[] = [];

  shiftGroups.forEach((group) => {
    const inPunches = group.punches.filter((p) => p.type === 'IN');
    const outPunches = group.punches.filter((p) => p.type === 'OUT');
    const bOutPunches = group.punches.filter((p) => p.type === 'BREAK_OUT');
    const bInPunches = group.punches.filter((p) => p.type === 'BREAK_IN');

    let firstIn: string | null = inPunches.length > 0 ? inPunches[0].timestamp : null;
    let lastOut: string | null = outPunches.length > 0 ? outPunches[outPunches.length - 1].timestamp : null;

    // Overnight clock-out fallback: if outPunches is empty but there's a punch on the next day, treat that last punch as lastOut
    if (!lastOut && group.punches.length > 1) {
      const lastPunch = group.punches[group.punches.length - 1];
      const [lastPunchDate] = lastPunch.timestamp.split(' ');
      if (lastPunchDate !== group.date) {
        lastOut = lastPunch.timestamp;
      }
    }

    let totalBreakMinutes = 60; // FBC standard 1-hour meal break default
    if (bOutPunches.length > 0 && bInPunches.length > 0) {
      const bOutTime = new Date(bOutPunches[0].timestamp.replace(' ', 'T')).getTime();
      const bInTime = new Date(bInPunches[0].timestamp.replace(' ', 'T')).getTime();
      if (bInTime > bOutTime) {
        totalBreakMinutes = Math.round((bInTime - bOutTime) / (1000 * 60));
      }
    }

    let netHoursWorked = 0;
    let undertimeHours = 0;
    let overtimeHours = 0;
    let ctoHoursEarned = 0;
    let status: AttendanceStatus = 'COMPLETE';
    const anomalies: string[] = [];

    const hasClockIn = Boolean(firstIn);
    const hasClockOut = Boolean(lastOut);
    const hasBreakOut = bOutPunches.length > 0;
    const hasBreakIn = bInPunches.length > 0;
    const isPresent = hasClockIn || hasClockOut || hasBreakOut || hasBreakIn;

    if (!isPresent) {
      status = 'ABSENT';
      anomalies.push('No attendance logs recorded');
    } else {
      const missingList: string[] = [];
      if (!hasClockIn) missingList.push('Clock-In');
      if (!hasBreakOut) missingList.push('Break-Out');
      if (!hasBreakIn) missingList.push('Break-In');
      if (!hasClockOut) missingList.push('Clock-Out');

      if (missingList.length > 0) {
        status = 'LACKING';
        anomalies.push(`Lacking punch logs: Missing ${missingList.join(', ')}`);
        if (firstIn && lastOut) {
          const inTime = new Date(firstIn.replace(' ', 'T')).getTime();
          const outTime = new Date(lastOut.replace(' ', 'T')).getTime();
          netHoursWorked = Math.max(0, Math.round(((outTime - inTime) / (1000 * 60 * 60)) * 100) / 100);
        }
      } else {
        const inTime = new Date(firstIn.replace(' ', 'T')).getTime();
        const outTime = new Date(lastOut.replace(' ', 'T')).getTime();
        const totalSpanHours = (outTime - inTime) / (1000 * 60 * 60);

        const breakHours = totalBreakMinutes / 60;
        netHoursWorked = Math.max(0, Math.round((totalSpanHours - breakHours) * 100) / 100);

        const TARGET_HOURS = 8.0;
        overtimeHours = 0;

        if (totalBreakMinutes > 60) {
          status = 'OVERBREAK';
          anomalies.push(`Overbreak: Break duration was ${totalBreakMinutes} mins (${(totalBreakMinutes / 60).toFixed(1)} hrs), exceeding 1-hour allowed limit.`);
        } else if (netHoursWorked < TARGET_HOURS) {
          undertimeHours = Math.round((TARGET_HOURS - netHoursWorked) * 100) / 100;
          status = 'UNDERTIME';
          anomalies.push(`Undertime: Worked ${netHoursWorked.toFixed(1)} hrs (-${undertimeHours.toFixed(1)}h deficit from 8.0h target)`);
        } else {
          if (netHoursWorked > 10.0) {
            ctoHoursEarned = Math.round((netHoursWorked - 10.0) * 100) / 100;
            status = 'COMPLETE';
            anomalies.push(`Shift > 10h (Worked ${netHoursWorked.toFixed(1)} hrs): Eligible for +${ctoHoursEarned.toFixed(1)}h CTO Credit Request`);
          } else {
            ctoHoursEarned = 0;
            status = 'COMPLETE';
          }
        }
      }
    }

    const firstInTime = firstIn ? (firstIn.split(' ')[1] || firstIn) : null;
    const breakOutTime = bOutPunches.length > 0 ? (bOutPunches[0].timestamp.split(' ')[1] || bOutPunches[0].timestamp) : null;
    const breakInTime = bInPunches.length > 0 ? (bInPunches[0].timestamp.split(' ')[1] || bInPunches[0].timestamp) : null;
    const lastOutTime = lastOut ? (lastOut.split(' ')[1] || lastOut) : null;

    summaries.push({
      id: `summary-${group.empId}-${group.date}`,
      employeeId: group.empId,
      employeeName: group.name,
      department: 'Store Operations',
      date: group.date,
      weekday: group.weekday,
      firstIn: firstInTime,
      breakOut: breakOutTime,
      breakIn: breakInTime,
      lastOut: lastOutTime,
      totalBreakMinutes,
      netHoursWorked,
      undertimeHours,
      overtimeHours,
      ctoHoursEarned,
      targetHours: 8.0,
      status,
      anomalies,
      punches: group.punches,
    });
  });

  summaries.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.employeeId.localeCompare(b.employeeId);
  });

  return summaries;
}

/**
 * Parse Excel File (.xls or .xlsx) and process biometric log data
 */
export async function parseAndCleanBiometricExcel(
  file: File,
  usersList?: User[]
): Promise<FileValidationResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });

        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          return resolve({
            isValid: false,
            errors: ['Workbook is empty or unreadable.'],
            warnings: [],
            rawRowsCount: 0,
            cleanedPunchesCount: 0,
            summaries: [],
          });
        }

        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert worksheet to a 2D array first to scan for the actual table header row
        // (handling ZKTeco exports with "Total Time Card" merged title in row 1)
        const rows2D = XLSX.utils.sheet_to_json<any[]>(worksheet, {
          header: 1,
          defval: '',
          raw: false,
        });

        if (!rows2D || rows2D.length === 0) {
          return resolve({
            isValid: false,
            errors: ['The selected Excel sheet contains no rows.'],
            warnings: [],
            rawRowsCount: 0,
            cleanedPunchesCount: 0,
            summaries: [],
          });
        }

        // Dynamically find which row index contains the real column headers
        let headerRowIndex = 0;

        for (let i = 0; i < Math.min(25, rows2D.length); i++) {
          const row = rows2D[i];
          if (!Array.isArray(row) || row.length === 0) continue;

          const rowTextJoined = row
            .map((cell) => String(cell || '').toLowerCase().replace(/[^a-z0-9]/g, ''))
            .join(' ');

          const hasEmpId =
            rowTextJoined.includes('employeeid') ||
            rowTextJoined.includes('empid') ||
            rowTextJoined.includes('id');
          const hasDate = rowTextJoined.includes('date');
          const hasClockIn =
            rowTextJoined.includes('clockin') || rowTextJoined.includes('in');
          const hasName =
            rowTextJoined.includes('firstname') || rowTextJoined.includes('name');

          // Check if this row contains table column headers
          if ((hasEmpId && (hasDate || hasClockIn)) || (hasName && hasDate && hasClockIn)) {
            headerRowIndex = i;
            break;
          }
        }

        // Convert worksheet to objects using the detected header row range
        const rawJson: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, {
          range: headerRowIndex,
          defval: '',
          raw: false,
        });

        if (rawJson.length === 0) {
          return resolve({
            isValid: false,
            errors: ['No data rows found below the header row.'],
            warnings: [],
            rawRowsCount: 0,
            cleanedPunchesCount: 0,
            summaries: [],
          });
        }

        // Validate Headers
        const firstRowKeys = Object.keys(rawJson[0]).map((k) => k.trim());
        const errors: string[] = [];
        const warnings: string[] = [];

        if (headerRowIndex > 0) {
          warnings.push(
            `Detected merged title header (e.g. "Total Time Card") at row 1. Automatically skipped ${headerRowIndex} title row(s) and parsed table headers from row ${
              headerRowIndex + 1
            }.`
          );
        }

        // Header mapping helper to normalize column names
        const findHeaderKey = (target: string): string | null => {
          const normTarget = target.toLowerCase().replace(/[^a-z0-9]/g, '');
          for (const key of firstRowKeys) {
            const normKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (normKey === normTarget || normKey.includes(normTarget)) {
              return key;
            }
          }
          return null;
        };

        const empIdKey = findHeaderKey('Employee ID') || findHeaderKey('Emp ID') || findHeaderKey('ID');
        const nameKey = findHeaderKey('First Name') || findHeaderKey('Name') || findHeaderKey('Employee Name');
        const dateKey = findHeaderKey('Date');
        const weekdayKey = findHeaderKey('Weekday');
        const clockInKey = findHeaderKey('Clock In') || findHeaderKey('In');
        const clockOutKey = findHeaderKey('Clock Out') || findHeaderKey('Out');
        const breakOutKey = findHeaderKey('Break Out');
        const breakInKey = findHeaderKey('Break In');
        const breakDurKey = findHeaderKey('Break Duration') || findHeaderKey('Break Hours') || findHeaderKey('Break');
        const workedHoursKey = findHeaderKey('Worked Hours') || findHeaderKey('Total Hours');

        if (!empIdKey) errors.push('Missing required header column: "Employee ID"');
        if (!dateKey) errors.push('Missing required header column: "Date"');
        if (!clockInKey && !clockOutKey) {
          errors.push('Missing time tracking headers: "Clock In" and/or "Clock Out"');
        }

        if (errors.length > 0) {
          return resolve({
            isValid: false,
            errors,
            warnings: [`Found headers: ${firstRowKeys.join(', ')}`],
            rawRowsCount: rawJson.length,
            cleanedPunchesCount: 0,
            summaries: [],
          });
        }

        // Parse individual punches
        const allPunches: BiometricPunch[] = [];
        const rawRowsMap = new Map<string, RawBiometricRow[]>();

        rawJson.forEach((row, idx) => {
          const empId = String(row[empIdKey!] || '').trim();
          
          // Filter out empty rows, repeat headers, or summary total rows
          if (
            !empId ||
            empId.toLowerCase().includes('total time card') ||
            empId.toLowerCase().includes('grand total') ||
            empId.toLowerCase() === 'total' ||
            empId.toLowerCase().includes('employee id')
          ) {
            return;
          }

          const dateVal = String(row[dateKey!] || '').trim();
          const clockInVal = String(row[clockInKey!] || '').trim();
          const clockOutVal = String(row[clockOutKey!] || '').trim();
          const breakOutVal = breakOutKey ? String(row[breakOutKey] || '').trim() : '';
          const breakInVal = breakInKey ? String(row[breakInKey] || '').trim() : '';

          if (clockInVal && clockInVal !== '--' && clockInVal !== 'N/A') {
            const ts = formatTimestamp(dateVal, clockInVal);
            if (ts) {
              allPunches.push({
                id: `punch-${idx}-in`,
                employeeId: empId,
                timestamp: ts,
                type: 'IN',
                deviceId: 'BIO-TERM-01',
              });
            }
          }

          if (breakOutVal && breakOutVal !== '--') {
            const ts = formatTimestamp(dateVal, breakOutVal);
            if (ts) {
              allPunches.push({
                id: `punch-${idx}-bout`,
                employeeId: empId,
                timestamp: ts,
                type: 'BREAK_OUT',
                deviceId: 'BIO-TERM-01',
              });
            }
          }

          if (breakInVal && breakInVal !== '--') {
            const ts = formatTimestamp(dateVal, breakInVal);
            if (ts) {
              allPunches.push({
                id: `punch-${idx}-bin`,
                employeeId: empId,
                timestamp: ts,
                type: 'BREAK_IN',
                deviceId: 'BIO-TERM-01',
              });
            }
          }

          if (clockOutVal && clockOutVal !== '--' && clockOutVal !== 'N/A') {
            const ts = formatTimestamp(dateVal, clockOutVal);
            if (ts) {
              allPunches.push({
                id: `punch-${idx}-out`,
                employeeId: empId,
                timestamp: ts,
                type: 'OUT',
                deviceId: 'BIO-TERM-01',
              });
            }
          }
        });

        // 1. DATA CLEANING RULE: Sort punches chronologically per employee, per day
        allPunches.sort((a, b) => {
          if (a.employeeId !== b.employeeId) {
            return a.employeeId.localeCompare(b.employeeId);
          }
          return a.timestamp.localeCompare(b.timestamp);
        });

        // 2. DATA CLEANING RULE: Remove duplicate punches (within a 60-second window for same type)
        const cleanedPunches: BiometricPunch[] = [];
        let duplicatesRemovedCount = 0;

        for (const punch of allPunches) {
          const lastPunch = cleanedPunches[cleanedPunches.length - 1];
          if (
            lastPunch &&
            lastPunch.employeeId === punch.employeeId &&
            lastPunch.type === punch.type &&
            getSecondsDifference(lastPunch.timestamp, punch.timestamp) < 60
          ) {
            duplicatesRemovedCount++;
            continue; // Skip duplicate punch within 60s
          }
          cleanedPunches.push(punch);
        }

        if (duplicatesRemovedCount > 0) {
          warnings.push(`Cleaned and removed ${duplicatesRemovedCount} duplicate biometric punch(es) detected within a 60-second window.`);
        }

        // 3. LOG PAIRING & ANOMALY DETECTION (Flexitime 8-Hour Logic & Overnight Support)
        const nameMap = new Map<string, string>();
        rawJson.forEach((row) => {
          const empId = String(row[empIdKey!] || '').trim();
          const name = nameKey ? String(row[nameKey] || '').trim() : '';
          if (empId && name) nameMap.set(empId, name);
        });

        const shiftGroups = groupPunchesIntoShiftBuckets(cleanedPunches, usersList, nameMap);
        const summaries = createDailySummariesFromShiftGroups(shiftGroups);

        resolve({
          isValid: true,
          errors: [],
          warnings,
          rawRowsCount: rawJson.length,
          cleanedPunchesCount: cleanedPunches.length,
          summaries,
        });

      } catch (err: any) {
        resolve({
          isValid: false,
          errors: [`Failed to parse Excel file: ${err.message || String(err)}`],
          warnings: [],
          rawRowsCount: 0,
          cleanedPunchesCount: 0,
          summaries: [],
        });
      }
    };

    reader.onerror = () => {
      resolve({
        isValid: false,
        errors: ['Error reading the uploaded file.'],
        warnings: [],
        rawRowsCount: 0,
        cleanedPunchesCount: 0,
        summaries: [],
      });
    };

    reader.readAsArrayBuffer(file);
  });
}

/**
 * Generate sample test Excel file matching FBC Restaurants Corp specs with merged Total Time Card header
 */
export function generateSampleBiometricExcel(): void {
  const aoaData = [
    ['Total Time Card', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
    [
      'Employee ID',
      'First Name',
      'Date',
      'Weekday',
      'Break Duration',
      'Clock In',
      'Clock Out',
      'Total Hours',
      'Worked Hours',
      'Break Out',
      'Break In',
      'Break Hours',
      'Break',
      'Total Hours',
      'Total OT',
    ],
    [
      'EMP-1001',
      'Maria Santos',
      '2026-08-03',
      'Monday',
      '60 mins',
      '08:00:00',
      '17:00:00',
      '9.00',
      '8.00',
      '12:00:00',
      '13:00:00',
      '1.00',
      '60m',
      '9.00',
      '0.00',
    ],
    [
      'EMP-1001',
      'Maria Santos',
      '2026-08-04',
      'Tuesday',
      '60 mins',
      '08:30:00',
      '18:30:00',
      '10.00',
      '9.00',
      '12:30:00',
      '13:30:00',
      '1.00',
      '60m',
      '10.00',
      '1.00',
    ],
    [
      'EMP-1002',
      'Juan Dela Cruz',
      '2026-08-03',
      'Monday',
      '60 mins',
      '09:00:00',
      '16:30:00',
      '7.50',
      '6.50',
      '12:00:00',
      '13:00:00',
      '1.00',
      '60m',
      '7.50',
      '0.00',
    ],
    [
      'EMP-1002',
      'Juan Dela Cruz',
      '2026-08-04',
      'Tuesday',
      '60 mins',
      '09:00:00',
      '--',
      '0.00',
      '0.00',
      '12:00:00',
      '13:00:00',
      '1.00',
      '60m',
      '0.00',
      '0.00',
    ],
    [
      'EMP-1003',
      'Elena Reyes',
      '2026-08-03',
      'Monday',
      '60 mins',
      '10:00:00',
      '19:00:00',
      '9.00',
      '8.00',
      '14:00:00',
      '15:00:00',
      '1.00',
      '60m',
      '9.00',
      '0.00',
    ],
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(aoaData);

  // Merge the title row across all 15 columns
  worksheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 14 } }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'ZKTeco Logs');

  XLSX.writeFile(workbook, 'ZKTeco_Biometric_Total_Time_Card_Sample.xlsx');
}

/**
 * Parse ZKTeco Old Version Biometric .DAT File (.dat or .txt)
 * Expected line format: ID Number | Name (optional) | Date | Time | Punch Code (0=Time In, 1=Time Out, 2=Break In, 3=Break Out)
 * Or standard ZK ATTLOG format: ID Number | Timestamp | Punch Code
 */
export async function parseAndCleanBiometricDat(
  file: File,
  usersList?: User[]
): Promise<FileValidationResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const textContent = (e.target?.result as string) || '';
        if (!textContent.trim()) {
          return resolve({
            isValid: false,
            errors: ['The selected .DAT file is empty.'],
            warnings: [],
            rawRowsCount: 0,
            cleanedPunchesCount: 0,
            summaries: [],
          });
        }

        const lines = textContent.split(/\r?\n/);
        const warnings: string[] = [];
        const errors: string[] = [];
        const rawPunches: BiometricPunch[] = [];

        // Build employee lookup maps for ID resolution
        const empMapByRawId = new Map<string, User>();
        if (usersList) {
          usersList.forEach((u) => {
            empMapByRawId.set(u.employeeId.toUpperCase(), u);
            // Numeric part, e.g. EMP-1001 -> 1001
            const numPart = u.employeeId.replace(/[^0-9]/g, '');
            if (numPart) {
              empMapByRawId.set(numPart, u);
              empMapByRawId.set(numPart.padStart(4, '0'), u);
            }
            if (u.pin) {
              empMapByRawId.set(u.pin, u);
            }
          });
        }

        let validLinesCount = 0;

        lines.forEach((line, lineIdx) => {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) return;

          // Try splitting by Tab, Comma, or Semicolon first, or fallback to space
          let parts: string[] = [];
          if (trimmed.includes('\t')) {
            parts = trimmed.split('\t').map((p) => p.trim()).filter(Boolean);
          } else if (trimmed.includes(',')) {
            parts = trimmed.split(',').map((p) => p.trim()).filter(Boolean);
          } else if (trimmed.includes(';')) {
            parts = trimmed.split(';').map((p) => p.trim()).filter(Boolean);
          } else {
            parts = trimmed.split(/\s+/).map((p) => p.trim()).filter(Boolean);
          }

          if (parts.length < 3) return; // Need at least ID, Date/Time, Punch Code

          // Check if header line
          const firstPartLower = parts[0].toLowerCase();
          if (
            firstPartLower === 'id' ||
            firstPartLower === 'empid' ||
            firstPartLower === 'employee id' ||
            firstPartLower === 'user id' ||
            firstPartLower === 'userid'
          ) {
            return;
          }

          // Extract Punch Code (last token or last numeric token)
          let punchCodeStr = parts[parts.length - 1];
          let type: 'IN' | 'OUT' | 'BREAK_IN' | 'BREAK_OUT' | null = null;

          if (punchCodeStr === '0' || punchCodeStr.toLowerCase() === 'in') {
            type = 'IN';
          } else if (punchCodeStr === '1' || punchCodeStr.toLowerCase() === 'out') {
            type = 'OUT';
          } else if (punchCodeStr === '2' || punchCodeStr.toLowerCase() === 'break_out' || punchCodeStr.toLowerCase() === 'bout') {
            type = 'BREAK_OUT';
          } else if (punchCodeStr === '3' || punchCodeStr.toLowerCase() === 'break_in' || punchCodeStr.toLowerCase() === 'bin') {
            type = 'BREAK_IN';
          } else {
            // Check second to last token if last token was device ID or status
            const altCode = parts[parts.length - 2];
            if (altCode === '0') type = 'IN';
            else if (altCode === '1') type = 'OUT';
            else if (altCode === '2') type = 'BREAK_OUT';
            else if (altCode === '3') type = 'BREAK_IN';
          }

          if (!type) {
            // Default to IN if unable to parse punch code
            type = 'IN';
          }

          // Raw ID extraction
          const rawEmpId = parts[0];
          let resolvedEmpId = rawEmpId;
          let resolvedName = '';

          const matchedUser = empMapByRawId.get(rawEmpId.toUpperCase());
          if (matchedUser) {
            resolvedEmpId = matchedUser.employeeId;
            resolvedName = matchedUser.name;
          } else {
            // If numeric e.g. 1001, default to EMP-1001
            if (/^\d+$/.test(rawEmpId)) {
              resolvedEmpId = `EMP-${rawEmpId}`;
            }
          }

          // Date and Time extraction
          // Look for date pattern (YYYY-MM-DD or MM/DD/YYYY or YYYY/MM/DD) and time pattern (HH:mm:ss or HH:mm)
          let dateStr = '';
          let timeStr = '';

          for (let i = 1; i < parts.length; i++) {
            const token = parts[i];
            if (!dateStr && (/\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(token) || /\d{1,2}[-/]\d{1,2}[-/]\d{4}/.test(token))) {
              dateStr = token;
            } else if (!timeStr && /\d{1,2}:\d{2}/.test(token)) {
              timeStr = token;
            } else if (!dateStr && token.includes(' ') && /\d{4}/.test(token)) {
              const dtParts = token.split(' ');
              dateStr = dtParts[0];
              timeStr = dtParts[1] || '';
            } else if (!resolvedName && i === 1 && !/\d/.test(token)) {
              resolvedName = token;
            } else if (!resolvedName && i === 2 && !/\d/.test(token)) {
              resolvedName = `${parts[1]} ${token}`;
            }
          }

          if (!dateStr) {
            // Fallback: try today's date if date is missing
            dateStr = new Date().toISOString().split('T')[0];
          }

          const formattedTs = formatTimestamp(dateStr, timeStr || '08:00:00');
          if (formattedTs) {
            validLinesCount++;
            rawPunches.push({
              id: `dat-punch-${lineIdx}`,
              employeeId: resolvedEmpId,
              timestamp: formattedTs,
              type,
              deviceId: 'ZKTeco-DAT-OldModel',
            });
          }
        });

        if (rawPunches.length === 0) {
          return resolve({
            isValid: false,
            errors: ['No valid biometric punch lines found in .DAT file.'],
            warnings: [],
            rawRowsCount: lines.length,
            cleanedPunchesCount: 0,
            summaries: [],
          });
        }

        // 1. Sort punches chronologically per employee
        rawPunches.sort((a, b) => {
          if (a.employeeId !== b.employeeId) {
            return a.employeeId.localeCompare(b.employeeId);
          }
          return a.timestamp.localeCompare(b.timestamp);
        });

        // 2. Remove duplicates within 60s window
        const cleanedPunches: BiometricPunch[] = [];
        let duplicatesRemovedCount = 0;

        for (const punch of rawPunches) {
          const lastPunch = cleanedPunches[cleanedPunches.length - 1];
          if (
            lastPunch &&
            lastPunch.employeeId === punch.employeeId &&
            lastPunch.type === punch.type &&
            getSecondsDifference(lastPunch.timestamp, punch.timestamp) < 60
          ) {
            duplicatesRemovedCount++;
            continue;
          }
          cleanedPunches.push(punch);
        }

        if (duplicatesRemovedCount > 0) {
          warnings.push(`Cleaned and removed ${duplicatesRemovedCount} duplicate .DAT punch(es) detected within a 60-second window.`);
        }

        // 3. Group punches by employee & shift for Daily Summary generation (supporting overnight closing shifts)
        const userNameMap = new Map<string, string>();
        if (usersList) {
          usersList.forEach((u) => userNameMap.set(u.employeeId, u.name));
        }

        const shiftGroups = groupPunchesIntoShiftBuckets(cleanedPunches, usersList, userNameMap);
        const summaries = createDailySummariesFromShiftGroups(shiftGroups);

        resolve({
          isValid: true,
          errors: [],
          warnings,
          rawRowsCount: validLinesCount,
          cleanedPunchesCount: cleanedPunches.length,
          summaries,
        });

      } catch (err: any) {
        resolve({
          isValid: false,
          errors: [`Failed to parse .DAT file: ${err.message || String(err)}`],
          warnings: [],
          rawRowsCount: 0,
          cleanedPunchesCount: 0,
          summaries: [],
        });
      }
    };

    reader.onerror = () => {
      resolve({
        isValid: false,
        errors: ['Error reading the uploaded .DAT file.'],
        warnings: [],
        rawRowsCount: 0,
        cleanedPunchesCount: 0,
        summaries: [],
      });
    };

    reader.readAsText(file);
  });
}

/**
 * Generate sample ZKTeco Old Version .DAT file
 * Columns: ID Number | Name | Date | Time | Punch Code (0=Time In, 1=Time Out, 2=Break Out, 3=Break In)
 */
export function generateSampleBiometricDat(): void {
  const datLines = [
    '# ZKTeco Old Version Biometric ATTLOG Export',
    '# Format: ID Number\tName\tDate\tTime\tPunch Code (0=Time In, 1=Time Out, 2=Break Out, 3=Break In)',
    '1001\tMaria Santos\t2026-08-03\t08:00:00\t0',
    '1001\tMaria Santos\t2026-08-03\t12:00:00\t2',
    '1001\tMaria Santos\t2026-08-03\t13:00:00\t3',
    '1001\tMaria Santos\t2026-08-03\t17:00:00\t1',
    '1002\tJuan Dela Cruz\t2026-08-03\t09:00:00\t0',
    '1002\tJuan Dela Cruz\t2026-08-03\t12:00:00\t2',
    '1002\tJuan Dela Cruz\t2026-08-03\t13:25:00\t3',
    '1002\tJuan Dela Cruz\t2026-08-03\t17:25:00\t1',
    '1003\tElena Reyes\t2026-08-03\t10:00:00\t0',
    '1003\tElena Reyes\t2026-08-03\t14:00:00\t2',
    '1003\tElena Reyes\t2026-08-03\t15:00:00\t3',
    '1003\tElena Reyes\t2026-08-03\t19:00:00\t1',
    '1001\tMaria Santos\t2026-08-04\t07:30:00\t0',
    '1001\tMaria Santos\t2026-08-04\t12:00:00\t2',
    '1001\tMaria Santos\t2026-08-04\t13:00:00\t3',
    '1001\tMaria Santos\t2026-08-04\t18:30:00\t1',
  ];

  const content = datLines.join('\r\n');
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = 'ZKTeco_Old_ATTLOG_Sample.dat';
  document.body.appendChild(link);
  link.click();

  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

