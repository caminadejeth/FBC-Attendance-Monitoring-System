import React, { useState } from 'react';
import { User, AttendanceSummaryDaily } from '../types';
import {
  parseAndCleanBiometricDat,
  generateSampleBiometricDat,
} from '../utils/fileProcessor';
import {
  showUploadProcessingAlert,
  showUploadSuccessAlert,
  showUploadErrorAlert,
} from '../utils/sweetAlerts';
import {
  Upload,
  Download,
  FileText,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Clock,
  UserCheck,
  Calendar,
  Sparkles,
} from 'lucide-react';

interface ZktecoDatUploaderProps {
  users: User[];
  currentUser?: User;
  onUploadProcessed: (newSummaries: AttendanceSummaryDaily[]) => void;
}

export const ZktecoDatUploader: React.FC<ZktecoDatUploaderProps> = ({
  users,
  currentUser,
  onUploadProcessed,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<{
    type: 'success' | 'error' | 'warning';
    title: string;
    text: string;
    details?: string[];
  } | null>(null);

  const [lastParsedSummaries, setLastParsedSummaries] = useState<AttendanceSummaryDaily[]>([]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setUploadMessage(null);

    // Show SweetAlert processing dialog
    showUploadProcessingAlert(file.name);

    const result = await parseAndCleanBiometricDat(file, users);
    setIsProcessing(false);

    if (result.isValid) {
      const taggedSummaries = result.summaries.map((s) => ({
        ...s,
        uploadedByUserId: currentUser?.id,
        branch: s.branch || currentUser?.department || 'Main Branch',
      }));
      onUploadProcessed(taggedSummaries);
      setLastParsedSummaries(taggedSummaries);

      setUploadMessage({
        type: 'success',
        title: 'ZKTeco Old Version .DAT File Parsed Successfully!',
        text: `Parsed ${result.rawRowsCount} valid log lines into ${result.cleanedPunchesCount} deduplicated punches. Generated ${result.summaries.length} daily employee attendance summaries.`,
        details: result.warnings,
      });

      // Show SweetAlert success dialog
      showUploadSuccessAlert(
        result.rawRowsCount,
        result.cleanedPunchesCount,
        result.summaries.length,
        result.warnings
      );
    } else {
      setUploadMessage({
        type: 'error',
        title: 'ZKTeco .DAT File Validation Failed',
        text: 'Unable to parse attendance log lines from the uploaded file.',
        details: result.errors,
      });

      // Show SweetAlert error dialog
      showUploadErrorAlert(result.errors);
    }

    e.target.value = '';
  };

  return (
    <div className="bg-white rounded-2xl border-2 border-zinc-950 p-6 shadow-xl space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-400 text-zinc-950 border border-zinc-950">
              Old Model Biometric Integration
            </span>
            <span className="text-xs font-mono text-zinc-500">Supported Format: .DAT / .TXT</span>
          </div>
          <h2 className="text-xl font-black text-zinc-950 uppercase tracking-tight">
            ZKTeco Old Version Biometric (.DAT) Uploader
          </h2>
          <p className="text-xs text-zinc-600 max-w-2xl">
            Upload attendance logs generated from legacy ZKTeco biometric terminals. Automatically reads ID numbers, timestamps, and maps punch status codes to staff profiles.
          </p>
        </div>
      </div>

      {/* Specification Reference Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-zinc-50 p-4 rounded-xl border border-zinc-200">
        <div className="p-2.5 bg-white rounded-lg border border-zinc-200 text-center space-y-1">
          <span className="text-[10px] font-black uppercase text-emerald-800 block">Code 0</span>
          <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 inline-block">
            Time In (IN)
          </span>
          <p className="text-[10px] text-zinc-500">First morning clock-in</p>
        </div>

        <div className="p-2.5 bg-white rounded-lg border border-zinc-200 text-center space-y-1">
          <span className="text-[10px] font-black uppercase text-amber-800 block">Code 1</span>
          <span className="text-xs font-black text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 inline-block">
            Time Out (OUT)
          </span>
          <p className="text-[10px] text-zinc-500">Evening shift clock-out</p>
        </div>

        <div className="p-2.5 bg-white rounded-lg border border-zinc-200 text-center space-y-1">
          <span className="text-[10px] font-black uppercase text-purple-800 block">Code 2</span>
          <span className="text-xs font-black text-purple-800 bg-purple-50 px-2 py-0.5 rounded border border-purple-200 inline-block">
            Break Out (BREAK_OUT)
          </span>
          <p className="text-[10px] text-zinc-500">Start meal break</p>
        </div>

        <div className="p-2.5 bg-white rounded-lg border border-zinc-200 text-center space-y-1">
          <span className="text-[10px] font-black uppercase text-blue-800 block">Code 3</span>
          <span className="text-xs font-black text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 inline-block">
            Break In (BREAK_IN)
          </span>
          <p className="text-[10px] text-zinc-500">Return from meal break</p>
        </div>
      </div>

      {/* Drag and Drop File Upload Area */}
      <div className="relative border-2 border-dashed border-amber-500 hover:border-amber-600 bg-amber-50/40 hover:bg-amber-50/80 rounded-2xl p-8 text-center transition-all cursor-pointer group shadow-xs">
        <input
          type="file"
          id="dat-file-input-element"
          accept=".dat,.txt"
          onChange={handleFileUpload}
          disabled={isProcessing}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <div className="flex flex-col items-center justify-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-amber-400 text-zinc-950 flex items-center justify-center group-hover:scale-105 transition-transform border-2 border-zinc-950 shadow-md">
            {isProcessing ? (
              <RefreshCw className="w-7 h-7 animate-spin" />
            ) : (
              <Upload className="w-7 h-7" />
            )}
          </div>
          <div>
            <span className="text-base font-black text-zinc-950 uppercase tracking-tight block">
              {isProcessing ? 'Processing ZKTeco .DAT File...' : 'Click to Browse or Drag & Drop .DAT File'}
            </span>
            <p className="text-xs text-zinc-600 mt-1 font-medium">
              Accepts ZKTeco <code className="bg-zinc-200 px-1.5 py-0.5 rounded font-mono font-bold text-zinc-900">.dat</code> or <code className="bg-zinc-200 px-1.5 py-0.5 rounded font-mono font-bold text-zinc-900">.txt</code> logs • Tab, Comma, or Space Delimited
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2 pt-2 text-[11px] font-mono font-bold text-zinc-700">
            <span className="bg-white px-2.5 py-1 rounded-lg border border-zinc-300">ID Number</span>
            <span className="bg-white px-2.5 py-1 rounded-lg border border-zinc-300">Name (Optional)</span>
            <span className="bg-white px-2.5 py-1 rounded-lg border border-zinc-300">Date (YYYY-MM-DD)</span>
            <span className="bg-white px-2.5 py-1 rounded-lg border border-zinc-300">Time (HH:mm:ss)</span>
            <span className="bg-white px-2.5 py-1 rounded-lg border border-zinc-300 text-amber-800 bg-amber-100">Status Code (0, 1, 2, 3)</span>
          </div>
        </div>
      </div>

      {/* Validation Feedback Banner */}
      {uploadMessage && (
        <div
          className={`p-4 rounded-2xl border-2 ${
            uploadMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-600 text-emerald-950'
              : 'bg-rose-50 border-rose-600 text-rose-950'
          }`}
        >
          <div className="flex items-start gap-3">
            {uploadMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div>
              <h4 className="text-xs font-black uppercase">{uploadMessage.title}</h4>
              <p className="text-xs mt-1 font-medium">{uploadMessage.text}</p>
              {uploadMessage.details && uploadMessage.details.length > 0 && (
                <ul className="mt-2 list-disc list-inside text-[11px] space-y-0.5 opacity-90 font-mono">
                  {uploadMessage.details.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Parsed Logs Preview */}
      {lastParsedSummaries.length > 0 && (
        <div className="space-y-3 pt-2 border-t border-zinc-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <h3 className="font-black text-xs uppercase tracking-wider text-zinc-950">
                Recently Processed .DAT Attendance Logs ({lastParsedSummaries.length} Users/Days)
              </h3>
            </div>
            <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300">
              ✓ Synced to Attendance Data Tables
            </span>
          </div>

          <div className="overflow-x-auto border-2 border-zinc-950 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-900 text-amber-400 font-black uppercase text-[10px] tracking-wider border-b-2 border-zinc-950">
                <tr>
                  <th className="py-2.5 px-3">Employee ID</th>
                  <th className="py-2.5 px-3">Name</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Time-In (0)</th>
                  <th className="py-2.5 px-3">Break-Out (2)</th>
                  <th className="py-2.5 px-3">Break-In (3)</th>
                  <th className="py-2.5 px-3">Time-Out (1)</th>
                  <th className="py-2.5 px-3 text-center">Net Worked</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 font-medium text-zinc-800">
                {lastParsedSummaries.map((s) => (
                  <tr key={s.id} className="hover:bg-amber-50/50">
                    <td className="py-2.5 px-3 font-mono font-bold text-zinc-900">{s.employeeId}</td>
                    <td className="py-2.5 px-3 font-bold text-zinc-950">{s.employeeName}</td>
                    <td className="py-2.5 px-3 font-mono">{s.date}</td>
                    <td className="py-2.5 px-3 font-mono text-emerald-700 font-bold">{s.firstIn || '--:--'}</td>
                    <td className="py-2.5 px-3 font-mono text-zinc-600">{s.breakOut || '--:--'}</td>
                    <td className="py-2.5 px-3 font-mono text-zinc-600">{s.breakIn || '--:--'}</td>
                    <td className="py-2.5 px-3 font-mono text-amber-800 font-bold">{s.lastOut || '--:--'}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-center">{s.netHoursWorked.toFixed(1)} hrs</td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${
                          s.status === 'OVERBREAK'
                            ? 'bg-rose-100 text-rose-950 border-rose-400'
                            : s.status === 'UNDERTIME'
                            ? 'bg-amber-100 text-amber-950 border-amber-300'
                            : s.status === 'MISSING_IN' || s.status === 'MISSING_OUT'
                            ? 'bg-orange-100 text-orange-950 border-orange-300'
                            : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
