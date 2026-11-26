import {
  AttendanceStatus,
  AttendanceSummaryDaily,
  BiometricPunch,
  DisputeRequest,
  DisputeSummarySnapshot,
  User,
} from '../types';
import {
  calculateGrossHours,
  getDayOfWeekName,
  parseToYYYYMMDD,
} from './timeFormatters';

export type DisputeTouchedField = 'firstIn' | 'lastOut' | 'breakOut' | 'breakIn';

export function getDisputeTouchedFields(dispute: DisputeRequest): DisputeTouchedField[] {
  const cat = (dispute.category || dispute.type || '').toLowerCase();
  const fields: DisputeTouchedField[] = [];

  const isTimeInCat =
    cat.includes('time-in') ||
    cat.includes('time_in') ||
    cat.includes('time in') ||
    cat.includes('full shift') ||
    cat.includes('full_shift');
  const isTimeOutCat =
    cat.includes('time-out') ||
    cat.includes('time_out') ||
    cat.includes('time out') ||
    cat.includes('full shift') ||
    cat.includes('full_shift');
  const isBreakOutCat =
    cat.includes('break-out') || cat.includes('break_out') || cat.includes('break out');
  const isBreakInCat =
    cat.includes('break-in') || cat.includes('break_in') || cat.includes('break in');

  if (dispute.requestedClockIn || isTimeInCat) fields.push('firstIn');
  if (dispute.requestedClockOut || isTimeOutCat) fields.push('lastOut');
  if (dispute.requestedBreakOut || isBreakOutCat) fields.push('breakOut');
  if (dispute.requestedBreakIn || isBreakInCat) fields.push('breakIn');

  return fields;
}

export function capturePreApprovalSnapshot(
  existingSummary: AttendanceSummaryDaily | undefined,
  fallbackSummaryId: string
): DisputeSummarySnapshot {
  if (!existingSummary) {
    return {
      existed: false,
      summaryId: fallbackSummaryId,
    };
  }

  return {
    existed: true,
    summaryId: existingSummary.id,
    status: existingSummary.status,
    firstIn: existingSummary.firstIn ?? null,
    lastOut: existingSummary.lastOut ?? null,
    breakOut: existingSummary.breakOut ?? null,
    breakIn: existingSummary.breakIn ?? null,
    totalBreakMinutes: existingSummary.totalBreakMinutes ?? 60,
    netHoursWorked: existingSummary.netHoursWorked ?? 0,
    undertimeHours: existingSummary.undertimeHours ?? 0,
    overtimeHours: existingSummary.overtimeHours ?? 0,
    ctoHoursEarned: existingSummary.ctoHoursEarned ?? 0,
    anomalies: Array.isArray(existingSummary.anomalies)
      ? [...existingSummary.anomalies]
      : [],
    isAdjusted: Boolean(existingSummary.isAdjusted),
    adjustmentNote: existingSummary.adjustmentNote ?? null,
    adjustedFields: Array.isArray(existingSummary.adjustedFields)
      ? [...existingSummary.adjustedFields]
      : [],
  };
}

