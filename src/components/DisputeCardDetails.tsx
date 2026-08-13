import React from 'react';
import { DisputeRequest } from '../types';
import { Paperclip, ExternalLink, CheckCircle2, XCircle, Clock, UserCheck, ShieldCheck } from 'lucide-react';
import { formatRealtimeTimestamp } from '../utils/timeFormatters';

interface DisputeCardDetailsProps {
  dispute: DisputeRequest;
}

export const DisputeCardDetails: React.FC<DisputeCardDetailsProps> = ({ dispute }) => {
  const cat = dispute.category || dispute.type || 'Time-in';

  let timeDetailText = '';
  if (dispute.requestedClockIn && !dispute.requestedClockOut) {
    timeDetailText = `Requested Time-In: ${dispute.requestedClockIn}`;
  } else if (dispute.requestedClockOut && !dispute.requestedClockIn) {
    timeDetailText = `Requested Time-Out: ${dispute.requestedClockOut}`;
  } else if (dispute.requestedBreakOut) {
    timeDetailText = `Requested Break-Out: ${dispute.requestedBreakOut}`;
  } else if (dispute.requestedBreakIn) {
    timeDetailText = `Requested Break-In: ${dispute.requestedBreakIn}`;
  } else if (dispute.requestedClockIn && dispute.requestedClockOut) {
    timeDetailText = `Requested: ${dispute.requestedClockIn} → ${dispute.requestedClockOut} (${dispute.requestedHours || 8.0}h)`;
  }

  const approvalDate = dispute.approvedAt || dispute.reviewedAt;

  return (
    <div className="space-y-2.5 mt-2">
      {/* Category and Reason */}
      <div className="bg-white p-3 rounded-xl border border-zinc-200 text-xs text-zinc-800 space-y-2 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-1.5 text-[11px] font-bold text-amber-900 border-b border-zinc-100 pb-2">
          <span className="uppercase tracking-tight bg-amber-50 px-2 py-0.5 rounded border border-amber-200/80">
            Category: {cat.replace(/_/g, ' ')}
          </span>
          {timeDetailText && (
            <span className="font-mono text-zinc-900 bg-amber-100/90 px-2 py-0.5 rounded-md border border-amber-300 font-bold">
              {timeDetailText}
            </span>
          )}
        </div>

        <div>
          <strong className="text-zinc-500 text-[10px] block uppercase font-bold tracking-tight mb-0.5">
            Reason / Explanation:
          </strong>
          <p className="text-zinc-800 italic bg-zinc-50 p-2 rounded-lg border border-zinc-150">
            "{dispute.reason}"
          </p>
        </div>

        {/* Attachment File Section */}
        {dispute.attachmentUrl && (
          <div className="pt-2 border-t border-zinc-100 space-y-1.5">
            <strong className="text-zinc-600 text-[10px] uppercase font-bold tracking-tight flex items-center gap-1">
              <Paperclip className="w-3 h-3 text-amber-700" /> Attachment File Proof:
            </strong>
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={dispute.attachmentUrl}
                target="_blank"
                rel="noopener noreferrer"
                download={dispute.attachmentName || 'Dispute_Attachment'}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-lg text-xs font-bold text-amber-950 transition-colors shadow-2xs cursor-pointer"
              >
                <Paperclip className="w-3.5 h-3.5 text-amber-800 shrink-0" />
                <span className="truncate max-w-[200px]">{dispute.attachmentName || 'View Attachment File'}</span>
                <ExternalLink className="w-3 h-3 text-amber-700 ml-1 shrink-0" />
              </a>
            </div>

            {dispute.attachmentUrl.startsWith('data:image') && (
              <div className="mt-2 max-w-xs rounded-lg overflow-hidden border border-zinc-200 shadow-2xs group relative">
                <img
                  src={dispute.attachmentUrl}
                  alt="Attachment Proof"
                  className="w-full h-auto max-h-40 object-cover cursor-pointer group-hover:scale-105 transition-transform duration-200"
                  onClick={() => {
                    const w = window.open('');
                    w?.document.write(`<title>Attachment File Proof</title><div style="display:flex;justify-content:center;align-items:center;min-height:100vh;background:#0f172a;"><img src="${dispute.attachmentUrl}" style="max-width:90%; max-height:90vh; border-radius:12px; box-shadow:0 10px 25px rgba(0,0,0,0.5);" /></div>`);
                  }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Request History & Branch Manager Approval Details */}
      <div className="bg-zinc-50 p-2.5 rounded-xl border border-zinc-200 text-[11px] space-y-1.5">
        <div className="flex items-center justify-between text-zinc-500 font-medium pb-1 border-b border-zinc-200/60">
          <span className="flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider text-zinc-600">
            <Clock className="w-3 h-3 text-zinc-500" /> Request History & Timeline
          </span>
          <span className="font-mono text-[10px] text-zinc-600 bg-zinc-200/60 px-1.5 py-0.5 rounded font-bold">
            Submitted: {formatRealtimeTimestamp(dispute.submittedAt)}
          </span>
        </div>

        {dispute.status === 'APPROVED' && (
          <div className="bg-emerald-50 border border-emerald-300 rounded-lg p-2.5 text-emerald-950 space-y-1.5">
            <div className="flex items-center justify-between font-bold text-xs text-emerald-900 flex-wrap gap-1">
              <span className="flex items-center gap-1 text-emerald-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                Dual Approval Completed (Manager & Payroll)
              </span>
              <span className="font-mono text-[10px] bg-emerald-200/90 text-emerald-950 px-2 py-0.5 rounded font-black border border-emerald-400">
                Fully Approved: {formatRealtimeTimestamp(approvalDate || dispute.submittedAt)}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1">
              <div className="bg-white/80 p-2 rounded border border-emerald-200 flex flex-col gap-0.5">
                <div className="flex items-center gap-1.5 text-emerald-900 font-bold">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                  <span>Branch Mgr: <strong>{dispute.managerApprovedBy || dispute.reviewedBy || 'Manager'}</strong></span>
                </div>
                <div className="text-[10px] text-emerald-800 font-mono font-semibold pl-5">
                  Approved on: {formatRealtimeTimestamp(dispute.managerApprovedAt || approvalDate || dispute.submittedAt)}
                </div>
              </div>
              <div className="bg-white/80 p-2 rounded border border-emerald-200 flex flex-col gap-0.5">
                <div className="flex items-center gap-1.5 text-emerald-900 font-bold">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                  <span>Payroll: <strong>{dispute.payrollApprovedBy || dispute.reviewedBy || 'Payroll'}</strong></span>
                </div>
                <div className="text-[10px] text-emerald-800 font-mono font-semibold pl-5">
                  Approved on: {formatRealtimeTimestamp(dispute.payrollApprovedAt || approvalDate || dispute.submittedAt)}
                </div>
              </div>
            </div>
            {dispute.adminNotes && (
              <p className="text-[11px] text-emerald-900 italic bg-white/70 p-1.5 rounded border border-emerald-200 mt-1">
                Approval Note: "{dispute.adminNotes}"
              </p>
            )}
          </div>
        )}

        {dispute.status === 'REJECTED' && (
          <div className="bg-rose-50 border border-rose-300 rounded-lg p-2.5 text-rose-950 space-y-1">
            <div className="flex items-center justify-between font-bold text-xs text-rose-900 flex-wrap gap-1">
              <span className="flex items-center gap-1 text-rose-900">
                <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                Adjustment Rejected
              </span>
              <span className="font-mono text-[10px] bg-rose-200 text-rose-950 px-2 py-0.5 rounded font-black border border-rose-400">
                Rejected: {formatRealtimeTimestamp(dispute.reviewedAt || dispute.submittedAt)}
              </span>
            </div>
            <div className="text-[11px] font-semibold text-rose-850 flex items-center gap-1.5 pt-0.5">
              <UserCheck className="w-3.5 h-3.5 text-rose-700 shrink-0" />
              <span>Reviewed By: <strong className="text-rose-950">{dispute.reviewedBy || 'Manager / Payroll'}</strong></span>
            </div>
            {dispute.adminNotes && (
              <p className="text-[11px] text-rose-900 italic bg-white/70 p-1.5 rounded border border-rose-200 mt-1">
                Rejection Reason: "{dispute.adminNotes}"
              </p>
            )}
          </div>
        )}

        {dispute.status === 'PENDING' && (
          <div className="bg-amber-50 border border-amber-300 rounded-lg p-2.5 text-amber-950 space-y-2">
            <div className="flex items-center justify-between font-bold text-xs flex-wrap gap-1">
              <span className="flex items-center gap-1.5 text-amber-900">
                <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                Dual Approval Status
              </span>
              <span className="font-mono text-[10px] bg-amber-200/80 px-2 py-0.5 rounded text-amber-950 border border-amber-400 font-bold">
                Submitted: {formatRealtimeTimestamp(dispute.submittedAt)}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              <div
                className={`p-2 rounded border flex flex-col gap-1 ${
                  dispute.managerApproved
                    ? 'bg-emerald-100/80 border-emerald-300 text-emerald-950 font-bold'
                    : 'bg-white/80 border-amber-200 text-amber-900'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="flex items-center gap-1 font-bold">
                    {dispute.managerApproved ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    ) : (
                      <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    )}
                    Branch Manager
                  </span>
                  <span className="text-[10px]">
                    {dispute.managerApproved
                      ? `Approved (${dispute.managerApprovedBy || 'Manager'})`
                      : 'Pending'}
                  </span>
                </div>
                {dispute.managerApproved && dispute.managerApprovedAt && (
                  <div className="text-[10px] font-mono text-emerald-800 font-semibold pl-4">
                    {formatRealtimeTimestamp(dispute.managerApprovedAt)}
                  </div>
                )}
              </div>

              <div
                className={`p-2 rounded border flex flex-col gap-1 ${
                  dispute.payrollApproved
                    ? 'bg-emerald-100/80 border-emerald-300 text-emerald-950 font-bold'
                    : 'bg-white/80 border-amber-200 text-amber-900'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="flex items-center gap-1 font-bold">
                    {dispute.payrollApproved ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    ) : (
                      <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    )}
                    Payroll Department
                  </span>
                  <span className="text-[10px]">
                    {dispute.payrollApproved
                      ? `Approved (${dispute.payrollApprovedBy || 'Payroll'})`
                      : 'Pending'}
                  </span>
                </div>
                {dispute.payrollApproved && dispute.payrollApprovedAt && (
                  <div className="text-[10px] font-mono text-emerald-800 font-semibold pl-4">
                    {formatRealtimeTimestamp(dispute.payrollApprovedAt)}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
