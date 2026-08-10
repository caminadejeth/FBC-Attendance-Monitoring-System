import Swal from 'sweetalert2';

// Yellow Cab styled Swal configuration wrapper
export const yellowCabSwal = Swal.mixin({
  customClass: {
    popup: 'rounded-2xl border-2 border-zinc-950 shadow-2xl font-sans bg-amber-50/95 backdrop-blur-md',
    title: 'text-zinc-950 font-black uppercase tracking-tight text-xl',
    htmlContainer: 'text-zinc-800 font-medium text-sm',
    confirmButton: 'bg-amber-400 hover:bg-amber-300 text-zinc-950 font-black uppercase tracking-wider text-xs py-3 px-6 rounded-xl border border-zinc-950 shadow-xs mx-1 cursor-pointer transition-all',
    cancelButton: 'bg-zinc-200 hover:bg-zinc-300 text-zinc-900 font-extrabold uppercase tracking-wider text-xs py-3 px-6 rounded-xl border border-zinc-400 mx-1 cursor-pointer transition-all',
    input: 'rounded-xl border-2 border-zinc-950 px-3 py-2 font-medium focus:ring-2 focus:ring-amber-400 focus:outline-none bg-white text-zinc-950 text-sm mt-2',
  },
  buttonsStyling: false,
});

export const showUploadProcessingAlert = (filename: string) => {
  return yellowCabSwal.fire({
    title: 'Processing Biometric File',
    html: `
      <div style="padding: 8px 0; text-align: center;">
        <div style="font-weight: 800; color: #09090b; margin-bottom: 6px; font-size: 15px;">
          Parsing <b>${filename}</b>
        </div>
        <p style="font-size: 12px; color: #52525b; margin: 0;">
          Cleaning duplicate biometric punches, extracting ZKTeco timestamps, and compiling 8-hour flexitime attendance records...
        </p>
      </div>
    `,
    allowOutsideClick: false,
    allowEscapeKey: false,
    showConfirmButton: false,
    didOpen: () => {
      Swal.showLoading();
    },
  });
};

export const showUploadSuccessAlert = (
  rawRowsCount: number,
  cleanedPunchesCount: number,
  summariesCount: number,
  warnings?: string[]
) => {
  const warningsHtml =
    warnings && warnings.length > 0
      ? `<div style="text-align: left; background-color: #fef3c7; border: 1.5px solid #f59e0b; padding: 10px; border-radius: 10px; margin-top: 12px; font-size: 12px; color: #92400e;">
          <strong>⚠️ File Parsing Notes (${warnings.length}):</strong>
          <ul style="padding-left: 18px; margin-top: 4px; margin-bottom: 0;">
            ${warnings.slice(0, 4).map((w) => `<li style="margin-bottom: 2px;">${w}</li>`).join('')}
            ${warnings.length > 4 ? `<li>...and ${warnings.length - 4} more notes</li>` : ''}
          </ul>
        </div>`
      : '';

  return yellowCabSwal.fire({
    icon: 'success',
    iconColor: '#d97706',
    title: 'ZKTeco File Uploaded!',
    html: `
      <div style="text-align: left; font-size: 14px; line-height: 1.5;">
        <p style="margin-bottom: 10px; color: #09090b; font-weight: 700;">
          Biometric file deduplicated & parsed successfully for Yellow Cab Pizza store attendance records.
        </p>
        <div style="background-color: #ffffff; border: 2px solid #09090b; border-radius: 12px; padding: 12px; margin-top: 6px; box-shadow: 2px 2px 0px 0px #09090b;">
          <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px; border-bottom: 1px border #f4f4f5; padding-bottom: 4px;">
            <span>📋 Raw Export Rows:</span>
            <strong style="font-family: monospace;">${rawRowsCount.toLocaleString()}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px; border-bottom: 1px border #f4f4f5; padding-bottom: 4px;">
            <span>⏱️ Deduplicated Punches:</span>
            <strong style="color: #d97706; font-family: monospace;">${cleanedPunchesCount.toLocaleString()}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 13px;">
            <span>👥 Generated Summaries:</span>
            <strong style="color: #166534; font-family: monospace;">${summariesCount.toLocaleString()} Daily Records</strong>
          </div>
        </div>
        ${warningsHtml}
      </div>
    `,
    confirmButtonText: 'View Store Summaries',
  });
};

export const showUploadErrorAlert = (errors: string[]) => {
  return yellowCabSwal.fire({
    icon: 'error',
    iconColor: '#dc2626',
    title: 'Upload Validation Failed',
    html: `
      <div style="text-align: left; font-size: 13px;">
        <p style="font-weight: 800; margin-bottom: 8px; color: #991b1b;">
          The uploaded file could not be validated against ZKTeco biometric export requirements:
        </p>
        <div style="background-color: #fef2f2; border: 2px solid #f87171; padding: 12px; border-radius: 10px; color: #7f1d1d;">
          <ul style="padding-left: 18px; margin: 0;">
            ${errors.map((err) => `<li style="margin-bottom: 4px; font-weight: 600;">${err}</li>`).join('')}
          </ul>
        </div>
      </div>
    `,
    confirmButtonText: 'Try Another File',
  });
};

export const showConfirmDisputeAlert = (disputeType: string, date: string) => {
  return yellowCabSwal.fire({
    icon: 'question',
    iconColor: '#d97706',
    title: 'Submit Timecard Dispute?',
    html: `Are you sure you want to file a <b>${disputeType.replace(/_/g, ' ')}</b> dispute for date <b>${date}</b>? Store managers will review your explanation.`,
    showCancelButton: true,
    confirmButtonText: 'Submit Dispute',
    cancelButtonText: 'Cancel',
  });
};

