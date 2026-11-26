import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ActivityActionType,
  ActivityLog,
  AdminEmailNotificationConfig,
  AttendanceStatus,
  AttendanceSummaryDaily,
  BiometricPunch,
  CtoManualAdjustment,
  CtoRequest,
  DisputeRequest,
  EmailedAdminAlertRecord,
  StockMovementEntry,
  StockTransferLineItem,
  StockTransferRequisition,
  StoreTicket,
  StoreTicketAttachment,
  StoreTicketCategory,
  StoreTicketPriority,
  StoreTicketStatus,
  SyncLog,
  User,
  UserRole,
  WarehouseBranchCode,
  WarehouseCategory,
  WarehouseInventoryItem,
  WorkSchedule,
} from './types';
import {
  parseToYYYYMMDD,
} from './utils/timeFormatters';
import {
  applyApprovedDisputeToSummary,
  capturePreApprovalSnapshot,
  revertSummaryAfterDisputeDisapproval,
} from './utils/disputeRevertHelper';
import { isSafeImageSrc } from './utils/imageCompression';
import {
  INITIAL_DAILY_SUMMARIES,
  INITIAL_DISPUTES,
  INITIAL_PUNCHES,
  INITIAL_USERS,
  INITIAL_CTO_REQUESTS,
  INITIAL_CTO_ADJUSTMENTS,
  INITIAL_SCHEDULES,
  INITIAL_ACTIVITY_LOGS,
} from './data/mockData';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { LoginScreen } from './components/LoginScreen';
import { AdminDashboard } from './components/AdminDashboard';
import { StaffDashboard } from './components/StaffDashboard';
import { ManagerDashboard } from './components/ManagerDashboard';
import { PayrollDashboard } from './components/PayrollDashboard';
import { WarehouseInventoryDashboard } from './components/WarehouseInventoryDashboard';
import { StoreTicketingDashboard } from './components/StoreTicketingDashboard';
import { GoogleSheetsSyncModal } from './components/GoogleSheetsSyncModal';
import { buildGoogleSheetsData, syncToGoogleSheets } from './utils/googleSheetsSync';
import { showAdminAlertToast, showSyncConfirmAlert } from './utils/sweetAlerts';
import {
  ALL_ADMIN_ALERT_CATEGORIES,
  buildAdminAlerts,
  DEFAULT_ADMIN_ALERT_EMAIL,
  DEFAULT_ADMIN_EMAIL_CONFIG,
  EmailDeliveryStatusResponse,
  fetchEmailDeliveryStatus,
  loadAdminDismissedAlertIds,
  loadAdminReadAlertIds,
  saveAdminDismissedAlertIds,
  saveAdminReadAlertIds,
  sendAdminAlertEmails,
  SendAdminAlertEmailsResult,
  toSafeAlertDocId,
} from './utils/adminAlerts';
import {
  buildDefaultCatalogItemsForBranch,
  buildDefaultWarehouseCategories,
  evaluateItemExpiry,
  findStockReferenceByCode,
  findStockReferenceByDescription,
  getBranchByCode,
  isMonitoredWarehouseBranch,
} from './data/warehouseData';
import { YellowCabCheckerboard } from './components/YellowCabBrand';
import {
  subscribeCollection,
  saveDocument,
  saveDocuments,
  removeDocument,
  isWarehouseCatalogSeeded,
  markWarehouseCatalogSeeded,
  safeLocalStorageSet,
  safeCacheCollectionItems,
  subscribeFirestoreQuotaStatus,
  getDateCutoffYYYYMMDD,
  getDateCutoffISO,
} from './lib/firestoreSync';
import { where } from './lib/firebase';