export function applyApprovedDisputeToSummary(
  dispute: DisputeRequest,
  existingSummary: AttendanceSummaryDaily | undefined,
  users: User[],
  adminNotes?: string,
  generatedSummaryId?: string
): AttendanceSummaryDaily {
  const empUser = users.find((u) => u.employeeId === dispute.employeeId);
  const empName = dispute.employeeName || empUser?.name || 'Staff Member';
  const dept = empUser?.department || dispute.department || 'Operations';
  const targetDate = parseToYYYYMMDD(dispute.date || (dispute as any).targetDate || '');

  const touchedFields = getDisputeTouchedFields(dispute);

  let reqIn = existingSummary?.firstIn || '';
  let reqOut = existingSummary?.lastOut || '';
  let reqBreakOut = existingSummary?.breakOut || '';
  let reqBreakIn = existingSummary?.breakIn || '';

  if (touchedFields.includes('firstIn')) {
    reqIn = dispute.requestedClockIn || reqIn || '08:00:00';
  }
  if (touchedFields.includes('lastOut')) {
    reqOut = dispute.requestedClockOut || reqOut || '17:00:00';
  }
  if (touchedFields.includes('breakOut')) {
    reqBreakOut = dispute.requestedBreakOut || reqBreakOut;
  }
  if (touchedFields.includes('breakIn')) {
    reqBreakIn = dispute.requestedBreakIn || reqBreakIn;
  }

  let reqHours = 0;
  let otHours = 0;
  let utHours = 0;
  let finalStatus: AttendanceStatus = 'ADJUSTED';

  if (reqIn && reqOut) {
    reqHours = dispute.requestedHours || calculateGrossHours(reqIn, reqOut) || 0;
    otHours = reqHours > 8.0 ? reqHours - 8.0 : 0;
    utHours = reqHours < 8.0 && reqHours > 0 ? 8.0 - reqHours : 0;
    finalStatus = otHours > 0 ? 'OVERTIME' : utHours > 0 ? 'UNDERTIME' : 'ADJUSTED';
  } else if (reqIn) {
    finalStatus = 'MISSING_OUT';
  } else if (reqOut) {
    finalStatus = 'MISSING_IN';
  } else {
    finalStatus = 'ABSENT';
  }

  const effectiveNotes = adminNotes ?? dispute.adminNotes ?? '';
  const reasonNote = `Time Adjustment (${dispute.category || dispute.type}) Approved: ${dispute.reason}${
    effectiveNotes ? ` (Notes: ${effectiveNotes})` : ''
  }`;

  if (existingSummary) {
    const combinedFields = Array.from(
      new Set([...(existingSummary.adjustedFields || []), ...touchedFields])
    );
    const filteredAnomalies = (existingSummary.anomalies || []).filter(
      (a) => !a.startsWith('Time Adjustment (') && !a.includes(' Approved:')
    );
    return {
      ...existingSummary,
      status: finalStatus,
      firstIn: reqIn || null,
      lastOut: reqOut || null,
      breakOut: reqBreakOut || existingSummary.breakOut || null,
      breakIn: reqBreakIn || existingSummary.breakIn || null,
      netHoursWorked: reqHours,
      undertimeHours: utHours,
      overtimeHours: otHours,
      anomalies: [reasonNote, ...filteredAnomalies],
      isAdjusted: true,
      adjustmentNote: dispute.reason,
      adjustedFields: combinedFields,
    };
  }

  const weekday = getDayOfWeekName(targetDate);
  return {
    id: generatedSummaryId || `summary-adj-${Date.now()}`,
    employeeId: dispute.employeeId,
    employeeName: empName,
    department: dept,
    ...(dispute.branch ? { branch: dispute.branch } : {}),
    date: targetDate,
    weekday: weekday || 'Workday',
    firstIn: reqIn || null,
    lastOut: reqOut || null,
    breakOut: reqBreakOut || null,
    breakIn: reqBreakIn || null,
    totalBreakMinutes: 60,
    netHoursWorked: reqHours,
    undertimeHours: utHours,
    overtimeHours: otHours,
    ctoHoursEarned: reqHours > 10.0 ? reqHours - 10.0 : 0,
    targetHours: 8.0,
    status: finalStatus,
    anomalies: [reasonNote],
    punches: [],
    isAdjusted: true,
    adjustmentNote: dispute.reason,
    adjustedFields: touchedFields,
  };
}

function extractTimePart(ts?: string | null): string | null {
  if (!ts) return null;
  const trimmed = ts.trim();
  if (trimmed.includes(' ')) {
    const parts = trimmed.split(' ');
    return parts[1] || trimmed;
  }
  return trimmed;
}

