import {
  AdminAlertCategoryKey,
  AdminEmailNotificationConfig,
  AttendanceSummaryDaily,
  CtoRequest,
  DisputeRequest,
  StockTransferRequisition,
  StoreTicket,
  WarehouseInventoryItem,
} from '../types';
import {
  evaluateItemExpiry,
  isMonitoredWarehouseBranch,
  NEAR_EXPIRY_THRESHOLD_DAYS,
} from '../data/warehouseData';
import { safeLocalStorageSet } from '../lib/firestoreSync';

export type AdminAlertCategory =
  | 'STR'
  | 'LOW_STOCK'
  | 'NEAR_EXPIRY'
  | 'DISPUTE'
  | 'CTO'
  | 'ATTENDANCE'
  | 'TICKET';
export type AdminAlertSeverity = 'critical' | 'warning' | 'info';

export interface AdminAlertItem {
  id: string;
  category: AdminAlertCategory;
  severity: AdminAlertSeverity;
  title: string;
  description: string;
  meta: string;
  timestamp: string;
  targetTab: string;
  actionLabel: string;
}

export interface BuildAdminAlertsInput {
  stockTransfers: StockTransferRequisition[];
  warehouseItems: WarehouseInventoryItem[];
  disputes: DisputeRequest[];
  ctoRequests: CtoRequest[];
  summaries: AttendanceSummaryDaily[];
  storeTickets?: StoreTicket[];
}

const SEVERITY_RANK: Record<AdminAlertSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

const toMillis = (isoOrDate?: string): number => {
  if (!isoOrDate) return 0;
  const parsed = Date.parse(isoOrDate);
  return Number.isNaN(parsed) ? 0 : parsed;
};

