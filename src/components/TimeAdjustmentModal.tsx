import React, { useState, useEffect } from 'react';
import { User, AttendanceSummaryDaily, DisputeRequest } from '../types';
import { DatePickerInput } from './DatePickerInput';
import { calculateGrossHours, formatDateMDYYYY } from '../utils/timeFormatters';
import { showSuccessAlert, showErrorAlert } from '../utils/sweetAlerts';
import { Clock, Upload, Paperclip, X, FileText, CheckCircle2 } from 'lucide-react';

interface TimeAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
  currentUser?: User;
  preselectedSummary?: AttendanceSummaryDaily | null;
  onSubmitDispute: (dispute: Omit<DisputeRequest, 'id' | 'status' | 'submittedAt'>) => void;
}

export type AdjustmentCategoryOption = 'Time-in' | 'Time-out' | 'Break-out' | 'Break-in' | 'Full Shift';

export const TimeAdjustmentModal: React.FC<TimeAdjustmentModalProps> = ({
  isOpen,
  onClose,
  users,
  currentUser,
  preselectedSummary,
  onSubmitDispute,
}) => {
  const [selectedEmpId, setSelectedEmpId] = useState<string>('');
  const [targetDate, setTargetDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState<AdjustmentCategoryOption>('Time-in');
  
  // Specific requested time values
  const [requestedTimeIn, setRequestedTimeIn] = useState<string>('08:00:00');
  const [requestedTimeOut, setRequestedTimeOut] = useState<string>('17:00:00');
  const [requestedBreakOut, setRequestedBreakOut] = useState<string>('12:00:00');
  const [requestedBreakIn, setRequestedBreakIn] = useState<string>('13:00:00');
  const [requestedHours, setRequestedHours] = useState<number>(8.0);
  const [reason, setReason] = useState<string>('');

  // File attachment state
  const [attachmentName, setAttachmentName] = useState<string>('');
  const [attachmentUrl, setAttachmentUrl] = useState<string>('');
  const [attachmentSize, setAttachmentSize] = useState<number>(0);

  useEffect(() => {
    if (preselectedSummary) {
      setSelectedEmpId(preselectedSummary.employeeId);
      setTargetDate(preselectedSummary.date);
      setRequestedTimeIn(preselectedSummary.firstIn || '08:00:00');
      setRequestedTimeOut(preselectedSummary.lastOut || '17:00:00');
      setRequestedBreakOut(preselectedSummary.breakOut || '12:00:00');
      setRequestedBreakIn(preselectedSummary.breakIn || '13:00:00');
      setRequestedHours(preselectedSummary.netHoursWorked > 0 ? preselectedSummary.netHoursWorked : 8.0);
      if (preselectedSummary.anomalies.length > 0) {
        setReason(preselectedSummary.anomalies.join(' | '));
      }
    } else if (currentUser) {
      setSelectedEmpId(currentUser.employeeId);
    } else if (users.length > 0) {
      setSelectedEmpId(users[0].employeeId);
    }
  }, [preselectedSummary, currentUser, users, isOpen]);

  if (!isOpen) return null;

  const targetUser = users.find((u) => u.employeeId === selectedEmpId) || currentUser;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      showErrorAlert('File Too Large', 'Please select an attachment smaller than 8MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setAttachmentName(file.name);
      setAttachmentUrl(reader.result as string);
      setAttachmentSize(file.size);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAttachment = () => {
    setAttachmentName('');
    setAttachmentUrl('');
    setAttachmentSize(0);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedEmpId) {
      showErrorAlert('Missing Employee', 'Please select an employee for this time adjustment.');
      return;
    }

    if (!reason.trim()) {
      showErrorAlert('Missing Reason', 'Please enter a reason for the time adjustment request.');
      return;
    }

    let finalReqIn: string | undefined = undefined;
    let finalReqOut: string | undefined = undefined;
    let finalReqBreakOut: string | undefined = undefined;
    let finalReqBreakIn: string | undefined = undefined;

    if (category === 'Time-in') {
      finalReqIn = requestedTimeIn;
    } else if (category === 'Time-out') {
      finalReqOut = requestedTimeOut;
    } else if (category === 'Break-out') {
      finalReqBreakOut = requestedBreakOut;
    } else if (category === 'Break-in') {
      finalReqBreakIn = requestedBreakIn;
    } else if (category === 'Full Shift') {
      finalReqIn = requestedTimeIn;
      finalReqOut = requestedTimeOut;
    }

    onSubmitDispute({
      employeeId: selectedEmpId,
      employeeName: targetUser?.name || 'Employee',
      department: targetUser?.department || 'Operations',
      date: targetDate,
      type: category,
      category: category,
      reason: reason.trim(),
      requestedClockIn: finalReqIn,
      requestedClockOut: finalReqOut,
      requestedBreakOut: finalReqBreakOut,
      requestedBreakIn: finalReqBreakIn,
      requestedHours: category === 'Full Shift' ? Number(requestedHours) : undefined,
      attachmentName: attachmentName || undefined,
      attachmentUrl: attachmentUrl || undefined,
    });

    showSuccessAlert(
      'Time Adjustment Request Submitted!',
      `Adjustment request (${category}) for ${targetUser?.name} on ${formatDateMDYYYY(targetDate)} has been transmitted for review.`
    );

    setReason('');
    setAttachmentName('');
    setAttachmentUrl('');
    setAttachmentSize(0);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border-2 border-zinc-950 max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-500" />
            <h3 className="font-black text-sm uppercase tracking-tight text-zinc-950">
              Request Time Adjustment / Dispute
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 text-sm font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Employee Selection */}
          <div>
            <label className="block text-xs font-black uppercase text-zinc-700 mb-1">
              Select Employee
            </label>
            <select
              value={selectedEmpId}
              onChange={(e) => setSelectedEmpId(e.target.value)}
              required
              className="w-full bg-zinc-50 border border-zinc-300 rounded-xl p-2.5 text-xs font-bold text-zinc-900 focus:ring-2 focus:ring-amber-400 focus:outline-none"
            >
              {users.map((u) => (
                <option key={u.id} value={u.employeeId}>
                  {u.name} ({u.employeeId}) — {u.department} ({u.role})
                </option>
              ))}
            </select>
          </div>

          {/* Date & Category Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <DatePickerInput
              label="Workdate (M/D/YYYY)"
              value={targetDate}
              onChange={(val) => setTargetDate(val)}
            />

            <div>
              <label className="block text-xs font-black uppercase text-zinc-700 mb-1">
                Adjustment Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as AdjustmentCategoryOption)}
                className="w-full bg-zinc-50 border border-zinc-300 rounded-xl p-2.5 text-xs font-bold text-zinc-900 focus:ring-2 focus:ring-amber-400 focus:outline-none"
              >
                <option value="Time-in">Time-in</option>
                <option value="Time-out">Time-out</option>
                <option value="Break-out">Break-out</option>
                <option value="Break-in">Break-in</option>
                <option value="Full Shift">Full Shift (In & Out)</option>
              </select>
            </div>
          </div>

          {/* Requested Time Correction Details - Dynamically renders ONLY the field corresponding to category */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase text-amber-900 block">
                Requested Time Correction Details
              </span>
              <span className="text-[10px] font-bold text-amber-800 bg-amber-200/80 px-2 py-0.5 rounded-md">
                Category: {category}
              </span>
            </div>

            {category === 'Time-in' && (
              <div>
                <label className="block text-[11px] font-bold text-amber-900 uppercase mb-1">
                  Requested Time-In
                </label>
                <input
                  type="time"
                  step="1"
                  value={requestedTimeIn}
                  onChange={(e) => setRequestedTimeIn(e.target.value.length === 5 ? `${e.target.value}:00` : e.target.value)}
                  required
                  className="w-full bg-white border border-amber-300 rounded-lg p-2.5 text-xs font-mono font-bold text-zinc-900 focus:ring-2 focus:ring-amber-400 focus:outline-none cursor-pointer"
                />
              </div>
            )}

            {category === 'Time-out' && (
              <div>
                <label className="block text-[11px] font-bold text-amber-900 uppercase mb-1">
                  Requested Time-Out
                </label>
                <input
                  type="time"
                  step="1"
                  value={requestedTimeOut}
                  onChange={(e) => setRequestedTimeOut(e.target.value.length === 5 ? `${e.target.value}:00` : e.target.value)}
                  required
                  className="w-full bg-white border border-amber-300 rounded-lg p-2.5 text-xs font-mono font-bold text-zinc-900 focus:ring-2 focus:ring-amber-400 focus:outline-none cursor-pointer"
                />
              </div>
            )}

            {category === 'Break-out' && (
              <div>
                <label className="block text-[11px] font-bold text-amber-900 uppercase mb-1">
                  Requested Break-Out
                </label>
                <input
                  type="time"
                  step="1"
                  value={requestedBreakOut}
                  onChange={(e) => setRequestedBreakOut(e.target.value.length === 5 ? `${e.target.value}:00` : e.target.value)}
                  required
                  className="w-full bg-white border border-amber-300 rounded-lg p-2.5 text-xs font-mono font-bold text-zinc-900 focus:ring-2 focus:ring-amber-400 focus:outline-none cursor-pointer"
                />
              </div>
            )}

            {category === 'Break-in' && (
              <div>
                <label className="block text-[11px] font-bold text-amber-900 uppercase mb-1">
                  Requested Break-In
                </label>
                <input
                  type="time"
                  step="1"
                  value={requestedBreakIn}
                  onChange={(e) => setRequestedBreakIn(e.target.value.length === 5 ? `${e.target.value}:00` : e.target.value)}
                  required
                  className="w-full bg-white border border-amber-300 rounded-lg p-2.5 text-xs font-mono font-bold text-zinc-900 focus:ring-2 focus:ring-amber-400 focus:outline-none cursor-pointer"
                />
              </div>
            )}

            {category === 'Full Shift' && (
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-amber-900 uppercase mb-1">
                    Clock-In Time
                  </label>
                  <input
                    type="time"
                    step="1"
                    value={requestedTimeIn}
                    onChange={(e) => {
                      const val = e.target.value.length === 5 ? `${e.target.value}:00` : e.target.value;
                      setRequestedTimeIn(val);
                      const hrs = calculateGrossHours(val, requestedTimeOut);
                      if (hrs > 0) setRequestedHours(Math.round(hrs * 10) / 10);
                    }}
                    className="w-full bg-white border border-amber-300 rounded-lg p-2 text-xs font-mono font-bold text-zinc-900 cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-amber-900 uppercase mb-1">
                    Clock-Out Time
                  </label>
                  <input
                    type="time"
                    step="1"
                    value={requestedTimeOut}
                    onChange={(e) => {
                      const val = e.target.value.length === 5 ? `${e.target.value}:00` : e.target.value;
                      setRequestedTimeOut(val);
                      const hrs = calculateGrossHours(requestedTimeIn, val);
                      if (hrs > 0) setRequestedHours(Math.round(hrs * 10) / 10);
                    }}
                    className="w-full bg-white border border-amber-300 rounded-lg p-2 text-xs font-mono font-bold text-zinc-900 cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-amber-900 uppercase mb-1">
                    Total Hours
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.5"
                    max="24"
                    value={requestedHours}
                    onChange={(e) => setRequestedHours(Number(e.target.value))}
                    className="w-full bg-white border border-amber-300 rounded-lg p-2 text-xs font-mono font-black text-amber-950"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Upload File Attachment Option */}
          <div>
            <label className="block text-xs font-black uppercase text-zinc-700 mb-1">
              Upload File Attachment (Optional Proof / Document)
            </label>
            {attachmentName ? (
              <div className="flex items-center justify-between p-3 bg-amber-50/80 border border-amber-300 rounded-xl space-x-2">
                <div className="flex items-center gap-2 truncate">
                  <Paperclip className="w-4 h-4 text-amber-800 shrink-0" />
                  <span className="text-xs font-bold text-zinc-900 truncate">{attachmentName}</span>
                  {attachmentSize > 0 && (
                    <span className="text-[10px] text-zinc-500 font-mono">
                      ({(attachmentSize / 1024).toFixed(1)} KB)
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleRemoveAttachment}
                  className="p-1 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0"
                  title="Remove attachment"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center p-3.5 border-2 border-dashed border-zinc-300 hover:border-amber-400 bg-zinc-50/80 hover:bg-amber-50/40 rounded-xl cursor-pointer transition-colors text-center group">
                <Upload className="w-5 h-5 text-zinc-400 group-hover:text-amber-600 mb-1 transition-colors" />
                <span className="text-xs font-bold text-zinc-700 group-hover:text-amber-900">
                  Click to attach image proof, barrier photo, or document
                </span>
                <span className="text-[10px] text-zinc-500 mt-0.5">
                  Supports JPG, PNG, WEBP, PDF, Word documents (Max 8MB)
                </span>
                <input
                  type="file"
                  accept="image/*,.pdf,.doc,.docx"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* Reason / Explanation textarea */}
          <div>
            <label className="block text-xs font-black uppercase text-zinc-700 mb-1">
              Reason / Explanation <span className="text-rose-600">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Provide explanation for time adjustment (this explanation will reflect on the Note/Anomaly column upon approval)..."
              rows={3}
              required
              className="w-full bg-zinc-50 border border-zinc-300 rounded-xl p-2.5 text-xs font-medium text-zinc-900 focus:ring-2 focus:ring-amber-400 focus:outline-none"
            />
            <p className="text-[10px] text-zinc-500 mt-1">
              Note: The reason entered here will automatically populate the <strong>Note/Anomaly</strong> column in the employee's attendance log upon approval.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-600 bg-zinc-100 hover:bg-zinc-200 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-zinc-950 bg-amber-400 hover:bg-amber-300 border border-zinc-950 shadow-xs cursor-pointer"
            >
              Transmit Time Adjustment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