function recomputeBaselineFromPunches(
  existingSummary: AttendanceSummaryDaily,
  rawPunches: BiometricPunch[]
): AttendanceSummaryDaily {
  const sortedPunches = [...rawPunches].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const inPunches = sortedPunches.filter((p) => p.type === 'IN');
  const outPunches = sortedPunches.filter((p) => p.type === 'OUT');
  const bOutPunches = sortedPunches.filter((p) => p.type === 'BREAK_OUT');
  const bInPunches = sortedPunches.filter((p) => p.type === 'BREAK_IN');

  const firstInFull = inPunches.length > 0 ? inPunches[0].timestamp : null;
  let lastOutFull = outPunches.length > 0 ? outPunches[outPunches.length - 1].timestamp : null;
  if (!lastOutFull && sortedPunches.length > 1) {
    const lastPunch = sortedPunches[sortedPunches.length - 1];
    const [lastPunchDate] = lastPunch.timestamp.split(' ');
    if (lastPunchDate && lastPunchDate !== existingSummary.date) {
      lastOutFull = lastPunch.timestamp;
    }
  }

  let totalBreakMinutes = 60;
  if (bOutPunches.length > 0 && bInPunches.length > 0) {
    const bOutTime = new Date(bOutPunches[0].timestamp.replace(' ', 'T')).getTime();
    const bInTime = new Date(bInPunches[0].timestamp.replace(' ', 'T')).getTime();
    if (!Number.isNaN(bOutTime) && !Number.isNaN(bInTime) && bInTime > bOutTime) {
      totalBreakMinutes = Math.round((bInTime - bOutTime) / (1000 * 60));
    }
  }

  let netHoursWorked = 0;
  let undertimeHours = 0;
  const overtimeHours = 0;
  let ctoHoursEarned = 0;
  let status: AttendanceStatus = 'COMPLETE';
  const anomalies: string[] = [];

  const hasClockIn = Boolean(firstInFull);
  const hasClockOut = Boolean(lastOutFull);
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
      if (firstInFull && lastOutFull) {
        const inTime = new Date(firstInFull.replace(' ', 'T')).getTime();
        const outTime = new Date(lastOutFull.replace(' ', 'T')).getTime();
        if (!Number.isNaN(inTime) && !Number.isNaN(outTime) && outTime >= inTime) {
          netHoursWorked = Math.max(0, Math.round(((outTime - inTime) / (1000 * 60 * 60)) * 100) / 100);
        }
      }
    } else if (firstInFull && lastOutFull) {
      const inTime = new Date(firstInFull.replace(' ', 'T')).getTime();
      const outTime = new Date(lastOutFull.replace(' ', 'T')).getTime();
      const totalSpanHours = (outTime - inTime) / (1000 * 60 * 60);
      const breakHours = totalBreakMinutes / 60;
      netHoursWorked = Math.max(0, Math.round((totalSpanHours - breakHours) * 100) / 100);

      if (totalBreakMinutes > 60) {
        status = 'OVERBREAK';
        anomalies.push(
          `Overbreak: Break duration was ${totalBreakMinutes} mins (${(totalBreakMinutes / 60).toFixed(
            1
          )} hrs), exceeding 1-hour allowed limit.`
        );
      } else if (netHoursWorked < 8.0) {
        undertimeHours = Math.round((8.0 - netHoursWorked) * 100) / 100;
        status = 'UNDERTIME';
        anomalies.push(
          `Undertime: Worked ${netHoursWorked.toFixed(1)} hrs (-${undertimeHours.toFixed(1)}h deficit from 8.0h target)`
        );
      } else if (netHoursWorked > 10.0) {
        ctoHoursEarned = Math.round((netHoursWorked - 10.0) * 100) / 100;
        status = 'COMPLETE';
        anomalies.push(
          `Shift > 10h (Worked ${netHoursWorked.toFixed(1)} hrs): Eligible for +${ctoHoursEarned.toFixed(
            1
          )}h CTO Credit Request`
        );
      } else {
        ctoHoursEarned = 0;
        status = 'COMPLETE';
      }
    }
  }

  const cleanExisting = { ...existingSummary };
  delete cleanExisting.adjustmentNote;

  return {
    ...cleanExisting,
    firstIn: extractTimePart(firstInFull),
    breakOut: bOutPunches.length > 0 ? extractTimePart(bOutPunches[0].timestamp) : null,
    breakIn: bInPunches.length > 0 ? extractTimePart(bInPunches[0].timestamp) : null,
    lastOut: extractTimePart(lastOutFull),
    totalBreakMinutes,
    netHoursWorked,
    undertimeHours,
    overtimeHours,
    ctoHoursEarned,
    status,
    anomalies,
    punches: sortedPunches,
    isAdjusted: false,
    adjustedFields: [],
  };
}