export function buildAdminAlerts({
  stockTransfers,
  warehouseItems,
  disputes,
  ctoRequests,
  summaries,
  storeTickets = [],
}: BuildAdminAlertsInput): AdminAlertItem[] {
  const alerts: AdminAlertItem[] = [];

  // 1. Pending Stock Transfer Requisitions (STR)
  const pendingTransfers = (stockTransfers || []).filter(
    (trf) => trf && trf.status === 'PENDING'
  );
  for (const trf of pendingTransfers) {
    const itemCount = Array.isArray(trf.items) ? trf.items.length : 0;
    const needsReview = !trf.reviewedBy;
    alerts.push({
      id: needsReview ? `str-review-${trf.id}` : `str-receive-${trf.id}`,
      category: 'STR',
      severity: needsReview ? 'critical' : 'info',
      title: needsReview
        ? `STR Awaiting Super Admin Review · ${trf.strRefNumber || trf.transferNumber}`
        : `Reviewed STR Pending Receipt · ${trf.strRefNumber || trf.transferNumber}`,
      description: `${trf.fromBranchName || trf.fromBranchCode} → ${
        trf.toBranchName || trf.toBranchCode
      } · ${itemCount} item${itemCount === 1 ? '' : 's'} prepared by ${
        trf.preparedBy || 'Branch Staff'
      }.`,
      meta: needsReview
        ? `Needs Review · ${trf.date || 'Pending'}`
        : `Reviewed by ${trf.reviewedBy} · Awaiting Confirmation`,
      timestamp: trf.createdAt || trf.date || new Date().toISOString(),
      targetTab: 'warehouse-inventory',
      actionLabel: needsReview ? 'Review STR' : 'Open STR',
    });
  }

  // 2. Low & Out-of-Stock Warehouse Inventory across the 6 Monitored Branches
  const monitoredLowItems = (warehouseItems || []).filter((item) => {
    if (!item || !isMonitoredWarehouseBranch(item.branchCode)) return false;
    const qty = Number(item.quantity) || 0;
    const min = Number(item.reorderLevel ?? 2);
    return qty < min;
  });

  const lowByBranch = new Map<string, WarehouseInventoryItem[]>();
  for (const item of monitoredLowItems) {
    const key = item.branchCode;
    const list = lowByBranch.get(key) || [];
    list.push(item);
    lowByBranch.set(key, list);
  }

  lowByBranch.forEach((branchItems, branchCode) => {
    const sorted = [...branchItems].sort(
      (a, b) => (Number(a.quantity) || 0) - (Number(b.quantity) || 0)
    );
    const outOfStockCount = sorted.filter((i) => (Number(i.quantity) || 0) <= 0).length;
    const branchName = sorted[0]?.branchName || branchCode;
    const previewNames = sorted
      .slice(0, 3)
      .map((i) => `${i.description} (${Number(i.quantity) || 0}/${i.reorderLevel ?? 2} ${i.uom})`)
      .join(', ');
    const remaining = sorted.length > 3 ? ` +${sorted.length - 3} more` : '';
    const latestUpdate = sorted.reduce((latest, cur) => {
      return toMillis(cur.updatedAt) > toMillis(latest) ? cur.updatedAt : latest;
    }, sorted[0]?.updatedAt || '');

    alerts.push({
      id: `low-stock-${branchCode}-${sorted.length}-${outOfStockCount}`,
      category: 'LOW_STOCK',
      severity: outOfStockCount > 0 ? 'critical' : 'warning',
      title:
        outOfStockCount > 0
          ? `Out of Stock Alert · ${branchName}`
          : `Low Stock Alert · ${branchName}`,
      description: `${previewNames}${remaining}`,
      meta: `${sorted.length} SKU${sorted.length === 1 ? '' : 's'} below Min · ${outOfStockCount} at 0 qty`,
      timestamp: latestUpdate || new Date().toISOString(),
      targetTab: 'warehouse-inventory',
      actionLabel: 'Check Stock',
    });
  });

  // 2b. Near-Expiry & Expired Warehouse Inventory across the 6 Monitored Branches
  const nearExpiryWithEval = (warehouseItems || [])
    .filter((item) => item && isMonitoredWarehouseBranch(item.branchCode))
    .map((item) => ({ item, expiry: evaluateItemExpiry(item) }))
    .filter(({ expiry }) => expiry.isAlertActive);

  const expiryByBranch = new Map<
    string,
    Array<{ item: WarehouseInventoryItem; expiry: ReturnType<typeof evaluateItemExpiry> }>
  >();
  for (const entry of nearExpiryWithEval) {
    const key = entry.item.branchCode;
    const list = expiryByBranch.get(key) || [];
    list.push(entry);
    expiryByBranch.set(key, list);
  }

  expiryByBranch.forEach((branchEntries, branchCode) => {
    const sorted = [...branchEntries].sort(
      (a, b) => (a.expiry.daysUntil ?? 9999) - (b.expiry.daysUntil ?? 9999)
    );
    const expiredCount = sorted.filter((e) => e.expiry.status === 'EXPIRED').length;
    const urgentCount = sorted.filter(
      (e) => e.expiry.daysUntil !== null && e.expiry.daysUntil <= 7
    ).length;
    const branchName = sorted[0]?.item.branchName || branchCode;
    const previewNames = sorted
      .slice(0, 3)
      .map((e) => `${e.item.description} (${e.expiry.label})`)
      .join(', ');
    const remaining = sorted.length > 3 ? ` +${sorted.length - 3} more` : '';
    const latestUpdate = sorted.reduce((latest, cur) => {
      return toMillis(cur.item.updatedAt) > toMillis(latest)
        ? cur.item.updatedAt
        : latest;
    }, sorted[0]?.item.updatedAt || '');

    alerts.push({
      id: `near-expiry-${branchCode}-${sorted.length}-${expiredCount}-${sorted[0]?.item.id || 'none'}`,
      category: 'NEAR_EXPIRY',
      severity: expiredCount > 0 || urgentCount > 0 ? 'critical' : 'warning',
      title:
        expiredCount > 0
          ? `Expired / Expiring Stock · ${branchName}`
          : `Near-Expiry Stock Alert · ${branchName}`,
      description: `${previewNames}${remaining}`,
      meta: `${sorted.length} SKU${sorted.length === 1 ? '' : 's'} expiring ≤${NEAR_EXPIRY_THRESHOLD_DAYS}d${
        expiredCount > 0 ? ` · ${expiredCount} expired` : ''
      }`,
      timestamp: latestUpdate || new Date().toISOString(),
      targetTab: 'warehouse-inventory',
      actionLabel: 'Check Expiry',
    });
  });

  // 3. Pending Attendance Disputes / Time Adjustment Requests
  const pendingDisputes = (disputes || []).filter(
    (d) => d && d.status === 'PENDING'
  );
  for (const d of pendingDisputes) {
    const typeLabel = d.category || d.type || 'Time Adjustment';
    alerts.push({
      id: `dispute-${d.id}`,
      category: 'DISPUTE',
      severity: 'warning',
      title: `Pending Time Dispute · ${d.employeeName}`,
      description: `${typeLabel} for ${d.date} — ${d.reason || 'Requested schedule correction'}`,
      meta: `${d.branch || d.department || 'Branch'} · ${
        d.managerApproved ? 'Manager Approved (Needs Admin/Payroll)' : 'Awaiting Approval'
      }`,
      timestamp: d.submittedAt || d.date || new Date().toISOString(),
      targetTab: 'disputes',
      actionLabel: 'Review Dispute',
    });
  }

  // 4. Pending CTO Requests
  const pendingCto = (ctoRequests || []).filter(
    (r) => r && r.status === 'PENDING'
  );
  for (const cto of pendingCto) {
    alerts.push({
      id: `cto-${cto.id}`,
      category: 'CTO',
      severity: 'info',
      title: `Pending CTO ${cto.requestType === 'CREDIT' ? 'Credit' : 'Leave'} · ${cto.employeeName}`,
      description: `${cto.hoursRequested}h on ${cto.date} — ${cto.reason || 'CTO filing'}`,
      meta: `${cto.branch || cto.department || 'Branch'} · ${
        cto.managerApproved ? 'Manager Approved' : 'Pending Review'
      }`,
      timestamp: cto.submittedAt || cto.date || new Date().toISOString(),
      targetTab: 'cto-management',
      actionLabel: 'Manage CTO',
    });
  }

  // 5. Biometric Missing Punch Anomalies Summary
  const missingPuncheSummaries = (summaries || []).filter(
    (s) => s && (s.status === 'MISSING_IN' || s.status === 'MISSING_OUT' || s.status === 'LACKING')
  );
  if (missingPuncheSummaries.length > 0) {
    const sortedMissing = [...missingPuncheSummaries].sort((a, b) =>
      (b.date || '').localeCompare(a.date || '')
    );
    const preview = sortedMissing
      .slice(0, 3)
      .map((s) => `${s.employeeName} (${s.date})`)
      .join(', ');
    const more = sortedMissing.length > 3 ? ` +${sortedMissing.length - 3} more` : '';
    alerts.push({
      id: `attendance-missing-${sortedMissing.length}-${sortedMissing[0]?.date || 'none'}`,
      category: 'ATTENDANCE',
      severity: 'warning',
      title: `Missing Biometric Punches · ${sortedMissing.length} Log${sortedMissing.length === 1 ? '' : 's'}`,
      description: `${preview}${more}`,
      meta: 'Incomplete clock-in / clock-out records',
      timestamp: sortedMissing[0]?.date || new Date().toISOString(),
      targetTab: 'logs',
      actionLabel: 'Inspect Logs',
    });
  }

  // 6. Pending Store Concern Tickets
  const pendingTickets = (storeTickets || []).filter(
    (t) => t && t.status === 'PENDING'
  );
  for (const t of pendingTickets) {
    const isUrgentOrHigh = t.priority === 'URGENT' || t.priority === 'HIGH';
    alerts.push({
      id: `ticket-${t.id}`,
      category: 'TICKET',
      severity: isUrgentOrHigh ? 'critical' : 'warning',
      title: `Store Ticket ${t.ticketNumber} · ${t.branch}`,
      description: `${t.category} (${t.priority}): ${t.subject}`,
      meta: `Submitted by ${t.requestedByName} · Pending Admin review`,
      timestamp: t.createdAt || new Date().toISOString(),
      targetTab: 'store-tickets',
      actionLabel: 'Manage Ticket',
    });
  }

  return alerts.sort((a, b) => {
    const sevDiff = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (sevDiff !== 0) return sevDiff;
    return toMillis(b.timestamp) - toMillis(a.timestamp);
  });
}

