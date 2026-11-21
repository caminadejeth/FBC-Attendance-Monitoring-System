import { AttendanceSummaryDaily, DisputeRequest, User } from '../types';
import {
  formatDateMDYYYY,
  formatTime12Hr,
  getBreakTimes,
  resolveSummaryBranch,
} from './timeFormatters';
import { getAdjustedDisplayTime, isFieldAdjusted } from './adjustmentHelper';

export interface DtrPrintPayload {
  user: User;
  users: User[];
  logs: AttendanceSummaryDaily[];
  disputes: DisputeRequest[];
  totalDaysWorked: number;
  totalNetHours: number;
  totalOvertimeHours: number;
  totalUndertimeHours: number;
}

const escapeHtml = (value: string | number | undefined | null): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

interface PreparedDtrRow {
  dateLabel: string;
  weekday: string;
  branch: string;
  clockIn: string;
  clockInAdj: boolean;
  clockInMissing: boolean;
  breakOut: string;
  breakOutAdj: boolean;
  breakOutMissing: boolean;
  breakIn: string;
  breakInAdj: boolean;
  breakInMissing: boolean;
  clockOut: string;
  clockOutAdj: boolean;
  clockOutMissing: boolean;
  workedHrs: string;
  undertime: string;
  overtime: string;
  statusLabel: string;
  statusTone: 'absent' | 'missing' | 'complete' | 'overtime' | 'undertime' | 'other';
}

