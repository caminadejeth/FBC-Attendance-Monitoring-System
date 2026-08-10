import React, { useState } from 'react';
import { AttendanceSummaryDaily, CtoManualAdjustment, CtoRequest, User } from '../types';
import { getUserCtoStats } from '../utils/ctoHelper';
import { DatePickerInput } from './DatePickerInput';
import { TablePagination } from './TablePagination';
import { showSuccessAlert, showActionSuccessToast } from '../utils/sweetAlerts';
import { formatDateWithDay, formatDateMDYY } from '../utils/timeFormatters';
import {
  Award,
  PlusCircle,
  Clock,
  CheckCircle2,
  AlertCircle,
  Clock3,
  CalendarDays,
  FileText,
  TrendingUp,
  Sparkles,
  Calendar,
  X,
  Send,
} from 'lucide-react';

interface CtoLeaveDashboardProps {
  currentUser: User;
  summaries: AttendanceSummaryDaily[];
  ctoRequests: CtoRequest[];
  ctoAdjustments: CtoManualAdjustment[];
  onSubmitCtoRequest: (req: Omit<CtoRequest, 'id' | 'status' | 'submittedAt'>) => void;
}

export const CtoLeaveDashboard: React.FC<CtoLeaveDashboardProps> = ({
  currentUser,
  summaries,
  ctoRequests,
  ctoAdjustments,
  onSubmitCtoRequest,
}) => {
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  // CTO Request Form Modal State
  const [showModal, setShowModal] = useState<boolean>(false);
  const [requestType, setRequestType] = useState<'LEAVE' | 'CREDIT'>('LEAVE');
  const [requestDate, setRequestDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [requestHours, setRequestHours] = useState<number>(8.0);
  const [requestReason, setRequestReason] = useState<string>('');

  // Calculate CTO Stats
  const ctoStats = getUserCtoStats(currentUser.employeeId, summaries, ctoRequests, ctoAdjustments);
  const myRequests = ctoRequests.filter((r) => r.employeeId === currentUser.employeeId);

  // Filter requests
  const filteredRequests = myRequests.filter((r) => {
    if (filterStatus === 'ALL') return true;
    return r.status === filterStatus;
  });

  const handleOpenModal = (type: 'LEAVE' | 'CREDIT') => {
    setRequestType(type);
    setRequestHours(type === 'LEAVE' ? 8.0 : 1.5);
    setRequestReason('');
    setRequestDate(new Date().toISOString().split('T')[0]);
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestReason.trim()) return;

    if (requestType === 'LEAVE' && requestHours > ctoStats.availableBalance) {
      if (
        !window.confirm(
          `Requested ${requestHours}h exceeds your current available balance of ${ctoStats.availableBalance.toFixed(
            1
          )}h. Do you still wish to submit for Payroll review?`
        )
      ) {
        return;
      }
    }

    onSubmitCtoRequest({
      employeeId: currentUser.employeeId,
      employeeName: currentUser.name,
      department: currentUser.department,
      date: requestDate,
      hoursRequested: Number(requestHours),
      requestType,
      reason: requestReason.trim(),
    });

    setShowModal(false);
    showSuccessAlert(
      'CTO Request Submitted!',
      `Your ${requestType === 'LEAVE' ? 'CTO Leave' : 'CTO Credit'} request for ${requestHours} hours on ${requestDate} has been sent for Payroll approval.`
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-[#D3D8C8] p-5 md:p-6 shadow-xs space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-600" />
            <h2 className="text-base md:text-lg font-black text-[#2C3524]">
              Compensatory Time Off (CTO) Leave Requests & Balance
            </h2>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            File CTO leave requests for planned shift absences or request CTO credits earned from flexitime overtime.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => handleOpenModal('LEAVE')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 text-xs font-black border border-zinc-950 shadow-2xs transition-all cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            File CTO Leave Request
          </button>
          <button
            onClick={() => handleOpenModal('CREDIT')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#656D4A] hover:bg-[#4A543E] text-white text-xs font-bold shadow-2xs transition-all cursor-pointer"
          >
            <TrendingUp className="w-4 h-4" />
            Request CTO Credit
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-gradient-to-br from-amber-50 to-amber-100/60 p-4 rounded-xl border border-amber-300 shadow-2xs">
          <span className="text-[11px] font-black uppercase text-amber-900 tracking-wider block">
            Available CTO Balance
          </span>
          <div className="text-2xl font-black text-amber-950 mt-1 font-mono">
            {ctoStats.availableBalance.toFixed(1)} <span className="text-xs">hrs</span>
          </div>
          <span className="text-[10px] text-amber-800 font-bold block mt-0.5">
            Ready to use for leave
          </span>
        </div>

        <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 shadow-2xs">
          <span className="text-[11px] font-black uppercase text-emerald-900 tracking-wider block">
            Earned Overtime Credit
          </span>
          <div className="text-2xl font-black text-emerald-950 mt-1 font-mono">
            +{ctoStats.earnedFromAttendance.toFixed(1)} <span className="text-xs">hrs</span>
          </div>
          <span className="text-[10px] text-emerald-800 font-bold block mt-0.5">
            Accumulated from &gt;10h shifts
          </span>
        </div>

        <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-200 shadow-2xs">
          <span className="text-[11px] font-black uppercase text-zinc-700 tracking-wider block">
            Approved Leave Used
          </span>
          <div className="text-2xl font-black text-zinc-900 mt-1 font-mono">
            -{ctoStats.usedApproved.toFixed(1)} <span className="text-xs">hrs</span>
          </div>
          <span className="text-[10px] text-zinc-500 font-bold block mt-0.5">
            Deducted for leave
          </span>
        </div>

        <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 shadow-2xs">
          <span className="text-[11px] font-black uppercase text-blue-900 tracking-wider block">
            Pending Requests
          </span>
          <div className="text-2xl font-black text-blue-950 mt-1 font-mono">
            {myRequests.filter((r) => r.status === 'PENDING').length}
          </div>
          <span className="text-[10px] text-blue-800 font-bold block mt-0.5">
            Awaiting Payroll Review
          </span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between border-b border-gray-100 pb-3">
        <div className="flex items-center gap-1.5 bg-[#F7F8F5] p-1 rounded-xl border border-[#D3D8C8]">
          {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1 rounded-lg text-xs font-extrabold transition-all ${
                filterStatus === st
                  ? 'bg-[#656D4A] text-white shadow-2xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <span className="text-xs text-gray-500 font-mono font-bold">
          Showing {filteredRequests.length} request(s)
        </span>
      </div>

      {/* CTO Requests Table */}
      <div className="overflow-x-auto rounded-xl border border-[#D3D8C8]">
        <table className="w-full text-left border-collapse min-w-[700px]">
          <thead>
            <tr className="bg-[#656D4A] text-white text-[11px] font-bold uppercase tracking-wider">
              <th className="p-2.5">Date Requested</th>
              <th className="p-2.5">Request Type</th>
              <th className="p-2.5 text-center">Hours</th>
              <th className="p-2.5">Reason / Purpose</th>
              <th className="p-2.5">Submitted On</th>
              <th className="p-2.5 text-center">Status</th>
              <th className="p-2.5">Approver Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-xs">
            {filteredRequests.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-gray-500 font-bold">
                  No CTO leave or credit requests found.
                </td>
              </tr>
            ) : (
              filteredRequests
                .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                .map((req) => (
                <tr key={req.id} className="hover:bg-[#F9FAF6]">
                  <td className="p-2.5 font-extrabold text-[#2C3524]">{req.date}</td>
                  <td className="p-2.5">
                    {req.requestType === 'CREDIT' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300">
                        + CTO Credit Request
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300">
                        - CTO Leave Request
                      </span>
                    )}
                  </td>
                  <td className="p-2.5 text-center font-mono font-bold text-sm">
                    {req.hoursRequested.toFixed(1)}h
                  </td>
                  <td className="p-2.5 text-gray-700 max-w-[200px] truncate" title={req.reason}>
                    {req.reason}
                  </td>
                  <td className="p-2.5 text-gray-500 font-mono text-[11px]">{req.submittedAt}</td>
                  <td className="p-2.5 text-center">
                    {req.status === 'PENDING' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300">
                        <Clock3 className="w-3 h-3" /> PENDING
                      </span>
                    )}
                    {req.status === 'APPROVED' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> APPROVED
                      </span>
                    )}
                    {req.status === 'REJECTED' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-900 border border-rose-300">
                        <AlertCircle className="w-3 h-3 text-rose-600" /> REJECTED
                      </span>
                    )}
                  </td>
                  <td className="p-2.5 text-xs text-gray-700">
                    {req.status === 'REJECTED' ? (
                      <div className="space-y-0.5">
                        <span className="font-bold text-rose-700 block">
                          Rejected by: <strong className="text-rose-950">{req.reviewedBy || 'Branch Manager'}</strong>
                        </span>
                        {req.reviewNotes && (
                          <span className="text-[11px] text-zinc-600 block italic">
                            "{req.reviewNotes}"
                          </span>
                        )}
                        {req.reviewedAt && (
                          <span className="text-[10px] text-zinc-400 font-mono block">
                            {req.reviewedAt}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="italic text-gray-600">
                        {req.reviewNotes || (req.reviewedBy ? `Reviewed by ${req.reviewedBy}` : '—')}
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <TablePagination
          currentPage={currentPage}
          totalPages={Math.ceil(filteredRequests.length / pageSize)}
          pageSize={pageSize}
          totalItems={filteredRequests.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          pageSizeOptions={[5, 10, 20, 50]}
        />
      </div>

      {/* Modal for Filing CTO Leave / Credit Request */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border-2 border-zinc-950 max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-500" />
                <h3 className="font-black text-sm uppercase tracking-tight text-zinc-950">
                  {requestType === 'LEAVE' ? 'File CTO Leave Request' : 'Request CTO Credit'}
                </h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-zinc-400 hover:text-zinc-600 text-sm font-bold cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Selector Tabs */}
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-zinc-100 rounded-xl text-xs font-black">
              <button
                type="button"
                onClick={() => {
                  setRequestType('LEAVE');
                  setRequestHours(8.0);
                }}
                className={`py-2 px-3 rounded-lg text-center transition-all cursor-pointer ${
                  requestType === 'LEAVE'
                    ? 'bg-amber-400 text-zinc-950 shadow-xs border border-zinc-950'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                - File CTO Leave Request
              </button>
              <button
                type="button"
                onClick={() => {
                  setRequestType('CREDIT');
                  setRequestHours(1.5);
                }}
                className={`py-2 px-3 rounded-lg text-center transition-all cursor-pointer ${
                  requestType === 'CREDIT'
                    ? 'bg-emerald-500 text-zinc-950 shadow-xs border border-zinc-950'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                + Request CTO Credit
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs space-y-1">
                <span className="font-bold text-amber-900 block">Available CTO Balance:</span>
                <span className="font-mono text-xl font-black text-amber-950">
                  {ctoStats.availableBalance.toFixed(1)} hours
                </span>
                <p className="text-[10px] text-amber-800 leading-tight">
                  {requestType === 'LEAVE'
                    ? 'CTO Leave deducts hours from your accumulated balance upon Payroll approval.'
                    : 'CTO Credit adds extra shift overtime hours to your accumulated balance upon Payroll approval.'}
                </p>
              </div>

              <div>
                <DatePickerInput
                  label={requestType === 'LEAVE' ? 'Date of Absence / Planned Leave' : 'Date of Overtime Shift'}
                  value={requestDate}
                  onChange={(val) => setRequestDate(val)}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-zinc-700 mb-1">
                  {requestType === 'LEAVE' ? 'CTO Leave Hours to Deduct' : 'CTO Credit Hours to Add'}
                </label>
                {requestType === 'LEAVE' ? (
                  <select
                    value={requestHours}
                    onChange={(e) => setRequestHours(Number(e.target.value))}
                    className="w-full bg-zinc-50 border border-zinc-300 rounded-xl p-2.5 text-xs font-bold text-zinc-900 focus:ring-2 focus:ring-amber-400 focus:outline-none"
                  >
                    <option value={8.0}>8.0 Hours (Full Day Shift Leave)</option>
                    <option value={4.0}>4.0 Hours (Half Day Shift Leave)</option>
                    <option value={2.0}>2.0 Hours (Partial Shift Leave)</option>
                    <option value={1.0}>1.0 Hour (Partial Shift Leave)</option>
                  </select>
                ) : (
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="24"
                    value={requestHours}
                    onChange={(e) => setRequestHours(Number(e.target.value))}
                    className="w-full bg-zinc-50 border border-zinc-300 rounded-xl p-2.5 text-xs font-bold text-zinc-900 focus:ring-2 focus:ring-amber-400 focus:outline-none"
                    required
                  />
                )}
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-zinc-700 mb-1">
                  Reason / Purpose for Request
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder={
                    requestType === 'LEAVE'
                      ? 'e.g. Personal emergency, family errand, medical checkup using accrued CTO hours...'
                      : 'e.g. Extended store closing duty on Friday shift (>10h total duration)...'
                  }
                  value={requestReason}
                  onChange={(e) => setRequestReason(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-300 rounded-xl p-2.5 text-xs font-medium text-zinc-900 focus:ring-2 focus:ring-amber-400 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-extrabold text-zinc-600 hover:bg-zinc-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-400 hover:bg-amber-300 text-zinc-950 font-black text-xs uppercase tracking-wider rounded-xl border border-zinc-950 shadow-xs transition-colors cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