export function formatAlertTimestamp(ts?: string): string {
  if (!ts) return 'Just now';
  const ms = Date.parse(ts);
  if (Number.isNaN(ms)) return ts;
  const diffSec = Math.floor((Date.now() - ms) / 1000);
  if (diffSec < 60 && diffSec >= 0) return 'Just now';
  if (diffSec < 3600 && diffSec >= 0) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400 && diffSec >= 0) return `${Math.floor(diffSec / 3600)}h ago`;
  const d = new Date(ms);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function loadAdminReadAlertIds(userId?: string): Set<string> {
  if (!userId) return new Set();
  try {
    const raw = localStorage.getItem(`fbc_admin_read_alerts_${userId}`);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr.filter((x) => typeof x === 'string'));
    }
  } catch (err) {
    console.error('Failed loading read admin alert IDs:', err);
  }
  return new Set();
}

export function saveAdminReadAlertIds(userId: string, ids: Set<string>): void {
  const bounded = Array.from(ids).slice(-400);
  safeLocalStorageSet(`fbc_admin_read_alerts_${userId}`, JSON.stringify(bounded), {
    essential: true,
  });
}

export function loadAdminDismissedAlertIds(userId?: string): Set<string> {
  if (!userId) return new Set();
  try {
    const raw = localStorage.getItem(`fbc_admin_dismissed_alerts_${userId}`);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr.filter((x) => typeof x === 'string'));
    }
  } catch (err) {
    console.error('Failed loading dismissed admin alert IDs:', err);
  }
  return new Set();
}