export function prepareDtrRows(payload: DtrPrintPayload): PreparedDtrRow[] {
  const { logs, users, user, disputes } = payload;
  return logs.map((s) => {
    const breakTimes = getBreakTimes(s.punches);
    const isAbsent = s.status === 'ABSENT';
    const hasClockIn = Boolean(s.firstIn && s.firstIn !== 'No Data' && s.firstIn !== '--');
    const hasClockOut = Boolean(s.lastOut && s.lastOut !== 'No Data' && s.lastOut !== '--');
    const hasBreakOut = Boolean(
      breakTimes.breakOut && breakTimes.breakOut !== 'No Data' && breakTimes.breakOut !== '--'
    );
    const hasBreakIn = Boolean(
      breakTimes.breakIn && breakTimes.breakIn !== 'No Data' && breakTimes.breakIn !== '--'
    );

    const missingPunches: string[] = [];
    if (!isAbsent) {
      if (!hasClockIn) missingPunches.push('Clock-In');
      if (!hasBreakOut) missingPunches.push('Break-Out');
      if (!hasBreakIn) missingPunches.push('Break-In');
      if (!hasClockOut) missingPunches.push('Clock-Out');
    }

    const clockInAdj = isFieldAdjusted(s, 'firstIn', disputes);
    const breakOutAdj = isFieldAdjusted(s, 'breakOut', disputes);
    const breakInAdj = isFieldAdjusted(s, 'breakIn', disputes);
    const clockOutAdj = isFieldAdjusted(s, 'lastOut', disputes);

    const rawClockIn = getAdjustedDisplayTime(s, 'firstIn', disputes) || s.firstIn;
    const rawBreakOut = getAdjustedDisplayTime(s, 'breakOut', disputes) || s.breakOut;
    const rawBreakIn = getAdjustedDisplayTime(s, 'breakIn', disputes) || s.breakIn;
    const rawClockOut = getAdjustedDisplayTime(s, 'lastOut', disputes) || s.lastOut;

    const clockInStr = clockInAdj
      ? rawClockIn
        ? formatTime12Hr(rawClockIn)
        : '08:00 AM'
      : rawClockIn
      ? formatTime12Hr(rawClockIn)
      : 'No Data';

    const breakOutStr = breakOutAdj
      ? rawBreakOut
        ? formatTime12Hr(rawBreakOut)
        : hasBreakOut
        ? breakTimes.breakOut
        : '12:00 PM'
      : rawBreakOut
      ? formatTime12Hr(rawBreakOut)
      : hasBreakOut
      ? breakTimes.breakOut
      : 'No Data';

    const breakInStr = breakInAdj
      ? rawBreakIn
        ? formatTime12Hr(rawBreakIn)
        : hasBreakIn
        ? breakTimes.breakIn
        : '01:00 PM'
      : rawBreakIn
      ? formatTime12Hr(rawBreakIn)
      : hasBreakIn
      ? breakTimes.breakIn
      : 'No Data';

    const clockOutStr = clockOutAdj
      ? rawClockOut
        ? formatTime12Hr(rawClockOut)
        : '05:00 PM'
      : rawClockOut
      ? formatTime12Hr(rawClockOut)
      : 'No Data';

    let statusLabel: string = s.status;
    let statusTone: PreparedDtrRow['statusTone'] = 'other';
    if (isAbsent) {
      statusLabel = 'Absent';
      statusTone = 'absent';
    } else if (missingPunches.length > 0) {
      statusLabel = `Missing ${missingPunches.join(', ')}`;
      statusTone = 'missing';
    } else if (s.status === 'COMPLETE') {
      statusLabel = 'Complete';
      statusTone = 'complete';
    } else if (s.status === 'OVERTIME') {
      statusLabel = `Overtime (+${(Number(s.overtimeHours) || 0).toFixed(1)}h)`;
      statusTone = 'overtime';
    } else if (s.status === 'UNDERTIME') {
      statusLabel = `Undertime (-${(Number(s.undertimeHours) || 0).toFixed(1)}h)`;
      statusTone = 'undertime';
    }

    return {
      dateLabel: formatDateMDYYYY(s.date),
      weekday: s.weekday,
      branch: resolveSummaryBranch(s, users, user),
      clockIn: clockInStr,
      clockInAdj,
      clockInMissing: !clockInAdj && !rawClockIn,
      breakOut: breakOutStr,
      breakOutAdj,
      breakOutMissing: !breakOutAdj && !rawBreakOut && !hasBreakOut,
      breakIn: breakInStr,
      breakInAdj,
      breakInMissing: !breakInAdj && !rawBreakIn && !hasBreakIn,
      clockOut: clockOutStr,
      clockOutAdj,
      clockOutMissing: !clockOutAdj && !rawClockOut,
      workedHrs: Number(s.netHoursWorked) ? `${Number(s.netHoursWorked).toFixed(1)} hrs` : '0.0 hrs',
      undertime: (Number(s.undertimeHours) || 0) > 0 ? `-${(Number(s.undertimeHours) || 0).toFixed(1)}h` : '0.0h',
      overtime: (Number(s.overtimeHours) || 0) > 0 ? `+${(Number(s.overtimeHours) || 0).toFixed(1)}h` : '0.0h',
      statusLabel,
      statusTone,
    };
  });
}