function stripLegacyDisputeAdjustment(
  existingSummary: AttendanceSummaryDaily,
  disapprovedDispute: DisputeRequest
): AttendanceSummaryDaily {
  const touchedFields = getDisputeTouchedFields(disapprovedDispute);
  const nextFirstIn = touchedFields.includes('firstIn') ? null : existingSummary.firstIn ?? null;
  const nextLastOut = touchedFields.includes('lastOut') ? null : existingSummary.lastOut ?? null;
  const nextBreakOut = touchedFields.includes('breakOut') ? null : existingSummary.breakOut ?? null;
  const nextBreakIn = touchedFields.includes('breakIn') ? null : existingSummary.breakIn ?? null;

  const remainingAdjustedFields = (existingSummary.adjustedFields || []).filter(
    (f) => !touchedFields.includes(f as DisputeTouchedField)
  );

  const filteredAnomalies = (existingSummary.anomalies || []).filter(
    (a) => !a.startsWith('Time Adjustment (') && !a.includes(' Approved:')
  );

  let netHoursWorked = 0;
  let undertimeHours = 0;
  let overtimeHours = 0;
  let ctoHoursEarned = 0;
  let status: AttendanceStatus = 'ABSENT';

  if (nextFirstIn && nextLastOut) {
    netHoursWorked = calculateGrossHours(nextFirstIn, nextLastOut) || 0;
    overtimeHours = netHoursWorked > 8.0 ? Math.round((netHoursWorked - 8.0) * 100) / 100 : 0;
    undertimeHours =
      netHoursWorked < 8.0 && netHoursWorked > 0 ? Math.round((8.0 - netHoursWorked) * 100) / 100 : 0;
    ctoHoursEarned = netHoursWorked > 10.0 ? Math.round((netHoursWorked - 10.0) * 100) / 100 : 0;
    status = overtimeHours > 0 ? 'OVERTIME' : undertimeHours > 0 ? 'UNDERTIME' : 'COMPLETE';
  } else if (nextFirstIn || nextLastOut || nextBreakOut || nextBreakIn) {
    status = !nextFirstIn && nextLastOut ? 'MISSING_IN' : nextFirstIn && !nextLastOut ? 'MISSING_OUT' : 'LACKING';
    const missingParts: string[] = [];
    if (!nextFirstIn) missingParts.push('Clock-In');
    if (!nextBreakOut) missingParts.push('Break-Out');
    if (!nextBreakIn) missingParts.push('Break-In');
    if (!nextLastOut) missingParts.push('Clock-Out');
    if (missingParts.length > 0 && filteredAnomalies.length === 0) {
      filteredAnomalies.push(`Lacking punch logs: Missing ${missingParts.join(', ')}`);
    }
  } else {
    status = 'ABSENT';
    if (filteredAnomalies.length === 0) {
      filteredAnomalies.push('No attendance logs recorded');
    }
  }

  const nextSummary: AttendanceSummaryDaily = {
    ...existingSummary,
    firstIn: nextFirstIn,
    lastOut: nextLastOut,
    breakOut: nextBreakOut,
    breakIn: nextBreakIn,
    netHoursWorked,
    undertimeHours,
    overtimeHours,
    ctoHoursEarned,
    status,
    anomalies: filteredAnomalies,
    isAdjusted: remainingAdjustedFields.length > 0,
    adjustedFields: remainingAdjustedFields,
  };

  if (!nextSummary.isAdjusted) {
    delete nextSummary.adjustmentNote;
  }

  return nextSummary;
}