export function saveAdminDismissedAlertIds(userId: string, ids: Set<string>): void {
  const bounded = Array.from(ids).slice(-400);
  safeLocalStorageSet(`fbc_admin_dismissed_alerts_${userId}`, JSON.stringify(bounded), {
    essential: true,
  });
}

export const DEFAULT_ADMIN_ALERT_EMAIL = 'caminadejeth@gmail.com';

export const ALL_ADMIN_ALERT_CATEGORIES: AdminAlertCategoryKey[] = [
  'STR',
  'LOW_STOCK',
  'NEAR_EXPIRY',
  'DISPUTE',
  'CTO',
  'ATTENDANCE',
  'TICKET',
];

export const DEFAULT_ADMIN_EMAIL_CONFIG: AdminEmailNotificationConfig = {
  id: 'superadmin',
  enabled: true,
  recipientEmail: DEFAULT_ADMIN_ALERT_EMAIL,
  enabledCategories: [...ALL_ADMIN_ALERT_CATEGORIES],
  updatedAt: '',
};

export function toSafeAlertDocId(alertId: string): string {
  return alertId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 140) || `alert_${Date.now()}`;
}

export interface EmailDeliveryStatusResponse {
  configured: boolean;
  provider: 'smtp' | 'resend' | 'none';
  defaultRecipient: string;
  senderConfigured?: boolean;
}

export async function fetchEmailDeliveryStatus(): Promise<EmailDeliveryStatusResponse> {
  try {
    const res = await fetch('/api/notifications/email-status');
    if (!res.ok) {
      return {
        configured: false,
        provider: 'none',
        defaultRecipient: DEFAULT_ADMIN_ALERT_EMAIL,
      };
    }
    return await res.json();
  } catch {
    return {
      configured: false,
      provider: 'none',
      defaultRecipient: DEFAULT_ADMIN_ALERT_EMAIL,
    };
  }
}

export interface SendAdminAlertEmailsResult {
  success: boolean;
  configured?: boolean;
  deduplicated?: boolean;
  sentCount?: number;
  recipient?: string;
  code?: string;
  message?: string;
  error?: string;
}

export async function sendAdminAlertEmails(params: {
  alerts: AdminAlertItem[];
  recipientEmail: string;
  isTest?: boolean;
  triggeredBy?: string;
}): Promise<SendAdminAlertEmailsResult> {
  try {
    const res = await fetch('/api/notifications/send-alert-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        alerts: params.alerts.map((a) => ({
          id: a.id,
          category: a.category,
          severity: a.severity,
          title: a.title,
          description: a.description,
          meta: a.meta,
          timestamp: a.timestamp,
        })),
        recipientEmail: params.recipientEmail || DEFAULT_ADMIN_ALERT_EMAIL,
        isTest: Boolean(params.isTest),
        triggeredBy: params.triggeredBy || 'FBC Attendance Portal',
      }),
    });
    return await res.json();
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Network error while sending alert email.',
    };
  }
}