export function buildSinglePageDtrHtml(payload: DtrPrintPayload): string {
  const rows = prepareDtrRows(payload);
  const generatedDate = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  // Tighten cell height dynamically for larger date ranges so everything stays 1 page
  const isDense = rows.length > 18;
  const isUltraDense = rows.length > 26;
  const cellPad = isUltraDense ? '2px 4px' : isDense ? '3px 4px' : '4px 5px';
  const fontSize = isUltraDense ? '8px' : isDense ? '8.5px' : '9.5px';

  const statusBadgeStyle = (tone: PreparedDtrRow['statusTone']) => {
    switch (tone) {
      case 'absent':
        return 'background:#ffe4e6;color:#881337;border:1px solid #fda4af;';
      case 'missing':
        return 'background:#fef3c7;color:#78350f;border:1px solid #fbbf24;';
      case 'complete':
        return 'background:#d1fae5;color:#064e3b;border:1px solid #6ee7b7;';
      case 'overtime':
        return 'background:#e0f2fe;color:#0c4a6e;border:1px solid #7dd3fc;';
      case 'undertime':
        return 'background:#fef3c7;color:#92400e;border:1px solid #fcd34d;';
      default:
        return 'background:#ffedd5;color:#7c2d12;border:1px solid #fdba74;';
    }
  };

  const rowsHtml =
    rows.length === 0
      ? `<tr><td colspan="11" style="text-align:center;padding:18px;color:#71717a;font-style:italic;">No attendance logs recorded for this employee during selected date range.</td></tr>`
      : rows
          .map(
            (r) => `
          <tr>
            <td style="font-family:monospace;font-weight:700;white-space:nowrap;">${escapeHtml(r.dateLabel)}</td>
            <td style="font-weight:700;color:#3f3f46;white-space:nowrap;">${escapeHtml(r.weekday)}</td>
            <td style="white-space:nowrap;"><span style="background:#f4f4f5;border:1px solid #d4d4d8;padding:1px 4px;border-radius:3px;font-weight:700;">${escapeHtml(r.branch)}</span></td>
            <td style="text-align:center;font-family:monospace;font-weight:700;white-space:nowrap;${
              r.clockInAdj
                ? 'color:#065f46;background:#ecfdf5;'
                : r.clockInMissing
                ? 'color:#dc2626;'
                : ''
            }">${escapeHtml(r.clockIn)}${r.clockInAdj ? ' <span style="background:#047857;color:#fff;padding:0 3px;border-radius:2px;font-size:7px;">ADJ</span>' : ''}</td>
            <td style="text-align:center;font-family:monospace;white-space:nowrap;${
              r.breakOutAdj
                ? 'color:#065f46;background:#ecfdf5;font-weight:700;'
                : r.breakOutMissing
                ? 'color:#9ca3af;font-weight:700;'
                : ''
            }">${escapeHtml(r.breakOut)}${r.breakOutAdj ? ' <span style="background:#047857;color:#fff;padding:0 3px;border-radius:2px;font-size:7px;">ADJ</span>' : ''}</td>
            <td style="text-align:center;font-family:monospace;white-space:nowrap;${
              r.breakInAdj
                ? 'color:#065f46;background:#ecfdf5;font-weight:700;'
                : r.breakInMissing
                ? 'color:#9ca3af;font-weight:700;'
                : ''
            }">${escapeHtml(r.breakIn)}${r.breakInAdj ? ' <span style="background:#047857;color:#fff;padding:0 3px;border-radius:2px;font-size:7px;">ADJ</span>' : ''}</td>
            <td style="text-align:center;font-family:monospace;font-weight:700;white-space:nowrap;${
              r.clockOutAdj
                ? 'color:#065f46;background:#ecfdf5;'
                : r.clockOutMissing
                ? 'color:#dc2626;'
                : ''
            }">${escapeHtml(r.clockOut)}${r.clockOutAdj ? ' <span style="background:#047857;color:#fff;padding:0 3px;border-radius:2px;font-size:7px;">ADJ</span>' : ''}</td>
            <td style="text-align:center;font-family:monospace;font-weight:900;white-space:nowrap;">${escapeHtml(r.workedHrs)}</td>
            <td style="text-align:center;font-family:monospace;font-weight:700;color:#92400e;white-space:nowrap;">${escapeHtml(r.undertime)}</td>
            <td style="text-align:center;font-family:monospace;font-weight:700;color:#075985;white-space:nowrap;">${escapeHtml(r.overtime)}</td>
            <td style="white-space:nowrap;"><span style="display:inline-block;padding:1px 4px;border-radius:3px;font-weight:800;font-size:7.5px;${statusBadgeStyle(
              r.statusTone
            )}">${escapeHtml(r.statusLabel)}</span></td>
          </tr>
        `
          )
          .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>DTR_${escapeHtml(payload.user.employeeId)}_${escapeHtml(payload.user.name)}</title>
  <style>
    @page {
      size: letter portrait;
      margin: 5mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    html, body {
      background: #ffffff;
      color: #18181b;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .sheet {
      width: 100%;
      border: 1.5px solid #18181b;
      border-radius: 6px;
      padding: 8px 10px;
      background: #ffffff;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1.5px solid #18181b;
      padding-bottom: 6px;
      margin-bottom: 6px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .logo {
      width: 32px;
      height: 32px;
      border-radius: 6px;
      background: #fbbf24;
      color: #09090b;
      border: 1.5px solid #09090b;
      font-weight: 900;
      font-size: 13px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .company {
      font-size: 13px;
      font-weight: 900;
      text-transform: uppercase;
      color: #09090b;
      line-height: 1.15;
    }
    .doc-title {
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      color: #78350f;
      letter-spacing: 0.4px;
    }
    .header-right {
      text-align: right;
      font-family: monospace;
    }
    .verified-pill {
      display: inline-block;
      background: #09090b;
      color: #fbbf24;
      font-weight: 800;
      font-size: 8.5px;
      padding: 2px 7px;
      border-radius: 4px;
      text-transform: uppercase;
    }
    .gen-date {
      font-size: 8.5px;
      color: #52525b;
      margin-top: 2px;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 8px;
      background: #f7f8f5;
      border: 1px solid #18181b;
      border-radius: 6px;
      padding: 6px 8px;
      margin-bottom: 6px;
    }
    .meta-label {
      display: block;
      font-size: 8px;
      font-weight: 900;
      text-transform: uppercase;
      color: #52525b;
    }
    .meta-val {
      display: block;
      font-size: 10.5px;
      font-weight: 900;
      color: #09090b;
      margin-top: 1px;
    }
    .table-wrap {
      border: 1px solid #18181b;
      border-radius: 6px;
      overflow: hidden;
      margin-bottom: 6px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: ${fontSize};
      line-height: 1.15;
    }
    thead tr {
      background: #18181b;
      color: #fbbf24;
      text-transform: uppercase;
      font-size: 8px;
      font-weight: 900;
    }
    th, td {
      padding: ${cellPad};
      border-bottom: 1px solid #e4e4e7;
    }
    tbody tr:last-child td {
      border-bottom: none;
    }
    .footer-grid {
      display: grid;
      grid-template-columns: 5fr 7fr;
      gap: 8px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .summary-box {
      background: #f7f8f5;
      border: 1px solid #18181b;
      border-radius: 6px;
      padding: 6px 8px;
    }
    .summary-title {
      font-size: 9px;
      font-weight: 900;
      text-transform: uppercase;
      border-bottom: 1px solid #d4d4d8;
      padding-bottom: 3px;
      margin-bottom: 5px;
    }
    .summary-cards {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4px;
    }
    .summary-card {
      background: #ffffff;
      border: 1px solid #d4d4d8;
      border-radius: 4px;
      padding: 4px 6px;
    }
    .summary-card-label {
      display: block;
      font-size: 7.5px;
      font-weight: 800;
      text-transform: uppercase;
      color: #71717a;
    }
    .summary-card-val {
      display: block;
      font-size: 10.5px;
      font-weight: 900;
      color: #09090b;
    }
    .oath-box {
      border: 1px solid #18181b;
      border-radius: 6px;
      padding: 6px 10px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .oath-text {
      font-style: italic;
      font-size: 9px;
      color: #27272a;
      text-align: center;
      line-height: 1.3;
    }
    .sig-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      text-align: center;
      margin-top: 6px;
    }
    .sig-line {
      border-bottom: 1.5px solid #18181b;
      height: 16px;
      margin-bottom: 2px;
    }
    .sig-name {
      font-size: 8.5px;
      font-weight: 900;
      text-transform: uppercase;
      display: block;
    }
    .sig-role {
      font-size: 7.5px;
      color: #71717a;
      text-transform: uppercase;
      font-weight: 700;
      display: block;
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="header">
      <div class="brand">
        <div class="logo">YC</div>
        <div>
          <div class="company">FBC RESTAURANTS CORP. / YELLOW CAB PIZZA CO.</div>
          <div class="doc-title">DAILY TIME RECORD (DTR) SHEET</div>
        </div>
      </div>
      <div class="header-right">
        <div class="verified-pill">Biometric ZKTeco Verified Log</div>
        <div class="gen-date">Generated: ${escapeHtml(generatedDate)}</div>
      </div>
    </div>

    <div class="meta-grid">
      <div>
        <span class="meta-label">Employee Name:</span>
        <span class="meta-val" style="text-transform:uppercase;">${escapeHtml(payload.user.name)}</span>
      </div>
      <div>
        <span class="meta-label">Employee ID:</span>
        <span class="meta-val" style="font-family:monospace;color:#78350f;">${escapeHtml(payload.user.employeeId)}</span>
      </div>
      <div>
        <span class="meta-label">Branch / Department:</span>
        <span class="meta-val">${escapeHtml(payload.user.department || payload.user.branch || 'Main Branch')}</span>
      </div>
      <div>
        <span class="meta-label">Official Shift Target:</span>
        <span class="meta-val">8.0 Hrs / Flexitime</span>
      </div>
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th style="text-align:left;">Date</th>
            <th style="text-align:left;">Day</th>
            <th style="text-align:left;">Branch</th>
            <th style="text-align:center;">Clock In</th>
            <th style="text-align:center;">Break Out</th>
            <th style="text-align:center;">Break In</th>
            <th style="text-align:center;">Clock Out</th>
            <th style="text-align:center;">Worked Hrs</th>
            <th style="text-align:center;">Undertime</th>
            <th style="text-align:center;">Overtime</th>
            <th style="text-align:left;">Status / Remarks</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </div>

    <div class="footer-grid">
      <div class="summary-box">
        <div class="summary-title">Period Attendance Summary</div>
        <div class="summary-cards">
          <div class="summary-card">
            <span class="summary-card-label">Days Worked</span>
            <span class="summary-card-val">${payload.totalDaysWorked} Days</span>
          </div>
          <div class="summary-card">
            <span class="summary-card-label">Total Net Hours</span>
            <span class="summary-card-val" style="color:#065f46;">${payload.totalNetHours.toFixed(1)} hrs</span>
          </div>
          <div class="summary-card">
            <span class="summary-card-label">Total Overtime</span>
            <span class="summary-card-val" style="color:#075985;">+${payload.totalOvertimeHours.toFixed(1)} hrs</span>
          </div>
          <div class="summary-card">
            <span class="summary-card-label">Undertime Deficit</span>
            <span class="summary-card-val" style="color:#92400e;">-${payload.totalUndertimeHours.toFixed(1)} hrs</span>
          </div>
        </div>
      </div>

      <div class="oath-box">
        <p class="oath-text">
          "I CERTIFY on my honor that the above is a true and correct record of the hours of work performed,
          record of which was made daily at the time of arrival and departure from office."
        </p>
        <div class="sig-grid">
          <div>
            <div class="sig-line"></div>
            <span class="sig-name">${escapeHtml(payload.user.name)}</span>
            <span class="sig-role">Employee Signature</span>
          </div>
          <div>
            <div class="sig-line"></div>
            <span class="sig-name">Payroll / Store Manager</span>
            <span class="sig-role">Verified as to Prescribed Office Hours</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Prints a standalone 1-page DTR HTML document via an off-screen iframe with real page dimensions.
 * Returns true if the browser triggered printing (beforeprint fired or print dialog blocked JS execution),
 * or false if printing was suppressed (e.g. inside a sandboxed preview iframe).
 */
export function printSinglePageDtrDocument(html: string): boolean {
  const existing = document.getElementById('fbc-dtr-print-frame');
  if (existing) existing.remove();

  const frame = document.createElement('iframe');
  frame.id = 'fbc-dtr-print-frame';
  frame.style.position = 'fixed';
  frame.style.left = '-10000px';
  frame.style.top = '0';
  frame.style.width = '816px';
  frame.style.height = '1056px';
  frame.style.border = '0';
  frame.style.opacity = '0';
  frame.style.pointerEvents = 'none';
  document.body.appendChild(frame);

  const win = frame.contentWindow;
  const doc = win?.document;
  if (!win || !doc) {
    frame.remove();
    return false;
  }

  doc.open();
  doc.write(html);
  doc.close();

  let beforePrintFired = false;
  const onBeforePrint = () => {
    beforePrintFired = true;
  };
  win.addEventListener('beforeprint', onBeforePrint, { once: true });

  const startTime = performance.now();
  try {
    win.focus();
    win.print();
  } catch {
    frame.remove();
    return false;
  }
  const elapsed = performance.now() - startTime;

  setTimeout(() => {
    win.removeEventListener('beforeprint', onBeforePrint);
    frame.remove();
  }, 60_000);

  return beforePrintFired || elapsed > 120;
}

/**
 * Renders the 1-page DTR Sheet onto a high-DPI Letter Portrait Canvas and downloads it as PNG.
 * Useful as a 1-click fallback inside sandboxed iframes or on mobile devices without printers.
 */
export function downloadDtrAsPng(payload: DtrPrintPayload): string {
  const rows = prepareDtrRows(payload);
  const scale = 2;
  const width = 816;
  const height = 1056;

  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context unavailable');
  }

  ctx.scale(scale, scale);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  const margin = 20;
  const innerW = width - margin * 2;
  ctx.strokeStyle = '#18181b';
  ctx.lineWidth = 2;
  ctx.strokeRect(margin, margin, innerW, height - margin * 2);

  const pad = margin + 12;
  const contentW = innerW - 24;
  let y = pad;

  // Logo badge
  ctx.fillStyle = '#fbbf24';
  ctx.fillRect(pad, y, 36, 36);
  ctx.strokeStyle = '#09090b';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(pad, y, 36, 36);
  ctx.fillStyle = '#09090b';
  ctx.font = '900 15px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('YC', pad + 18, y + 19);

  // Header titles
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = '900 15px system-ui, -apple-system, sans-serif';
  ctx.fillText('FBC RESTAURANTS CORP. / YELLOW CAB PIZZA CO.', pad + 46, y + 2);
  ctx.fillStyle = '#78350f';
  ctx.font = '800 11px system-ui, -apple-system, sans-serif';
  ctx.fillText('DAILY TIME RECORD (DTR) SHEET', pad + 46, y + 21);

  // Header right pill
  ctx.fillStyle = '#09090b';
  ctx.fillRect(pad + contentW - 185, y + 1, 185, 18);
  ctx.fillStyle = '#fbbf24';
  ctx.font = '800 9px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('BIOMETRIC ZKTECO VERIFIED LOG', pad + contentW - 92.5, y + 6);
  ctx.fillStyle = '#52525b';
  ctx.textAlign = 'right';
  ctx.font = '600 9px ui-monospace, monospace';
  const genDate = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  ctx.fillText(`Generated: ${genDate}`, pad + contentW, y + 24);

  y += 44;
  ctx.strokeStyle = '#18181b';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(pad, y);
  ctx.lineTo(pad + contentW, y);
  ctx.stroke();

  // Metadata Box
  y += 8;
  ctx.fillStyle = '#f7f8f5';
  ctx.fillRect(pad, y, contentW, 42);
  ctx.strokeStyle = '#18181b';
  ctx.lineWidth = 1;
  ctx.strokeRect(pad, y, contentW, 42);

  const metaCols = [
    { label: 'EMPLOYEE NAME:', val: (payload.user.name || 'Employee').toUpperCase() },
    { label: 'EMPLOYEE ID:', val: payload.user.employeeId || '—' },
    { label: 'BRANCH / DEPT:', val: payload.user.department || payload.user.branch || 'Main Branch' },
    { label: 'OFFICIAL SHIFT:', val: '8.0 Hrs / Flexitime' },
  ];
  const metaColW = contentW / 4;
  metaCols.forEach((m, idx) => {
    const mx = pad + 8 + idx * metaColW;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#52525b';
    ctx.font = '900 8px system-ui, sans-serif';
    ctx.fillText(m.label, mx, y + 7);
    ctx.fillStyle = idx === 1 ? '#78350f' : '#09090b';
    ctx.font = '900 10.5px system-ui, sans-serif';
    ctx.fillText(m.val.slice(0, 26), mx, y + 20, metaColW - 10);
  });

  // Table area
  y += 50;
  const footerH = 112;
  const tableMaxBottom = height - pad - footerH - 8;
  const availableTableH = tableMaxBottom - y;
  const headerRowH = 22;
  const maxRows = rows.length || 1;
  const rowH = Math.min(22, Math.max(13, Math.floor((availableTableH - headerRowH) / maxRows)));
  const visibleRows = rows.slice(0, Math.floor((availableTableH - headerRowH) / rowH));

  const colWidths = [74, 42, 76, 68, 66, 66, 68, 54, 48, 48, contentW - 610];
  const headers = [
    'Date',
    'Day',
    'Branch',
    'Clock In',
    'Break Out',
    'Break In',
    'Clock Out',
    'Worked',
    'UT',
    'OT',
    'Status / Remarks',
  ];

  // Table header
  ctx.fillStyle = '#18181b';
  ctx.fillRect(pad, y, contentW, headerRowH);
  ctx.fillStyle = '#fbbf24';
  ctx.font = '900 8.5px system-ui, sans-serif';
  let cx = pad;
  headers.forEach((h, i) => {
    ctx.textAlign = i >= 3 && i <= 9 ? 'center' : 'left';
    const tx = i >= 3 && i <= 9 ? cx + colWidths[i] / 2 : cx + 5;
    ctx.fillText(h.toUpperCase(), tx, y + 7, colWidths[i] - 6);
    cx += colWidths[i];
  });
  y += headerRowH;

  if (visibleRows.length === 0) {
    ctx.fillStyle = '#71717a';
    ctx.font = 'italic 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No attendance logs recorded for this employee during selected date range.', pad + contentW / 2, y + 18);
  } else {
    visibleRows.forEach((r, idx) => {
      if (idx % 2 === 1) {
        ctx.fillStyle = '#fafafa';
        ctx.fillRect(pad, y, contentW, rowH);
      }
      ctx.strokeStyle = '#e4e4e7';
      ctx.lineWidth = 0.75;
      ctx.beginPath();
      ctx.moveTo(pad, y + rowH);
      ctx.lineTo(pad + contentW, y + rowH);
      ctx.stroke();

      const rowFontSize = rowH <= 15 ? 7.5 : 8.5;
      const textY = y + Math.max(3, (rowH - rowFontSize) / 2);
      const vals = [
        r.dateLabel,
        r.weekday.slice(0, 3),
        r.branch,
        r.clockIn,
        r.breakOut,
        r.breakIn,
        r.clockOut,
        r.workedHrs,
        r.undertime,
        r.overtime,
        r.statusLabel,
      ];
      let rx = pad;
      vals.forEach((val, ci) => {
        ctx.textAlign = ci >= 3 && ci <= 9 ? 'center' : 'left';
        const tx = ci >= 3 && ci <= 9 ? rx + colWidths[ci] / 2 : rx + 5;
        ctx.fillStyle =
          ci === 3 && r.clockInMissing
            ? '#dc2626'
            : ci === 6 && r.clockOutMissing
            ? '#dc2626'
            : ci === 8
            ? '#92400e'
            : ci === 9
            ? '#075985'
            : '#18181b';
        ctx.font = `${ci === 0 || ci === 7 ? '800' : '600'} ${rowFontSize}px ${
          ci >= 3 && ci <= 9 ? 'ui-monospace, monospace' : 'system-ui, sans-serif'
        }`;
        ctx.fillText(val, tx, textY, colWidths[ci] - 6);
        rx += colWidths[ci];
      });
      y += rowH;
    });
  }

  // Table border
  ctx.strokeStyle = '#18181b';
  ctx.lineWidth = 1;
  ctx.strokeRect(pad, y - (visibleRows.length > 0 ? visibleRows.length * rowH : 0) - headerRowH, contentW, (visibleRows.length > 0 ? visibleRows.length * rowH : 40) + headerRowH);

  // Footer summary + oath
  const fy = height - pad - footerH;
  const sumW = Math.round(contentW * 0.41);
  const oathW = contentW - sumW - 10;

  ctx.fillStyle = '#f7f8f5';
  ctx.fillRect(pad, fy, sumW, footerH);
  ctx.strokeStyle = '#18181b';
  ctx.lineWidth = 1;
  ctx.strokeRect(pad, fy, sumW, footerH);

  ctx.fillStyle = '#09090b';
  ctx.font = '900 9px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('PERIOD ATTENDANCE SUMMARY', pad + 8, fy + 8);

  const summaryItems = [
    { label: 'DAYS WORKED', val: `${payload.totalDaysWorked} Days`, color: '#09090b' },
    { label: 'NET HOURS', val: `${payload.totalNetHours.toFixed(1)} hrs`, color: '#065f46' },
    { label: 'OVERTIME', val: `+${payload.totalOvertimeHours.toFixed(1)} hrs`, color: '#075985' },
    { label: 'UNDERTIME', val: `-${payload.totalUndertimeHours.toFixed(1)} hrs`, color: '#92400e' },
  ];
  const cardW = (sumW - 22) / 2;
  const cardH = 36;
  summaryItems.forEach((item, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const sx = pad + 8 + col * (cardW + 6);
    const sy = fy + 24 + row * (cardH + 6);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(sx, sy, cardW, cardH);
    ctx.strokeStyle = '#d4d4d8';
    ctx.strokeRect(sx, sy, cardW, cardH);
    ctx.fillStyle = '#71717a';
    ctx.font = '800 7.5px system-ui, sans-serif';
    ctx.fillText(item.label, sx + 6, sy + 6);
    ctx.fillStyle = item.color;
    ctx.font = '900 11px system-ui, sans-serif';
    ctx.fillText(item.val, sx + 6, sy + 18);
  });

  // Oath & Signatures
  const ox = pad + sumW + 10;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(ox, fy, oathW, footerH);
  ctx.strokeStyle = '#18181b';
  ctx.strokeRect(ox, fy, oathW, footerH);

  ctx.fillStyle = '#27272a';
  ctx.font = 'italic 9px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(
    '"I CERTIFY on my honor that the above is a true and correct record of the hours of work',
    ox + oathW / 2,
    fy + 10,
    oathW - 16
  );
  ctx.fillText(
    'performed, record of which was made daily at the time of arrival and departure from office."',
    ox + oathW / 2,
    fy + 22,
    oathW - 16
  );

  const sigW = (oathW - 44) / 2;
  [
    { name: (payload.user.name || 'Employee').toUpperCase(), role: 'EMPLOYEE SIGNATURE' },
    { name: 'PAYROLL / STORE MANAGER', role: 'VERIFIED OFFICE HOURS' },
  ].forEach((sig, idx) => {
    const sx = ox + 14 + idx * (sigW + 16);
    const lineY = fy + 76;
    ctx.strokeStyle = '#18181b';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(sx, lineY);
    ctx.lineTo(sx + sigW, lineY);
    ctx.stroke();

    ctx.fillStyle = '#09090b';
    ctx.font = '900 8.5px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(sig.name, sx + sigW / 2, lineY + 6, sigW);
    ctx.fillStyle = '#71717a';
    ctx.font = '700 7.5px system-ui, sans-serif';
    ctx.fillText(sig.role, sx + sigW / 2, lineY + 18, sigW);
  });

  const dataUrl = canvas.toDataURL('image/png');
  const safeName = `DTR_${payload.user.employeeId || 'EMP'}_${(payload.user.name || 'Employee').replace(/[^a-zA-Z0-9_-]+/g, '_')}.png`;
  const link = document.createElement('a');
  link.download = safeName;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  return safeName;
}