export type RevertSummaryResult =
  | { action: 'KEEP' }
  | { action: 'DELETE'; summaryId: string }
  | { action: 'UPDATE'; summary: AttendanceSummaryDaily };

export function revertSummaryAfterDisputeDisapproval(params: {
  targetDispute: DisputeRequest;
  remainingApprovedDisputesForDay: DisputeRequest[];
  existingSummary: AttendanceSummaryDaily | undefined;
  dayPunches: BiometricPunch[];
  users: User[];
}): RevertSummaryResult {
  const {
    targetDispute,
    remainingApprovedDisputesForDay,
    existingSummary,
    dayPunches,
    users,
  } = params;

  let baseline: AttendanceSummaryDaily | null = null;
  const snapshot = targetDispute.preApprovalSummarySnapshot;

  if (snapshot) {
    if (!snapshot.existed) {
      baseline = null;
    } else if (existingSummary) {
      const restored: AttendanceSummaryDaily = {
        ...existingSummary,
        status: snapshot.status || existingSummary.status,
        firstIn: snapshot.firstIn ?? null,
        lastOut: snapshot.lastOut ?? null,
        breakOut: snapshot.breakOut ?? null,
        breakIn: snapshot.breakIn ?? null,
        totalBreakMinutes: snapshot.totalBreakMinutes ?? existingSummary.totalBreakMinutes,
        netHoursWorked: snapshot.netHoursWorked ?? 0,
        undertimeHours: snapshot.undertimeHours ?? 0,
        overtimeHours: snapshot.overtimeHours ?? 0,
        ctoHoursEarned: snapshot.ctoHoursEarned ?? 0,
        anomalies: Array.isArray(snapshot.anomalies) ? [...snapshot.anomalies] : [],
        isAdjusted: Boolean(snapshot.isAdjusted),
        adjustedFields: Array.isArray(snapshot.adjustedFields) ? [...snapshot.adjustedFields] : [],
      };
      if (snapshot.adjustmentNote) {
        restored.adjustmentNote = snapshot.adjustmentNote;
      } else {
        delete restored.adjustmentNote;
      }
      baseline = restored;
    } else {
      baseline = null;
    }
  } else {
    if (!existingSummary) {
      return { action: 'KEEP' };
    }

    const effectivePunches =
      existingSummary.punches && existingSummary.punches.length > 0
        ? existingSummary.punches
        : dayPunches;

    if (existingSummary.id.startsWith('summary-adj-') && effectivePunches.length === 0) {
      baseline = null;
    } else if (effectivePunches.length > 0) {
      baseline = recomputeBaselineFromPunches(existingSummary, effectivePunches);
    } else {
      baseline = stripLegacyDisputeAdjustment(existingSummary, targetDispute);
    }
  }

  let finalSummary: AttendanceSummaryDaily | null = baseline;
  const sortedRemaining = [...remainingApprovedDisputesForDay].sort((a, b) =>
    (a.submittedAt || '').localeCompare(b.submittedAt || '')
  );

  for (const remDispute of sortedRemaining) {
    finalSummary = applyApprovedDisputeToSummary(
      remDispute,
      finalSummary || undefined,
      users,
      remDispute.adminNotes,
      existingSummary?.id
    );
  }

  if (!finalSummary) {
    if (existingSummary) {
      return { action: 'DELETE', summaryId: existingSummary.id };
    }
    return { action: 'KEEP' };
  }

  return { action: 'UPDATE', summary: finalSummary };
}
