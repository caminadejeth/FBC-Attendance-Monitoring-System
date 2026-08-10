import React, { useState } from 'react';
import { SyncLog } from '../types';
import { GoogleSheetsPayload } from '../utils/googleSheetsSync';
import {
  FileSpreadsheet,
  CheckCircle2,
  ExternalLink,
  Download,
  Copy,
  Check,
  Table,
} from 'lucide-react';

interface GoogleSheetsSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  syncLog: SyncLog | null;
  payload: GoogleSheetsPayload | null;
}

export const GoogleSheetsSyncModal: React.FC<GoogleSheetsSyncModalProps> = ({
  isOpen,
  onClose,
  syncLog,
  payload,
}) => {
  const [activeSheetTab, setActiveSheetTab] = useState<'RAW' | 'DAILY' | 'PAYROLL'>('DAILY');
  const [copied, setCopied] = useState(false);

  if (!isOpen || !syncLog || !payload) return null;

  const handleCopySheetUrl = () => {
    navigator.clipboard.writeText(syncLog.sheetUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-gray-200 space-y-5 animate-in fade-in zoom-in-95 my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#656D4A] text-white flex items-center justify-center shadow-xs">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-[#2C3524]">
                  Google Sheets Schema Generation Complete
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Synced Live
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Generated 3 normalized sheets for FBC Restaurants Corp attendance monitoring
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-sm font-bold"
          >
            ✕
          </button>
        </div>

        {/* Sync Metadata Banner */}
        <div className="p-4 bg-[#F7F8F5] border border-[#D3D8C8] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div>
            <span className="font-bold text-[#2C3524]">Google Sheets Workbook Status:</span>{' '}
            <span className="font-mono text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-bold">
              3 Normalized Sheets Ready
            </span>
            <div className="text-[11px] text-gray-500 mt-1">
              Exported by: <strong>{syncLog.syncedBy}</strong> at {syncLog.syncedAt}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleCopySheetUrl}
              className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg font-bold text-gray-700 hover:bg-gray-50 flex items-center gap-1 transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied URL!' : 'Copy Link'}
            </button>

            <a
              href="https://sheets.google.com"
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-1.5 bg-[#656D4A] hover:bg-[#4A543E] text-white font-bold rounded-lg flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
            >
              Open Google Sheets <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Sheet Tabs */}
        <div className="border-b border-gray-200">
          <div className="flex space-x-2">
            <button
              onClick={() => setActiveSheetTab('DAILY')}
              className={`py-2 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 ${
                activeSheetTab === 'DAILY'
                  ? 'border-[#656D4A] text-[#2C3524]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Table className="w-3.5 h-3.5 text-[#656D4A]" />
              Sheet 2: Daily Summaries ({payload.dailySummaries.length})
            </button>

            <button
              onClick={() => setActiveSheetTab('PAYROLL')}
              className={`py-2 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 ${
                activeSheetTab === 'PAYROLL'
                  ? 'border-[#656D4A] text-[#2C3524]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Table className="w-3.5 h-3.5 text-[#656D4A]" />
              Sheet 3: Payroll Period Summary ({payload.payrollSummaries.length})
            </button>

            <button
              onClick={() => setActiveSheetTab('RAW')}
              className={`py-2 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 ${
                activeSheetTab === 'RAW'
                  ? 'border-[#656D4A] text-[#2C3524]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Table className="w-3.5 h-3.5 text-[#656D4A]" />
              Sheet 1: Raw Chronological Logs ({payload.rawLogs.length})
            </button>
          </div>
        </div>

        {/* Live Sheet Data Table Preview */}
        <div className="max-h-72 overflow-auto border border-gray-200 rounded-xl">
          {activeSheetTab === 'DAILY' && (
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F7F8F5] text-[#4A543E] font-bold sticky top-0 border-b">
                <tr>
                  <th className="p-2.5">Employee ID</th>
                  <th className="p-2.5">Name</th>
                  <th className="p-2.5">Date</th>
                  <th className="p-2.5">First In</th>
                  <th className="p-2.5">Last Out</th>
                  <th className="p-2.5">Net Hours</th>
                  <th className="p-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {payload.dailySummaries.slice(0, 15).map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="p-2.5 font-mono font-bold text-[#656D4A]">{row['Employee ID']}</td>
                    <td className="p-2.5 font-bold">{row['Employee Name']}</td>
                    <td className="p-2.5">{row['Date']}</td>
                    <td className="p-2.5 font-mono">{row['First Clock In']}</td>
                    <td className="p-2.5 font-mono">{row['Last Clock Out']}</td>
                    <td className="p-2.5 font-bold text-[#2C3524]">{row['Net Hours Worked']} hrs</td>
                    <td className="p-2.5 font-bold">{row['Status']}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeSheetTab === 'PAYROLL' && (
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F7F8F5] text-[#4A543E] font-bold sticky top-0 border-b">
                <tr>
                  <th className="p-2.5">Employee ID</th>
                  <th className="p-2.5">Name</th>
                  <th className="p-2.5">Hourly Rate</th>
                  <th className="p-2.5">Days Worked</th>
                  <th className="p-2.5">Net Payable Hrs</th>
                  <th className="p-2.5">Gross Pay</th>
                  <th className="p-2.5">Net Pay</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {payload.payrollSummaries.map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="p-2.5 font-mono font-bold text-[#656D4A]">{row['Employee ID']}</td>
                    <td className="p-2.5 font-bold">{row['Employee Name']}</td>
                    <td className="p-2.5 font-mono">₱{row['Hourly Rate (PHP)']?.toFixed(2)}</td>
                    <td className="p-2.5">{row['Days Worked']}</td>
                    <td className="p-2.5 font-bold">{row['Net Payable Hours']} hrs</td>
                    <td className="p-2.5 font-bold text-emerald-800">₱{row['Gross Pay (PHP)']?.toFixed(2)}</td>
                    <td className="p-2.5 font-black text-[#2C3524]">₱{row['Net Pay (PHP)']?.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeSheetTab === 'RAW' && (
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F7F8F5] text-[#4A543E] font-bold sticky top-0 border-b">
                <tr>
                  <th className="p-2.5">Punch ID</th>
                  <th className="p-2.5">Employee ID</th>
                  <th className="p-2.5">Name</th>
                  <th className="p-2.5">Timestamp</th>
                  <th className="p-2.5">Punch Type</th>
                  <th className="p-2.5">Device ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {payload.rawLogs.slice(0, 15).map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="p-2.5 font-mono text-gray-400">{row['Punch ID']}</td>
                    <td className="p-2.5 font-mono font-bold text-[#656D4A]">{row['Employee ID']}</td>
                    <td className="p-2.5 font-bold">{row['Employee Name']}</td>
                    <td className="p-2.5 font-mono text-[#2C3524]">{row['Timestamp']}</td>
                    <td className="p-2.5 font-bold">{row['Punch Type']}</td>
                    <td className="p-2.5 text-gray-500">{row['Device ID']}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex items-center justify-between pt-2 border-t text-xs">
          <span className="text-gray-500">
            FBC Restaurants Corp • Automated Google Sheets Sync Pipeline
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-[#656D4A] hover:bg-[#4A543E] text-white font-bold rounded-xl shadow-xs transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
