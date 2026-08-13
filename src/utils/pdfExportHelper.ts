import { DisputeRequest } from '../types';

export function exportDisputesToPdf(
  disputes: DisputeRequest[],
  branchFilter: string = 'ALL'
) {
  if (!disputes || disputes.length === 0) {
    alert('No time adjustment or dispute records available to export.');
    return;
  }

  // Filter list if branch is specified
  const listToExport = disputes.filter((d) => {
    if (branchFilter === 'ALL') return true;
    return d.branch === branchFilter || d.department === branchFilter;
  });

  if (listToExport.length === 0) {
    alert(`No matching dispute records found for selected branch: ${branchFilter}`);
    return;
  }

  // Group items into chunks of 4 (Strictly 4 data records per page)
  const pageSize = 4;
  const pages: DisputeRequest[][] = [];
  for (let i = 0; i < listToExport.length; i += pageSize) {
    pages.push(listToExport.slice(i, i + pageSize));
  }

  const dateGenerated = new Date().toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  // Open a clean printable print-window
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Pop-up blocked! Please allow pop-ups for this domain to download the PDF report.');
    return;
  }

  const pagesHtml = pages
    .map((pageItems, pageIdx) => {
      const itemsHtml = pageItems
        .map((d, itemIdx) => {
          const itemNum = pageIdx * pageSize + itemIdx + 1;
          const statusColor =
            d.status === 'APPROVED'
              ? '#047857' // emerald
              : d.status === 'REJECTED'
              ? '#b91c1c' // rose
              : '#b45309'; // amber

          const statusBg =
            d.status === 'APPROVED'
              ? '#ecfdf5'
              : d.status === 'REJECTED'
              ? '#fef2f2'
              : '#fffbeb';

          let timeDetailText = 'N/A';
          if (d.requestedClockIn && !d.requestedClockOut) {
            timeDetailText = `Time-In: ${d.requestedClockIn}`;
          } else if (d.requestedClockOut && !d.requestedClockIn) {
            timeDetailText = `Time-Out: ${d.requestedClockOut}`;
          } else if (d.requestedBreakOut) {
            timeDetailText = `Break-Out: ${d.requestedBreakOut}`;
          } else if (d.requestedBreakIn) {
            timeDetailText = `Break-In: ${d.requestedBreakIn}`;
          } else if (d.requestedClockIn && d.requestedClockOut) {
            timeDetailText = `Clock-In: ${d.requestedClockIn} | Clock-Out: ${d.requestedClockOut}`;
          }

          return `
            <div class="dispute-card">
              <div class="card-header">
                <div class="card-header-left">
                  <span class="record-num">#${itemNum}</span>
                  <span class="emp-name">${d.employeeName}</span>
                  <span class="emp-id">(${d.employeeId})</span>
                  <span class="branch-tag">${d.branch || d.department || 'Main Branch'}</span>
                </div>
                <div class="status-badge" style="background-color: ${statusBg}; color: ${statusColor}; border-color: ${statusColor};">
                  ${d.status}
                </div>
              </div>

              <div class="card-body">
                <div class="meta-row">
                  <div><strong>Date of Adjustment:</strong> ${d.date}</div>
                  <div><strong>Category:</strong> ${(d.category || d.type || 'Time Adjustment').replace(/_/g, ' ')}</div>
                  <div><strong>Requested Adjustment:</strong> <span class="time-highlight">${timeDetailText}</span></div>
                </div>

                <div class="reason-box">
                  <strong>Employee Reason / Justification:</strong>
                  <p>"${d.reason || 'No reason provided'}"</p>
                </div>

                <div class="approvals-grid">
                  <div class="approval-item">
                    <span class="app-title">Branch Manager:</span>
                    <span class="app-status ${d.managerApproved ? 'text-green' : 'text-amber'}">
                      ${d.managerApproved ? '✓ APPROVED' : (d.status === 'REJECTED' ? '✕ REJECTED' : '⏳ PENDING')}
                    </span>
                    ${d.managerApprovedAt ? `<span class="app-time">(${d.managerApprovedAt})</span>` : ''}
                  </div>
                  <div class="approval-item">
                    <span class="app-title">Payroll Dept:</span>
                    <span class="app-status ${d.payrollApproved ? 'text-green' : 'text-amber'}">
                      ${d.payrollApproved ? '✓ APPROVED' : (d.status === 'REJECTED' ? '✕ REJECTED' : '⏳ PENDING')}
                    </span>
                    ${d.payrollApprovedAt ? `<span class="app-time">(${d.payrollApprovedAt})</span>` : ''}
                  </div>
                </div>
              </div>
            </div>
          `;
        })
        .join('');

      return `
        <div class="pdf-page">
          <div class="page-header">
            <div class="brand">
              <span class="brand-title">YELLOW CAB PIZZA CO. • FBC RESTAURANTS CORP.</span>
              <span class="doc-title">BRANCH TIME ADJUSTMENT & DISPUTE HISTORY REPORT</span>
            </div>
            <div class="page-meta">
              <div><strong>Generated Date:</strong> ${dateGenerated}</div>
              <div><strong>Branch Filter:</strong> ${branchFilter}</div>
              <div style="font-weight:800; color:#000;"><strong>Page ${pageIdx + 1} of ${pages.length}</strong></div>
            </div>
          </div>

          <div class="items-container">
            ${itemsHtml}
          </div>

          <div class="page-footer">
            <span>FBC Biometric Attendance System • Official Time Adjustment Audit Log</span>
            <span>4 Records Per Page • Confidential</span>
          </div>
        </div>
      `;
    })
    .join('');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Branch Time Adjustment & Dispute History - PDF Export</title>
        <style>
          @page {
            size: letter portrait;
            margin: 8mm;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          }
          body {
            background-color: #f4f4f5;
            color: #18181b;
            font-size: 11px;
            line-height: 1.3;
          }
          @media print {
            body {
              background-color: #ffffff;
            }
            .no-print {
              display: none !important;
            }
            .pdf-page {
              box-shadow: none !important;
              margin: 0 !important;
              border: none !important;
              page-break-after: always;
              break-after: page;
            }
          }
          .no-print-bar {
            background-color: #09090b;
            color: #ffffff;
            padding: 12px 24px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            position: sticky;
            top: 0;
            z-index: 100;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          }
          .btn-print {
            background-color: #f59e0b;
            color: #09090b;
            font-weight: 900;
            padding: 8px 20px;
            border-radius: 8px;
            border: none;
            cursor: pointer;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          }
          .btn-print:hover {
            background-color: #d97706;
            color: #ffffff;
          }
          .pdf-page {
            width: 210mm;
            min-height: 270mm;
            height: 270mm;
            background: #ffffff;
            margin: 20px auto;
            padding: 18px 22px;
            border: 1px solid #e4e4e7;
            border-radius: 4px;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          .page-header {
            border-bottom: 2.5px solid #09090b;
            padding-bottom: 8px;
            margin-bottom: 12px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
          }
          .brand-title {
            display: block;
            font-size: 10px;
            font-weight: 900;
            letter-spacing: 1px;
            color: #b45309;
            text-transform: uppercase;
          }
          .doc-title {
            display: block;
            font-size: 14px;
            font-weight: 900;
            color: #09090b;
            letter-spacing: -0.3px;
          }
          .page-meta {
            text-align: right;
            font-size: 9px;
            color: #52525b;
            line-height: 1.4;
          }
          .items-container {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 12px;
          }
          .dispute-card {
            border: 1.5px solid #d4d4d8;
            border-radius: 8px;
            padding: 10px 14px;
            background: #fafafa;
            height: 23%;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          .card-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid #e4e4e7;
            padding-bottom: 5px;
          }
          .card-header-left {
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .record-num {
            font-weight: 900;
            background: #09090b;
            color: #fbbf24;
            font-size: 10px;
            padding: 2px 6px;
            border-radius: 4px;
          }
          .emp-name {
            font-weight: 900;
            font-size: 13px;
            color: #09090b;
          }
          .emp-id {
            font-family: monospace;
            font-weight: 700;
            color: #71717a;
            font-size: 11px;
          }
          .branch-tag {
            background: #f4f4f5;
            border: 1px solid #d4d4d8;
            padding: 2px 8px;
            border-radius: 4px;
            font-weight: 800;
            font-size: 9px;
            color: #27272a;
          }
          .status-badge {
            font-weight: 900;
            font-size: 10px;
            padding: 2px 10px;
            border-radius: 9999px;
            border: 1px solid;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .card-body {
            display: flex;
            flex-direction: column;
            gap: 6px;
            margin-top: 4px;
          }
          .meta-row {
            display: flex;
            justify-content: space-between;
            font-size: 10.5px;
            background: #ffffff;
            padding: 5px 10px;
            border-radius: 6px;
            border: 1px solid #e4e4e7;
          }
          .time-highlight {
            font-family: monospace;
            font-weight: 900;
            color: #047857;
            background: #ecfdf5;
            padding: 1px 6px;
            border-radius: 4px;
            border: 1px solid #a7f3d0;
          }
          .reason-box {
            font-size: 10px;
            background: #ffffff;
            padding: 6px 10px;
            border-radius: 6px;
            border: 1px solid #e4e4e7;
          }
          .reason-box p {
            font-style: italic;
            color: #27272a;
            margin-top: 2px;
          }
          .approvals-grid {
            display: flex;
            justify-content: space-between;
            font-size: 9.5px;
            padding-top: 2px;
          }
          .approval-item {
            display: flex;
            align-items: center;
            gap: 4px;
          }
          .app-title {
            font-weight: 800;
            color: #52525b;
          }
          .app-status {
            font-weight: 900;
          }
          .text-green { color: #047857; }
          .text-amber { color: #b45309; }
          .app-time {
            font-size: 8.5px;
            color: #71717a;
            font-mono: true;
          }
          .page-footer {
            border-top: 1px solid #09090b;
            padding-top: 8px;
            margin-top: 8px;
            display: flex;
            justify-content: space-between;
            font-size: 8.5px;
            color: #52525b;
            font-weight: 700;
            text-transform: uppercase;
          }
        </style>
      </head>
      <body>
        <div class="no-print-bar no-print">
          <div>
            <strong style="color: #fbbf24;">Yellow Cab Pizza Co. / FBC Time Adjustment PDF Export</strong>
            <span style="font-size:12px; opacity:0.85; margin-left:12px;">(${listToExport.length} Total Records • 4 Data Per Page)</span>
          </div>
          <button class="btn-print" onclick="window.print()">Print / Save as PDF</button>
        </div>

        ${pagesHtml}

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 500);
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}