export const showDisputeSuccessAlert = () => {
  return yellowCabSwal.fire({
    icon: 'success',
    iconColor: '#d97706',
    title: 'Dispute Transmitted',
    text: 'Your attendance dispute has been submitted to Store Managers & Payroll for approval.',
    confirmButtonText: 'Done',
  });
};

export const showConfirmDisputeAction = (
  action: 'APPROVE' | 'REJECT',
  employeeName: string,
  date: string
) => {
  const isApprove = action === 'APPROVE';
  return yellowCabSwal.fire({
    icon: isApprove ? 'question' : 'warning',
    iconColor: isApprove ? '#d97706' : '#dc2626',
    title: `${isApprove ? 'Approve' : 'Reject'} Dispute for ${employeeName}?`,
    html: `<div style="text-align: left;">
      <p style="margin-bottom: 8px;">Date: <b>${date}</b></p>
      <p style="font-size: 12px; color: #52525b;">${
        isApprove
          ? 'Approving will recalculate work hours based on requested clock times and update undertime/overtime records.'
          : 'Rejecting will decline the requested timecard correction.'
      }</p>
    </div>`,
    input: 'text',
    inputPlaceholder: isApprove ? 'Optional manager remarks...' : 'Reason for rejection (required)...',
    inputValidator: (value) => {
      if (!isApprove && !value?.trim()) {
        return 'Please enter a rejection reason!';
      }
      return null;
    },
    showCancelButton: true,
    confirmButtonText: isApprove ? 'Approve Dispute' : 'Reject Dispute',
    cancelButtonText: 'Cancel',
  });
};

export const showExportToast = (filename: string) => {
  return yellowCabSwal.fire({
    icon: 'success',
    iconColor: '#d97706',
    title: 'Report Downloaded',
    text: `Saved as ${filename}`,
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3500,
    timerProgressBar: true,
  });
};

export const showSyncConfirmAlert = () => {
  return yellowCabSwal.fire({
    icon: 'info',
    iconColor: '#d97706',
    title: 'Sync to Google Sheets?',
    text: 'This will aggregate deduplicated ZKTeco biometric punches, 8-hour daily flexitime records, and payroll outputs into Google Sheets format.',
    showCancelButton: true,
    confirmButtonText: 'Proceed to Sync',
    cancelButtonText: 'Cancel',
  });
};

export const showSuccessAlert = (title: string, text?: string) => {
  return yellowCabSwal.fire({
    icon: 'success',
    iconColor: '#d97706',
    title: title,
    text: text,
    confirmButtonText: 'OK',
  });
};

export const showErrorAlert = (title: string, text?: string) => {
  return yellowCabSwal.fire({
    icon: 'error',
    iconColor: '#dc2626',
    title: title,
    text: text,
    confirmButtonText: 'Understood',
  });
};

export const showActionSuccessToast = (message: string) => {
  return yellowCabSwal.fire({
    icon: 'success',
    iconColor: '#d97706',
    title: message,
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 2500,
    timerProgressBar: true,
  });
};

export const showConfirmCtoActionAlert = (
  action: 'APPROVE' | 'REJECT',
  employeeName: string,
  hours: number,
  date: string
) => {
  const isApprove = action === 'APPROVE';
  return yellowCabSwal.fire({
    icon: isApprove ? 'question' : 'warning',
    iconColor: isApprove ? '#d97706' : '#dc2626',
    title: `${isApprove ? 'Approve' : 'Reject'} CTO Request?`,
    html: `<div style="text-align: left; font-size: 13px;">
      <p>Employee: <b>${employeeName}</b></p>
      <p>Requested Date: <b>${date}</b> (${hours} hrs)</p>
      <p style="font-size: 12px; color: #52525b; margin-top: 6px;">
        ${isApprove ? 'Approving will deduct hours from employee earned CTO balance.' : 'Rejecting will decline this CTO leave request.'}
      </p>
    </div>`,
    input: 'text',
    inputPlaceholder: isApprove ? 'Optional remarks...' : 'Reason for rejection (required)...',
    inputValidator: (value) => {
      if (!isApprove && !value?.trim()) {
        return 'Please state a rejection reason!';
      }
      return null;
    },
    showCancelButton: true,
    confirmButtonText: isApprove ? 'Approve CTO' : 'Reject CTO',
    cancelButtonText: 'Cancel',
  });
};

export const showLoginToast = (userName: string, role: string) => {
  return yellowCabSwal.fire({
    icon: 'success',
    iconColor: '#d97706',
    title: `Welcome, ${userName}!`,
    text: `Logged in as ${role.replace('_', ' ')}`,
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
  });
};

export const showRemarkPromptAlert = (
  employeeName: string,
  dateStr: string,
  existingRemark?: string
) => {
  return yellowCabSwal.fire({
    title: 'Time & Attendance Concern',
    html: `
      <div style="text-align: left; font-size: 13px;">
        <p style="margin-bottom: 8px; color: #09090b; font-weight: 700;">
          Add or update concern regarding time for <b>${employeeName}</b> on <b>${dateStr}</b>:
        </p>
      </div>
    `,
    input: 'textarea',
    inputValue: existingRemark || '',
    inputPlaceholder: 'State your concern or remark here (e.g., Forgot clock out, power failure during shift, break adjustment needed)...',
    inputAttributes: {
      'aria-label': 'Type your concern here',
      rows: '3',
    },
    showCancelButton: true,
    confirmButtonText: 'Submit Concern / Remark',
    cancelButtonText: 'Cancel',
    inputValidator: (value) => {
      if (!value || !value.trim()) {
        return 'Please enter a concern or remark before submitting!';
      }
      return null;
    },
  });
};