const loadFromStorage = <T,>(key: string, fallback: T): T => {
  try {
    const saved = localStorage.getItem(key);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (err) {
    console.error(`Failed to load ${key} from localStorage`, err);
  }
  return fallback;
};

export default function App() {
  // Authentication & Users State
  const [currentUser, setCurrentUser] = useState<User | null>(() =>
    loadFromStorage<User | null>('fbc_current_user', null)
  );
  const [users, setUsers] = useState<User[]>(() =>
    loadFromStorage<User[]>('fbc_users', INITIAL_USERS)
  );
  const [summaries, setSummaries] = useState<AttendanceSummaryDaily[]>(() =>
    loadFromStorage<AttendanceSummaryDaily[]>('fbc_summaries', INITIAL_DAILY_SUMMARIES)
  );
  const [punches, setPunches] = useState<BiometricPunch[]>(() =>
    loadFromStorage<BiometricPunch[]>('fbc_punches', INITIAL_PUNCHES)
  );
  const [disputes, setDisputes] = useState<DisputeRequest[]>(() =>
    loadFromStorage<DisputeRequest[]>('fbc_disputes', INITIAL_DISPUTES)
  );
  const [schedules, setSchedules] = useState<WorkSchedule[]>(() =>
    loadFromStorage<WorkSchedule[]>('fbc_schedules', INITIAL_SCHEDULES)
  );
  const [ctoRequests, setCtoRequests] = useState<CtoRequest[]>(() =>
    loadFromStorage<CtoRequest[]>('fbc_cto_requests', INITIAL_CTO_REQUESTS)
  );
  const [ctoAdjustments, setCtoAdjustments] = useState<CtoManualAdjustment[]>(() =>
    loadFromStorage<CtoManualAdjustment[]>('fbc_cto_adjustments', INITIAL_CTO_ADJUSTMENTS)
  );
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>(() =>
    loadFromStorage<ActivityLog[]>('fbc_activity_logs', INITIAL_ACTIVITY_LOGS)
  );
  const [warehouseCategories, setWarehouseCategories] = useState<WarehouseCategory[]>(() =>
    loadFromStorage<WarehouseCategory[]>('fbc_warehouseCategories', [])
  );
  const [warehouseItems, setWarehouseItems] = useState<WarehouseInventoryItem[]>(() =>
    loadFromStorage<WarehouseInventoryItem[]>('fbc_warehouseItems', [])
  );
  const [stockMovements, setStockMovements] = useState<StockMovementEntry[]>(() =>
    loadFromStorage<StockMovementEntry[]>('fbc_stockMovements', [])
  );
  const [stockTransfers, setStockTransfers] = useState<StockTransferRequisition[]>(() =>
    loadFromStorage<StockTransferRequisition[]>('fbc_stockTransfers', [])
  );
  const [storeTickets, setStoreTickets] = useState<StoreTicket[]>(() =>
    loadFromStorage<StoreTicket[]>('fbc_storeTickets', [])
  );
  const [adminEmailSettingsList, setAdminEmailSettingsList] = useState<
    AdminEmailNotificationConfig[]
  >(() =>
    loadFromStorage<AdminEmailNotificationConfig[]>(
      'fbc_adminNotificationSettings',
      [{ ...DEFAULT_ADMIN_EMAIL_CONFIG, updatedAt: new Date().toISOString() }]
    )
  );
  const [emailedAlerts, setEmailedAlerts] = useState<EmailedAdminAlertRecord[]>(() =>
    loadFromStorage<EmailedAdminAlertRecord[]>('fbc_emailedAlerts', [])
  );
  const [emailDeliveryStatus, setEmailDeliveryStatus] =
    useState<EmailDeliveryStatusResponse>({
      configured: false,
      provider: 'none',
      defaultRecipient: DEFAULT_ADMIN_ALERT_EMAIL,
    });
  const [firestoreQuotaExceeded, setFirestoreQuotaExceeded] = useState(false);
  const [historyScope, setHistoryScope] = useState<'RECENT' | 'ALL'>('RECENT');

  // Check server-side email transport readiness on mount
  useEffect(() => {
    fetchEmailDeliveryStatus().then(setEmailDeliveryStatus);
  }, []);

  // Monitor Firestore quota status so users are notified while local persistent cache stays active
  useEffect(() => {
    return subscribeFirestoreQuotaStatus(setFirestoreQuotaExceeded);
  }, []);

  // Always subscribe to users so LoginScreen authentication works cleanly
  useEffect(() => {
    const unsubUsers = subscribeCollection('users', INITIAL_USERS, setUsers);
    return () => {
      unsubUsers();
    };
  }, []);

  // Role-Gated & Date-Windowed Firestore Cloud Subscriptions (active only after sign-in)
  useEffect(() => {
    if (!currentUser) {
      return;
    }

    const role = currentUser.role;
    const isAdmin = role === 'ADMIN';
    const needsPunches = role === 'ADMIN' || role === 'BRANCH_MANAGER' || role === 'PAYROLL';
    const isRecentWindow = historyScope === 'RECENT';
    const cutoff90Days = getDateCutoffYYYYMMDD(90);
    const cutoff60DaysIso = getDateCutoffISO(60);
    const cutoff30DaysIso = getDateCutoffISO(30);

    const unsubSummaries = subscribeCollection(
      'summaries',
      INITIAL_DAILY_SUMMARIES,
      setSummaries,
      isRecentWindow
        ? { constraints: [where('date', '>=', cutoff90Days)], idbKey: 'summaries_recent_90d', skipSeedOnEmpty: true }
        : undefined
    );
    const unsubDisputes = subscribeCollection('disputes', INITIAL_DISPUTES, setDisputes);
    const unsubSchedules = subscribeCollection('schedules', INITIAL_SCHEDULES, setSchedules);
    const unsubCtoReq = subscribeCollection('ctoRequests', INITIAL_CTO_REQUESTS, setCtoRequests);
    const unsubCtoAdj = subscribeCollection('ctoAdjustments', INITIAL_CTO_ADJUSTMENTS, setCtoAdjustments);
    const unsubWarehouseCats = subscribeCollection<WarehouseCategory>('warehouseCategories', [], setWarehouseCategories);
    const unsubWarehouseItems = subscribeCollection<WarehouseInventoryItem>('warehouseItems', [], setWarehouseItems);
    const unsubStockMovements = subscribeCollection<StockMovementEntry>(
      'stockMovements',
      [],
      setStockMovements,
      isRecentWindow
        ? { constraints: [where('date', '>=', cutoff90Days)], idbKey: 'stockMovements_recent_90d', skipSeedOnEmpty: true }
        : undefined
    );
    const unsubStockTransfers = subscribeCollection<StockTransferRequisition>('stockTransfers', [], setStockTransfers);
    const unsubStoreTickets = subscribeCollection<StoreTicket>('storeTickets', [], setStoreTickets);
    const unsubEmailSettings = subscribeCollection<AdminEmailNotificationConfig>(
      'adminNotificationSettings',
      [{ ...DEFAULT_ADMIN_EMAIL_CONFIG, updatedAt: new Date().toISOString() }],
      setAdminEmailSettingsList
    );
    const unsubEmailedAlerts = subscribeCollection<EmailedAdminAlertRecord>(
      'emailedAlerts',
      [],
      setEmailedAlerts,
      isRecentWindow
        ? { constraints: [where('sentAt', '>=', cutoff30DaysIso)], idbKey: 'emailedAlerts_recent_30d', skipSeedOnEmpty: true }
        : undefined
    );

    const unsubPunches = needsPunches
      ? subscribeCollection(
          'punches',
          INITIAL_PUNCHES,
          setPunches,
          isRecentWindow
            ? { constraints: [where('timestamp', '>=', cutoff90Days)], idbKey: 'punches_recent_90d', skipSeedOnEmpty: true }
            : undefined
        )
      : () => {};

    const unsubActivity = isAdmin
      ? subscribeCollection(
          'activityLogs',
          INITIAL_ACTIVITY_LOGS,
          setActivityLogs,
          isRecentWindow
            ? { constraints: [where('timestamp', '>=', cutoff60DaysIso)], idbKey: 'activityLogs_recent_60d', skipSeedOnEmpty: true }
            : undefined
        )
      : () => {};

    // One-time default warehouse catalog & categories seed to Firestore (Admin session only)
    if (isAdmin) {
      (async () => {
        try {
          const alreadySeeded = await isWarehouseCatalogSeeded();
          if (!alreadySeeded) {
            const defaultCats = buildDefaultWarehouseCategories('System Default');
            const defaultItems = buildDefaultCatalogItemsForBranch('YC-EBLC', 'System Default', true);
            await saveDocuments('warehouseCategories', defaultCats);
            await saveDocuments('warehouseItems', defaultItems);
            await markWarehouseCatalogSeeded();
          }
        } catch (err) {
          console.error('Failed one-time warehouse default catalog seed:', err);
        }
      })();
    }

    return () => {
      unsubSummaries();
      unsubPunches();
      unsubDisputes();
      unsubSchedules();
      unsubCtoReq();
      unsubCtoAdj();
      unsubActivity();
      unsubWarehouseCats();
      unsubWarehouseItems();
      unsubStockMovements();
      unsubStockTransfers();
      unsubStoreTickets();
      unsubEmailSettings();
      unsubEmailedAlerts();
    };
  }, [currentUser?.id, currentUser?.role, historyScope]);

  // System Activity Logger Helper
  const logActivity = (
    actionType: ActivityActionType,
    details: string,
    actionCategory: string = 'System'
  ) => {
    const newLog: ActivityLog = {
      id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      userName: currentUser?.name || 'System Administrator',
      userRole: currentUser?.role || 'ADMIN',
      userEmail: currentUser?.email,
      actionType,
      actionCategory,
      details,
    };

    setActivityLogs((prev) => [newLog, ...prev]);
    saveDocument('activityLogs', newLog);
  };

  const handleClearActivityLogs = async () => {
    for (const log of activityLogs) {
      await removeDocument('activityLogs', log.id);
    }
    setActivityLogs([]);
    try {
      localStorage.removeItem('fbc_activity_logs');
      localStorage.removeItem('fbc_deleted_activityLogs');
    } catch (e) {
      console.error(e);
    }
  };

  // Keep currentUser synced with live Firestore updates to their own account
  useEffect(() => {
    if (!currentUser) return;
    const latest = users.find((u) => u.id === currentUser.id);
    if (latest && JSON.stringify(latest) !== JSON.stringify(currentUser)) {
      setCurrentUser(latest);
    }
  }, [users, currentUser]);

  // Sync current logged-in user session to localStorage
  useEffect(() => {
    try {
      if (currentUser) {
        safeLocalStorageSet('fbc_current_user', JSON.stringify(currentUser), {
          essential: true,
        });
      } else {
        localStorage.removeItem('fbc_current_user');
      }
    } catch {
      // Ignore storage access errors
    }
  }, [currentUser]);

  const handleUpdateSummaryAnomaly = (summaryId: string, newNote: string) => {
    setSummaries((prev) =>
      prev.map((s) => {
        if (s.id === summaryId) {
          const updated = {
            ...s,
            anomalies: newNote.trim() ? [newNote.trim()] : [],
          };
          saveDocument('summaries', updated);
          return updated;
        }
        return s;
      })
    );
  };

  const handleSaveSchedule = (updatedSchedule: WorkSchedule) => {
    saveDocument('schedules', updatedSchedule);
    logActivity('SCHEDULE_UPDATE', `Updated work schedule roster for ${updatedSchedule.employeeName} (${updatedSchedule.shiftName}).`, 'Schedules');
    setSchedules((prev) => {
      const idx = prev.findIndex(
        (s) =>
          s.employeeId === updatedSchedule.employeeId &&
          s.effectiveDate === updatedSchedule.effectiveDate
      );
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = updatedSchedule;
        return next;
      }
      return [updatedSchedule, ...prev];
    });
  };

  const handleUpdateUserPin = (userId: string, newPin: string) => {
    const targetUser = users.find((u) => u.id === userId);
    if (targetUser) {
      const updated = { ...targetUser, pin: newPin };
      saveDocument('users', updated);
    }
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, pin: newPin } : u))
    );
    if (currentUser && currentUser.id === userId) {
      setCurrentUser((prev) => (prev ? { ...prev, pin: newPin } : prev));
    }
  };

  // Sync & Modal State
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [currentSyncLog, setCurrentSyncLog] = useState<SyncLog | null>(null);
  const [showSyncModal, setShowSyncModal] = useState<boolean>(false);

  const getDefaultTabForRole = (role?: UserRole): string => {
    if (role === 'ADMIN') return 'overview';
    if (role === 'BRANCH_MANAGER' || role === 'PAYROLL') return 'dtr-logs';
    return 'my-punches';
  };

  // Navigation Tab State
  const [activeTab, setActiveTab] = useState<string>(() =>
    getDefaultTabForRole(currentUser?.role)
  );

  // Super Admin Alert Notification State (read/dismissed persisted per admin user)
  const [readAlertIds, setReadAlertIds] = useState<Set<string>>(() =>
    loadAdminReadAlertIds(currentUser?.id)
  );
  const [dismissedAlertIds, setDismissedAlertIds] = useState<Set<string>>(() =>
    loadAdminDismissedAlertIds(currentUser?.id)
  );

  useEffect(() => {
    setReadAlertIds(loadAdminReadAlertIds(currentUser?.id));
    setDismissedAlertIds(loadAdminDismissedAlertIds(currentUser?.id));
  }, [currentUser?.id]);

  const adminEmailConfig: AdminEmailNotificationConfig = useMemo(() => {
    const saved = adminEmailSettingsList.find((s) => s.id === 'superadmin');
    if (!saved) return DEFAULT_ADMIN_EMAIL_CONFIG;
    return {
      ...DEFAULT_ADMIN_EMAIL_CONFIG,
      ...saved,
      recipientEmail: saved.recipientEmail?.trim() || DEFAULT_ADMIN_ALERT_EMAIL,
      enabledCategories:
        Array.isArray(saved.enabledCategories) && saved.enabledCategories.length > 0
          ? saved.enabledCategories
          : [...ALL_ADMIN_ALERT_CATEGORIES],
    };
  }, [adminEmailSettingsList]);

  const allAdminAlerts = useMemo(
    () =>
      buildAdminAlerts({
        stockTransfers,
        warehouseItems,
        disputes,
        ctoRequests,
        summaries,
        storeTickets,
      }),
    [stockTransfers, warehouseItems, disputes, ctoRequests, summaries, storeTickets]
  );

  const monitoredNearExpiryEntries = useMemo(
    () =>
      warehouseItems
        .filter((item) => item && isMonitoredWarehouseBranch(item.branchCode))
        .map((item) => ({ item, expiry: evaluateItemExpiry(item) }))
        .filter(({ expiry }) => expiry.isAlertActive)
        .sort((a, b) => (a.expiry.daysUntil ?? 9999) - (b.expiry.daysUntil ?? 9999)),
    [warehouseItems]
  );

  const visibleAdminAlerts = useMemo(
    () => allAdminAlerts.filter((a) => !dismissedAlertIds.has(a.id)),
    [allAdminAlerts, dismissedAlertIds]
  );

  const dismissedAdminAlertsCount = useMemo(
    () => allAdminAlerts.filter((a) => dismissedAlertIds.has(a.id)).length,
    [allAdminAlerts, dismissedAlertIds]
  );

  const handleMarkAlertRead = (alertId: string) => {
    setReadAlertIds((prev) => {
      if (prev.has(alertId)) return prev;
      const next = new Set<string>(prev);
      next.add(alertId);
      if (currentUser?.id) saveAdminReadAlertIds(currentUser.id, next);
      return next;
    });
  };

  const handleDismissAlert = (alertId: string) => {
    setDismissedAlertIds((prev) => {
      const next = new Set<string>(prev);
      next.add(alertId);
      if (currentUser?.id) saveAdminDismissedAlertIds(currentUser.id, next);
      return next;
    });
  };

  const handleMarkAllAlertsRead = () => {
    setReadAlertIds((prev) => {
      const next = new Set<string>(prev);
      visibleAdminAlerts.forEach((a) => next.add(a.id));
      if (currentUser?.id) saveAdminReadAlertIds(currentUser.id, next);
      return next;
    });
  };

  const handleRestoreDismissedAlerts = () => {
    const empty = new Set<string>();
    setDismissedAlertIds(empty);
    if (currentUser?.id) saveAdminDismissedAlertIds(currentUser.id, empty);
  };

  const handleSaveAdminEmailConfig = async (
    updated: AdminEmailNotificationConfig
  ): Promise<boolean> => {
    const nextConfig: AdminEmailNotificationConfig = {
      ...updated,
      id: 'superadmin',
      recipientEmail: updated.recipientEmail.trim() || DEFAULT_ADMIN_ALERT_EMAIL,
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser?.name || 'Super Admin',
    };
    const ok = await saveDocument('adminNotificationSettings', nextConfig);
    if (!ok) return false;
    setAdminEmailSettingsList([nextConfig]);
    safeLocalStorageSet('fbc_adminNotificationSettings', JSON.stringify([nextConfig]), {
      essential: true,
    });
    logActivity(
      'SYSTEM_EVENT',
      `Updated Super Admin automatic email notification settings (${nextConfig.enabled ? 'ENABLED' : 'PAUSED'} → ${nextConfig.recipientEmail}).`,
      'System'
    );
    return true;
  };

  const handleSendTestAdminEmail = async (
    recipientEmail: string
  ): Promise<SendAdminAlertEmailsResult> => {
    const targetEmail = recipientEmail.trim() || adminEmailConfig.recipientEmail || DEFAULT_ADMIN_ALERT_EMAIL;
    const res = await sendAdminAlertEmails({
      alerts: [
        {
          id: `test-${Date.now()}`,
          category: 'TICKET',
          severity: 'info',
          title: 'FBC Super Admin Email Notification Test',
          description: `Automatic alert email notifications are configured for ${targetEmail}. Currently ${allAdminAlerts.length} active alert(s) exist in the portal.`,
          meta: 'Triggered manually from Admin Alert Notifications',
          timestamp: new Date().toISOString(),
          targetTab: 'overview',
          actionLabel: 'Open Dashboard',
        },
      ],
      recipientEmail: targetEmail,
      isTest: true,
      triggeredBy: currentUser?.name || 'Super Admin',
    });

    const refreshedStatus = await fetchEmailDeliveryStatus();
    setEmailDeliveryStatus(refreshedStatus);

    const statusUpdate: AdminEmailNotificationConfig = {
      ...adminEmailConfig,
      id: 'superadmin',
      recipientEmail: targetEmail,
      updatedAt: new Date().toISOString(),
      lastSentAt: res.success ? new Date().toISOString() : adminEmailConfig.lastSentAt,
      lastStatus: res.success
        ? 'SENT'
        : res.code === 'EMAIL_NOT_CONFIGURED'
        ? 'NOT_CONFIGURED'
        : 'ERROR',
      lastError: res.success ? '' : res.message || res.error || 'Delivery failed',
    };
    await saveDocument('adminNotificationSettings', statusUpdate);
    setAdminEmailSettingsList([statusUpdate]);
    return res;
  };

  const handleEmailActiveAlertsNow = async (): Promise<SendAdminAlertEmailsResult> => {
    const enabledCats = new Set(adminEmailConfig.enabledCategories || ALL_ADMIN_ALERT_CATEGORIES);
    const matching = visibleAdminAlerts.filter((a) => enabledCats.has(a.category));
    if (matching.length === 0) {
      return {
        success: false,
        error: 'No active alerts match the selected email notification categories.',
      };
    }

    const res = await sendAdminAlertEmails({
      alerts: matching.slice(0, 25),
      recipientEmail: adminEmailConfig.recipientEmail || DEFAULT_ADMIN_ALERT_EMAIL,
      isTest: true,
      triggeredBy: `${currentUser?.name || 'Super Admin'} (Manual Digest)`,
    });

    if (res.success) {
      const nowIso = new Date().toISOString();
      const records: EmailedAdminAlertRecord[] = matching.slice(0, 25).map((a) => ({
        id: toSafeAlertDocId(a.id),
        alertId: a.id,
        recipientEmail: adminEmailConfig.recipientEmail || DEFAULT_ADMIN_ALERT_EMAIL,
        sentAt: nowIso,
        category: a.category,
        title: a.title,
      }));
      await saveDocuments('emailedAlerts', records);
      const statusUpdate: AdminEmailNotificationConfig = {
        ...adminEmailConfig,
        id: 'superadmin',
        updatedAt: nowIso,
        lastSentAt: nowIso,
        lastStatus: 'SENT',
        lastError: '',
      };
      await saveDocument('adminNotificationSettings', statusUpdate);
      setAdminEmailSettingsList([statusUpdate]);
    }
    return res;
  };

  // Real-time non-blocking toast (Admin only) + automatic Super Admin email notification (any session) for NEW alerts
  const alertBaselineIdsRef = useRef<Set<string> | null>(null);
  const alertsArmedRef = useRef(false);
  const inFlightEmailedAlertIdsRef = useRef<Set<string>>(new Set());

  const emailedAlertIdSet = useMemo(() => {
    const set = new Set<string>();
    for (const rec of emailedAlerts) {
      if (rec?.alertId) set.add(rec.alertId);
    }
    return set;
  }, [emailedAlerts]);

  useEffect(() => {
    alertsArmedRef.current = false;
    alertBaselineIdsRef.current = null;
    if (!currentUser) return;
    const timer = setTimeout(() => {
      alertBaselineIdsRef.current = new Set(allAdminAlerts.map((a) => a.id));
      alertsArmedRef.current = true;
    }, 2500);
    return () => clearTimeout(timer);
  }, [currentUser?.id]);

  useEffect(() => {
    if (!alertsArmedRef.current) {
      alertBaselineIdsRef.current = new Set(allAdminAlerts.map((a) => a.id));
      return;
    }

    const prevIds = alertBaselineIdsRef.current || new Set<string>();
    const newlyArrived = allAdminAlerts.filter(
      (a) => !prevIds.has(a.id) && !dismissedAlertIds.has(a.id)
    );
    alertBaselineIdsRef.current = new Set(allAdminAlerts.map((a) => a.id));

    if (newlyArrived.length === 0) return;

    // 1. In-app toast notification strictly when Super Admin is signed in
    if (currentUser?.role === 'ADMIN') {
      const topAlert = newlyArrived[0];
      showAdminAlertToast(
        newlyArrived.length > 1
          ? `${newlyArrived.length} New Admin Alerts`
          : topAlert.title,
        newlyArrived.length > 1
          ? `${topAlert.title} (+${newlyArrived.length - 1} more)`
          : topAlert.description,
        topAlert.severity
      );
    }

    // 2. Automatic Super Admin email notification (runs for any logged-in session when enabled)
    if (!currentUser || !adminEmailConfig.enabled || !adminEmailConfig.recipientEmail) {
      return;
    }

    const enabledCats = new Set(
      adminEmailConfig.enabledCategories || ALL_ADMIN_ALERT_CATEGORIES
    );
    const alertsToEmail = newlyArrived.filter(
      (a) =>
        enabledCats.has(a.category) &&
        !emailedAlertIdSet.has(a.id) &&
        !inFlightEmailedAlertIdsRef.current.has(a.id)
    );

    if (alertsToEmail.length === 0) return;

    alertsToEmail.forEach((a) => inFlightEmailedAlertIdsRef.current.add(a.id));

    (async () => {
      const res = await sendAdminAlertEmails({
        alerts: alertsToEmail,
        recipientEmail: adminEmailConfig.recipientEmail,
        isTest: false,
        triggeredBy: `${currentUser.name} (${currentUser.role})`,
      });

      if (res.success && !res.deduplicated) {
        const nowIso = new Date().toISOString();
        const records: EmailedAdminAlertRecord[] = alertsToEmail.map((a) => ({
          id: toSafeAlertDocId(a.id),
          alertId: a.id,
          recipientEmail: adminEmailConfig.recipientEmail,
          sentAt: nowIso,
          category: a.category,
          title: a.title,
        }));
        await saveDocuments('emailedAlerts', records);
        const statusUpdate: AdminEmailNotificationConfig = {
          ...adminEmailConfig,
          id: 'superadmin',
          updatedAt: nowIso,
          lastSentAt: nowIso,
          lastStatus: 'SENT',
          lastError: '',
        };
        await saveDocument('adminNotificationSettings', statusUpdate);
        setAdminEmailSettingsList([statusUpdate]);
      } else if (res.code === 'EMAIL_NOT_CONFIGURED' || (!res.success && res.error)) {
        alertsToEmail.forEach((a) => inFlightEmailedAlertIdsRef.current.delete(a.id));
        const statusUpdate: AdminEmailNotificationConfig = {
          ...adminEmailConfig,
          id: 'superadmin',
          updatedAt: new Date().toISOString(),
          lastStatus: res.code === 'EMAIL_NOT_CONFIGURED' ? 'NOT_CONFIGURED' : 'ERROR',
          lastError: res.message || res.error || 'Email send failed',
        };
        await saveDocument('adminNotificationSettings', statusUpdate);
        setAdminEmailSettingsList([statusUpdate]);
      }
    })();
  }, [
    allAdminAlerts,
    currentUser,
    dismissedAlertIds,
    adminEmailConfig,
    emailedAlertIdSet,
  ]);

  // Alert logged-in Super Admin once per session when near-expiry or expired stock items exist
  useEffect(() => {
    if (!currentUser || currentUser.role !== 'ADMIN' || monitoredNearExpiryEntries.length === 0) return;
    const todayKey = new Date().toISOString().slice(0, 10);
    const storageKey = `fbc_near_expiry_notified_${currentUser.id}_${todayKey}_${monitoredNearExpiryEntries.length}`;
    try {
      if (typeof window !== 'undefined' && window.sessionStorage.getItem(storageKey)) {
        return;
      }
    } catch {
      // Ignore storage access errors
    }

    const timer = setTimeout(() => {
      const expiredCount = monitoredNearExpiryEntries.filter(
        (e) => e.expiry.status === 'EXPIRED'
      ).length;
      const top = monitoredNearExpiryEntries[0];
      const total = monitoredNearExpiryEntries.length;
      const title =
        expiredCount > 0
          ? `Expired / Near-Expiry Stock Alert (${total})`
          : `Near-Expiry Stock Alert (${total})`;
      const text =
        total === 1
          ? `${top.item.description} (${top.item.branchName}) · ${top.expiry.label}. Check Warehouse & STR.`
          : `${top.item.description} (${top.expiry.label}) +${total - 1} more item(s). Check Warehouse & STR.`;

      showAdminAlertToast(title, text, expiredCount > 0 ? 'critical' : 'warning');
      try {
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(storageKey, '1');
        }
      } catch {
        // Ignore storage errors
      }
    }, 1400);

    return () => clearTimeout(timer);
  }, [currentUser, monitoredNearExpiryEntries]);

  // Security guard: Only ADMIN role can access activity-logs or overview; BRANCH_MANAGER does not use my-punches; STAFF cannot access my-cto
  useEffect(() => {
    if (!currentUser) return;
    if (
      currentUser.role !== 'ADMIN' &&
      (activeTab === 'activity-logs' || activeTab === 'overview' || activeTab === 'dashboard')
    ) {
      setActiveTab(getDefaultTabForRole(currentUser.role));
    } else if (currentUser.role === 'BRANCH_MANAGER' && activeTab === 'my-punches') {
      setActiveTab('dtr-logs');
    } else if (currentUser.role === 'STAFF' && activeTab === 'my-cto') {
      setActiveTab('my-punches');
    }
  }, [currentUser, activeTab]);

  // Login handler
  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    setActiveTab(getDefaultTabForRole(user.role));
  };

  // Logout handler
  const handleLogout = () => {
    setCurrentUser(null);
  };

  // Handle uploaded biometric file processing
  const handleUploadProcessed = async (newSummaries: AttendanceSummaryDaily[]) => {
    await saveDocuments('summaries', newSummaries);
    logActivity('BIOMETRIC_UPLOAD', `Uploaded and processed ${newSummaries.length} biometric attendance summary logs.`, 'Biometrics');
    setSummaries((prev) => {
      const map = new Map<string, AttendanceSummaryDaily>();
      prev.forEach((s) => map.set(`${s.employeeId}_${s.date}`, s));
      newSummaries.forEach((s) => map.set(`${s.employeeId}_${s.date}`, s));
      return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
    });
  };

  // Handle Dispute Approvals & Hours Recalculation (Dual Approval)
  const handleApproveDispute = async (
    disputeId: string,
    adminNotes: string,
    approverRole?: 'MANAGER' | 'PAYROLL' | 'ADMIN'
  ) => {
    const currentNow = new Date().toISOString();
    const role =
      approverRole ||
      (currentUser?.role === 'BRANCH_MANAGER' || currentUser?.role === 'SHIFT_MANAGER'
        ? 'MANAGER'
        : currentUser?.role === 'ADMIN'
        ? 'ADMIN'
        : 'PAYROLL');

    const targetDispute = disputes.find((d) => d.id === disputeId);
    if (!targetDispute) return;

    const isMgr = role === 'MANAGER';
    const isPay = role === 'PAYROLL';
    const isAdmin = role === 'ADMIN' || currentUser?.role === 'ADMIN';

    const updatedMgrApp = isMgr || isAdmin ? true : Boolean(targetDispute.managerApproved);
    const updatedMgrBy = isMgr
      ? currentUser?.name || 'Branch Manager'
      : isAdmin
      ? `${currentUser?.name || 'System Admin'} (Admin)`
      : targetDispute.managerApprovedBy || (targetDispute.status === 'APPROVED' ? targetDispute.reviewedBy : undefined);
    const updatedMgrAt = (isMgr || isAdmin) ? (targetDispute.managerApprovedAt || currentNow) : targetDispute.managerApprovedAt;

    const updatedPayApp = isPay || isAdmin ? true : Boolean(targetDispute.payrollApproved);
    const updatedPayBy = isPay
      ? currentUser?.name || 'Payroll Department'
      : isAdmin
      ? `${currentUser?.name || 'System Admin'} (Admin)`
      : targetDispute.payrollApprovedBy;
    const updatedPayAt = (isPay || isAdmin) ? (targetDispute.payrollApprovedAt || currentNow) : targetDispute.payrollApprovedAt;

    // Fully approved if both approved, OR if done by ADMIN
    const fullyApproved = (updatedMgrApp && updatedPayApp) || isAdmin;

    const approvers: string[] = [];
    if (updatedMgrApp) approvers.push(`Branch Manager (${updatedMgrBy || 'Manager'})`);
    if (updatedPayApp) approvers.push(`Payroll (${updatedPayBy || 'Payroll'})`);

    const normalizedDate = targetDispute.date || (targetDispute as any).targetDate || '';
    const normalizedType = targetDispute.type || (targetDispute as any).disputeType || 'MISSING_PUNCH';
    const targetDate = parseToYYYYMMDD(normalizedDate);

    const existingSummaryForSnapshot = fullyApproved
      ? summaries.find(
          (s) =>
            s.employeeId === targetDispute.employeeId &&
            parseToYYYYMMDD(s.date) === targetDate
        )
      : undefined;
    const generatedSummaryId = existingSummaryForSnapshot?.id || `summary-adj-${Date.now()}`;

    const preApprovalSnapshot =
      fullyApproved && targetDispute.status !== 'APPROVED'
        ? targetDispute.preApprovalSummarySnapshot ||
          capturePreApprovalSnapshot(existingSummaryForSnapshot, generatedSummaryId)
        : targetDispute.preApprovalSummarySnapshot;

    const updatedDisputeItem: DisputeRequest = {
      ...targetDispute,
      date: normalizedDate,
      type: normalizedType,
      status: fullyApproved ? 'APPROVED' : 'PENDING',
      adminNotes: adminNotes || targetDispute.adminNotes,
      reviewedBy: approvers.join(' & ') || currentUser?.name || 'Authorized Approver',
      reviewedAt: currentNow,
      approvedAt: fullyApproved ? (targetDispute.approvedAt || currentNow) : targetDispute.approvedAt,
      managerApproved: updatedMgrApp,
      managerApprovedBy: updatedMgrBy,
      managerApprovedAt: updatedMgrAt,
      payrollApproved: updatedPayApp,
      payrollApprovedBy: updatedPayBy,
      payrollApprovedAt: updatedPayAt,
      ...(preApprovalSnapshot ? { preApprovalSummarySnapshot: preApprovalSnapshot } : {}),
    };
    delete updatedDisputeItem.disapprovedAt;
    delete updatedDisputeItem.disapprovedBy;

    // Save updated dispute directly to Firestore
    await saveDocument('disputes', updatedDisputeItem, { replace: true });

    setDisputes((prev) =>
      prev.map((d) => (d.id === disputeId ? updatedDisputeItem : d))
    );

    logActivity(
      updatedDisputeItem.status === 'APPROVED' ? 'DISPUTE_APPROVAL' : 'SYSTEM_EVENT',
      `${updatedDisputeItem.status === 'APPROVED' ? 'Approved' : 'Updated approval status for'} dispute for ${updatedDisputeItem.employeeName} (${updatedDisputeItem.category || updatedDisputeItem.type} on ${updatedDisputeItem.date}).`,
      'Disputes'
    );

    // Recalculate DTR Attendance summary ONLY when fully approved by BOTH or ADMIN
    if (fullyApproved) {
      const updatedSummaryItem = applyApprovedDisputeToSummary(
        updatedDisputeItem,
        existingSummaryForSnapshot,
        users,
        adminNotes,
        generatedSummaryId
      );

      await saveDocument('summaries', updatedSummaryItem, { replace: true });

      setSummaries((prev) => {
        const idx = prev.findIndex(
          (s) => s.employeeId === updatedDisputeItem.employeeId && parseToYYYYMMDD(s.date) === targetDate
        );
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = updatedSummaryItem;
          return next;
        }
        return [updatedSummaryItem, ...prev];
      });
    }
  };

  // Handle Dispute Rejection / Admin Disapproval of Mistakenly Approved Adjustment
  const handleRejectDispute = async (disputeId: string, adminNotes: string) => {
    const currentNow = new Date().toISOString();
    const targetDispute = disputes.find((d) => d.id === disputeId);
    if (!targetDispute) return;

    const wasApproved = targetDispute.status === 'APPROVED';
    const normalizedDate = targetDispute.date || (targetDispute as any).targetDate || '';
    const targetDate = parseToYYYYMMDD(normalizedDate);

    const updatedDisputeItem: DisputeRequest = {
      ...targetDispute,
      date: normalizedDate,
      type: targetDispute.type || (targetDispute as any).disputeType || 'MISSING_PUNCH',
      status: 'REJECTED',
      adminNotes,
      reviewedBy: currentUser?.name || 'Branch Manager / Admin',
      reviewedAt: currentNow,
      managerApproved: false,
      payrollApproved: false,
      ...(wasApproved
        ? {
            disapprovedBy: currentUser?.name || 'System Admin',
            disapprovedAt: currentNow,
          }
        : {}),
    };
    delete updatedDisputeItem.approvedAt;
    delete updatedDisputeItem.managerApprovedBy;
    delete updatedDisputeItem.managerApprovedAt;
    delete updatedDisputeItem.payrollApprovedBy;
    delete updatedDisputeItem.payrollApprovedAt;
    delete updatedDisputeItem.preApprovalSummarySnapshot;

    await saveDocument('disputes', updatedDisputeItem, { replace: true });

    setDisputes((prev) =>
      prev.map((d) => (d.id === disputeId ? updatedDisputeItem : d))
    );

    if (wasApproved) {
      const existingSummary = summaries.find(
        (s) =>
          s.employeeId === updatedDisputeItem.employeeId &&
          parseToYYYYMMDD(s.date) === targetDate
      );

      const remainingApprovedDisputesForDay = disputes.filter(
        (d) =>
          d.id !== disputeId &&
          d.employeeId === updatedDisputeItem.employeeId &&
          d.status === 'APPROVED' &&
          parseToYYYYMMDD(d.date || (d as any).targetDate || '') === targetDate
      );

      const dayPunches = punches.filter(
        (p) =>
          p.employeeId === updatedDisputeItem.employeeId &&
          parseToYYYYMMDD((p.timestamp || '').split(' ')[0]) === targetDate
      );

      const revertResult = revertSummaryAfterDisputeDisapproval({
        targetDispute,
        remainingApprovedDisputesForDay,
        existingSummary,
        dayPunches,
        users,
      });

      if (revertResult.action === 'DELETE') {
        await removeDocument('summaries', revertResult.summaryId);
        setSummaries((prev) => prev.filter((s) => s.id !== revertResult.summaryId));
      } else if (revertResult.action === 'UPDATE') {
        await saveDocument('summaries', revertResult.summary, { replace: true });
        setSummaries((prev) => {
          const idx = prev.findIndex(
            (s) =>
              s.id === revertResult.summary.id ||
              (s.employeeId === revertResult.summary.employeeId &&
                parseToYYYYMMDD(s.date) === targetDate)
          );
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = revertResult.summary;
            return next;
          }
          return [revertResult.summary, ...prev];
        });
      }
    }

    logActivity(
      'DISPUTE_REJECTION',
      wasApproved
        ? `Disapproved previously approved adjustment for ${updatedDisputeItem.employeeName} (${updatedDisputeItem.category || updatedDisputeItem.type} on ${updatedDisputeItem.date}) and reverted DTR logs. Reason: ${adminNotes}`
        : `Rejected dispute for ${updatedDisputeItem.employeeName} (${updatedDisputeItem.category || updatedDisputeItem.type} on ${updatedDisputeItem.date}).`,
      'Disputes'
    );
  };

  // Handle Staff submitting new dispute
  const handleSubmitDispute = (
    newDispute: Omit<DisputeRequest, 'id' | 'status' | 'submittedAt'>
  ) => {
    const dispute: DisputeRequest = {
      ...newDispute,
      date: newDispute.date || (newDispute as any).targetDate || '',
      type: newDispute.type || (newDispute as any).disputeType || 'MISSING_PUNCH',
      id: `disp-${Date.now()}`,
      status: 'PENDING',
      submittedAt: new Date().toISOString(),
    };
    saveDocument('disputes', dispute);
    logActivity(
      'DISPUTE_FILING',
      `Submitted dispute request for ${dispute.employeeName} (${dispute.category || dispute.type} on ${dispute.date}).`,
      'Disputes'
    );
    setDisputes((prev) => [dispute, ...prev]);
  };

  // CTO Handlers
  const handleSubmitCtoRequest = (
    newReq: Omit<CtoRequest, 'id' | 'status' | 'submittedAt'>
  ) => {
    if (currentUser?.role === 'STAFF') return;
    const normalizedDate = parseToYYYYMMDD(newReq.date) || newReq.date;
    const req: CtoRequest = {
      ...newReq,
      date: normalizedDate,
      id: `cto-req-${Date.now()}`,
      status: 'PENDING',
      managerApproved: false,
      payrollApproved: false,
      submittedAt: new Date().toISOString(),
    };
    saveDocument('ctoRequests', req);
    setCtoRequests((prev) => {
      const next = [req, ...prev];
      safeCacheCollectionItems('ctoRequests', next);
      return next;
    });
  };

  const handleApproveCtoRequest = async (id: string, notes?: string, approverRole?: 'MANAGER' | 'PAYROLL' | 'ADMIN') => {
    const currentNow = new Date().toISOString();
    const role = approverRole || (currentUser?.role === 'BRANCH_MANAGER' || currentUser?.role === 'SHIFT_MANAGER' ? 'MANAGER' : 'PAYROLL');

    const targetCto = ctoRequests.find((r) => r.id === id);
    if (!targetCto) return;

    const isMgr = role === 'MANAGER';
    const isPay = role === 'PAYROLL' || role === 'ADMIN';

    const updatedMgrApp = isMgr ? true : Boolean(targetCto.managerApproved);
    const updatedMgrBy = isMgr ? (currentUser?.name || 'Branch Manager') : targetCto.managerApprovedBy;
    const updatedMgrAt = isMgr ? currentNow : targetCto.managerApprovedAt;

    const updatedPayApp = isPay ? true : Boolean(targetCto.payrollApproved);
    const updatedPayBy = isPay ? (currentUser?.name || 'Payroll Department') : targetCto.payrollApprovedBy;
    const updatedPayAt = isPay ? currentNow : targetCto.payrollApprovedAt;

    // Both approved, or Payroll/Admin final sign-off
    const isFullyApproved = (updatedMgrApp && updatedPayApp) || (isPay && role === 'ADMIN');

    const updatedCtoItem: CtoRequest = {
      ...targetCto,
      status: isFullyApproved ? 'APPROVED' : 'PENDING',
      reviewNotes: notes || targetCto.reviewNotes,
      reviewedBy: currentUser?.name || 'Authorized Approver',
      managerApproved: updatedMgrApp,
      managerApprovedBy: updatedMgrBy,
      managerApprovedAt: updatedMgrAt,
      payrollApproved: updatedPayApp,
      payrollApprovedBy: updatedPayBy,
      payrollApprovedAt: updatedPayAt,
    };

    await saveDocument('ctoRequests', updatedCtoItem);

    setCtoRequests((prev) =>
      prev.map((r) => (r.id === id ? updatedCtoItem : r))
    );

    // If fully approved and it's a LEAVE request, mark Attendance Summary as LEAVE
    if (isFullyApproved && updatedCtoItem.requestType !== 'CREDIT') {
      const target: CtoRequest = updatedCtoItem;
      const normalizedTargetDate = (parseToYYYYMMDD(target.date) || target.date).replace(/\//g, '-');
      let updatedSummaryItem: AttendanceSummaryDaily;
      const existingIdx = summaries.findIndex(
        (s) => s.employeeId === target.employeeId && (parseToYYYYMMDD(s.date) || s.date) === normalizedTargetDate
      );

      if (existingIdx >= 0) {
        updatedSummaryItem = {
          ...summaries[existingIdx],
          status: 'LEAVE' as AttendanceStatus,
          isAdjusted: true,
          adjustmentNote: `Approved CTO Leave (${target.hoursRequested}h) - Approved by ${target.managerApprovedBy || 'Manager'} & ${target.payrollApprovedBy || 'Payroll'}`,
          anomalies: Array.from(new Set([...(summaries[existingIdx].anomalies || []), 'Approved CTO Leave'])),
        };
      } else {
        updatedSummaryItem = {
          id: `sum-cto-${target.employeeId}-${normalizedTargetDate}`,
          employeeId: target.employeeId,
          employeeName: target.employeeName,
          department: target.department,
          branch: target.branch || target.department,
          date: normalizedTargetDate,
          weekday: Number.isNaN(new Date(normalizedTargetDate).getTime())
            ? ''
            : new Date(normalizedTargetDate).toLocaleDateString('en-US', { weekday: 'long' }),
          status: 'LEAVE',
          firstIn: null,
          lastOut: null,
          totalBreakMinutes: 0,
          netHoursWorked: 0,
          undertimeHours: 0,
          overtimeHours: 0,
          targetHours: 8.0,
          anomalies: ['Approved CTO Leave'],
          punches: [],
          isAdjusted: true,
          adjustmentNote: `Approved CTO Leave (${target.hoursRequested}h) - Approved by ${target.managerApprovedBy || 'Manager'} & ${target.payrollApprovedBy || 'Payroll'}`,
        };
      }

      await saveDocument('summaries', updatedSummaryItem);

      setSummaries((prevSummaries) => {
        const idx = prevSummaries.findIndex(
          (s) => s.employeeId === target.employeeId && (parseToYYYYMMDD(s.date) || s.date) === normalizedTargetDate
        );
        if (idx >= 0) {
          const next = [...prevSummaries];
          next[idx] = updatedSummaryItem;
          return next;
        }
        return [updatedSummaryItem, ...prevSummaries];
      });
    }
  };

  const handleRejectCtoRequest = async (id: string, notes?: string) => {
    const currentNow = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const targetCto = ctoRequests.find((r) => r.id === id);
    if (!targetCto) return;

    const rejectorRole = currentUser?.role === 'BRANCH_MANAGER'
      ? `Branch Manager - ${currentUser.branch || 'YC Ebloc'}`
      : currentUser?.role === 'SHIFT_MANAGER'
      ? `Shift Manager - ${currentUser.branch || 'YC Ebloc'}`
      : currentUser?.role === 'PAYROLL'
      ? (currentUser.position || 'Payroll')
      : currentUser?.role === 'ADMIN'
      ? 'System Admin'
      : 'Approver';
    
    const rejectorIdentity = currentUser
      ? `${currentUser.name} (${rejectorRole})`
      : 'Branch Manager';

    const updatedCtoItem: CtoRequest = {
      ...targetCto,
      status: 'REJECTED',
      reviewNotes: notes || 'CTO Request Disapproved',
      reviewedBy: rejectorIdentity,
      reviewedAt: currentNow,
    };

    await saveDocument('ctoRequests', updatedCtoItem);

    setCtoRequests((prev) =>
      prev.map((r) => (r.id === id ? updatedCtoItem : r))
    );
  };

  const handleUpdateCtoRequest = async (updatedCto: CtoRequest): Promise<boolean> => {
    const normalizedDate = (parseToYYYYMMDD(updatedCto.date) || updatedCto.date).replace(/\//g, '-');
    const sanitizedCto: CtoRequest = {
      ...updatedCto,
      date: normalizedDate,
    };

    const ok = await saveDocument('ctoRequests', sanitizedCto);
    if (!ok) return false;

    setCtoRequests((prev) => {
      const next = prev.map((r) => (r.id === sanitizedCto.id ? sanitizedCto : r));
      safeCacheCollectionItems('ctoRequests', next);
      return next;
    });

    logActivity(
      'CTO_ADJUSTMENT',
      `Edited CTO ${sanitizedCto.requestType === 'CREDIT' ? 'Credit' : 'Leave'} request for ${sanitizedCto.employeeName} (${sanitizedCto.employeeId}) on ${sanitizedCto.date} (${sanitizedCto.hoursRequested}h, status: ${sanitizedCto.status}).`,
      'CTO Requests'
    );

    if (sanitizedCto.status === 'APPROVED' && sanitizedCto.requestType !== 'CREDIT') {
      const existingIdx = summaries.findIndex(
        (s) => s.employeeId === sanitizedCto.employeeId && (parseToYYYYMMDD(s.date) || s.date) === normalizedDate
      );
      const updatedSummaryItem: AttendanceSummaryDaily =
        existingIdx >= 0
          ? {
              ...summaries[existingIdx],
              status: 'LEAVE' as AttendanceStatus,
              isAdjusted: true,
              adjustmentNote: `Approved CTO Leave (${sanitizedCto.hoursRequested}h) - Updated by ${currentUser?.name || 'Admin'}`,
              anomalies: Array.from(new Set([...(summaries[existingIdx].anomalies || []), 'Approved CTO Leave'])),
            }
          : {
              id: `sum-cto-${sanitizedCto.employeeId}-${normalizedDate}`,
              employeeId: sanitizedCto.employeeId,
              employeeName: sanitizedCto.employeeName,
              department: sanitizedCto.department,
              branch: sanitizedCto.branch || sanitizedCto.department,
              date: normalizedDate,
              weekday: Number.isNaN(new Date(normalizedDate).getTime())
                ? ''
                : new Date(normalizedDate).toLocaleDateString('en-US', { weekday: 'long' }),
              status: 'LEAVE',
              firstIn: null,
              lastOut: null,
              totalBreakMinutes: 0,
              netHoursWorked: 0,
              undertimeHours: 0,
              overtimeHours: 0,
              targetHours: 8.0,
              anomalies: ['Approved CTO Leave'],
              punches: [],
              isAdjusted: true,
              adjustmentNote: `Approved CTO Leave (${sanitizedCto.hoursRequested}h) - Updated by ${currentUser?.name || 'Admin'}`,
            };

      await saveDocument('summaries', updatedSummaryItem);
      setSummaries((prevSummaries) => {
        const idx = prevSummaries.findIndex(
          (s) => s.employeeId === sanitizedCto.employeeId && (parseToYYYYMMDD(s.date) || s.date) === normalizedDate
        );
        if (idx >= 0) {
          const next = [...prevSummaries];
          next[idx] = updatedSummaryItem;
          return next;
        }
        return [updatedSummaryItem, ...prevSummaries];
      });
    }

    return true;
  };

  const handleAddCtoManualAdjustment = (
    adj: Omit<CtoManualAdjustment, 'id' | 'timestamp'>
  ) => {
    const record: CtoManualAdjustment = {
      ...adj,
      id: `cto-adj-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
    };
    saveDocument('ctoAdjustments', record);
    logActivity(
      'CTO_ADJUSTMENT',
      `Manual CTO adjustment of ${adj.amount > 0 ? '+' : ''}${adj.amount}h for ${adj.employeeName || 'ID ' + adj.employeeId}. Reason: ${adj.reason}`,
      'Adjustments'
    );
    setCtoAdjustments((prev) => [record, ...prev]);
  };

  // Add / Edit User handlers
  const handleAddUser = async (newUser: User): Promise<boolean> => {
    setUsers((prev) => {
      const next = [...prev, newUser];
      safeCacheCollectionItems('users', next);
      return next;
    });
    const ok = await saveDocument('users', newUser);
    logActivity('USER_MANAGEMENT', `Created staff account for ${newUser.name} (${newUser.employeeId}).`, 'Users');
    return ok;
  };

  const handleUpdateUser = async (updatedUser: User): Promise<boolean> => {
    setUsers((prev) => {
      const next = prev.map((u) => (u.id === updatedUser.id ? updatedUser : u));
      safeCacheCollectionItems('users', next);
      return next;
    });
    if (currentUser && currentUser.id === updatedUser.id) {
      setCurrentUser(updatedUser);
    }
    const ok = await saveDocument('users', updatedUser);
    logActivity('USER_MANAGEMENT', `Updated employee profile for ${updatedUser.name} (${updatedUser.employeeId}).`, 'Users');
    return ok;
  };

  const handleDeleteUser = (userId: string) => {
    const target = users.find((u) => u.id === userId);
    removeDocument('users', userId);
    logActivity('USER_MANAGEMENT', `Deleted user account ${target ? target.name + ' (' + target.employeeId + ')' : 'ID ' + userId}.`, 'Users');
    setUsers((prev) => prev.filter((u) => u.id !== userId));
  };

  const handleDeleteDispute = (disputeId: string) => {
    setDisputes((prev) => {
      const updated = prev.filter((d) => d.id !== disputeId);
      safeCacheCollectionItems('disputes', updated);
      return updated;
    });
    removeDocument('disputes', disputeId);
  };

  const handleDeleteSummary = (summaryId: string) => {
    removeDocument('summaries', summaryId);
    setSummaries((prev) => prev.filter((s) => s.id !== summaryId));
  };

  const handleClearSummaries = async (summaryIdsToClear?: string[]) => {
    if (summaryIdsToClear && summaryIdsToClear.length > 0) {
      const idsSet = new Set(summaryIdsToClear);
      for (const id of summaryIdsToClear) {
        await removeDocument('summaries', id);
      }
      logActivity('DATA_CLEAR', `Cleared ${summaryIdsToClear.length} selected biometric summary records.`, 'Data Clear');
      setSummaries((prev) => prev.filter((s) => !idsSet.has(s.id)));
    } else {
      for (const s of summaries) {
        await removeDocument('summaries', s.id);
      }
      for (const p of punches) {
        await removeDocument('punches', p.id);
      }
      logActivity('DATA_CLEAR', `Cleared all biometric summary logs (${summaries.length} entries) and punch logs from system.`, 'Data Clear');
      setSummaries([]);
      setPunches([]);
      try {
        localStorage.removeItem('fbc_summaries');
        localStorage.removeItem('fbc_punches');
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleDeleteCtoRequest = async (ctoId: string) => {
    const target = ctoRequests.find((c) => c.id === ctoId);
    setCtoRequests((prev) => {
      const next = prev.filter((c) => c.id !== ctoId);
      safeCacheCollectionItems('ctoRequests', next);
      return next;
    });
    await removeDocument('ctoRequests', ctoId);
    logActivity(
      'CTO_ADJUSTMENT',
      `Deleted CTO request ${target ? `for ${target.employeeName} (${target.employeeId}) on ${target.date} (${target.hoursRequested}h)` : `ID ${ctoId}`}.`,
      'CTO Requests'
    );
  };

  // Warehouse Category & Stock Item CRUD Handlers
  const handleAddWarehouseCategory = async (name: string) => {
    const nowIso = new Date().toISOString();
    const cleanName = name.trim().toUpperCase();
    const maxOrder = warehouseCategories.reduce(
      (max, c) => Math.max(max, c.sortOrder || 0),
      0
    );
    const newCat: WarehouseCategory = {
      id: `cat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: cleanName,
      sortOrder: maxOrder + 1,
      updatedAt: nowIso,
      updatedBy: currentUser?.name || 'System User',
    };
    await saveDocument('warehouseCategories', newCat);
    setWarehouseCategories((prev) => [...prev, newCat]);
    logActivity('SYSTEM_EVENT', `Added warehouse category "${cleanName}".`, 'Warehouse');
  };

  const handleUpdateWarehouseCategory = async (categoryId: string, newName: string) => {
    const target = warehouseCategories.find((c) => c.id === categoryId);
    if (!target) return;
    const cleanNew = newName.trim().toUpperCase();
    const oldName = target.name;
    const nowIso = new Date().toISOString();
    const performer = currentUser?.name || 'System User';

    const updatedCat: WarehouseCategory = {
      ...target,
      name: cleanNew,
      updatedAt: nowIso,
      updatedBy: performer,
    };
    await saveDocument('warehouseCategories', updatedCat);
    setWarehouseCategories((prev) =>
      prev.map((c) => (c.id === categoryId ? updatedCat : c))
    );

    // Sync renamed category onto matching stock items
    const affectedItems = warehouseItems
      .filter((i) => i.category === oldName)
      .map((i) => ({ ...i, category: cleanNew, updatedAt: nowIso, updatedBy: performer }));
    if (affectedItems.length > 0) {
      await saveDocuments('warehouseItems', affectedItems);
      setWarehouseItems((prev) =>
        prev.map((i) => (i.category === oldName ? { ...i, category: cleanNew, updatedAt: nowIso } : i))
      );
    }

    logActivity(
      'SYSTEM_EVENT',
      `Renamed warehouse category "${oldName}" to "${cleanNew}" (${affectedItems.length} item(s) updated).`,
      'Warehouse'
    );
  };

  const handleDeleteWarehouseCategory = async (categoryId: string) => {
    const target = warehouseCategories.find((c) => c.id === categoryId);
    await removeDocument('warehouseCategories', categoryId);
    setWarehouseCategories((prev) => prev.filter((c) => c.id !== categoryId));
    if (target) {
      logActivity('SYSTEM_EVENT', `Deleted warehouse category "${target.name}".`, 'Warehouse');
    }
  };

  // Warehouse Inventory & Stock Transfer (STR) Handlers
  const handleAddWarehouseItem = async (
    itemData: Omit<WarehouseInventoryItem, 'id' | 'updatedAt' | 'updatedBy'>,
    initialRefNumber?: string,
    notes?: string
  ) => {
    const nowIso = new Date().toISOString();
    const today = nowIso.slice(0, 10);
    const performer = currentUser?.name || 'Warehouse Staff';
    const resolvedItemCode =
      (itemData.itemCode || '').trim() ||
      findStockReferenceByDescription(
        itemData.description,
        warehouseItems,
        itemData.branchCode
      )?.itemCode ||
      '';
    const newItem: WarehouseInventoryItem = {
      ...itemData,
      itemCode: resolvedItemCode || undefined,
      id: `wh-${itemData.branchCode.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      updatedAt: nowIso,
      updatedBy: performer,
    };

    await saveDocument('warehouseItems', newItem);
    setWarehouseItems((prev) => [...prev, newItem]);

    if (newItem.quantity > 0) {
      const initialMovement: StockMovementEntry = {
        id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        date: today,
        timestamp: nowIso,
        movementType: 'STOCK_IN',
        status: 'COMPLETED',
        branchCode: newItem.branchCode,
        branchName: newItem.branchName,
        itemId: newItem.id,
        itemCode: newItem.itemCode,
        description: newItem.description,
        category: newItem.category,
        batchNo: newItem.batchNo,
        uom: newItem.uom,
        unitPrice: newItem.unitPrice,
        quantity: newItem.quantity,
        previousQty: 0,
        newQty: newItem.quantity,
        refNumber: initialRefNumber || `INIT-${newItem.branchCode}`,
        performedBy: performer,
        notes: notes || 'Initial stock item creation',
      };
      await saveDocument('stockMovements', initialMovement);
      setStockMovements((prev) => [initialMovement, ...prev]);
    }

    logActivity(
      'SYSTEM_EVENT',
      `Added warehouse SKU "${newItem.description}" (${newItem.quantity} ${newItem.uom}) to ${newItem.branchName}.`,
      'Warehouse'
    );
  };

  const handleUpdateWarehouseItem = async (updatedItem: WarehouseInventoryItem) => {
    const existing = warehouseItems.find((i) => i.id === updatedItem.id);
    const sanitizedItem: WarehouseInventoryItem =
      currentUser?.role === 'ADMIN'
        ? updatedItem
        : {
            ...updatedItem,
            quantity: existing?.quantity ?? updatedItem.quantity,
          };
    await saveDocument('warehouseItems', sanitizedItem);
    setWarehouseItems((prev) =>
      prev.map((i) => (i.id === sanitizedItem.id ? sanitizedItem : i))
    );
    logActivity(
      'SYSTEM_EVENT',
      `Updated stock item "${sanitizedItem.description}" at ${sanitizedItem.branchName}.`,
      'Warehouse'
    );
  };

  const handleDeleteWarehouseItem = async (itemId: string) => {
    const target = warehouseItems.find((i) => i.id === itemId);
    await removeDocument('warehouseItems', itemId);
    setWarehouseItems((prev) => prev.filter((i) => i.id !== itemId));
    if (target) {
      logActivity(
        'SYSTEM_EVENT',
        `Deleted stock item "${target.description}" from ${target.branchName}.`,
        'Warehouse'
      );
    }
  };

  const handleSeedBranchCatalog = async (branchCode: WarehouseBranchCode) => {
    const performer = currentUser?.name || 'System Admin';
    const branch = getBranchByCode(branchCode);
    const catalogItems = buildDefaultCatalogItemsForBranch(branchCode, performer, false);
    const existingKeys = new Set(
      warehouseItems
        .filter((i) => i.branchCode === branchCode)
        .map((i) => `${(i.itemCode || '').toLowerCase()}::${i.description.toLowerCase()}`)
    );
    const newItems = catalogItems.filter(
      (i) => !existingKeys.has(`${(i.itemCode || '').toLowerCase()}::${i.description.toLowerCase()}`)
    );
    if (newItems.length > 0) {
      await saveDocuments('warehouseItems', newItems);
      setWarehouseItems((prev) => [...prev, ...newItems]);
      logActivity(
        'SYSTEM_EVENT',
        `Seeded ${newItems.length} default catalog items to ${branch?.name || branchCode}.`,
        'Warehouse'
      );
    }
  };

  const handleAutoFillMissingItemCodes = async (): Promise<number> => {
    if (currentUser?.role !== 'ADMIN') return 0;
    const nowIso = new Date().toISOString();
    const performer = currentUser.name || 'Super Admin';
    const updates: WarehouseInventoryItem[] = [];
    const updatedById = new Map<string, WarehouseInventoryItem>();

    warehouseItems.forEach((item) => {
      if ((item.itemCode || '').trim()) return;
      const match = findStockReferenceByDescription(
        item.description,
        warehouseItems,
        item.branchCode
      );
      if (match?.itemCode) {
        const updatedDoc: WarehouseInventoryItem = {
          ...item,
          itemCode: match.itemCode,
          updatedAt: nowIso,
          updatedBy: performer,
        };
        updates.push(updatedDoc);
        updatedById.set(item.id, updatedDoc);
      }
    });

    if (updates.length > 0) {
      await saveDocuments('warehouseItems', updates);
      setWarehouseItems((prev) => prev.map((i) => updatedById.get(i.id) || i));
      logActivity(
        'SYSTEM_EVENT',
        `Auto-filled missing stock item codes for ${updates.length} item(s).`,
        'Warehouse'
      );
    }

    return updates.length;
  };

  const handleBulkImportWarehouseItems = async (params: {
    items: Array<{
      existingId?: string;
      item: Omit<WarehouseInventoryItem, 'id' | 'updatedAt' | 'updatedBy'>;
    }>;
    refNumber?: string;
  }): Promise<{ createdCount: number; updatedCount: number; categoriesAdded: number }> => {
    if (currentUser?.role !== 'ADMIN') {
      return { createdCount: 0, updatedCount: 0, categoriesAdded: 0 };
    }

    const nowIso = new Date().toISOString();
    const today = nowIso.slice(0, 10);
    const compactDate = today.replace(/-/g, '');
    const performer = currentUser.name || 'Super Admin';
    const importRef = params.refNumber?.trim() || `IMP-${compactDate}`;

    // 1. Register any new categories encountered in import
    const existingCatNames = new Set(
      warehouseCategories.map((c) => c.name.trim().toUpperCase())
    );
    let nextSortOrder = warehouseCategories.reduce(
      (max, c) => Math.max(max, c.sortOrder || 0),
      0
    );
    const newCategoryDocs: WarehouseCategory[] = [];
    params.items.forEach(({ item }) => {
      const catUpper = (item.category || '').trim().toUpperCase();
      if (catUpper && !existingCatNames.has(catUpper)) {
        existingCatNames.add(catUpper);
        nextSortOrder += 1;
        newCategoryDocs.push({
          id: `cat-${Date.now()}-${nextSortOrder}-${Math.random().toString(36).slice(2, 5)}`,
          name: catUpper,
          sortOrder: nextSortOrder,
          updatedAt: nowIso,
          updatedBy: performer,
        });
      }
    });

    // 2. Build inventory creations/updates and ledger movements
    const existingMap = new Map<string, WarehouseInventoryItem>();
    warehouseItems.forEach((w) => existingMap.set(w.id, w));

    const docsToSave: WarehouseInventoryItem[] = [];
    const createdIds = new Set<string>();
    const updatedMap = new Map<string, WarehouseInventoryItem>();
    const newMovements: StockMovementEntry[] = [];
    let createdCount = 0;
    let updatedCount = 0;

    params.items.forEach((entry, idx) => {
      const normalizedCat = (entry.item.category || 'GENERAL').trim().toUpperCase();
      if (entry.existingId && existingMap.has(entry.existingId)) {
        const prevItem = existingMap.get(entry.existingId)!;
        const nextQty = Number(entry.item.quantity) || 0;
        const prevQty = Number(prevItem.quantity) || 0;
        const updatedDoc: WarehouseInventoryItem = {
          ...prevItem,
          ...entry.item,
          category: normalizedCat,
          updatedAt: nowIso,
          updatedBy: performer,
        };
        docsToSave.push(updatedDoc);
        updatedMap.set(updatedDoc.id, updatedDoc);
        updatedCount += 1;

        if (nextQty !== prevQty) {
          const isIn = nextQty > prevQty;
          const diff = Math.abs(nextQty - prevQty);
          newMovements.push({
            id: `mov-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
            date: today,
            timestamp: nowIso,
            movementType: isIn ? 'STOCK_IN' : 'STOCK_OUT',
            status: 'COMPLETED',
            branchCode: updatedDoc.branchCode,
            branchName: updatedDoc.branchName,
            fromBranchCode: isIn ? undefined : updatedDoc.branchCode,
            fromBranchName: isIn ? 'Bulk Import Adjustment' : updatedDoc.branchName,
            toBranchCode: isIn ? updatedDoc.branchCode : undefined,
            toBranchName: isIn ? updatedDoc.branchName : 'Bulk Import Adjustment',
            itemId: updatedDoc.id,
            itemCode: updatedDoc.itemCode,
            description: updatedDoc.description,
            category: updatedDoc.category,
            batchNo: updatedDoc.batchNo,
            uom: updatedDoc.uom,
            unitPrice: updatedDoc.unitPrice,
            quantity: diff,
            previousQty: prevQty,
            newQty: nextQty,
            refNumber: importRef,
            performedBy: performer,
            notes: 'Updated via Super Admin Stock Import',
          });
        }
      } else {
        const newId = `wh-${entry.item.branchCode.toLowerCase()}-${Date.now()}-${idx}-${Math.random()
          .toString(36)
          .slice(2, 6)}`;
        const newQty = Number(entry.item.quantity) || 0;
        const resolvedNewCode =
          (entry.item.itemCode || '').trim() ||
          findStockReferenceByDescription(
            entry.item.description,
            warehouseItems,
            entry.item.branchCode
          )?.itemCode ||
          undefined;
        const newDoc: WarehouseInventoryItem = {
          ...entry.item,
          itemCode: resolvedNewCode,
          category: normalizedCat,
          id: newId,
          updatedAt: nowIso,
          updatedBy: performer,
        };
        docsToSave.push(newDoc);
        createdIds.add(newId);
        createdCount += 1;

        if (newQty > 0) {
          newMovements.push({
            id: `mov-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
            date: today,
            timestamp: nowIso,
            movementType: 'STOCK_IN',
            status: 'COMPLETED',
            branchCode: newDoc.branchCode,
            branchName: newDoc.branchName,
            fromBranchName: 'Bulk Stock Import',
            toBranchCode: newDoc.branchCode,
            toBranchName: newDoc.branchName,
            itemId: newDoc.id,
            itemCode: newDoc.itemCode,
            description: newDoc.description,
            category: newDoc.category,
            batchNo: newDoc.batchNo,
            uom: newDoc.uom,
            unitPrice: newDoc.unitPrice,
            quantity: newQty,
            previousQty: 0,
            newQty,
            refNumber: importRef,
            performedBy: performer,
            notes: 'Quick-added via Super Admin Stock Import',
          });
        }
      }
    });

    if (newCategoryDocs.length > 0) {
      await saveDocuments('warehouseCategories', newCategoryDocs);
      setWarehouseCategories((prev) => [...prev, ...newCategoryDocs]);
    }
    if (docsToSave.length > 0) {
      await saveDocuments('warehouseItems', docsToSave);
      setWarehouseItems((prev) => {
        const merged = prev.map((item) => updatedMap.get(item.id) || item);
        const createdDocs = docsToSave.filter((d) => createdIds.has(d.id));
        return [...merged, ...createdDocs];
      });
    }
    if (newMovements.length > 0) {
      await saveDocuments('stockMovements', newMovements);
      setStockMovements((prev) => [...newMovements, ...prev]);
    }

    logActivity(
      'SYSTEM_EVENT',
      `Imported stock items (${createdCount} added, ${updatedCount} updated, ${newCategoryDocs.length} new categories). Ref: ${importRef}.`,
      'Warehouse'
    );

    return {
      createdCount,
      updatedCount,
      categoriesAdded: newCategoryDocs.length,
    };
  };

  const handleRecordStockMovement = async (params: {
    itemId: string;
    movementType: 'STOCK_IN' | 'STOCK_OUT';
    quantity: number;
    refNumber: string;
    date: string;
    notes?: string;
  }) => {
    if (currentUser?.role !== 'ADMIN') return;
    const targetItem = warehouseItems.find((i) => i.id === params.itemId);
    if (!targetItem) return;

    const nowIso = new Date().toISOString();
    const performer = currentUser?.name || 'Warehouse Staff';
    const prevQty = Number(targetItem.quantity) || 0;
    const delta = Number(params.quantity) || 0;
    const nextQty =
      params.movementType === 'STOCK_IN'
        ? prevQty + delta
        : Math.max(0, prevQty - delta);

    const updatedItem: WarehouseInventoryItem = {
      ...targetItem,
      quantity: nextQty,
      updatedAt: nowIso,
      updatedBy: performer,
    };

    const movement: StockMovementEntry = {
      id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      date: params.date || nowIso.slice(0, 10),
      timestamp: nowIso,
      movementType: params.movementType,
      status: 'COMPLETED',
      branchCode: targetItem.branchCode,
      branchName: targetItem.branchName,
      fromBranchCode: params.movementType === 'STOCK_OUT' ? targetItem.branchCode : undefined,
      fromBranchName: params.movementType === 'STOCK_OUT' ? targetItem.branchName : 'Supplier / Stock In',
      toBranchCode: params.movementType === 'STOCK_IN' ? targetItem.branchCode : undefined,
      toBranchName: params.movementType === 'STOCK_IN' ? targetItem.branchName : 'Store Usage / Out',
      itemId: targetItem.id,
      itemCode: targetItem.itemCode,
      description: targetItem.description,
      category: targetItem.category,
      batchNo: targetItem.batchNo,
      uom: targetItem.uom,
      unitPrice: targetItem.unitPrice,
      quantity: delta,
      previousQty: prevQty,
      newQty: nextQty,
      refNumber: params.refNumber,
      performedBy: performer,
      notes: params.notes,
    };

    await saveDocument('warehouseItems', updatedItem);
    await saveDocument('stockMovements', movement);

    setWarehouseItems((prev) =>
      prev.map((i) => (i.id === updatedItem.id ? updatedItem : i))
    );
    setStockMovements((prev) => [movement, ...prev]);

    logActivity(
      'SYSTEM_EVENT',
      `Recorded ${params.movementType === 'STOCK_IN' ? 'Stock In' : 'Stock Out'} of ${delta} ${targetItem.uom} for "${targetItem.description}" at ${targetItem.branchName} (Ref: ${params.refNumber}).`,
      'Warehouse'
    );
  };

  const handleBulkStockInDelivery = async (params: {
    branchCode: WarehouseBranchCode;
    date: string;
    refNumber: string;
    supplierOrSource?: string;
    notes?: string;
    lines: Array<{
      itemId?: string;
      itemCode?: string;
      description: string;
      category: string;
      batchNo?: string;
      expiryDate?: string;
      uom: string;
      unitPrice: number;
      quantity: number;
      reorderLevel?: number;
    }>;
  }): Promise<{ updatedCount: number; createdCount: number; totalQtyAdded: number }> => {
    if (currentUser?.role !== 'ADMIN') {
      return { updatedCount: 0, createdCount: 0, totalQtyAdded: 0 };
    }

    const validLines = params.lines.filter(
      (line) => line.description.trim() && (Number(line.quantity) || 0) > 0
    );
    if (validLines.length === 0) {
      return { updatedCount: 0, createdCount: 0, totalQtyAdded: 0 };
    }

    const nowIso = new Date().toISOString();
    const deliveryDate = params.date || nowIso.slice(0, 10);
    const performer = currentUser.name || 'Super Admin';
    const branchName = getBranchByCode(params.branchCode)?.name || params.branchCode;
    const refNum =
      params.refNumber.trim() || `DEL-${deliveryDate.replace(/-/g, '').slice(2)}`;
    const fromSource = params.supplierOrSource?.trim() || 'Supplier / Bulk Delivery';

    const existingCatNames = new Set(
      warehouseCategories.map((c) => c.name.trim().toUpperCase())
    );
    let nextSortOrder = warehouseCategories.reduce(
      (max, c) => Math.max(max, c.sortOrder || 0),
      0
    );
    const newCategoryDocs: WarehouseCategory[] = [];
    validLines.forEach((line) => {
      const catUpper = (line.category || 'GENERAL').trim().toUpperCase();
      if (catUpper && !existingCatNames.has(catUpper)) {
        existingCatNames.add(catUpper);
        nextSortOrder += 1;
        newCategoryDocs.push({
          id: `cat-${Date.now()}-${nextSortOrder}-${Math.random().toString(36).slice(2, 5)}`,
          name: catUpper,
          sortOrder: nextSortOrder,
          updatedAt: nowIso,
          updatedBy: performer,
        });
      }
    });

    const workingById = new Map<string, WarehouseInventoryItem>();
    warehouseItems.forEach((item) => workingById.set(item.id, item));

    const findMatchInWorking = (
      line: (typeof validLines)[number]
    ): WarehouseInventoryItem | undefined => {
      if (line.itemId && workingById.has(line.itemId)) {
        const direct = workingById.get(line.itemId)!;
        if (direct.branchCode === params.branchCode) return direct;
      }
      const descLower = line.description.trim().toLowerCase();
      const batchLower = (line.batchNo || '').trim().toLowerCase();
      const codeLower = (line.itemCode || '').trim().toLowerCase();
      const branchValues = Array.from(workingById.values()).filter(
        (w) => w.branchCode === params.branchCode
      );
      return (
        branchValues.find(
          (w) =>
            (w.description || '').trim().toLowerCase() === descLower &&
            (w.batchNo || '').trim().toLowerCase() === batchLower
        ) ||
        branchValues.find(
          (w) =>
            (codeLower &&
              (w.itemCode || '').trim().toLowerCase() === codeLower &&
              (w.batchNo || '').trim().toLowerCase() === batchLower) ||
            ((w.description || '').trim().toLowerCase() === descLower && !batchLower)
        )
      );
    };

    const touchedDocsMap = new Map<string, WarehouseInventoryItem>();
    const createdIds = new Set<string>();
    const newMovements: StockMovementEntry[] = [];
    let updatedCount = 0;
    let createdCount = 0;
    let totalQtyAdded = 0;

    validLines.forEach((line, idx) => {
      const delta = Number(line.quantity) || 0;
      if (delta <= 0) return;
      totalQtyAdded += delta;

      const normalizedCat = (line.category || 'GENERAL').trim().toUpperCase();
      const matched = findMatchInWorking(line);

      if (matched) {
        const prevQty = Number(matched.quantity) || 0;
        const nextQty = prevQty + delta;
        const updatedDoc: WarehouseInventoryItem = {
          ...matched,
          itemCode: (line.itemCode || '').trim() || matched.itemCode || undefined,
          batchNo: (line.batchNo || '').trim() || matched.batchNo || '',
          expiryDate: (line.expiryDate || '').trim() || matched.expiryDate || undefined,
          unitPrice:
            Number(line.unitPrice) > 0 ? Number(line.unitPrice) : matched.unitPrice,
          quantity: nextQty,
          updatedAt: nowIso,
          updatedBy: performer,
        };
        workingById.set(updatedDoc.id, updatedDoc);
        if (!createdIds.has(updatedDoc.id)) {
          updatedCount += 1;
        }
        touchedDocsMap.set(updatedDoc.id, updatedDoc);

        newMovements.push({
          id: `mov-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
          date: deliveryDate,
          timestamp: nowIso,
          movementType: 'STOCK_IN',
          status: 'COMPLETED',
          branchCode: params.branchCode,
          branchName,
          fromBranchName: fromSource,
          toBranchCode: params.branchCode,
          toBranchName: branchName,
          itemId: updatedDoc.id,
          itemCode: updatedDoc.itemCode,
          description: updatedDoc.description,
          category: updatedDoc.category,
          batchNo: updatedDoc.batchNo,
          uom: updatedDoc.uom,
          unitPrice: updatedDoc.unitPrice,
          quantity: delta,
          previousQty: prevQty,
          newQty: nextQty,
          refNumber: refNum,
          performedBy: performer,
          notes: params.notes?.trim() || 'Bulk stock delivery (Stock In)',
        });
      } else {
        const newId = `wh-${params.branchCode.toLowerCase()}-${Date.now()}-${idx}-${Math.random()
          .toString(36)
          .slice(2, 6)}`;
        const resolvedCode =
          (line.itemCode || '').trim() ||
          findStockReferenceByDescription(
            line.description,
            warehouseItems,
            params.branchCode
          )?.itemCode ||
          undefined;
        const newDoc: WarehouseInventoryItem = {
          id: newId,
          itemCode: resolvedCode,
          description: line.description.trim(),
          category: normalizedCat,
          batchNo: (line.batchNo || '').trim(),
          expiryDate: (line.expiryDate || '').trim() || undefined,
          uom: line.uom || 'Pack',
          unitPrice: Number(line.unitPrice) || 0,
          branchCode: params.branchCode,
          branchName,
          quantity: delta,
          reorderLevel:
            line.reorderLevel !== undefined
              ? Math.max(0, Number(line.reorderLevel) || 0)
              : 2,
          updatedAt: nowIso,
          updatedBy: performer,
        };
        workingById.set(newId, newDoc);
        createdIds.add(newId);
        touchedDocsMap.set(newId, newDoc);
        createdCount += 1;

        newMovements.push({
          id: `mov-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
          date: deliveryDate,
          timestamp: nowIso,
          movementType: 'STOCK_IN',
          status: 'COMPLETED',
          branchCode: params.branchCode,
          branchName,
          fromBranchName: fromSource,
          toBranchCode: params.branchCode,
          toBranchName: branchName,
          itemId: newDoc.id,
          itemCode: newDoc.itemCode,
          description: newDoc.description,
          category: newDoc.category,
          batchNo: newDoc.batchNo,
          uom: newDoc.uom,
          unitPrice: newDoc.unitPrice,
          quantity: delta,
          previousQty: 0,
          newQty: delta,
          refNumber: refNum,
          performedBy: performer,
          notes: params.notes?.trim() || 'Bulk stock delivery (Stock In)',
        });
      }
    });

    const docsToSave = Array.from(touchedDocsMap.values());
    if (newCategoryDocs.length > 0) {
      await saveDocuments('warehouseCategories', newCategoryDocs);
      setWarehouseCategories((prev) => [...prev, ...newCategoryDocs]);
    }
    if (docsToSave.length > 0) {
      await saveDocuments('warehouseItems', docsToSave);
      setWarehouseItems((prev) => {
        const updatedSet = new Set(docsToSave.map((d) => d.id));
        const merged = prev.map((item) =>
          updatedSet.has(item.id) ? touchedDocsMap.get(item.id)! : item
        );
        const createdDocs = docsToSave.filter((d) => createdIds.has(d.id));
        return [...merged, ...createdDocs];
      });
    }
    if (newMovements.length > 0) {
      await saveDocuments('stockMovements', newMovements);
      setStockMovements((prev) => [...newMovements, ...prev]);
    }

    logActivity(
      'SYSTEM_EVENT',
      `Bulk Stock In delivery at ${branchName}: +${totalQtyAdded} units across ${validLines.length} line(s) (Ref: ${refNum}).`,
      'Warehouse'
    );

    return { updatedCount, createdCount, totalQtyAdded };
  };

  const handleCreateStockTransfer = async (
    transferInput: Omit<
      StockTransferRequisition,
      'id' | 'createdAt' | 'createdByUserId' | 'status'
    >
  ): Promise<StockTransferRequisition> => {
    const nowIso = new Date().toISOString();
    const performer = currentUser?.name || transferInput.preparedBy || 'Warehouse Staff';
    const cleanReviewer =
      currentUser?.role === 'ADMIN' ? (transferInput.reviewedBy || '').trim() : '';

    const newTransfer: StockTransferRequisition = {
      ...transferInput,
      id: `str-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      reviewedBy: cleanReviewer,
      reviewedAt: cleanReviewer ? nowIso : undefined,
      reviewedByUserId: cleanReviewer ? currentUser?.id : undefined,
      receivedBy: '',
      status: 'PENDING',
      createdAt: nowIso,
      createdByUserId: currentUser?.id,
    };

    const workingInventory = [...warehouseItems];
    const itemsToSaveMap = new Map<string, WarehouseInventoryItem>();
    const newMovements: StockMovementEntry[] = [];
    const isFromMonitored = isMonitoredWarehouseBranch(transferInput.fromBranchCode);

    (transferInput.items || []).forEach((line, lineIndex) => {
      const qty = Number(line.quantity) || 0;
      if (qty <= 0) return;

      // Deduct from Issuing (From) Branch immediately on dispatch if it is a monitored warehouse branch
      const issuingIdx = isFromMonitored
        ? workingInventory.findIndex(
            (i) =>
              (line.itemId &&
                i.id === line.itemId &&
                i.branchCode === transferInput.fromBranchCode) ||
              (i.branchCode === transferInput.fromBranchCode &&
                (i.description || '').toLowerCase() === (line.description || '').toLowerCase() &&
                (i.batchNo || '').toLowerCase() === (line.batchNo || '').toLowerCase())
          )
        : -1;

      let issuingPrevQty = 0;
      let issuingNewQty = 0;
      let issuingItemId =
        line.itemId ||
        `wh-${transferInput.fromBranchCode.toLowerCase()}-${Date.now()}-${lineIndex}`;

      let issuingItemCode =
        (line.itemCode || '').trim() ||
        findStockReferenceByDescription(
          line.description,
          workingInventory,
          transferInput.fromBranchCode
        )?.itemCode ||
        undefined;

      if (issuingIdx >= 0) {
        const existingIssuing = workingInventory[issuingIdx];
        issuingPrevQty = Number(existingIssuing.quantity) || 0;
        issuingNewQty = Math.max(0, issuingPrevQty - qty);
        issuingItemId = existingIssuing.id;
        issuingItemCode = (existingIssuing.itemCode || '').trim() || issuingItemCode;

        const updatedIssuing: WarehouseInventoryItem = {
          ...existingIssuing,
          itemCode: existingIssuing.itemCode || issuingItemCode,
          quantity: issuingNewQty,
          updatedAt: nowIso,
          updatedBy: performer,
        };
        workingInventory[issuingIdx] = updatedIssuing;
        itemsToSaveMap.set(updatedIssuing.id, updatedIssuing);
      }

      newMovements.push({
        id: `mov-tout-${Date.now()}-${lineIndex}-${Math.random().toString(36).slice(2, 5)}`,
        date: transferInput.date,
        timestamp: nowIso,
        movementType: 'TRANSFER_OUT',
        status: 'PENDING',
        branchCode: transferInput.fromBranchCode,
        branchName: transferInput.fromBranchName,
        counterpartyBranchCode: transferInput.toBranchCode,
        counterpartyBranchName: transferInput.toBranchName,
        fromBranchCode: transferInput.fromBranchCode,
        fromBranchName: transferInput.fromBranchName,
        toBranchCode: transferInput.toBranchCode,
        toBranchName: transferInput.toBranchName,
        itemId: issuingItemId,
        itemCode: issuingItemCode,
        description: line.description,
        category: line.category,
        batchNo: (line.batchNo || '').trim(),
        uom: line.uom,
        unitPrice: Number(line.unitPrice) || 0,
        quantity: qty,
        previousQty: issuingPrevQty,
        newQty: issuingNewQty,
        refNumber: transferInput.strRefNumber,
        transferNumber: transferInput.transferNumber,
        performedBy: performer,
        notes: transferInput.remarks || `Dispatched to ${transferInput.toBranchName} (Pending Receipt)`,
      });
    });

    await saveDocuments('warehouseItems', Array.from(itemsToSaveMap.values()));
    await saveDocuments('stockMovements', newMovements);
    await saveDocument('stockTransfers', newTransfer);

    setWarehouseItems(workingInventory);
    setStockMovements((prev) => [...newMovements, ...prev]);
    setStockTransfers((prev) => [newTransfer, ...prev]);

    logActivity(
      'SYSTEM_EVENT',
      `Created PENDING STR ${newTransfer.strRefNumber} (${newTransfer.transferNumber}) from ${newTransfer.fromBranchName} to ${newTransfer.toBranchName}${cleanReviewer ? ` · Reviewed by ${cleanReviewer}` : ''}.`,
      'Warehouse'
    );

    return newTransfer;
  };

  const handleApproveReviewStockTransfer = async (
    transferId: string,
    cancelledItemIds: string[] = [],
    cancelReasons: Record<string, string> = {},
    reviewedItems?: StockTransferLineItem[]
  ) => {
    if (currentUser?.role !== 'ADMIN') return;
    const target = stockTransfers.find((t) => t.id === transferId);
    if (!target) return;

    const nowIso = new Date().toISOString();
    const todayDate = nowIso.slice(0, 10);
    const reviewer = currentUser?.name || 'Super Admin';
    const cancelledSet = new Set(cancelledItemIds);

    const workingInventory = [...warehouseItems];
    const itemsToSaveMap = new Map<string, WarehouseInventoryItem>();
    const newMovements: StockMovementEntry[] = [];
    const updatedMovementsMap = new Map<string, StockMovementEntry>();
    const isFromMonitored = isMonitoredWarehouseBranch(target.fromBranchCode);

    const origLinesByKey = new Map<string, StockTransferLineItem>();
    (target.items || []).forEach((orig, idx) => {
      origLinesByKey.set(orig.id || `line-idx-${idx}`, orig);
    });

    const baseLines: StockTransferLineItem[] =
      Array.isArray(reviewedItems) && reviewedItems.length > 0
        ? reviewedItems
        : target.items || [];

    const usedMovementIds = new Set<string>();
    let qtyEditedCount = 0;
    let addedLinesCount = 0;

    const updatedItems: StockTransferLineItem[] = baseLines.map((line, lineIndex) => {
      const lineKey = line.id || `line-idx-${lineIndex}`;
      const origLine = origLinesByKey.get(lineKey);
      const isCancelled = cancelledSet.has(lineKey);
      const wasAlreadyCancelled = origLine?.itemStatus === 'CANCELLED';
      const nextQty = Math.max(1, Math.floor(Number(line.quantity) || Number(origLine?.quantity) || 1));
      const reasonText = isCancelled
        ? (cancelReasons[lineKey] || '').trim() || 'Not available in inventory'
        : undefined;

      const origOutMov = origLine
        ? stockMovements.find(
            (m) =>
              !usedMovementIds.has(m.id) &&
              m.movementType === 'TRANSFER_OUT' &&
              m.refNumber === target.strRefNumber &&
              m.transferNumber === target.transferNumber &&
              m.branchCode === target.fromBranchCode &&
              (m.description || '').toLowerCase() === (line.description || '').toLowerCase() &&
              ((m.batchNo || '').toLowerCase() === (line.batchNo || '').trim().toLowerCase() ||
                (!(line.batchNo || '').trim() && (m.batchNo || '').toLowerCase() === 'general'))
          ) ||
          stockMovements.find(
            (m) =>
              !usedMovementIds.has(m.id) &&
              m.movementType === 'TRANSFER_OUT' &&
              m.refNumber === target.strRefNumber &&
              m.transferNumber === target.transferNumber &&
              m.branchCode === target.fromBranchCode &&
              (m.description || '').toLowerCase() === (line.description || '').toLowerCase()
          )
        : undefined;

      if (origOutMov) {
        usedMovementIds.add(origOutMov.id);
      }

      const findIssuingIdx = () =>
        workingInventory.findIndex(
          (i) =>
            (line.itemId && i.id === line.itemId && i.branchCode === target.fromBranchCode) ||
            (i.branchCode === target.fromBranchCode &&
              (i.description || '').toLowerCase() === (line.description || '').toLowerCase() &&
              (i.batchNo || '').toLowerCase() === (line.batchNo || '').toLowerCase())
        );

      if (isCancelled) {
        if (origOutMov) {
          updatedMovementsMap.set(origOutMov.id, {
            ...origOutMov,
            status: 'CANCELLED',
          });
        }

        if (!wasAlreadyCancelled && origLine && isFromMonitored) {
          const deductedQty = origOutMov
            ? Math.max(0, (Number(origOutMov.previousQty) || 0) - (Number(origOutMov.newQty) || 0))
            : 0;

          if (deductedQty > 0) {
            const issuingIdx = findIssuingIdx();
            if (issuingIdx >= 0) {
              const existingIssuing = workingInventory[issuingIdx];
              const prevQty = Number(existingIssuing.quantity) || 0;
              const newQty = prevQty + deductedQty;
              const restoredItem: WarehouseInventoryItem = {
                ...existingIssuing,
                quantity: newQty,
                updatedAt: nowIso,
                updatedBy: reviewer,
              };
              workingInventory[issuingIdx] = restoredItem;
              itemsToSaveMap.set(restoredItem.id, restoredItem);

              newMovements.push({
                id: `mov-ret-${Date.now()}-${lineIndex}-${Math.random().toString(36).slice(2, 5)}`,
                date: todayDate,
                timestamp: nowIso,
                movementType: 'STOCK_IN',
                status: 'CANCELLED',
                branchCode: target.fromBranchCode,
                branchName: target.fromBranchName,
                fromBranchCode: target.toBranchCode,
                fromBranchName: `${target.toBranchName} (STR Cancelled Item)`,
                toBranchCode: target.fromBranchCode,
                toBranchName: target.fromBranchName,
                itemId: restoredItem.id,
                itemCode: restoredItem.itemCode || line.itemCode,
                description: line.description,
                category: line.category,
                batchNo: (line.batchNo || '').trim(),
                uom: line.uom,
                unitPrice: line.unitPrice,
                quantity: deductedQty,
                previousQty: prevQty,
                newQty,
                refNumber: target.strRefNumber,
                transferNumber: target.transferNumber,
                performedBy: reviewer,
                notes: `Item cancelled during Super Admin STR review (${reasonText})`,
              });
            }
          }
        }

        return {
          ...line,
          id: lineKey,
          quantity: nextQty,
          itemStatus: 'CANCELLED',
          cancelReason: reasonText,
        };
      }

      // Active APPROVED line
      if (!origLine || wasAlreadyCancelled) {
        if (!origLine) {
          addedLinesCount++;
        } else {
          qtyEditedCount++;
        }

        let prevQty = 0;
        let afterQty = 0;
        let resolvedItemId =
          line.itemId ||
          `wh-${target.fromBranchCode.toLowerCase()}-${Date.now()}-${lineIndex}`;
        let resolvedItemCode = line.itemCode;

        if (isFromMonitored) {
          const issuingIdx = findIssuingIdx();
          if (issuingIdx >= 0) {
            const existingIssuing = workingInventory[issuingIdx];
            prevQty = Number(existingIssuing.quantity) || 0;
            afterQty = Math.max(0, prevQty - nextQty);
            resolvedItemId = existingIssuing.id;
            resolvedItemCode = (existingIssuing.itemCode || '').trim() || resolvedItemCode;

            const updatedIssuing: WarehouseInventoryItem = {
              ...existingIssuing,
              quantity: afterQty,
              updatedAt: nowIso,
              updatedBy: reviewer,
            };
            workingInventory[issuingIdx] = updatedIssuing;
            itemsToSaveMap.set(updatedIssuing.id, updatedIssuing);
          }
        }

        if (origOutMov) {
          updatedMovementsMap.set(origOutMov.id, {
            ...origOutMov,
            status: 'PENDING',
            quantity: nextQty,
            previousQty: prevQty,
            newQty: afterQty,
            notes: `Re-approved during Super Admin STR review (${nextQty} ${line.uom})`,
          });
        } else {
          newMovements.push({
            id: `mov-tout-${Date.now()}-${lineIndex}-${Math.random().toString(36).slice(2, 5)}`,
            date: target.date || todayDate,
            timestamp: nowIso,
            movementType: 'TRANSFER_OUT',
            status: 'PENDING',
            branchCode: target.fromBranchCode,
            branchName: target.fromBranchName,
            counterpartyBranchCode: target.toBranchCode,
            counterpartyBranchName: target.toBranchName,
            fromBranchCode: target.fromBranchCode,
            fromBranchName: target.fromBranchName,
            toBranchCode: target.toBranchCode,
            toBranchName: target.toBranchName,
            itemId: resolvedItemId,
            itemCode: resolvedItemCode,
            description: line.description,
            category: line.category,
            batchNo: (line.batchNo || '').trim(),
            uom: line.uom,
            unitPrice: Number(line.unitPrice) || 0,
            quantity: nextQty,
            previousQty: prevQty,
            newQty: afterQty,
            refNumber: target.strRefNumber,
            transferNumber: target.transferNumber,
            performedBy: reviewer,
            notes: `Added during Super Admin STR review (${target.toBranchName})`,
          });
        }
      } else {
        const prevActiveQty = Number(origLine.quantity) || 0;
        const qtyDelta = nextQty - prevActiveQty;

        if (qtyDelta !== 0) {
          qtyEditedCount++;
          let actualDelta = 0;

          if (isFromMonitored) {
            const issuingIdx = findIssuingIdx();
            if (issuingIdx >= 0) {
              const existingIssuing = workingInventory[issuingIdx];
              const curQty = Number(existingIssuing.quantity) || 0;
              const nextBranchQty =
                qtyDelta > 0
                  ? Math.max(0, curQty - qtyDelta)
                  : curQty + Math.abs(qtyDelta);
              actualDelta = curQty - nextBranchQty;

              const updatedIssuing: WarehouseInventoryItem = {
                ...existingIssuing,
                quantity: nextBranchQty,
                updatedAt: nowIso,
                updatedBy: reviewer,
              };
              workingInventory[issuingIdx] = updatedIssuing;
              itemsToSaveMap.set(updatedIssuing.id, updatedIssuing);
            }
          }

          if (origOutMov) {
            const oldReserved = Math.max(
              0,
              (Number(origOutMov.previousQty) || 0) - (Number(origOutMov.newQty) || 0)
            );
            const updatedReserved = isFromMonitored
              ? Math.max(0, oldReserved + actualDelta)
              : nextQty;
            const movNewQty = Number(origOutMov.newQty) || 0;
            const movPrevQty = movNewQty + updatedReserved;

            updatedMovementsMap.set(origOutMov.id, {
              ...origOutMov,
              quantity: nextQty,
              previousQty: movPrevQty,
              newQty: movNewQty,
              notes: `${origOutMov.notes ? `${origOutMov.notes} · ` : ''}Qty adjusted ${prevActiveQty} → ${nextQty} by ${reviewer}`,
            });
          } else {
            newMovements.push({
              id: `mov-tout-${Date.now()}-${lineIndex}-${Math.random().toString(36).slice(2, 5)}`,
              date: target.date || todayDate,
              timestamp: nowIso,
              movementType: 'TRANSFER_OUT',
              status: 'PENDING',
              branchCode: target.fromBranchCode,
              branchName: target.fromBranchName,
              counterpartyBranchCode: target.toBranchCode,
              counterpartyBranchName: target.toBranchName,
              fromBranchCode: target.fromBranchCode,
              fromBranchName: target.fromBranchName,
              toBranchCode: target.toBranchCode,
              toBranchName: target.toBranchName,
              itemId:
                line.itemId ||
                `wh-${target.fromBranchCode.toLowerCase()}-${Date.now()}-${lineIndex}`,
              itemCode: line.itemCode,
              description: line.description,
              category: line.category,
              batchNo: (line.batchNo || '').trim(),
              uom: line.uom,
              unitPrice: Number(line.unitPrice) || 0,
              quantity: nextQty,
              previousQty: Math.max(0, actualDelta),
              newQty: 0,
              refNumber: target.strRefNumber,
              transferNumber: target.transferNumber,
              performedBy: reviewer,
              notes: `Qty adjusted ${prevActiveQty} → ${nextQty} by ${reviewer}`,
            });
          }
        }
      }

      const { cancelReason: _removedReason, ...restLine } = line;
      return {
        ...restLine,
        id: lineKey,
        quantity: nextQty,
        itemStatus: 'APPROVED',
      };
    });

    const allCancelled =
      updatedItems.length > 0 && updatedItems.every((item) => item.itemStatus === 'CANCELLED');
    const cancelledCount = updatedItems.filter((item) => item.itemStatus === 'CANCELLED').length;
    const approvedCount = updatedItems.length - cancelledCount;

    const updatedTransfer: StockTransferRequisition = {
      ...target,
      items: updatedItems,
      status: allCancelled ? 'CANCELLED' : target.status === 'CANCELLED' ? 'PENDING' : target.status,
      reviewedBy: reviewer,
      reviewedAt: nowIso,
      reviewedByUserId: currentUser?.id,
    };

    const movementsToPersist = [...newMovements, ...Array.from(updatedMovementsMap.values())];
    if (itemsToSaveMap.size > 0) {
      await saveDocuments('warehouseItems', Array.from(itemsToSaveMap.values()));
      setWarehouseItems(workingInventory);
    }
    if (movementsToPersist.length > 0) {
      await saveDocuments('stockMovements', movementsToPersist);
      setStockMovements((prev) => [
        ...newMovements,
        ...prev.map((m) => updatedMovementsMap.get(m.id) || m),
      ]);
    }
    await saveDocument('stockTransfers', updatedTransfer);
    setStockTransfers((prev) =>
      prev.map((t) => (t.id === transferId ? updatedTransfer : t))
    );

    const extraSummary = [
      qtyEditedCount > 0 ? `${qtyEditedCount} qty adjusted` : '',
      addedLinesCount > 0 ? `${addedLinesCount} item(s) added` : '',
    ]
      .filter(Boolean)
      .join(', ');

    logActivity(
      'SYSTEM_EVENT',
      `Super Admin ${reviewer} reviewed STR ${target.strRefNumber} (${target.fromBranchName} → ${target.toBranchName}): ${approvedCount} approved, ${cancelledCount} cancelled${extraSummary ? ` · ${extraSummary}` : ''}${allCancelled ? ' (STR CANCELLED)' : ''}.`,
      'Warehouse'
    );
  };

  const handleMarkStockTransferReceived = async (transferId: string) => {
    const target = stockTransfers.find((t) => t.id === transferId);
    if (!target || target.status !== 'PENDING') return;

    const nowIso = new Date().toISOString();
    const todayDate = nowIso.slice(0, 10);
    const receiverName = currentUser?.name || 'System User';

    const workingInventory = [...warehouseItems];
    const itemsToSaveMap = new Map<string, WarehouseInventoryItem>();
    const newMovements: StockMovementEntry[] = [];
    const updatedMovementsMap = new Map<string, StockMovementEntry>();
    const isToMonitored = isMonitoredWarehouseBranch(target.toBranchCode);

    (target.items || []).forEach((line, lineIndex) => {
      if (line.itemStatus === 'CANCELLED') return;
      const qty = Number(line.quantity) || 0;
      if (qty <= 0) return;

      const matchingOutMov = stockMovements.find(
        (m) =>
          m.movementType === 'TRANSFER_OUT' &&
          m.refNumber === target.strRefNumber &&
          m.transferNumber === target.transferNumber &&
          (m.description || '').toLowerCase() === (line.description || '').toLowerCase()
      );
      if (matchingOutMov && matchingOutMov.status !== 'CANCELLED') {
        updatedMovementsMap.set(matchingOutMov.id, {
          ...matchingOutMov,
          status: 'RECEIVED',
        });
      }

      const sourceItem = workingInventory.find(
        (i) =>
          (line.itemId && i.id === line.itemId) ||
          (i.branchCode === target.fromBranchCode &&
            (i.description || '').toLowerCase() === (line.description || '').toLowerCase() &&
            (i.batchNo || '').toLowerCase() === (line.batchNo || '').toLowerCase())
      );

      let receivingPrevQty = 0;
      let receivingNewQty = qty;
      let receivingItemId =
        line.itemId ||
        `store-${target.toBranchCode.toLowerCase()}-${Date.now()}-${lineIndex}`;

      const resolvedLineCode =
        (line.itemCode || '').trim() ||
        (sourceItem?.itemCode || '').trim() ||
        findStockReferenceByDescription(
          line.description,
          workingInventory,
          target.fromBranchCode
        )?.itemCode ||
        findStockReferenceByCode(
          line.itemCode || '',
          workingInventory,
          target.fromBranchCode
        )?.itemCode ||
        undefined;

      if (isToMonitored) {
        const receivingIdx = workingInventory.findIndex(
          (i) =>
            i.branchCode === target.toBranchCode &&
            (i.description || '').toLowerCase() === (line.description || '').toLowerCase() &&
            (i.batchNo || '').toLowerCase() === (line.batchNo || '').toLowerCase()
        );

        if (receivingIdx >= 0) {
          const existingReceiving = workingInventory[receivingIdx];
          receivingPrevQty = Number(existingReceiving.quantity) || 0;
          receivingNewQty = receivingPrevQty + qty;
          receivingItemId = existingReceiving.id;

          const updatedReceiving: WarehouseInventoryItem = {
            ...existingReceiving,
            itemCode: existingReceiving.itemCode || resolvedLineCode,
            quantity: receivingNewQty,
            unitPrice: line.unitPrice || existingReceiving.unitPrice,
            updatedAt: nowIso,
            updatedBy: receiverName,
          };
          workingInventory[receivingIdx] = updatedReceiving;
          itemsToSaveMap.set(updatedReceiving.id, updatedReceiving);
        } else {
          receivingItemId = `wh-${target.toBranchCode.toLowerCase()}-${Date.now()}-${lineIndex}-${Math.random().toString(36).slice(2, 5)}`;
          const createdReceiving: WarehouseInventoryItem = {
            id: receivingItemId,
            itemCode: resolvedLineCode,
            description: line.description,
            category: line.category,
            batchNo: (line.batchNo || '').trim(),
            uom: line.uom,
            unitPrice: line.unitPrice || 0,
            branchCode: target.toBranchCode,
            branchName: target.toBranchName,
            quantity: receivingNewQty,
            reorderLevel: 2,
            updatedAt: nowIso,
            updatedBy: receiverName,
          };
          workingInventory.push(createdReceiving);
          itemsToSaveMap.set(createdReceiving.id, createdReceiving);
        }
      }

      newMovements.push({
        id: `mov-tin-${Date.now()}-${lineIndex}-${Math.random().toString(36).slice(2, 5)}`,
        date: todayDate,
        timestamp: nowIso,
        movementType: 'TRANSFER_IN',
        status: 'RECEIVED',
        branchCode: target.toBranchCode,
        branchName: target.toBranchName,
        counterpartyBranchCode: target.fromBranchCode,
        counterpartyBranchName: target.fromBranchName,
        fromBranchCode: target.fromBranchCode,
        fromBranchName: target.fromBranchName,
        toBranchCode: target.toBranchCode,
        toBranchName: target.toBranchName,
        itemId: receivingItemId,
        itemCode: resolvedLineCode,
        description: line.description,
        category: line.category,
        batchNo: (line.batchNo || '').trim(),
        uom: line.uom,
        unitPrice: line.unitPrice,
        quantity: qty,
        previousQty: receivingPrevQty,
        newQty: receivingNewQty,
        refNumber: target.strRefNumber,
        transferNumber: target.transferNumber,
        performedBy: receiverName,
        notes:
          target.remarks ||
          (isToMonitored
            ? `Marked received from ${target.fromBranchName}`
            : `Received at store branch ${target.toBranchName} (unmonitored inventory)`),
      });
    });

    const updatedTransfer: StockTransferRequisition = {
      ...target,
      status: 'RECEIVED',
      receivedBy: receiverName,
      receivedAt: nowIso,
      receivedByUserId: currentUser?.id,
      receivedByRole: currentUser?.role,
    };

    const movementsToPersist = [...newMovements, ...Array.from(updatedMovementsMap.values())];
    await saveDocuments('warehouseItems', Array.from(itemsToSaveMap.values()));
    await saveDocuments('stockMovements', movementsToPersist);
    await saveDocument('stockTransfers', updatedTransfer);

    setWarehouseItems(workingInventory);
    setStockMovements((prev) => [
      ...newMovements,
      ...prev.map((m) => updatedMovementsMap.get(m.id) || m),
    ]);
    setStockTransfers((prev) =>
      prev.map((t) => (t.id === transferId ? updatedTransfer : t))
    );

    logActivity(
      'SYSTEM_EVENT',
      `Marked STR ${target.strRefNumber} (${target.fromBranchName} → ${target.toBranchName}) as RECEIVED by ${receiverName}.`,
      'Warehouse'
    );
  };

  const handleDeleteStockTransfer = async (transferId: string) => {
    if (currentUser?.role !== 'ADMIN') return;
    const target = stockTransfers.find((t) => t.id === transferId);
    if (!target) return;

    const nowIso = new Date().toISOString();
    const performer = currentUser?.name || 'Super Admin';
    const linkedMovements = stockMovements.filter(
      (m) =>
        m.refNumber === target.strRefNumber &&
        m.transferNumber === target.transferNumber
    );

    const workingInventory = [...warehouseItems];
    const itemsToSaveMap = new Map<string, WarehouseInventoryItem>();
    const isFromMonitored = isMonitoredWarehouseBranch(target.fromBranchCode);
    const isToMonitored = isMonitoredWarehouseBranch(target.toBranchCode);

    // Reverse linked stock adjustments so deleting an STR keeps branch balances accurate
    linkedMovements.forEach((mov) => {
      if (mov.movementType === 'TRANSFER_OUT' && mov.status !== 'CANCELLED' && isFromMonitored) {
        const deductedQty = Math.max(
          0,
          (Number(mov.previousQty) || 0) - (Number(mov.newQty) || 0)
        );
        if (deductedQty > 0) {
          const idx = workingInventory.findIndex(
            (i) =>
              (mov.itemId && i.id === mov.itemId && i.branchCode === target.fromBranchCode) ||
              (i.branchCode === target.fromBranchCode &&
                (i.description || '').toLowerCase() === (mov.description || '').toLowerCase() &&
                ((i.batchNo || '').toLowerCase() === (mov.batchNo || '').toLowerCase() ||
                  (!(i.batchNo || '').trim() && (mov.batchNo || '').toLowerCase() === 'general')))
          );
          if (idx >= 0) {
            const cur = workingInventory[idx];
            const restored: WarehouseInventoryItem = {
              ...cur,
              quantity: (Number(cur.quantity) || 0) + deductedQty,
              updatedAt: nowIso,
              updatedBy: performer,
            };
            workingInventory[idx] = restored;
            itemsToSaveMap.set(restored.id, restored);
          }
        }
      } else if (mov.movementType === 'TRANSFER_IN' && mov.status === 'RECEIVED' && isToMonitored) {
        const addedQty = Math.max(
          0,
          (Number(mov.newQty) || 0) - (Number(mov.previousQty) || 0)
        );
        if (addedQty > 0) {
          const idx = workingInventory.findIndex(
            (i) =>
              (mov.itemId && i.id === mov.itemId && i.branchCode === target.toBranchCode) ||
              (i.branchCode === target.toBranchCode &&
                (i.description || '').toLowerCase() === (mov.description || '').toLowerCase() &&
                ((i.batchNo || '').toLowerCase() === (mov.batchNo || '').toLowerCase() ||
                  (!(i.batchNo || '').trim() && (mov.batchNo || '').toLowerCase() === 'general')))
          );
          if (idx >= 0) {
            const cur = workingInventory[idx];
            const reverted: WarehouseInventoryItem = {
              ...cur,
              quantity: Math.max(0, (Number(cur.quantity) || 0) - addedQty),
              updatedAt: nowIso,
              updatedBy: performer,
            };
            workingInventory[idx] = reverted;
            itemsToSaveMap.set(reverted.id, reverted);
          }
        }
      }
    });

    if (itemsToSaveMap.size > 0) {
      await saveDocuments('warehouseItems', Array.from(itemsToSaveMap.values()));
      setWarehouseItems(workingInventory);
    }

    if (linkedMovements.length > 0) {
      const linkedIds = new Set(linkedMovements.map((m) => m.id));
      await Promise.all(linkedMovements.map((m) => removeDocument('stockMovements', m.id)));
      setStockMovements((prev) => prev.filter((m) => !linkedIds.has(m.id)));
    }

    await removeDocument('stockTransfers', transferId);
    setStockTransfers((prev) => prev.filter((t) => t.id !== transferId));

    logActivity(
      'SYSTEM_EVENT',
      `Deleted STR ${target.strRefNumber} (${target.fromBranchName} → ${target.toBranchName}, status: ${target.status}).`,
      'Warehouse'
    );
  };

  // Super Admin Stock Movement Ledger CRUD Handlers
  const handleAddLedgerEntry = async (
    entryData: Omit<StockMovementEntry, 'id' | 'timestamp'>
  ) => {
    if (currentUser?.role !== 'ADMIN') return;
    const nowIso = new Date().toISOString();
    const newEntry: StockMovementEntry = {
      ...entryData,
      id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: nowIso,
    };
    await saveDocument('stockMovements', newEntry);
    setStockMovements((prev) => [newEntry, ...prev]);
    logActivity(
      'SYSTEM_EVENT',
      `Added ledger entry ${newEntry.refNumber} (${newEntry.movementType}) for "${newEntry.description}" at ${newEntry.branchName}.`,
      'Warehouse'
    );
  };

  const handleUpdateLedgerEntry = async (updatedEntry: StockMovementEntry) => {
    if (currentUser?.role !== 'ADMIN') return;
    await saveDocument('stockMovements', updatedEntry);
    setStockMovements((prev) =>
      prev.map((m) => (m.id === updatedEntry.id ? updatedEntry : m))
    );
    logActivity(
      'SYSTEM_EVENT',
      `Updated ledger entry ${updatedEntry.refNumber} for "${updatedEntry.description}".`,
      'Warehouse'
    );
  };

  const handleDeleteLedgerEntry = async (entryId: string) => {
    if (currentUser?.role !== 'ADMIN') return;
    const target = stockMovements.find((m) => m.id === entryId);
    await removeDocument('stockMovements', entryId);
    setStockMovements((prev) => prev.filter((m) => m.id !== entryId));
    if (target) {
      logActivity(
        'SYSTEM_EVENT',
        `Deleted ledger entry ${target.refNumber} (${target.description}).`,
        'Warehouse'
      );
    }
  };

  // Store Concern Ticketing CRUD Handlers
  const handleCreateStoreTicket = async (payload: {
    branch: string;
    category: StoreTicketCategory;
    priority: StoreTicketPriority;
    subject: string;
    description: string;
    attachments?: StoreTicketAttachment[];
  }): Promise<boolean> => {
    if (!currentUser) return false;
    const nowIso = new Date().toISOString();
    const dateSlug = nowIso.slice(0, 10).replace(/-/g, '');
    const todayPrefix = `TCK-${dateSlug}-`;
    const todaySeqs = storeTickets
      .filter((t) => (t.ticketNumber || '').startsWith(todayPrefix))
      .map((t) => Number(t.ticketNumber.slice(todayPrefix.length)))
      .filter((n) => Number.isFinite(n) && n > 0);
    const nextSeq = (todaySeqs.length > 0 ? Math.max(...todaySeqs) : 0) + 1;
    const ticketNumber = `${todayPrefix}${String(nextSeq).padStart(3, '0')}`;

    const sanitizedAttachments = (payload.attachments || [])
      .filter((att) => att && isSafeImageSrc(att.dataUrl))
      .slice(0, 3);

    const newTicket: StoreTicket = {
      id: `tck-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ticketNumber,
      branch: payload.branch,
      category: payload.category,
      priority: payload.priority,
      subject: payload.subject,
      description: payload.description,
      attachments: sanitizedAttachments.length > 0 ? sanitizedAttachments : undefined,
      status: 'PENDING',
      requestedByUserId: currentUser.id,
      requestedByEmployeeId: currentUser.employeeId,
      requestedByName: currentUser.name,
      requestedByRole: currentUser.role,
      createdAt: nowIso,
      updatedAt: nowIso,
      updatedBy: currentUser.name,
      statusHistory: [
        {
          status: 'PENDING',
          changedBy: currentUser.name,
          changedByRole: currentUser.role,
          changedAt: nowIso,
          note:
            sanitizedAttachments.length > 0
              ? `Submitted ticket for ${payload.branch} with ${sanitizedAttachments.length} photo(s)`
              : `Submitted ticket for ${payload.branch}`,
        },
      ],
    };

    const ok = await saveDocument('storeTickets', newTicket);
    if (!ok) return false;

    setStoreTickets((prev) => {
      const next = [newTicket, ...prev];
      safeCacheCollectionItems('storeTickets', next);
      return next;
    });

    logActivity(
      'TICKET_MANAGEMENT',
      `Submitted store ticket ${newTicket.ticketNumber} for ${newTicket.branch} [${newTicket.category} · ${newTicket.priority}]: "${newTicket.subject}"${sanitizedAttachments.length > 0 ? ` (${sanitizedAttachments.length} image(s) attached)` : ''}.`,
      'Store Tickets'
    );
    return true;
  };

  const handleUpdateStoreTicketStatus = async (
    ticketId: string,
    newStatus: StoreTicketStatus,
    adminNotes: string
  ): Promise<boolean> => {
    if (!currentUser) return false;
    const target = storeTickets.find((t) => t.id === ticketId);
    if (!target) return false;

    const isOwnerCancellingPending =
      currentUser.role !== 'ADMIN' &&
      newStatus === 'CANCELLED' &&
      target.status === 'PENDING' &&
      target.requestedByEmployeeId === currentUser.employeeId;

    if (currentUser.role !== 'ADMIN' && !isOwnerCancellingPending) {
      return false;
    }

    const nowIso = new Date().toISOString();
    const historyEntry = {
      status: newStatus,
      changedBy: currentUser.name,
      changedByRole: currentUser.role,
      changedAt: nowIso,
      note: adminNotes || undefined,
    };

    const updatedTicket: StoreTicket = {
      ...target,
      status: newStatus,
      adminNotes,
      updatedBy: currentUser.name,
      updatedAt: nowIso,
      resolvedAt:
        newStatus === 'DONE'
          ? target.resolvedAt || nowIso
          : target.status === 'DONE'
          ? ''
          : target.resolvedAt,
      statusHistory: [...(target.statusHistory || []), historyEntry],
    };

    const ok = await saveDocument('storeTickets', updatedTicket);
    if (!ok) return false;

    setStoreTickets((prev) => {
      const next = prev.map((t) => (t.id === ticketId ? updatedTicket : t));
      safeCacheCollectionItems('storeTickets', next);
      return next;
    });

    logActivity(
      'TICKET_MANAGEMENT',
      `Updated store ticket ${updatedTicket.ticketNumber} (${updatedTicket.branch}) status to ${newStatus}${adminNotes ? ` — Notes: "${adminNotes}"` : ''}.`,
      'Store Tickets'
    );
    return true;
  };

  const handleUpdateStoreTicketAttachments = async (
    ticketId: string,
    attachments: StoreTicketAttachment[]
  ): Promise<boolean> => {
    if (!currentUser) return false;
    const target = storeTickets.find((t) => t.id === ticketId);
    if (!target) return false;

    const isOwner = target.requestedByEmployeeId === currentUser.employeeId;
    const isAdminUser = currentUser.role === 'ADMIN';
    if (!isAdminUser && (!isOwner || target.status === 'DONE' || target.status === 'CANCELLED')) {
      return false;
    }

    const sanitizedAttachments = (attachments || [])
      .filter((att) => att && isSafeImageSrc(att.dataUrl))
      .slice(0, 3);

    const nowIso = new Date().toISOString();
    const updatedTicket: StoreTicket = {
      ...target,
      attachments: sanitizedAttachments,
      updatedBy: currentUser.name,
      updatedAt: nowIso,
    };

    const ok = await saveDocument('storeTickets', updatedTicket);
    if (!ok) return false;

    setStoreTickets((prev) => {
      const next = prev.map((t) => (t.id === ticketId ? updatedTicket : t));
      safeCacheCollectionItems('storeTickets', next);
      return next;
    });

    logActivity(
      'TICKET_MANAGEMENT',
      `Updated photo attachments on store ticket ${updatedTicket.ticketNumber} (${sanitizedAttachments.length} image(s)).`,
      'Store Tickets'
    );
    return true;
  };

  const handleDeleteStoreTicket = async (ticketId: string): Promise<boolean> => {
    if (currentUser?.role !== 'ADMIN') return false;
    const target = storeTickets.find((t) => t.id === ticketId);
    await removeDocument('storeTickets', ticketId);
    setStoreTickets((prev) => {
      const next = prev.filter((t) => t.id !== ticketId);
      safeCacheCollectionItems('storeTickets', next);
      return next;
    });
    if (target) {
      logActivity(
        'TICKET_MANAGEMENT',
        `Deleted store ticket ${target.ticketNumber} (${target.branch} — "${target.subject}").`,
        'Store Tickets'
      );
    }
    return true;
  };

  // Full System JSON Backup & Restore Handlers (Permanent Local + Cloud Safety)
  const handleExportSystemBackup = () => {
    const backupPayload = {
      app: 'FBC Attendance Monitoring System',
      version: 1,
      exportedAt: new Date().toISOString(),
      exportedBy: currentUser?.name || 'Super Admin',
      collections: {
        users,
        summaries,
        punches,
        disputes,
        schedules,
        ctoRequests,
        ctoAdjustments,
        activityLogs,
        warehouseCategories,
        warehouseItems,
        stockMovements,
        stockTransfers,
        storeTickets,
        adminNotificationSettings: adminEmailSettingsList,
      },
    };
    const json = JSON.stringify(backupPayload, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FBC-System-Backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    logActivity(
      'SYSTEM_EVENT',
      `Exported full system backup (${users.length} users, ${summaries.length} attendance logs, ${warehouseItems.length} stock items, ${stockTransfers.length} STRs, ${storeTickets.length} tickets).`,
      'System Backup'
    );
  };

  const handleRestoreSystemBackup = async (
    jsonText: string
  ): Promise<{ totalRestored: number; collectionsRestored: number }> => {
    const parsed = JSON.parse(jsonText);
    const cols = parsed?.collections;
    if (!cols || typeof cols !== 'object') {
      throw new Error('Invalid FBC backup file: missing collections object.');
    }

    const mergeById = <T extends { id: string }>(existing: T[], incoming: unknown): T[] | null => {
      if (!Array.isArray(incoming)) return null;
      const valid = incoming.filter((item): item is T => Boolean(item && typeof item === 'object' && typeof (item as any).id === 'string'));
      const map = new Map<string, T>();
      for (const item of existing) map.set(item.id, item);
      for (const item of valid) map.set(item.id, item);
      return Array.from(map.values());
    };

    let totalRestored = 0;
    let collectionsRestored = 0;

    const applyCollection = async <T extends { id: string }>(
      colName: string,
      current: T[],
      setter: React.Dispatch<React.SetStateAction<T[]>>,
      incomingRaw: unknown
    ) => {
      if (!Array.isArray(incomingRaw) || incomingRaw.length === 0) return;
      const merged = mergeById(current, incomingRaw);
      if (!merged) return;
      const incomingValid = incomingRaw.filter(
        (item): item is T => Boolean(item && typeof item === 'object' && typeof (item as any).id === 'string')
      );
      if (incomingValid.length === 0) return;
      setter(merged);
      safeCacheCollectionItems(colName, merged);
      await saveDocuments(colName, incomingValid);
      totalRestored += incomingValid.length;
      collectionsRestored++;
    };

    await applyCollection('users', users, setUsers, cols.users);
    await applyCollection('summaries', summaries, setSummaries, cols.summaries);
    await applyCollection('punches', punches, setPunches, cols.punches);
    await applyCollection('disputes', disputes, setDisputes, cols.disputes);
    await applyCollection('schedules', schedules, setSchedules, cols.schedules);
    await applyCollection('ctoRequests', ctoRequests, setCtoRequests, cols.ctoRequests);
    await applyCollection('ctoAdjustments', ctoAdjustments, setCtoAdjustments, cols.ctoAdjustments);
    await applyCollection('activityLogs', activityLogs, setActivityLogs, cols.activityLogs);
    await applyCollection('warehouseCategories', warehouseCategories, setWarehouseCategories, cols.warehouseCategories);
    await applyCollection('warehouseItems', warehouseItems, setWarehouseItems, cols.warehouseItems);
    await applyCollection('stockMovements', stockMovements, setStockMovements, cols.stockMovements);
    await applyCollection('stockTransfers', stockTransfers, setStockTransfers, cols.stockTransfers);
    await applyCollection('storeTickets', storeTickets, setStoreTickets, cols.storeTickets);
    await applyCollection(
      'adminNotificationSettings',
      adminEmailSettingsList,
      setAdminEmailSettingsList,
      cols.adminNotificationSettings
    );

    logActivity(
      'SYSTEM_EVENT',
      `Restored ${totalRestored} records across ${collectionsRestored} collection(s) from backup file.`,
      'System Backup'
    );
    return { totalRestored, collectionsRestored };
  };

  // Handle Google Sheets Sync Trigger
  const handleSyncGoogleSheets = async () => {
    const confirm = await showSyncConfirmAlert();
    if (!confirm.isConfirmed) return;

    setIsSyncing(true);
    const syncResult = await syncToGoogleSheets(
      summaries,
      users,
      punches,
      currentUser?.name || 'System User'
    );
    setIsSyncing(false);
    setCurrentSyncLog(syncResult);
    setShowSyncModal(true);
  };

  // If not logged in, render locked Access Control Login Screen
  if (!currentUser) {
    return <LoginScreen users={users} onLoginSuccess={handleLoginSuccess} />;
  }

  const pendingDisputesCount = disputes.filter((d) => d.status === 'PENDING').length;
  const pendingWarehouseAlertsCount = visibleAdminAlerts.filter(
    (a) =>
      a.category === 'STR' ||
      a.category === 'LOW_STOCK' ||
      a.category === 'NEAR_EXPIRY'
  ).length;
  const currentSheetsPayload = buildGoogleSheetsData(summaries, users, punches);

  const getDashboardRoleInfo = (role: UserRole) => {
    switch (role) {
      case 'ADMIN':
        return {
          title: 'EXECUTIVE OWNER & SYSTEM ADMIN DASHBOARD',
          subtitle: 'Full Control • Biometric File Auditing • Employee Management • Dispute Approvals',
          badge: 'ROLE: OWNER / EXECUTIVE ADMIN',
          icon: '👑',
        };
      case 'SHIFT_MANAGER':
        return {
          title: 'SHIFT MANAGER ATTENDANCE PORTAL',
          subtitle: 'Personal Punch Records • 8-Hour Daily Progress • Shift Breakdown • Dispute Filing',
          badge: 'ROLE: SHIFT MANAGER',
          icon: '👤',
        };
      case 'BRANCH_MANAGER':
        return {
          title: 'STORE OPERATIONS PORTAL',
          subtitle: 'Store Operations • Biometric ZKTeco File Uploads • Dispute Approvals & Shift Monitoring',
          badge: 'ROLE: BRANCH MANAGER',
          icon: '🏪',
        };
      case 'PAYROLL':
        const payrollPosUpper = (currentUser?.position || 'PAYROLL').toUpperCase();
        return {
          title: `${payrollPosUpper} DTR & EXPORT DASHBOARD`,
          subtitle: 'Biometric Attendance Logs • Employee DTR Records • Dispute Audits • Google Sheets Sync',
          badge: `POSITION: ${payrollPosUpper}`,
          icon: '💼',
        };
      case 'STAFF':
        return {
          title: 'STAFF EMPLOYEE ATTENDANCE & FLEXITIME PORTAL',
          subtitle: 'Personal Punch Records • 8-Hour Daily Progress • Shift Breakdown • Dispute Filing',
          badge: 'ROLE: STAFF EMPLOYEE',
          icon: '👤',
        };
    }
  };

  const roleInfo = currentUser ? getDashboardRoleInfo(currentUser.role) : null;
  const isMainDashboardTab =
    activeTab === 'overview' ||
    activeTab === 'dashboard' ||
    (currentUser?.role === 'ADMIN' && (activeTab === 'overview' || activeTab === 'logs')) ||
    (currentUser?.role === 'BRANCH_MANAGER' && activeTab === 'branch-logs') ||
    (currentUser?.role === 'PAYROLL' && activeTab === 'daily-logs') ||
    ((currentUser?.role === 'STAFF' || currentUser?.role === 'SHIFT_MANAGER') && activeTab === 'my-punches');

  return (
    <div className="min-h-screen bg-[#FAF9F5] text-zinc-900 flex flex-col font-sans overflow-x-clip">
      {/* Top Header Navigation */}
      <Header
        currentUser={currentUser}
        onLogout={handleLogout}
        onSyncGoogleSheets={handleSyncGoogleSheets}
        isSyncing={isSyncing}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        pendingDisputesCount={pendingDisputesCount}
        adminAlerts={visibleAdminAlerts}
        readAlertIds={readAlertIds}
        dismissedCount={dismissedAdminAlertsCount}
        onMarkAlertRead={handleMarkAlertRead}
        onDismissAlert={handleDismissAlert}
        onMarkAllAlertsRead={handleMarkAllAlertsRead}
        onRestoreDismissedAlerts={handleRestoreDismissedAlerts}
      />

      {/* Main Workspace Layout with Professional Sidebar */}
      {currentUser ? (
        <div className="flex-1 max-w-[1600px] w-full mx-auto flex flex-col md:flex-row min-w-0">
          {/* Dashboard Sidebar Component */}
          <Sidebar
            currentUser={currentUser}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            pendingDisputesCount={pendingDisputesCount}
            pendingCtoCount={ctoRequests.filter((r) => r.status === 'PENDING').length}
            pendingWarehouseCount={
              currentUser.role === 'ADMIN'
                ? pendingWarehouseAlertsCount
                : monitoredNearExpiryEntries.length
            }
            pendingTicketsCount={storeTickets.filter((t) => t.status === 'PENDING').length}
            onLogout={handleLogout}
            onSyncGoogleSheets={handleSyncGoogleSheets}
            isSyncing={isSyncing}
            onUpdatePin={(newPin) => handleUpdateUserPin(currentUser.id, newPin)}
          />

          {/* Main Content Workspace Area */}
          <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0 overflow-y-auto print:p-0 print:overflow-visible">
            {firestoreQuotaExceeded && (
              <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-950 flex flex-wrap items-center justify-between gap-2 print:hidden no-print">
                <div className="space-y-0.5">
                  <div className="font-bold">
                    Cloud Database Daily Read Quota Reached — Local Persistent Cache Active
                  </div>
                  <p className="text-[11px] text-amber-900">
                    Your data is safely stored in Firestore and preserved locally in IndexedDB. Live cloud sync resumes automatically when the daily quota resets or the database plan is upgraded.
                  </p>
                </div>
                <a
                  href="https://console.firebase.google.com/project/tangential-gauge-8f6jr/firestore/databases/ai-studio-fbcattendancemon-27002b5f-1722-4af4-aaf3-3c79da6191bc/data?openUpgradeDialog=true"
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-amber-900 hover:bg-amber-800 text-white text-[11px] font-bold whitespace-nowrap shrink-0"
                >
                  Open Firebase Quota / Upgrade
                </a>
              </div>
            )}

            {(currentUser.role === 'ADMIN' ||
              currentUser.role === 'PAYROLL' ||
              currentUser.role === 'BRANCH_MANAGER' ||
              activeTab === 'warehouse-inventory') && (
              <div className="mb-4 rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs text-zinc-700 flex flex-wrap items-center justify-between gap-2 print:hidden no-print">
                <span>
                  {historyScope === 'RECENT' ? (
                    <>
                      Date Window: <strong className="text-zinc-950">Last 90 Days</strong> (Attendance, Stock Movements &amp; Logs)
                    </>
                  ) : (
                    <>
                      Date Window: <strong className="text-zinc-950">All-Time Archive</strong>
                    </>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setHistoryScope((prev) => (prev === 'RECENT' ? 'ALL' : 'RECENT'))
                  }
                  className="px-2.5 py-1 rounded-lg bg-zinc-950 hover:bg-zinc-800 text-amber-400 text-[11px] font-black uppercase tracking-wider cursor-pointer transition-colors"
                >
                  {historyScope === 'RECENT' ? 'Load All-Time Archive' : 'Use 90-Day Window'}
                </button>
              </div>
            )}

            {/* Prominent User Role Banner - Shown strictly on Main Dashboard tab */}
            {roleInfo && isMainDashboardTab && (
              <div className="mb-6 rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 p-5 border-2 border-zinc-950 shadow-md text-zinc-950 relative overflow-hidden print:hidden no-print">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-xl bg-zinc-950 text-amber-400 flex items-center justify-center text-2xl shadow-sm border border-amber-300 shrink-0">
                      {roleInfo.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-zinc-950 text-amber-400 tracking-wider uppercase border border-amber-400/30">
                          {roleInfo.badge}
                        </span>
                        <span className="text-xs font-bold text-zinc-900/80 uppercase tracking-wider">
                          LOGGED IN AS: <strong className="text-zinc-950">{currentUser.name}</strong> ({currentUser.position || currentUser.department})
                        </span>
                      </div>
                      <h2 className="text-xl sm:text-2xl font-black text-zinc-950 tracking-tight mt-0.5 uppercase">
                        {roleInfo.title}
                      </h2>
                      <p className="text-xs sm:text-sm font-semibold text-zinc-900/90 mt-0.5">
                        {roleInfo.subtitle}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'warehouse-inventory' &&
            (currentUser.role === 'ADMIN' ||
              currentUser.role === 'BRANCH_MANAGER' ||
              currentUser.role === 'PAYROLL' ||
              currentUser.role === 'SHIFT_MANAGER' ||
              currentUser.role === 'STAFF') ? (
              <WarehouseInventoryDashboard
                currentUser={currentUser}
                categories={warehouseCategories}
                inventoryItems={warehouseItems}
                stockMovements={stockMovements}
                stockTransfers={stockTransfers}
                onAddCategory={handleAddWarehouseCategory}
                onUpdateCategory={handleUpdateWarehouseCategory}
                onDeleteCategory={handleDeleteWarehouseCategory}
                onAddInventoryItem={handleAddWarehouseItem}
                onUpdateInventoryItem={handleUpdateWarehouseItem}
                onDeleteInventoryItem={handleDeleteWarehouseItem}
                onSeedBranchCatalog={handleSeedBranchCatalog}
                onAutoFillMissingCodes={handleAutoFillMissingItemCodes}
                onBulkImportInventoryItems={handleBulkImportWarehouseItems}
                onRecordStockMovement={handleRecordStockMovement}
                onBulkStockIn={handleBulkStockInDelivery}
                onCreateStockTransfer={handleCreateStockTransfer}
                onReviewStockTransfer={handleApproveReviewStockTransfer}
                onMarkStockTransferReceived={handleMarkStockTransferReceived}
                onDeleteStockTransfer={handleDeleteStockTransfer}
                onAddLedgerEntry={handleAddLedgerEntry}
                onUpdateLedgerEntry={handleUpdateLedgerEntry}
                onDeleteLedgerEntry={handleDeleteLedgerEntry}
              />
            ) : activeTab === 'store-tickets' &&
              (currentUser.role === 'ADMIN' ||
                currentUser.role === 'BRANCH_MANAGER' ||
                currentUser.role === 'PAYROLL' ||
                currentUser.role === 'SHIFT_MANAGER' ||
                currentUser.role === 'STAFF') ? (
              <StoreTicketingDashboard
                currentUser={currentUser}
                tickets={storeTickets}
                onCreateTicket={handleCreateStoreTicket}
                onUpdateTicketStatus={handleUpdateStoreTicketStatus}
                onUpdateTicketAttachments={handleUpdateStoreTicketAttachments}
                onDeleteTicket={handleDeleteStoreTicket}
              />
            ) : (
              <>
                {currentUser.role === 'ADMIN' && (
                  <AdminDashboard
                    users={users}
                    summaries={summaries}
                    disputes={disputes}
                    punches={punches}
                    ctoRequests={ctoRequests}
                    ctoAdjustments={ctoAdjustments}
                    schedules={schedules}
                    onSaveSchedule={handleSaveSchedule}
                    onUploadProcessed={handleUploadProcessed}
                    onUpdateSummaryAnomaly={handleUpdateSummaryAnomaly}
                    onApproveDispute={handleApproveDispute}
                    onRejectDispute={handleRejectDispute}
                    onSubmitDispute={handleSubmitDispute}
                    onApproveCtoRequest={handleApproveCtoRequest}
                    onRejectCtoRequest={handleRejectCtoRequest}
                    onUpdateCtoRequest={handleUpdateCtoRequest}
                    onSubmitCtoRequest={handleSubmitCtoRequest}
                    onAddUser={handleAddUser}
                    onUpdateUser={handleUpdateUser}
                    onDeleteUser={handleDeleteUser}
                    onDeleteDispute={handleDeleteDispute}
                    onDeleteSummary={handleDeleteSummary}
                    onClearSummaries={handleClearSummaries}
                    onDeleteCtoRequest={handleDeleteCtoRequest}
                    onSyncGoogleSheets={handleSyncGoogleSheets}
                    activityLogs={activityLogs}
                    onClearActivityLogs={handleClearActivityLogs}
                    activeTab={activeTab}
                    onNavigateTab={setActiveTab}
                    adminAlerts={visibleAdminAlerts}
                    readAlertIds={readAlertIds}
                    dismissedAlertCount={dismissedAdminAlertsCount}
                    onMarkAlertRead={handleMarkAlertRead}
                    onDismissAlert={handleDismissAlert}
                    onMarkAllAlertsRead={handleMarkAllAlertsRead}
                    onRestoreDismissedAlerts={handleRestoreDismissedAlerts}
                    adminEmailConfig={adminEmailConfig}
                    emailDeliveryStatus={emailDeliveryStatus}
                    onSaveAdminEmailConfig={handleSaveAdminEmailConfig}
                    onSendTestAdminEmail={handleSendTestAdminEmail}
                    onEmailActiveAlertsNow={handleEmailActiveAlertsNow}
                    onExportSystemBackup={handleExportSystemBackup}
                    onRestoreSystemBackup={handleRestoreSystemBackup}
                  />
                )}

                {(currentUser.role === 'STAFF' || currentUser.role === 'SHIFT_MANAGER') && (
                  <StaffDashboard
                    currentUser={currentUser}
                    users={users}
                    summaries={summaries}
                    disputes={disputes}
                    ctoRequests={ctoRequests}
                    ctoAdjustments={ctoAdjustments}
                    schedules={schedules}
                    onUpdateSummaryAnomaly={handleUpdateSummaryAnomaly}
                    onSubmitDispute={handleSubmitDispute}
                    onSubmitCtoRequest={handleSubmitCtoRequest}
                    activityLogs={activityLogs}
                    onClearActivityLogs={handleClearActivityLogs}
                    activeTab={activeTab}
                  />
                )}

                {currentUser.role === 'BRANCH_MANAGER' && (
                  <ManagerDashboard
                    currentUser={currentUser}
                    users={users}
                    summaries={summaries}
                    disputes={disputes}
                    punches={punches}
                    ctoRequests={ctoRequests}
                    ctoAdjustments={ctoAdjustments}
                    schedules={schedules}
                    onSaveSchedule={handleSaveSchedule}
                    onUploadProcessed={handleUploadProcessed}
                    onUpdateSummaryAnomaly={handleUpdateSummaryAnomaly}
                    onApproveDispute={handleApproveDispute}
                    onRejectDispute={handleRejectDispute}
                    onSubmitDispute={handleSubmitDispute}
                    onSubmitCtoRequest={handleSubmitCtoRequest}
                    onApproveCtoRequest={handleApproveCtoRequest}
                    onRejectCtoRequest={handleRejectCtoRequest}
                    onSyncGoogleSheets={handleSyncGoogleSheets}
                    activityLogs={activityLogs}
                    onClearActivityLogs={handleClearActivityLogs}
                    activeTab={activeTab}
                  />
                )}

                {currentUser.role === 'PAYROLL' && (
                  <PayrollDashboard
                    currentUser={currentUser}
                    users={users}
                    summaries={summaries}
                    disputes={disputes}
                    punches={punches}
                    ctoRequests={ctoRequests}
                    ctoAdjustments={ctoAdjustments}
                    schedules={schedules}
                    onSaveSchedule={handleSaveSchedule}
                    onUploadProcessed={handleUploadProcessed}
                    onUpdateSummaryAnomaly={handleUpdateSummaryAnomaly}
                    onApproveDispute={handleApproveDispute}
                    onRejectDispute={handleRejectDispute}
                    onSubmitDispute={handleSubmitDispute}
                    onApproveCtoRequest={handleApproveCtoRequest}
                    onRejectCtoRequest={handleRejectCtoRequest}
                    onAddCtoManualAdjustment={handleAddCtoManualAdjustment}
                    onSyncGoogleSheets={handleSyncGoogleSheets}
                    activityLogs={activityLogs}
                    onClearActivityLogs={handleClearActivityLogs}
                    activeTab={activeTab}
                  />
                )}
              </>
            )}
          </main>
        </div>
      ) : (
        <LoginScreen users={users} onLoginSuccess={handleLoginSuccess} />
      )}

      {/* Footer */}
      <footer className="bg-zinc-950 text-amber-400 border-t-2 border-amber-400 text-center text-xs font-semibold mt-auto">
        <YellowCabCheckerboard height="h-2" />
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            FBC Restaurants Corp • <strong>Yellow Cab Pizza Co.</strong>
          </span>
          <span className="text-zinc-400 text-[11px]">
            Biometric Attendance & Flexitime System • Confidential Internal Tool
          </span>
        </div>
      </footer>

      {/* Google Sheets Sync Modal */}
      <GoogleSheetsSyncModal
        isOpen={showSyncModal}
        onClose={() => setShowSyncModal(false)}
        syncLog={currentSyncLog}
        payload={currentSheetsPayload}
      />
    </div>
  );
}
