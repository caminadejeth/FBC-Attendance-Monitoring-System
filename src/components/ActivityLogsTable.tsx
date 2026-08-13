import React, { useState } from 'react';
import { ActivityActionType, ActivityLog, User } from '../types';
import { formatRealtimeTimestamp } from '../utils/timeFormatters';
import { yellowCabSwal, showSuccessAlert } from '../utils/sweetAlerts';
import {
  History,
  Trash2,
  Search,
  Filter,
} from 'lucide-react';

interface ActivityLogsTableProps {
  activityLogs: ActivityLog[];
  onClearActivityLogs?: () => void;
  currentUser?: User;
}

export const ActivityLogsTable: React.FC<ActivityLogsTableProps> = ({
  activityLogs = [],
  onClearActivityLogs,
  currentUser,
}) => {
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [logCategoryFilter, setLogCategoryFilter] = useState('ALL');

  const filteredLogs = activityLogs.filter((log) => {
    const matchesSearch =
      log.details.toLowerCase().includes(logSearchQuery.toLowerCase()) ||
      log.userName.toLowerCase().includes(logSearchQuery.toLowerCase()) ||
      log.actionCategory.toLowerCase().includes(logSearchQuery.toLowerCase()) ||
      log.actionType.toLowerCase().includes(logSearchQuery.toLowerCase());

    const matchesCategory =
      logCategoryFilter === 'ALL' ||
      logCategoryFilter.toUpperCase() === log.actionCategory.toUpperCase() ||
      logCategoryFilter.toUpperCase() === log.actionType.toUpperCase();

    return matchesSearch && matchesCategory;
  });

  const getActionBadgeColor = (type: ActivityActionType) => {
    switch (type) {
      case 'DISPUTE_APPROVAL':
        return 'bg-emerald-200 text-emerald-950 border-emerald-400 font-black';
      case 'DISPUTE_REJECTION':
        return 'bg-rose-200 text-rose-950 border-rose-400 font-black';
      case 'DISPUTE_FILING':
        return 'bg-amber-200 text-amber-950 border-amber-400 font-bold';
      case 'DATA_CLEAR':
        return 'bg-red-600 text-white border-red-700 font-black tracking-wider animate-pulse';
      case 'CTO_ADJUSTMENT':
        return 'bg-sky-200 text-sky-950 border-sky-400 font-bold';
      case 'USER_MANAGEMENT':
        return 'bg-blue-600 text-white border-blue-700 font-black';
      case 'BIOMETRIC_UPLOAD':
        return 'bg-teal-200 text-teal-950 border-teal-400 font-bold';
      case 'SCHEDULE_UPDATE':
        return 'bg-indigo-200 text-indigo-950 border-indigo-400 font-bold';
      default:
        return 'bg-zinc-200 text-zinc-900 border-zinc-400 font-bold';
    }
  };

  const getRowCriticalityStyle = (type: ActivityActionType) => {
    switch (type) {
      case 'DATA_CLEAR':
        return 'bg-red-50/90 border-l-4 border-l-red-600 hover:bg-red-100/90 text-red-950 font-medium';
      case 'USER_MANAGEMENT':
        return 'bg-blue-50/80 border-l-4 border-l-blue-600 hover:bg-blue-100/80 text-blue-950 font-medium';
      case 'DISPUTE_APPROVAL':
        return 'bg-emerald-50/80 border-l-4 border-l-emerald-600 hover:bg-emerald-100/80 text-emerald-950 font-medium';
      case 'DISPUTE_REJECTION':
        return 'bg-rose-50/70 border-l-4 border-l-rose-500 hover:bg-rose-100/80 text-rose-950';
      case 'DISPUTE_FILING':
        return 'bg-amber-50/70 border-l-4 border-l-amber-500 hover:bg-amber-100/80 text-amber-950';
      case 'CTO_ADJUSTMENT':
        return 'bg-sky-50/70 border-l-4 border-l-sky-600 hover:bg-sky-100/80 text-sky-950';
      case 'BIOMETRIC_UPLOAD':
        return 'bg-teal-50/70 border-l-4 border-l-teal-600 hover:bg-teal-100/80 text-teal-950';
      case 'SCHEDULE_UPDATE':
        return 'bg-indigo-50/70 border-l-4 border-l-indigo-600 hover:bg-indigo-100/80 text-indigo-950';
      default:
        return 'bg-zinc-50/50 border-l-4 border-l-zinc-300 hover:bg-zinc-100/70 text-zinc-900';
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-amber-400 text-zinc-950 font-black';
      case 'BRANCH_MANAGER':
        return 'bg-zinc-900 text-amber-400 font-bold';
      case 'PAYROLL':
        return 'bg-blue-900 text-blue-100 font-bold';
      case 'SHIFT_MANAGER':
        return 'bg-emerald-800 text-emerald-100 font-bold';
      default:
        return 'bg-zinc-200 text-zinc-700 font-medium';
    }
  };

  const handleConfirmClearLogs = async () => {
    if (!onClearActivityLogs) return;
    const confirm = await yellowCabSwal.fire({
      title: 'Clear All Activity Logs?',
      text: 'Are you sure you want to permanently clear the chronological history of activity logs? This action cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, Clear All Logs',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#d33',
    });

    if (confirm.isConfirmed) {
      onClearActivityLogs();
      showSuccessAlert('Activity logs cleared successfully.');
    }
  };

  return (
    <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-zinc-200 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-100 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-100 text-amber-900 rounded-xl">
              <History className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-black text-zinc-900 tracking-tight uppercase">
              System Activity Log & Audit Trail
            </h2>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Chronological audit trail of dispute approvals, data clears, manual adjustments, and administrative system actions across all users.
          </p>
        </div>

        {onClearActivityLogs && activityLogs.length > 0 && (!currentUser || currentUser.role === 'ADMIN') && (
          <button
            onClick={handleConfirmClearLogs}
            className="flex items-center gap-2 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl border border-rose-200 transition-colors cursor-pointer self-start md:self-auto"
          >
            <Trash2 className="w-4 h-4" />
            <span>Clear Activity History</span>
          </button>
        )}
      </div>

      {/* Stats Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 bg-zinc-50 rounded-xl border border-zinc-200">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Total Recorded Logs</span>
          <span className="text-lg font-black text-zinc-900">{activityLogs.length}</span>
        </div>
        <div className="p-3.5 bg-emerald-50/70 rounded-xl border border-emerald-200/80">
          <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Dispute Approvals</span>
          <span className="text-lg font-black text-emerald-900">
            {activityLogs.filter(l => l.actionType === 'DISPUTE_APPROVAL').length}
          </span>
        </div>
        <div className="p-3.5 bg-blue-50/70 rounded-xl border border-blue-200/80">
          <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">Manual Adjustments</span>
          <span className="text-lg font-black text-blue-900">
            {activityLogs.filter(l => l.actionType === 'CTO_ADJUSTMENT' || l.actionCategory === 'Adjustments').length}
          </span>
        </div>
        <div className="p-3.5 bg-rose-50/70 rounded-xl border border-rose-200/80">
          <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider block">Data Clear Actions</span>
          <span className="text-lg font-black text-rose-900">
            {activityLogs.filter(l => l.actionType === 'DATA_CLEAR').length}
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-zinc-50/80 p-3 rounded-xl border border-zinc-200">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={logSearchQuery}
            onChange={(e) => setLogSearchQuery(e.target.value)}
            placeholder="Search activity logs by staff name, details, or action category..."
            className="w-full pl-9 pr-3 py-2 bg-white border border-zinc-200 rounded-lg text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-zinc-500 shrink-0" />
          <select
            value={logCategoryFilter}
            onChange={(e) => setLogCategoryFilter(e.target.value)}
            className="w-full sm:w-48 px-3 py-2 bg-white border border-zinc-200 rounded-lg text-xs font-bold text-zinc-800 focus:ring-2 focus:ring-amber-500 focus:outline-none"
          >
            <option value="ALL">All Categories</option>
            <option value="Disputes">Dispute Actions</option>
            <option value="Data Clear">Data Clear Events</option>
            <option value="Adjustments">Manual Adjustments</option>
            <option value="Users">User Management</option>
            <option value="Biometrics">Biometric Uploads</option>
            <option value="Schedules">Roster Schedules</option>
          </select>
        </div>
      </div>

      {/* Criticality Color-Coding Legend */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-zinc-100/70 rounded-lg border border-zinc-200 text-[11px] font-semibold text-zinc-700">
        <span className="font-bold text-zinc-900 uppercase tracking-wider text-[10px] mr-1">Action Criticality Legend:</span>
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-red-100 text-red-950 border border-red-300 font-bold">
          <span className="w-2 h-2 rounded-full bg-red-600"></span> DATA CLEAR (Critical)
        </span>
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-blue-100 text-blue-950 border border-blue-300 font-bold">
          <span className="w-2 h-2 rounded-full bg-blue-600"></span> USER MANAGEMENT
        </span>
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-100 text-emerald-950 border border-emerald-300 font-bold">
          <span className="w-2 h-2 rounded-full bg-emerald-600"></span> APPROVALS
        </span>
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-rose-100 text-rose-950 border border-rose-300 font-bold">
          <span className="w-2 h-2 rounded-full bg-rose-500"></span> REJECTIONS
        </span>
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-100 text-amber-950 border border-amber-300 font-bold">
          <span className="w-2 h-2 rounded-full bg-amber-500"></span> FILINGS
        </span>
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-sky-100 text-sky-950 border border-sky-300 font-bold">
          <span className="w-2 h-2 rounded-full bg-sky-600"></span> CTO / ADJUSTMENTS
        </span>
      </div>

      {/* Activity Log List */}
      {filteredLogs.length === 0 ? (
        <div className="text-center py-12 bg-zinc-50 rounded-xl border border-dashed border-zinc-200">
          <History className="w-10 h-10 text-zinc-300 mx-auto mb-2" />
          <p className="text-sm font-bold text-zinc-600">No activity logs found</p>
          <p className="text-xs text-zinc-400 mt-1">
            {activityLogs.length === 0
              ? 'No system events or actions have been recorded yet.'
              : 'Try adjusting your search query or category filter.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 shadow-xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-100/80 text-zinc-700 font-black uppercase tracking-wider text-[10px] border-b border-zinc-200">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Performed By</th>
                <th className="px-4 py-3">Action Type</th>
                <th className="px-4 py-3">Details / Activity Record</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {filteredLogs.map((log) => (
                <tr
                  key={log.id}
                  className={`transition-colors ${getRowCriticalityStyle(log.actionType)}`}
                >
                  <td className="px-4 py-3 font-mono text-[11px] whitespace-nowrap text-zinc-600">
                    {formatRealtimeTimestamp(log.timestamp)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="font-extrabold text-zinc-900">{log.userName}</div>
                    <span className={`inline-block text-[9px] px-1.5 py-0.5 rounded uppercase mt-0.5 ${getRoleBadge(log.userRole)}`}>
                      {log.userRole}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] border ${getActionBadgeColor(log.actionType)}`}>
                      {log.actionType.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="max-w-xl text-xs leading-relaxed text-zinc-800">
                      {log.details}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
