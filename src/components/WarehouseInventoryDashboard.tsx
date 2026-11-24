import React, { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  AlertTriangle,
  ArrowLeftRight,
  ArrowDownToLine,
  ArrowUpFromLine,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCopy,
  Clock,
  Download,
  Eye,
  FileSpreadsheet,
  FolderCog,
  History,
  Package,
  Pencil,
  Plus,
  Printer,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  StockMovementEntry,
  StockMovementStatus,
  StockMovementType,
  StockTransferLineItem,
  StockTransferRequisition,
  User,
  WarehouseBranchCode,
  WarehouseCategory,
  WarehouseInventoryItem,
} from '../types';
import {
  STORE_BRANCHES,
  WAREHOUSE_BRANCHES,
  WAREHOUSE_UOMS,
  NEAR_EXPIRY_THRESHOLD_DAYS,
  evaluateItemExpiry,
  findStockReferenceByCode,
  findStockReferenceByDescription,
  generateNextStrRef,
  generateNextTransferNumber,
  getBranchByCode,
  getUniqueStockReferences,
  isMonitoredWarehouseBranch,
  mapDepartmentToBranchCode,
  normalizeExpiryDate,
  resolveItemExpiryDate,
} from '../data/warehouseData';
import { DEFAULT_STOCK_CATALOG } from '../data/warehouseCatalog';
import { PrintableStrModal } from './PrintableStrModal';
import {
  showActionSuccessToast,
  showAdminAlertToast,
  showErrorAlert,
  showExportToast,
  yellowCabSwal,
} from '../utils/sweetAlerts';

interface WarehouseInventoryDashboardProps {
  currentUser: User;
  categories: WarehouseCategory[];
  inventoryItems: WarehouseInventoryItem[];
  stockMovements: StockMovementEntry[];
  stockTransfers: StockTransferRequisition[];
  onAddCategory: (name: string) => Promise<void> | void;
  onUpdateCategory: (categoryId: string, newName: string) => Promise<void> | void;
  onDeleteCategory: (categoryId: string) => Promise<void> | void;
  onAddInventoryItem: (
    item: Omit<WarehouseInventoryItem, 'id' | 'updatedAt' | 'updatedBy'>,
    initialRefNumber?: string,
    notes?: string
  ) => Promise<void> | void;
  onUpdateInventoryItem: (item: WarehouseInventoryItem) => Promise<void> | void;
  onDeleteInventoryItem: (itemId: string) => Promise<void> | void;
  onSeedBranchCatalog: (branchCode: WarehouseBranchCode) => Promise<void> | void;
  onAutoFillMissingCodes?: () => Promise<number> | number;
  onBulkImportInventoryItems: (params: {
    items: Array<{
      existingId?: string;
      item: Omit<WarehouseInventoryItem, 'id' | 'updatedAt' | 'updatedBy'>;
    }>;
    refNumber?: string;
  }) => Promise<{ createdCount: number; updatedCount: number; categoriesAdded: number }>;
  onRecordStockMovement: (params: {
    itemId: string;
    movementType: 'STOCK_IN' | 'STOCK_OUT';
    quantity: number;
    refNumber: string;
    date: string;
    notes?: string;
  }) => Promise<void> | void;
  onCreateStockTransfer: (
    transfer: Omit<
      StockTransferRequisition,
      'id' | 'createdAt' | 'createdByUserId' | 'status'
    >
  ) => Promise<StockTransferRequisition | void> | StockTransferRequisition | void;
  onReviewStockTransfer: (
    transferId: string,
    cancelledItemIds?: string[],
    cancelReasons?: Record<string, string>,
    reviewedItems?: StockTransferLineItem[]
  ) => Promise<void> | void;
  onMarkStockTransferReceived: (transferId: string) => Promise<void> | void;
  onAddLedgerEntry: (
    entry: Omit<StockMovementEntry, 'id' | 'timestamp'>
  ) => Promise<void> | void;
  onUpdateLedgerEntry: (entry: StockMovementEntry) => Promise<void> | void;
  onDeleteLedgerEntry: (entryId: string) => Promise<void> | void;
}

type WarehouseSubTab = 'inventory' | 'str' | 'ledger';

const GOOGLE_SHEET_HEADERS = [
  'Date',
  'Transfer #',
  'From Location',
  'To Location',
  'Ref #',
  'Category',
  'Price',
  'Description',
  'Batch No',
  'UOM',
  'Qty',
] as const;

const ITEMS_PER_PAGE = 50;

export const WarehouseInventoryDashboard: React.FC<WarehouseInventoryDashboardProps> = ({
  currentUser,
  categories,
  inventoryItems,
  stockMovements,
  stockTransfers,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
  onAddInventoryItem,
  onUpdateInventoryItem,
  onDeleteInventoryItem,
  onSeedBranchCatalog,
  onAutoFillMissingCodes,
  onBulkImportInventoryItems,
  onRecordStockMovement,
  onCreateStockTransfer,
  onReviewStockTransfer,
  onMarkStockTransferReceived,
  onAddLedgerEntry,
  onUpdateLedgerEntry,
  onDeleteLedgerEntry,
}) => {
  const isSuperAdmin = currentUser.role === 'ADMIN';
  const canViewLedger =
    currentUser.role !== 'BRANCH_MANAGER' &&
    currentUser.role !== 'SHIFT_MANAGER' &&
    currentUser.role !== 'STAFF';
  const mappedUserBranch = mapDepartmentToBranchCode(
    currentUser.branch || currentUser.department
  );
  const defaultUserBranch: WarehouseBranchCode =
    mappedUserBranch && isMonitoredWarehouseBranch(mappedUserBranch)
      ? mappedUserBranch
      : 'YC-EBLC';

  // Only the default 6 warehouse branches are monitored in Stock Items & Low Stock Alerts
  const monitoredInventoryItems = useMemo(
    () => inventoryItems.filter((item) => isMonitoredWarehouseBranch(item.branchCode)),
    [inventoryItems]
  );

  const [subTab, setSubTab] = useState<WarehouseSubTab>('inventory');

  useEffect(() => {
    if (!canViewLedger && subTab === 'ledger') {
      setSubTab('inventory');
    }
  }, [canViewLedger, subTab]);

  // Category names list (live from Firestore categories + fallback any used in items)
  const categoryOptions = useMemo(() => {
    const names = categories.map((c) => c.name);
    const set = new Set(names);
    inventoryItems.forEach((i) => {
      if (i.category && !set.has(i.category)) {
        names.push(i.category);
        set.add(i.category);
      }
    });
    return names;
  }, [categories, inventoryItems]);

  // Inventory Filters & Pagination
  const [branchFilter, setBranchFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [inStockOnly, setInStockOnly] = useState<boolean>(false);
  const [lowStockOnly, setLowStockOnly] = useState<boolean>(false);
  const [nearExpiryOnly, setNearExpiryOnly] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Ledger Filters
  const [ledgerBranchFilter, setLedgerBranchFilter] = useState<string>('ALL');
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState<string>('ALL');
  const [ledgerStatusFilter, setLedgerStatusFilter] = useState<string>('ALL');
  const [ledgerSearch, setLedgerSearch] = useState<string>('');
  const [ledgerDateFilter, setLedgerDateFilter] = useState<string>('');

  // Category Manager Modal State
  const [showCategoryModal, setShowCategoryModal] = useState<boolean>(false);
  const [newCategoryName, setNewCategoryName] = useState<string>('');
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState<string>('');

  // Add / Edit Stock Item Modal State
  const [showItemModal, setShowItemModal] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<WarehouseInventoryItem | null>(null);
  const [itemBranch, setItemBranch] = useState<WarehouseBranchCode>(defaultUserBranch);
  const [itemCode, setItemCode] = useState<string>('');
  const [itemDesc, setItemDesc] = useState<string>('');
  const [itemCategory, setItemCategory] = useState<string>(categoryOptions[0] || 'BEVERAGE');
  const [itemBatch, setItemBatch] = useState<string>('');
  const [itemExpiryDate, setItemExpiryDate] = useState<string>('');
  const [itemUom, setItemUom] = useState<string>('Pack');
  const [itemPrice, setItemPrice] = useState<string>('0');
  const [itemQty, setItemQty] = useState<string>('0');
  const [itemReorder, setItemReorder] = useState<string>('2');
  const [itemRef, setItemRef] = useState<string>('');
  const [itemNotes, setItemNotes] = useState<string>('');
  const [itemAutoFillHint, setItemAutoFillHint] = useState<string>('');
  const [isAutoFillingCodes, setIsAutoFillingCodes] = useState<boolean>(false);

  // Stock In / Out Modal State
  const [adjustTargetItem, setAdjustTargetItem] = useState<WarehouseInventoryItem | null>(null);
  const [adjustType, setAdjustType] = useState<'STOCK_IN' | 'STOCK_OUT'>('STOCK_IN');
  const [adjustQty, setAdjustQty] = useState<string>('1');
  const [adjustRef, setAdjustRef] = useState<string>('');
  const [adjustDate, setAdjustDate] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [adjustNotes, setAdjustNotes] = useState<string>('');

  // STR Form State
  const todayStr = new Date().toISOString().slice(0, 10);
  const [strDate, setStrDate] = useState<string>(todayStr);
  const [fromBranchCode, setFromBranchCode] = useState<WarehouseBranchCode>('YC-EBLC');
  const [toBranchCode, setToBranchCode] = useState<WarehouseBranchCode>('YC-RMOS');
  const [prefixBasis, setPrefixBasis] = useState<'FROM' | 'TO'>('FROM');
  const [strRefInput, setStrRefInput] = useState<string>(() =>
    generateNextStrRef('YC-EBLC', stockTransfers)
  );
  const [transferNumInput, setTransferNumInput] = useState<string>(() =>
    generateNextTransferNumber(todayStr, stockTransfers)
  );
  const [preparedBy, setPreparedBy] = useState<string>(currentUser.name || '');
  const [reviewedBy, setReviewedBy] = useState<string>('');
  const [strRemarks, setStrRemarks] = useState<string>('');
  const [lineItems, setLineItems] = useState<StockTransferLineItem[]>([
    {
      id: `line-${Date.now()}`,
      itemId: '',
      itemCode: '',
      description: '',
      category: categoryOptions[0] || 'BEVERAGE',
      batchNo: '',
      uom: 'Pack',
      unitPrice: 0,
      quantity: 1,
    },
  ]);

  // History, Print, Inline Min & STR/Ledger Modal State
  const [strSearch, setStrSearch] = useState<string>('');
  const [printableTransfer, setPrintableTransfer] =
    useState<StockTransferRequisition | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
  const [isSubmittingStr, setIsSubmittingStr] = useState<boolean>(false);
  const [isSeedingBranch, setIsSeedingBranch] = useState<boolean>(false);
  const [pickerLineIdx, setPickerLineIdx] = useState<number | null>(null);
  const [pickerSearch, setPickerSearch] = useState<string>('');
  const [pickerCategory, setPickerCategory] = useState<string>('ALL');
  const [pickerSource, setPickerSource] = useState<'ISSUING' | 'CATALOG'>('ISSUING');

  // Super Admin STR Item-by-Item Review & Cancellation Modal State
  const [reviewingTransfer, setReviewingTransfer] =
    useState<StockTransferRequisition | null>(null);
  const [reviewDraftItems, setReviewDraftItems] = useState<StockTransferLineItem[]>([]);
  const [reviewAddedLineIds, setReviewAddedLineIds] = useState<Set<string>>(new Set());
  const [reviewCancelledIds, setReviewCancelledIds] = useState<Set<string>>(new Set());
  const [reviewCancelReasons, setReviewCancelReasons] = useState<Record<string, string>>({});
  const [isSavingReview, setIsSavingReview] = useState<boolean>(false);
  const [isReviewAddPickerOpen, setIsReviewAddPickerOpen] = useState<boolean>(false);
  const [reviewPickerSearch, setReviewPickerSearch] = useState<string>('');
  const [reviewPickerCategory, setReviewPickerCategory] = useState<string>('ALL');

  // Inline Min Level Editing (Super Admin)
  const [editingMinItemId, setEditingMinItemId] = useState<string | null>(null);
  const [editingMinVal, setEditingMinVal] = useState<string>('2');

  // Ledger Remarks View & Super Admin Add/Edit Modal State
  const [viewingRemarksEntry, setViewingRemarksEntry] =
    useState<StockMovementEntry | null>(null);
  const [showLedgerModal, setShowLedgerModal] = useState<boolean>(false);
  const [editingLedgerEntry, setEditingLedgerEntry] =
    useState<StockMovementEntry | null>(null);
  const [ledgerFormDate, setLedgerFormDate] = useState<string>(todayStr);
  const [ledgerFormType, setLedgerFormType] = useState<StockMovementType>('STOCK_IN');
  const [ledgerFormStatus, setLedgerFormStatus] =
    useState<StockMovementStatus>('COMPLETED');
  const [ledgerFormBranch, setLedgerFormBranch] =
    useState<WarehouseBranchCode>(defaultUserBranch);
  const [ledgerFormFromBranch, setLedgerFormFromBranch] = useState<string>('');
  const [ledgerFormToBranch, setLedgerFormToBranch] = useState<string>('');
  const [ledgerFormRef, setLedgerFormRef] = useState<string>('');
  const [ledgerFormTransferNum, setLedgerFormTransferNum] = useState<string>('');
  const [ledgerFormItemId, setLedgerFormItemId] = useState<string>('');
  const [ledgerFormItemCode, setLedgerFormItemCode] = useState<string>('');
  const [ledgerFormDesc, setLedgerFormDesc] = useState<string>('');
  const [ledgerFormCat, setLedgerFormCat] = useState<string>(
    categoryOptions[0] || 'BEVERAGE'
  );
  const [ledgerFormBatch, setLedgerFormBatch] = useState<string>('');
  const [ledgerFormUom, setLedgerFormUom] = useState<string>('Pack');
  const [ledgerFormPrevQty, setLedgerFormPrevQty] = useState<string>('0');
  const [ledgerFormQty, setLedgerFormQty] = useState<string>('1');
  const [ledgerFormNewQty, setLedgerFormNewQty] = useState<string>('1');
  const [ledgerFormBy, setLedgerFormBy] = useState<string>(currentUser.name || '');
  const [ledgerFormNotes, setLedgerFormNotes] = useState<string>('');

  // Super Admin Quick-Add Stock Items Import/Export Modal State
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [importFileName, setImportFileName] = useState<string>('');
  const [importDefaultBranch, setImportDefaultBranch] =
    useState<WarehouseBranchCode>(defaultUserBranch);
  const [importDuplicateMode, setImportDuplicateMode] = useState<'SKIP' | 'UPDATE'>('SKIP');
  const [importRefNumber, setImportRefNumber] = useState<string>(
    `IMP-${todayStr.replace(/-/g, '')}`
  );
  const [importRawRows, setImportRawRows] = useState<Record<string, any>[]>([]);
  const [isImportingStock, setIsImportingStock] = useState<boolean>(false);

  const itemModalReferences = useMemo(
    () => getUniqueStockReferences(inventoryItems, itemBranch),
    [inventoryItems, itemBranch]
  );

  const strReferences = useMemo(
    () => getUniqueStockReferences(inventoryItems, fromBranchCode),
    [inventoryItems, fromBranchCode]
  );

  const fillableMissingCodeCount = useMemo(() => {
    return monitoredInventoryItems.filter((item) => {
      if ((item.itemCode || '').trim()) return false;
      const match = findStockReferenceByDescription(
        item.description,
        inventoryItems,
        item.branchCode
      );
      return Boolean(match?.itemCode);
    }).length;
  }, [monitoredInventoryItems, inventoryItems]);

  const refreshStrNumbers = (
    nextFrom: WarehouseBranchCode,
    nextTo: WarehouseBranchCode,
    nextBasis: 'FROM' | 'TO',
    nextDate: string
  ) => {
    const targetBranch = nextBasis === 'FROM' ? nextFrom : nextTo;
    setStrRefInput(generateNextStrRef(targetBranch, stockTransfers));
    setTransferNumInput(generateNextTransferNumber(nextDate, stockTransfers));
  };

  const getItemReorderLevel = (item: WarehouseInventoryItem) =>
    item.reorderLevel ?? 2;

  const isItemLowStock = (item: WarehouseInventoryItem) =>
    (Number(item.quantity) || 0) < getItemReorderLevel(item);

  // Per-branch Low Stock summary (6 monitored warehouse branches only)
  const lowStockByBranch = useMemo(() => {
    const counts = new Map<WarehouseBranchCode, number>();
    WAREHOUSE_BRANCHES.forEach((b) => counts.set(b.code, 0));
    monitoredInventoryItems.forEach((item) => {
      if ((Number(item.quantity) || 0) < (item.reorderLevel ?? 2)) {
        counts.set(item.branchCode, (counts.get(item.branchCode) || 0) + 1);
      }
    });
    return WAREHOUSE_BRANCHES.map((b) => ({
      code: b.code,
      name: b.name,
      count: counts.get(b.code) || 0,
    }));
  }, [monitoredInventoryItems]);

  const totalLowStockCount = useMemo(
    () => lowStockByBranch.reduce((sum, entry) => sum + entry.count, 0),
    [lowStockByBranch]
  );

  const activeScopeLowStockCount = useMemo(() => {
    return monitoredInventoryItems.filter((item) => {
      if (branchFilter !== 'ALL' && item.branchCode !== branchFilter) return false;
      if (categoryFilter !== 'ALL' && item.category !== categoryFilter) return false;
      return (Number(item.quantity) || 0) < (item.reorderLevel ?? 2);
    }).length;
  }, [monitoredInventoryItems, branchFilter, categoryFilter]);

  // Per-branch Near Expiry & Expired summary (6 monitored warehouse branches only)
  const nearExpiryByBranch = useMemo(() => {
    const counts = new Map<WarehouseBranchCode, { total: number; expired: number }>();
    WAREHOUSE_BRANCHES.forEach((b) => counts.set(b.code, { total: 0, expired: 0 }));
    monitoredInventoryItems.forEach((item) => {
      const expiry = evaluateItemExpiry(item);
      if (expiry.isAlertActive) {
        const cur = counts.get(item.branchCode) || { total: 0, expired: 0 };
        counts.set(item.branchCode, {
          total: cur.total + 1,
          expired: cur.expired + (expiry.status === 'EXPIRED' ? 1 : 0),
        });
      }
    });
    return WAREHOUSE_BRANCHES.map((b) => {
      const entry = counts.get(b.code) || { total: 0, expired: 0 };
      return {
        code: b.code,
        name: b.name,
        count: entry.total,
        expiredCount: entry.expired,
      };
    });
  }, [monitoredInventoryItems]);

  const totalNearExpiryCount = useMemo(
    () => nearExpiryByBranch.reduce((sum, entry) => sum + entry.count, 0),
    [nearExpiryByBranch]
  );

  const totalExpiredCount = useMemo(
    () => nearExpiryByBranch.reduce((sum, entry) => sum + entry.expiredCount, 0),
    [nearExpiryByBranch]
  );

  const activeScopeNearExpiryCount = useMemo(() => {
    return monitoredInventoryItems.filter((item) => {
      if (branchFilter !== 'ALL' && item.branchCode !== branchFilter) return false;
      if (categoryFilter !== 'ALL' && item.category !== categoryFilter) return false;
      return evaluateItemExpiry(item).isAlertActive;
    }).length;
  }, [monitoredInventoryItems, branchFilter, categoryFilter]);

  // Filtered Inventory Items (6 monitored warehouse branches only)
  const filteredInventory = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const list = monitoredInventoryItems.filter((item) => {
      if (branchFilter !== 'ALL' && item.branchCode !== branchFilter) return false;
      if (categoryFilter !== 'ALL' && item.category !== categoryFilter) return false;
      if (inStockOnly && (Number(item.quantity) || 0) <= 0) return false;
      if (lowStockOnly && (Number(item.quantity) || 0) >= (item.reorderLevel ?? 2)) return false;
      if (nearExpiryOnly && !evaluateItemExpiry(item).isAlertActive) return false;
      if (q) {
        const matches =
          (item.description || '').toLowerCase().includes(q) ||
          (item.itemCode || '').toLowerCase().includes(q) ||
          (item.batchNo || '').toLowerCase().includes(q) ||
          (item.expiryDate || '').toLowerCase().includes(q) ||
          (item.category || '').toLowerCase().includes(q) ||
          (item.branchName || '').toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });

    if (nearExpiryOnly) {
      return [...list].sort((a, b) => {
        const aDays = evaluateItemExpiry(a).daysUntil ?? 99999;
        const bDays = evaluateItemExpiry(b).daysUntil ?? 99999;
        return aDays - bDays;
      });
    }
    return list;
  }, [
    monitoredInventoryItems,
    branchFilter,
    categoryFilter,
    inStockOnly,
    lowStockOnly,
    nearExpiryOnly,
    searchQuery,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredInventory.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedInventory = useMemo(() => {
    const start = (safePage - 1) * ITEMS_PER_PAGE;
    return filteredInventory.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredInventory, safePage]);

  // Issuing Branch Stock for STR Picker
  const issuingBranchStock = useMemo(() => {
    return inventoryItems
      .filter((item) => item.branchCode === fromBranchCode)
      .sort((a, b) => (a.description || '').localeCompare(b.description || ''));
  }, [inventoryItems, fromBranchCode]);

  const filteredPickerStock = useMemo(() => {
    const q = pickerSearch.toLowerCase().trim();
    return issuingBranchStock.filter((item) => {
      if (pickerCategory !== 'ALL' && item.category !== pickerCategory) return false;
      if (!q) return true;
      return (
        (item.description || '').toLowerCase().includes(q) ||
        (item.itemCode || '').toLowerCase().includes(q) ||
        (item.batchNo || '').toLowerCase().includes(q) ||
        (item.category || '').toLowerCase().includes(q)
      );
    });
  }, [issuingBranchStock, pickerSearch, pickerCategory]);

  const filteredPickerCatalog = useMemo(() => {
    const q = pickerSearch.toLowerCase().trim();
    return DEFAULT_STOCK_CATALOG.filter((item) => {
      if (pickerCategory !== 'ALL' && item.category !== pickerCategory) return false;
      if (!q) return true;
      return (
        item.description.toLowerCase().includes(q) ||
        item.itemCode.toLowerCase().includes(q) ||
        item.batchNo.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      );
    });
  }, [pickerSearch, pickerCategory]);

  const getLedgerEntryStatus = (
    mov: StockMovementEntry
  ): { status: StockMovementStatus; label: string; detail?: string } => {
    const linkedTransfer = stockTransfers.find(
      (t) =>
        (mov.transferNumber && t.transferNumber === mov.transferNumber) ||
        (mov.refNumber && t.strRefNumber === mov.refNumber)
    );

    if (linkedTransfer) {
      const safeLines = Array.isArray(linkedTransfer.items) ? linkedTransfer.items : [];
      const movDesc = (mov.description || '').toLowerCase();
      const movBatch = (mov.batchNo || '').toLowerCase();
      const matchedLine =
        safeLines.find(
          (line) =>
            (mov.itemId && line.itemId === mov.itemId) ||
            ((line.description || '').toLowerCase() === movDesc &&
              (line.batchNo || 'GENERAL').toLowerCase() === (movBatch || 'GENERAL'))
        ) ||
        safeLines.find((line) => (line.description || '').toLowerCase() === movDesc);

      if (
        mov.status === 'CANCELLED' ||
        matchedLine?.itemStatus === 'CANCELLED' ||
        linkedTransfer.status === 'CANCELLED' ||
        (mov.fromBranchName || '').toLowerCase().includes('cancelled item') ||
        (mov.notes || '').toLowerCase().includes('cancelled during')
      ) {
        return {
          status: 'CANCELLED',
          label: 'Cancelled',
          detail:
            matchedLine?.cancelReason ||
            (mov.movementType === 'STOCK_IN'
              ? 'Returned to inventory after STR cancellation'
              : 'Cancelled during Super Admin STR review'),
        };
      }

      if (linkedTransfer.status === 'PENDING') {
        return {
          status: 'PENDING',
          label: 'Pending',
          detail: linkedTransfer.reviewedBy
            ? `Reviewed by ${linkedTransfer.reviewedBy} · Pending receipt`
            : 'Pending Super Admin review / receipt',
        };
      }

      if (linkedTransfer.status === 'RECEIVED' || linkedTransfer.status === 'COMPLETED') {
        return {
          status: 'RECEIVED',
          label: 'Received',
          detail: linkedTransfer.receivedBy
            ? `Received by ${linkedTransfer.receivedBy}`
            : 'STR Received',
        };
      }
    }

    if (mov.status === 'CANCELLED') {
      return { status: 'CANCELLED', label: 'Cancelled' };
    }
    if (mov.status === 'PENDING') {
      return { status: 'PENDING', label: 'Pending' };
    }
    if (mov.status === 'RECEIVED') {
      return { status: 'RECEIVED', label: 'Received' };
    }
    if (mov.status === 'COMPLETED') {
      return { status: 'COMPLETED', label: 'Completed' };
    }

    const notesLower = (mov.notes || '').toLowerCase();
    const fromLower = (mov.fromBranchName || '').toLowerCase();
    if (notesLower.includes('cancelled') || fromLower.includes('cancelled')) {
      return { status: 'CANCELLED', label: 'Cancelled' };
    }
    if (notesLower.includes('pending')) {
      return { status: 'PENDING', label: 'Pending' };
    }
    if (mov.movementType === 'TRANSFER_IN') {
      return { status: 'RECEIVED', label: 'Received' };
    }
    return { status: 'COMPLETED', label: 'Completed' };
  };

  // Filtered Ledger
  const filteredMovements = useMemo(() => {
    const q = ledgerSearch.toLowerCase().trim();
    return stockMovements.filter((mov) => {
      if (ledgerBranchFilter !== 'ALL' && mov.branchCode !== ledgerBranchFilter) return false;
      if (ledgerTypeFilter !== 'ALL' && mov.movementType !== ledgerTypeFilter) return false;
      if (ledgerStatusFilter !== 'ALL') {
        const resolved = getLedgerEntryStatus(mov).status;
        if (resolved !== ledgerStatusFilter) return false;
      }
      if (ledgerDateFilter && mov.date !== ledgerDateFilter) return false;
      if (q) {
        const matches =
          (mov.description || '').toLowerCase().includes(q) ||
          (mov.refNumber || '').toLowerCase().includes(q) ||
          (mov.transferNumber || '').toLowerCase().includes(q) ||
          (mov.batchNo || '').toLowerCase().includes(q) ||
          (mov.performedBy || '').toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [
    stockMovements,
    stockTransfers,
    ledgerBranchFilter,
    ledgerTypeFilter,
    ledgerStatusFilter,
    ledgerDateFilter,
    ledgerSearch,
  ]);

  // Filtered STR Transfers
  const filteredTransfers = useMemo(() => {
    const q = strSearch.toLowerCase().trim();
    return stockTransfers.filter((trf) => {
      if (!q) return true;
      const items = Array.isArray(trf.items) ? trf.items : [];
      return (
        (trf.strRefNumber || '').toLowerCase().includes(q) ||
        (trf.transferNumber || '').toLowerCase().includes(q) ||
        (trf.fromBranchName || '').toLowerCase().includes(q) ||
        (trf.toBranchName || '').toLowerCase().includes(q) ||
        (trf.preparedBy || '').toLowerCase().includes(q) ||
        (trf.receivedBy || '').toLowerCase().includes(q) ||
        items.some((i) => (i.description || '').toLowerCase().includes(q))
      );
    });
  }, [stockTransfers, strSearch]);

  // Google Sheet Flattened Rows
  const googleSheetRows = useMemo(() => {
    const rows: Array<Record<(typeof GOOGLE_SHEET_HEADERS)[number], string | number>> = [];
    const orderedTransfers = [...stockTransfers].sort((a, b) =>
      (b.date || '').localeCompare(a.date || '')
    );

    orderedTransfers.forEach((trf) => {
      (trf.items || []).forEach((line) => {
        if (line.itemStatus === 'CANCELLED') return;
        rows.push({
          Date: trf.date,
          'Transfer #': trf.transferNumber,
          'From Location': trf.fromBranchName,
          'To Location': trf.toBranchName,
          'Ref #': trf.strRefNumber,
          Category: line.category,
          Price: Number(line.unitPrice || 0),
          Description: line.description,
          'Batch No': line.batchNo || '',
          UOM: line.uom,
          Qty: Number(line.quantity || 0),
        });
      });
    });

    return rows;
  }, [stockTransfers]);

  const handleExportGoogleSheetXlsx = (transfersSubset?: StockTransferRequisition[]) => {
    const source = transfersSubset || stockTransfers;
    if (source.length === 0) {
      showErrorAlert(
        'No Stock Transfers to Export',
        'Create at least one Stock Transfer Requisition (STR) before exporting.'
      );
      return;
    }

    const rows: Array<Record<(typeof GOOGLE_SHEET_HEADERS)[number], string | number>> = [];
    source.forEach((trf) => {
      trf.items.forEach((line) => {
        if (line.itemStatus === 'CANCELLED') return;
        rows.push({
          Date: trf.date,
          'Transfer #': trf.transferNumber,
          'From Location': trf.fromBranchName,
          'To Location': trf.toBranchName,
          'Ref #': trf.strRefNumber,
          Category: line.category,
          Price: Number(line.unitPrice || 0),
          Description: line.description,
          'Batch No': line.batchNo || '',
          UOM: line.uom,
          Qty: Number(line.quantity || 0),
        });
      });
    });

    const worksheet = XLSX.utils.json_to_sheet(rows, {
      header: [...GOOGLE_SHEET_HEADERS],
    });
    worksheet['!cols'] = [
      { wch: 12 },
      { wch: 18 },
      { wch: 16 },
      { wch: 16 },
      { wch: 14 },
      { wch: 24 },
      { wch: 10 },
      { wch: 36 },
      { wch: 16 },
      { wch: 10 },
      { wch: 8 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'STR Export');
    const filename = `FBC_STR_GoogleSheet_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, filename);
    showExportToast(filename);
  };

  const handleCopyGoogleSheetTsv = async () => {
    if (googleSheetRows.length === 0) {
      showErrorAlert(
        'No Stock Transfers to Copy',
        'Create at least one Stock Transfer Requisition (STR) first.'
      );
      return;
    }
    const headerLine = GOOGLE_SHEET_HEADERS.join('\t');
    const dataLines = googleSheetRows.map((row) =>
      GOOGLE_SHEET_HEADERS.map((col) =>
        String(row[col] ?? '')
          .replace(/\t/g, ' ')
          .replace(/\r?\n/g, ' ')
      ).join('\t')
    );

    try {
      await navigator.clipboard.writeText([headerLine, ...dataLines].join('\n'));
      showActionSuccessToast(`Copied ${googleSheetRows.length} STR rows for Google Sheets!`);
    } catch {
      showErrorAlert('Clipboard Blocked', 'Please use the Export .xlsx button instead.');
    }
  };

  // Super Admin Stock Items Export & Import Handlers
  const STOCK_EXPORT_HEADERS = [
    'Branch',
    'Item Code',
    'Description',
    'Category',
    'Batch / Exp',
    'Expiry Date',
    'UOM',
    'Price',
    'Min',
    'Qty',
  ] as const;

  const resolveImportBranchCode = (
    rawVal: unknown,
    fallbackCode: WarehouseBranchCode
  ): { code: WarehouseBranchCode; name: string; valid: boolean } => {
    const str = String(rawVal ?? '').trim();
    if (!str) {
      const fb = getBranchByCode(fallbackCode) || WAREHOUSE_BRANCHES[0];
      return { code: fb.code, name: fb.name, valid: true };
    }
    const direct = WAREHOUSE_BRANCHES.find(
      (b) =>
        b.code.toLowerCase() === str.toLowerCase() ||
        b.name.toLowerCase() === str.toLowerCase()
    );
    if (direct) return { code: direct.code, name: direct.name, valid: true };
    const mapped = mapDepartmentToBranchCode(str);
    if (mapped && isMonitoredWarehouseBranch(mapped)) {
      const b = getBranchByCode(mapped) || WAREHOUSE_BRANCHES[0];
      return { code: b.code, name: b.name, valid: true };
    }
    const fb = getBranchByCode(fallbackCode) || WAREHOUSE_BRANCHES[0];
    return { code: fb.code, name: fb.name, valid: false };
  };

  const getCellValueCI = (row: Record<string, any>, aliases: string[]): any => {
    const keys = Object.keys(row);
    for (const alias of aliases) {
      const target = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
      const matchedKey = keys.find(
        (k) => k.toLowerCase().replace(/[^a-z0-9]/g, '') === target
      );
      if (matchedKey !== undefined && row[matchedKey] !== undefined && row[matchedKey] !== '') {
        return row[matchedKey];
      }
    }
    return undefined;
  };

  const parsedImportPreview = useMemo(() => {
    return importRawRows.map((raw, idx) => {
      const rawBranch = getCellValueCI(raw, ['Branch', 'Branch Code', 'Location', 'Store']);
      const resolvedBranch = resolveImportBranchCode(rawBranch, importDefaultBranch);
      const rawCode = getCellValueCI(raw, ['Item Code', 'Code', 'SKU']);
      const rawDesc = getCellValueCI(raw, ['Description', 'Stock Item', 'Item', 'Item Name', 'Name']);
      const rawCat = getCellValueCI(raw, ['Category', 'Cat']);
      const rawBatch = getCellValueCI(raw, ['Batch / Exp', 'Batch No', 'Batch']);
      const rawExpiry = getCellValueCI(raw, ['Expiry Date', 'Exp Date', 'Expiry', 'Expiration Date', 'Exp']);
      const rawUom = getCellValueCI(raw, ['UOM', 'Unit']);
      const rawPrice = getCellValueCI(raw, ['Price', 'Unit Price', 'Cost']);
      const rawMin = getCellValueCI(raw, ['Min', 'Min Level', 'Reorder Level', 'Reorder']);
      const rawQty = getCellValueCI(raw, ['Qty', 'Quantity', 'Stock Qty', 'On Hand']);

      let description = String(rawDesc ?? '').trim();
      let itemCode = String(rawCode ?? '').trim();
      let codeAutoFilled = false;

      const refByCode = itemCode
        ? findStockReferenceByCode(itemCode, inventoryItems, resolvedBranch.code)
        : undefined;
      if (!description && refByCode) {
        description = refByCode.description;
      }

      const refByDesc =
        !itemCode && description
          ? findStockReferenceByDescription(description, inventoryItems, resolvedBranch.code)
          : undefined;
      if (!itemCode && refByDesc?.itemCode) {
        itemCode = refByDesc.itemCode;
        codeAutoFilled = true;
      }

      const refMatch = refByCode || refByDesc;
      const category = String(
        rawCat ?? refMatch?.category ?? categoryOptions[0] ?? 'BEVERAGE'
      )
        .trim()
        .toUpperCase();
      const batchNo = String(rawBatch ?? refMatch?.batchNo ?? '').trim();
      const expiryDate =
        normalizeExpiryDate(rawExpiry) || normalizeExpiryDate(batchNo);
      const uomRaw = String(rawUom ?? refMatch?.uom ?? 'Pack').trim();
      const matchedUom =
        WAREHOUSE_UOMS.find((u) => u.toLowerCase() === uomRaw.toLowerCase()) || uomRaw || 'Pack';

      const parsedPrice =
        rawPrice !== undefined ? Number(rawPrice) : refMatch?.unitPrice ?? 0;
      const parsedMin =
        rawMin !== undefined ? Number(rawMin) : refMatch?.reorderLevel ?? 2;
      const parsedQty = rawQty !== undefined ? Number(rawQty) : 0;

      let error: string | undefined;
      if (!description) {
        error = 'Missing Description';
      } else if (!resolvedBranch.valid) {
        error = `Unknown branch "${String(rawBranch)}"`;
      } else if (Number.isNaN(parsedQty) || parsedQty < 0) {
        error = 'Invalid Qty';
      } else if (Number.isNaN(parsedMin) || parsedMin < 0) {
        error = 'Invalid Min';
      }

      const existingMatch = !error
        ? inventoryItems.find((existing) => {
            if (existing.branchCode !== resolvedBranch.code) return false;
            if (
              itemCode &&
              existing.itemCode &&
              existing.itemCode.trim().toLowerCase() === itemCode.toLowerCase()
            ) {
              return true;
            }
            return (
              (existing.description || '').trim().toLowerCase() === description.toLowerCase() &&
              (existing.batchNo || '').trim().toLowerCase() === batchNo.toLowerCase()
            );
          })
        : undefined;

      const status: 'INVALID' | 'SKIP' | 'UPDATE' | 'NEW' = error
        ? 'INVALID'
        : existingMatch
        ? importDuplicateMode === 'SKIP'
          ? 'SKIP'
          : 'UPDATE'
        : 'NEW';

      return {
        rowNumber: idx + 2,
        branchCode: resolvedBranch.code,
        branchName: resolvedBranch.name,
        itemCode: itemCode || undefined,
        codeAutoFilled,
        description,
        category,
        batchNo,
        expiryDate,
        uom: matchedUom,
        unitPrice: Number.isNaN(parsedPrice) || parsedPrice < 0 ? 0 : parsedPrice,
        reorderLevel: Number.isNaN(parsedMin) || parsedMin < 0 ? 2 : parsedMin,
        quantity: Number.isNaN(parsedQty) || parsedQty < 0 ? 0 : parsedQty,
        existingId: existingMatch?.id,
        status,
        error,
      };
    });
  }, [importRawRows, importDefaultBranch, importDuplicateMode, inventoryItems, categoryOptions]);

  const handleExportStockItemsXlsx = () => {
    if (!isSuperAdmin) return;
    const source = filteredInventory.length > 0 ? filteredInventory : monitoredInventoryItems;
    const rows =
      source.length > 0
        ? source.map((item) => ({
            Branch: item.branchCode,
            'Item Code': item.itemCode || '',
            Description: item.description,
            Category: item.category,
            'Batch / Exp': item.batchNo || '',
            'Expiry Date': resolveItemExpiryDate(item) || '',
            UOM: item.uom,
            Price: Number(item.unitPrice || 0),
            Min: Number(item.reorderLevel ?? 2),
            Qty: Number(item.quantity || 0),
          }))
        : [
            {
              Branch: branchFilter !== 'ALL' ? branchFilter : defaultUserBranch,
              'Item Code': '01-0001',
              Description: 'SAMPLE STOCK ITEM',
              Category: categoryOptions[0] || 'BEVERAGE',
              'Batch / Exp': '',
              'Expiry Date': '',
              UOM: 'Pack',
              Price: 0,
              Min: 2,
              Qty: 10,
            },
          ];

    const worksheet = XLSX.utils.json_to_sheet(rows, {
      header: [...STOCK_EXPORT_HEADERS],
    });
    worksheet['!cols'] = [
      { wch: 12 },
      { wch: 14 },
      { wch: 40 },
      { wch: 24 },
      { wch: 16 },
      { wch: 13 },
      { wch: 10 },
      { wch: 10 },
      { wch: 8 },
      { wch: 10 },
    ];

    const guideRows: Array<Record<string, string>> = WAREHOUSE_BRANCHES.map((b, idx) => ({
      'Branch Code': b.code,
      'Branch Name': b.name,
      'STR Prefix': b.strPrefix,
      'Valid UOMs': WAREHOUSE_UOMS[idx] || '',
    }));
    WAREHOUSE_UOMS.slice(WAREHOUSE_BRANCHES.length).forEach((uom) => {
      guideRows.push({
        'Branch Code': '',
        'Branch Name': '',
        'STR Prefix': '',
        'Valid UOMs': uom,
      });
    });
    const guideSheet = XLSX.utils.json_to_sheet(guideRows);
    guideSheet['!cols'] = [{ wch: 14 }, { wch: 18 }, { wch: 12 }, { wch: 14 }];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Stock Items');
    XLSX.utils.book_append_sheet(workbook, guideSheet, 'Branches & UOMs');
    const scopeTag = branchFilter === 'ALL' ? 'AllBranches' : branchFilter;
    const filename = `FBC_Stock_Items_${scopeTag}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, filename);
    showExportToast(filename);
  };

  const handleDownloadStockImportTemplate = () => {
    const sampleBranch =
      branchFilter !== 'ALL' ? (branchFilter as WarehouseBranchCode) : defaultUserBranch;
    const templateRows = [
      {
        Branch: sampleBranch,
        'Item Code': '01-0001',
        Description: 'SAMPLE ITEM DESCRIPTION',
        Category: categoryOptions[0] || 'BEVERAGE',
        'Batch / Exp': '12-31-26',
        'Expiry Date': '2026-12-31',
        UOM: 'Pack',
        Price: 0,
        Min: 2,
        Qty: 10,
      },
    ];
    const worksheet = XLSX.utils.json_to_sheet(templateRows, {
      header: [...STOCK_EXPORT_HEADERS],
    });
    worksheet['!cols'] = [
      { wch: 12 },
      { wch: 14 },
      { wch: 36 },
      { wch: 24 },
      { wch: 14 },
      { wch: 13 },
      { wch: 10 },
      { wch: 10 },
      { wch: 8 },
      { wch: 10 },
    ];
    const guideRows: Array<Record<string, string>> = WAREHOUSE_BRANCHES.map((b, idx) => ({
      'Branch Code': b.code,
      'Branch Name': b.name,
      'Valid UOMs': WAREHOUSE_UOMS[idx] || '',
    }));
    WAREHOUSE_UOMS.slice(WAREHOUSE_BRANCHES.length).forEach((uom) => {
      guideRows.push({ 'Branch Code': '', 'Branch Name': '', 'Valid UOMs': uom });
    });
    const guideSheet = XLSX.utils.json_to_sheet(guideRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Stock Import Template');
    XLSX.utils.book_append_sheet(workbook, guideSheet, 'Branches & UOMs');
    const filename = `FBC_QuickAdd_Stock_Template.xlsx`;
    XLSX.writeFile(workbook, filename);
    showExportToast(filename);
  };

  const handleOpenImportModal = () => {
    if (!isSuperAdmin) return;
    setImportDefaultBranch(
      branchFilter !== 'ALL' ? (branchFilter as WarehouseBranchCode) : defaultUserBranch
    );
    setImportFileName('');
    setImportRawRows([]);
    setImportDuplicateMode('SKIP');
    setImportRefNumber(`IMP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`);
    setShowImportModal(true);
  };

  const handleImportFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        showErrorAlert('Empty File', 'No worksheet found in the selected file.');
        return;
      }
      const sheet = workbook.Sheets[firstSheetName];
      const jsonRows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, {
        defval: '',
      });
      if (jsonRows.length === 0) {
        showErrorAlert('No Rows Found', 'The uploaded sheet does not contain any stock rows.');
        return;
      }
      setImportFileName(file.name);
      setImportRawRows(jsonRows);
    } catch (err) {
      console.error('Import parse error:', err);
      showErrorAlert(
        'Invalid File',
        'Could not read the uploaded file. Please upload a valid .xlsx, .xls, or .csv file.'
      );
    } finally {
      e.target.value = '';
    }
  };

  const handleConfirmImportStockItems = async () => {
    if (!isSuperAdmin || isImportingStock) return;
    const actionableRows = parsedImportPreview.filter(
      (r) => r.status === 'NEW' || r.status === 'UPDATE'
    );
    if (actionableRows.length === 0) {
      showErrorAlert(
        'Nothing to Import',
        'There are no valid new or updatable stock items in the current preview.'
      );
      return;
    }

    setIsImportingStock(true);
    try {
      const summary = await onBulkImportInventoryItems({
        items: actionableRows.map((row) => ({
          existingId: row.status === 'UPDATE' ? row.existingId : undefined,
          item: {
            itemCode: row.itemCode,
            description: row.description,
            category: row.category,
            batchNo: row.batchNo,
            uom: row.uom,
            unitPrice: row.unitPrice,
            branchCode: row.branchCode,
            branchName: row.branchName,
            quantity: row.quantity,
            reorderLevel: row.reorderLevel,
            expiryDate: row.expiryDate,
          },
        })),
        refNumber: importRefNumber.trim() || undefined,
      });

      const importedNearExpiry = actionableRows.filter(
        (row) =>
          evaluateItemExpiry({
            expiryDate: row.expiryDate,
            batchNo: row.batchNo,
            quantity: row.quantity,
          }).isAlertActive
      );

      setShowImportModal(false);
      setImportRawRows([]);
      setImportFileName('');
      if (importedNearExpiry.length > 0) {
        const hasExpired = importedNearExpiry.some(
          (r) =>
            evaluateItemExpiry({
              expiryDate: r.expiryDate,
              batchNo: r.batchNo,
              quantity: r.quantity,
            }).status === 'EXPIRED'
        );
        showAdminAlertToast(
          `Imported with Expiry Alert (${importedNearExpiry.length})`,
          `${summary.createdCount} added, ${summary.updatedCount} updated · ${importedNearExpiry.length} item(s) are expired or expiring within ${NEAR_EXPIRY_THRESHOLD_DAYS}d.`,
          hasExpired ? 'critical' : 'warning'
        );
      } else {
        showActionSuccessToast(
          `Imported: ${summary.createdCount} added, ${summary.updatedCount} updated${
            summary.categoriesAdded > 0 ? `, ${summary.categoriesAdded} new categories` : ''
          }`
        );
      }
    } catch (err) {
      console.error('Bulk import failed:', err);
      showErrorAlert('Import Failed', 'An error occurred while saving imported stock items.');
    } finally {
      setIsImportingStock(false);
    }
  };

  // Category CRUD Handlers
  const handleSubmitNewCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCategoryName.trim().toUpperCase();
    if (!trimmed) return;
    if (categories.some((c) => (c.name || '').toUpperCase() === trimmed)) {
      showErrorAlert('Duplicate Category', `"${trimmed}" already exists.`);
      return;
    }
    await onAddCategory(trimmed);
    setNewCategoryName('');
    showActionSuccessToast(`Added category "${trimmed}"`);
  };

  const handleSaveCategoryRename = async (categoryId: string) => {
    const trimmed = editingCategoryName.trim().toUpperCase();
    if (!trimmed) return;
    const duplicate = categories.some(
      (c) => c.id !== categoryId && (c.name || '').toUpperCase() === trimmed
    );
    if (duplicate) {
      showErrorAlert('Duplicate Category', `"${trimmed}" already exists.`);
      return;
    }
    await onUpdateCategory(categoryId, trimmed);
    setEditingCategoryId(null);
    setEditingCategoryName('');
    showActionSuccessToast(`Renamed category to "${trimmed}"`);
  };

  const handleConfirmDeleteCategory = async (cat: WarehouseCategory) => {
    const usedCount = inventoryItems.filter((i) => i.category === cat.name).length;
    const result = await yellowCabSwal.fire({
      icon: 'warning',
      title: `Delete Category "${cat.name}"?`,
      text:
        usedCount > 0
          ? `${usedCount} stock item(s) currently reference this category. Deleting the category removes it from the category list without deleting your stock items.`
          : 'This category has no stock items and will be permanently removed.',
      showCancelButton: true,
      confirmButtonText: 'Delete Category',
      cancelButtonText: 'Cancel',
    });
    if (result.isConfirmed) {
      await onDeleteCategory(cat.id);
      if (categoryFilter === cat.name) setCategoryFilter('ALL');
      showActionSuccessToast(`Deleted category "${cat.name}"`);
    }
  };

  // Stock Item Add / Edit / Delete Handlers
  const handleOpenAddItemModal = () => {
    setEditingItem(null);
    setItemBranch(
      branchFilter !== 'ALL' ? (branchFilter as WarehouseBranchCode) : defaultUserBranch
    );
    setItemCode('');
    setItemDesc('');
    setItemCategory(
      categoryFilter !== 'ALL' ? categoryFilter : categoryOptions[0] || 'BEVERAGE'
    );
    setItemBatch('');
    setItemExpiryDate('');
    setItemUom('Pack');
    setItemPrice('0');
    setItemQty('0');
    setItemReorder('2');
    setItemRef(`SI-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}`);
    setItemNotes('');
    setItemAutoFillHint('');
    setShowItemModal(true);
  };

  const handleOpenEditItemModal = (item: WarehouseInventoryItem) => {
    setEditingItem(item);
    setItemBranch(item.branchCode);
    const existingCode = (item.itemCode || '').trim();
    const matchedCodeRef = !existingCode
      ? findStockReferenceByDescription(item.description, inventoryItems, item.branchCode)
      : undefined;
    const autoCode = matchedCodeRef?.itemCode || '';
    setItemCode(existingCode || autoCode);
    setItemDesc(item.description);
    setItemCategory(item.category);
    setItemBatch(item.batchNo || '');
    setItemExpiryDate(resolveItemExpiryDate(item) || '');
    setItemUom(item.uom || 'Pc');
    setItemPrice(String(item.unitPrice ?? 0));
    setItemQty(String(item.quantity ?? 0));
    setItemReorder(String(item.reorderLevel ?? 2));
    setItemAutoFillHint(
      !existingCode && autoCode
        ? `Auto-filled item code ${autoCode} from Stock Items`
        : ''
    );
    setShowItemModal(true);
  };

  const handleItemCodeInputChange = (nextCode: string) => {
    setItemCode(nextCode);
    const match = findStockReferenceByCode(nextCode, inventoryItems, itemBranch);
    if (!match) {
      setItemAutoFillHint('');
      return;
    }

    if (!editingItem || !itemDesc.trim()) {
      setItemDesc(match.description);
      if (match.category && categoryOptions.includes(match.category)) {
        setItemCategory(match.category);
      }
      if (match.uom) setItemUom(match.uom);
      if (match.batchNo && !itemBatch.trim()) setItemBatch(match.batchNo);
      if (match.unitPrice > 0) setItemPrice(String(match.unitPrice));
      if (!editingItem) setItemReorder(String(match.reorderLevel));
    }
    setItemAutoFillHint(`Matched Stock Item: ${match.description}`);
  };

  const handleItemDescInputChange = (nextDesc: string) => {
    setItemDesc(nextDesc);
    const match = findStockReferenceByDescription(nextDesc, inventoryItems, itemBranch);
    if (!match) {
      setItemAutoFillHint('');
      return;
    }

    if (match.itemCode && (!editingItem || !itemCode.trim())) {
      setItemCode(match.itemCode);
      setItemAutoFillHint(`Auto-filled item code: ${match.itemCode}`);
    } else {
      setItemAutoFillHint('');
    }

    if (!editingItem) {
      if (match.category && categoryOptions.includes(match.category)) {
        setItemCategory(match.category);
      }
      if (match.uom) setItemUom(match.uom);
      if (match.batchNo && !itemBatch.trim()) setItemBatch(match.batchNo);
      if (match.unitPrice > 0) setItemPrice(String(match.unitPrice));
      setItemReorder(String(match.reorderLevel));
    }
  };

  const handleBatchAutoFillMissingCodes = async () => {
    if (!isSuperAdmin || !onAutoFillMissingCodes || isAutoFillingCodes) return;
    setIsAutoFillingCodes(true);
    try {
      const updatedCount = await onAutoFillMissingCodes();
      if (updatedCount > 0) {
        showActionSuccessToast(`Auto-filled item codes for ${updatedCount} stock item(s).`);
      } else {
        showActionSuccessToast('All matching stock items already have item codes.');
      }
    } finally {
      setIsAutoFillingCodes(false);
    }
  };

  const handleSubmitItemModal = async (e: React.FormEvent) => {
    e.preventDefault();
    const branch = getBranchByCode(itemBranch);
    if (!branch) return;

    if (!itemDesc.trim()) {
      showErrorAlert('Missing Description', 'Please enter a stock item description.');
      return;
    }

    const parsedQty = Number(itemQty);
    const parsedPrice = Number(itemPrice);
    const parsedReorder = Number(itemReorder);

    if (!Number.isFinite(parsedQty) || parsedQty < 0) {
      showErrorAlert('Invalid Quantity', 'Quantity must be 0 or greater.');
      return;
    }

    const safePrice = Number.isFinite(parsedPrice) && parsedPrice >= 0 ? parsedPrice : 0;
    const safeReorder = Number.isFinite(parsedReorder) && parsedReorder >= 0 ? parsedReorder : 2;

    const resolvedCode =
      itemCode.trim() ||
      findStockReferenceByDescription(itemDesc.trim(), inventoryItems, branch.code)
        ?.itemCode ||
      '';

    const resolvedExpiry =
      normalizeExpiryDate(itemExpiryDate) || normalizeExpiryDate(itemBatch);
    const effectiveQty = editingItem
      ? isSuperAdmin
        ? parsedQty
        : editingItem.quantity
      : parsedQty;
    const savedExpiryEval = evaluateItemExpiry({
      expiryDate: resolvedExpiry,
      batchNo: itemBatch.trim(),
      quantity: effectiveQty,
    });

    if (editingItem) {
      await onUpdateInventoryItem({
        ...editingItem,
        branchCode: branch.code,
        branchName: branch.name,
        itemCode: resolvedCode || undefined,
        description: itemDesc.trim(),
        category: itemCategory,
        batchNo: itemBatch.trim(),
        expiryDate: resolvedExpiry,
        uom: itemUom,
        unitPrice: safePrice,
        quantity: isSuperAdmin ? parsedQty : editingItem.quantity,
        reorderLevel: safeReorder,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.name,
      });
      if (savedExpiryEval.isAlertActive) {
        showAdminAlertToast(
          `Updated · Expiry Alert (${savedExpiryEval.label})`,
          `"${itemDesc.trim()}" at ${branch.name} is ${
            savedExpiryEval.status === 'EXPIRED' ? 'expired' : 'nearing expiry'
          }.`,
          savedExpiryEval.status === 'EXPIRED' ? 'critical' : 'warning'
        );
      } else {
        showActionSuccessToast(`Updated "${itemDesc.trim()}"`);
      }
    } else {
      await onAddInventoryItem(
        {
          itemCode: resolvedCode || undefined,
          description: itemDesc.trim(),
          category: itemCategory,
          batchNo: itemBatch.trim(),
          expiryDate: resolvedExpiry,
          uom: itemUom,
          unitPrice: safePrice,
          branchCode: branch.code,
          branchName: branch.name,
          quantity: parsedQty,
          reorderLevel: safeReorder,
        },
        itemRef.trim() || undefined,
        itemNotes.trim() || undefined
      );
      if (savedExpiryEval.isAlertActive) {
        showAdminAlertToast(
          `Added · Expiry Alert (${savedExpiryEval.label})`,
          `"${itemDesc.trim()}" added to ${branch.name} is ${
            savedExpiryEval.status === 'EXPIRED' ? 'expired' : 'nearing expiry'
          }.`,
          savedExpiryEval.status === 'EXPIRED' ? 'critical' : 'warning'
        );
      } else {
        showActionSuccessToast(`Added "${itemDesc.trim()}" to ${branch.name}`);
      }
    }
    setShowItemModal(false);
  };

  const handleSaveInlineMin = async (item: WarehouseInventoryItem) => {
    const parsed = Number(editingMinVal);
    if (Number.isNaN(parsed) || parsed < 0) {
      showErrorAlert('Invalid Min Level', 'Minimum stock level must be 0 or greater.');
      return;
    }
    await onUpdateInventoryItem({
      ...item,
      reorderLevel: parsed,
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser.name,
    });
    setEditingMinItemId(null);
    showActionSuccessToast(`Updated Min level for "${item.description}" to ${parsed}`);
  };

  const handleConfirmDeleteItem = async (item: WarehouseInventoryItem) => {
    const result = await yellowCabSwal.fire({
      icon: 'warning',
      title: 'Delete Stock Item?',
      html: `<div style="font-size:13px;">Remove <strong>${item.description}</strong> (${item.branchName}) from inventory?</div>`,
      showCancelButton: true,
      confirmButtonText: 'Delete Item',
      cancelButtonText: 'Cancel',
    });
    if (result.isConfirmed) {
      await onDeleteInventoryItem(item.id);
      showActionSuccessToast(`Deleted "${item.description}"`);
    }
  };

  // Stock In / Out Handlers (Super Admin only)
  const handleOpenAdjustModal = (
    item: WarehouseInventoryItem,
    type: 'STOCK_IN' | 'STOCK_OUT'
  ) => {
    if (!isSuperAdmin) {
      showErrorAlert(
        'Restricted Action',
        'Only Super Admin can perform Stock In / Stock Out adjustments.'
      );
      return;
    }
    setAdjustTargetItem(item);
    setAdjustType(type);
    setAdjustQty('1');
    setAdjustDate(new Date().toISOString().slice(0, 10));
    setAdjustRef(
      `${type === 'STOCK_IN' ? 'SI' : 'SO'}-${new Date()
        .toISOString()
        .slice(2, 10)
        .replace(/-/g, '')}`
    );
    setAdjustNotes('');
  };

  const handleSubmitAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustTargetItem) return;
    const qty = Number(adjustQty);
    if (Number.isNaN(qty) || qty <= 0) {
      showErrorAlert('Invalid Quantity', 'Enter a quantity greater than 0.');
      return;
    }
    if (adjustType === 'STOCK_OUT' && qty > adjustTargetItem.quantity) {
      showErrorAlert(
        'Insufficient Stock',
        `${adjustTargetItem.branchName} only has ${adjustTargetItem.quantity} ${adjustTargetItem.uom} on hand.`
      );
      return;
    }

    await onRecordStockMovement({
      itemId: adjustTargetItem.id,
      movementType: adjustType,
      quantity: qty,
      refNumber: adjustRef.trim() || `${adjustType}-${Date.now()}`,
      date: adjustDate,
      notes: adjustNotes.trim() || undefined,
    });
    setAdjustTargetItem(null);
    showActionSuccessToast(
      `${adjustType === 'STOCK_IN' ? 'Stock In' : 'Stock Out'} recorded for ${
        adjustTargetItem.description
      }`
    );
  };

  // STR Line Item Search Modal Handlers
  const handleOpenItemPicker = (lineIdx: number) => {
    setPickerLineIdx(lineIdx);
    setPickerSearch('');
    setPickerCategory('ALL');
    setPickerSource(issuingBranchStock.length > 0 ? 'ISSUING' : 'CATALOG');
  };

  const handleSelectStockItemForLine = (chosen: WarehouseInventoryItem) => {
    if (pickerLineIdx === null) return;
    if ((Number(chosen.quantity) || 0) <= 0) {
      showErrorAlert(
        '0 Quantity Not Selectable',
        `"${chosen.description}" currently has 0 quantity on hand in ${getBranchByCode(fromBranchCode)?.name || fromBranchCode}. Items with 0 quantity cannot be selected in a new STR.`
      );
      return;
    }
    const resolvedCode =
      (chosen.itemCode || '').trim() ||
      findStockReferenceByDescription(chosen.description, inventoryItems, fromBranchCode)
        ?.itemCode ||
      '';
    setLineItems((prev) =>
      prev.map((row, idx) =>
        idx === pickerLineIdx
          ? {
              ...row,
              itemId: chosen.id,
              itemCode: resolvedCode,
              description: chosen.description,
              category: chosen.category,
              batchNo: chosen.batchNo,
              uom: chosen.uom,
              unitPrice: chosen.unitPrice,
            }
          : row
      )
    );
    setPickerLineIdx(null);
  };

  const handleSelectCatalogItemForLine = (
    catItem: (typeof DEFAULT_STOCK_CATALOG)[number]
  ) => {
    if (pickerLineIdx === null) return;
    const matchedIssuing = issuingBranchStock.find(
      (s) =>
        (s.description || '').toLowerCase() === (catItem.description || '').toLowerCase() &&
        (s.batchNo || '').toLowerCase() === (catItem.batchNo || '').toLowerCase()
    );
    if (
      isMonitoredWarehouseBranch(fromBranchCode) &&
      (!matchedIssuing || (Number(matchedIssuing.quantity) || 0) <= 0)
    ) {
      showErrorAlert(
        '0 Quantity Not Selectable',
        `"${catItem.description}" has 0 quantity on hand in ${getBranchByCode(fromBranchCode)?.name || fromBranchCode}. Items with 0 quantity cannot be selected in a new STR.`
      );
      return;
    }
    const resolvedCode =
      (matchedIssuing?.itemCode || catItem.itemCode || '').trim();
    setLineItems((prev) =>
      prev.map((row, idx) =>
        idx === pickerLineIdx
          ? {
              ...row,
              itemId: matchedIssuing?.id || '',
              itemCode: resolvedCode,
              description: catItem.description,
              category: catItem.category,
              batchNo: catItem.batchNo,
              uom: matchedIssuing?.uom || catItem.uom,
              unitPrice: matchedIssuing?.unitPrice || 0,
            }
          : row
      )
    );
    setPickerLineIdx(null);
  };

  const handleStrLineCodeChange = (lineIdx: number, nextCode: string) => {
    const trimmed = nextCode.trim().toLowerCase();
    const ref = findStockReferenceByCode(nextCode, inventoryItems, fromBranchCode);
    const issuingExact = trimmed
      ? issuingBranchStock.find(
          (s) => (s.itemCode || '').trim().toLowerCase() === trimmed
        )
      : undefined;

    const isExactMatchZeroStock = Boolean(
      trimmed &&
        ((issuingExact && (Number(issuingExact.quantity) || 0) <= 0) ||
          (isMonitoredWarehouseBranch(fromBranchCode) &&
            !issuingExact &&
            ref &&
            (ref.itemCode || '').trim().toLowerCase() === trimmed))
    );

    if (isExactMatchZeroStock) {
      showErrorAlert(
        '0 Quantity Not Selectable',
        `"${issuingExact?.description || ref?.description || nextCode}" has 0 quantity on hand in ${getBranchByCode(fromBranchCode)?.name || fromBranchCode} and cannot be selected in a new STR.`
      );
      setLineItems((prev) =>
        prev.map((row, idx) =>
          idx === lineIdx
            ? { ...row, itemId: '', itemCode: '', description: '' }
            : row
        )
      );
      return;
    }

    setLineItems((prev) =>
      prev.map((row, idx) => {
        if (idx !== lineIdx) return row;
        if (!ref && !issuingExact) {
          return { ...row, itemCode: nextCode };
        }
        const sourceItem = issuingExact || ref?.matchedItem;
        return {
          ...row,
          itemId: issuingExact?.id || (sourceItem?.branchCode === fromBranchCode ? sourceItem.id : ''),
          itemCode: issuingExact?.itemCode || ref?.itemCode || nextCode,
          description: issuingExact?.description || ref?.description || row.description,
          category: issuingExact?.category || ref?.category || row.category,
          batchNo: issuingExact?.batchNo || ref?.batchNo || row.batchNo,
          uom: issuingExact?.uom || ref?.uom || row.uom,
          unitPrice: issuingExact?.unitPrice ?? ref?.unitPrice ?? row.unitPrice,
        };
      })
    );
  };

  const handleUpdateLineItem = <K extends keyof StockTransferLineItem>(
    lineIdx: number,
    field: K,
    value: StockTransferLineItem[K]
  ) => {
    setLineItems((prev) =>
      prev.map((row, idx) => (idx === lineIdx ? { ...row, [field]: value } : row))
    );
  };

  const handleAddLineRow = () => {
    setLineItems((prev) => [
      ...prev,
      {
        id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        itemId: '',
        itemCode: '',
        description: '',
        category: categoryOptions[0] || 'BEVERAGE',
        batchNo: '',
        uom: 'Pack',
        unitPrice: 0,
        quantity: 1,
      },
    ]);
  };

  const handleRemoveLineRow = (lineIdx: number) => {
    if (lineItems.length <= 1) return;
    setLineItems((prev) => prev.filter((_, idx) => idx !== lineIdx));
  };

  const handleSubmitStr = async (e: React.FormEvent) => {
    e.preventDefault();
    if (fromBranchCode === toBranchCode) {
      showErrorAlert(
        'Invalid Branch Pair',
        'Issuing Branch (From) and Requesting Branch (To) must be different.'
      );
      return;
    }

    const fromBranch = getBranchByCode(fromBranchCode);
    const toBranch = getBranchByCode(toBranchCode);
    if (!fromBranch || !toBranch) return;

    if (!strRefInput.trim() || !preparedBy.trim()) {
      showErrorAlert(
        'Missing Required Fields',
        'STR Ref # and Prepared By are required.'
      );
      return;
    }

    const cleanedLines = lineItems
      .map((line) => {
        const lineDesc = (line.description || '').trim();
        const lineBatch = (line.batchNo || '').trim();
        const matchedIssuing =
          inventoryItems.find(
            (i) => i.id === line.itemId && i.branchCode === fromBranchCode
          ) ||
          inventoryItems.find(
            (i) =>
              i.branchCode === fromBranchCode &&
              (i.description || '').toLowerCase() === lineDesc.toLowerCase() &&
              (i.batchNo || '').toLowerCase() === lineBatch.toLowerCase()
          );
        const resolvedCode =
          (matchedIssuing?.itemCode || '').trim() ||
          (line.itemCode || '').trim() ||
          findStockReferenceByDescription(
            lineDesc,
            inventoryItems,
            fromBranchCode
          )?.itemCode ||
          '';
        return {
          ...line,
          itemCode: resolvedCode || undefined,
          description: lineDesc,
          batchNo: lineBatch,
          uom: matchedIssuing?.uom || line.uom,
          quantity: Number(line.quantity) || 0,
          unitPrice: Number(line.unitPrice) || 0,
        };
      })
      .filter((line) => line.description.length > 0 && line.quantity > 0);

    if (cleanedLines.length === 0) {
      showErrorAlert(
        'No Valid Line Items',
        'Add at least one item with a description and quantity greater than 0.'
      );
      return;
    }

    if (isMonitoredWarehouseBranch(fromBranchCode)) {
      const deductionCheck = new Map<string, number>();
      const zeroStockErrors: string[] = [];
      const stockWarnings: string[] = [];
      for (const line of cleanedLines) {
        const matchedItem =
          inventoryItems.find(
            (i) => i.id === line.itemId && i.branchCode === fromBranchCode
          ) ||
          inventoryItems.find(
            (i) =>
              i.branchCode === fromBranchCode &&
              (i.description || '').toLowerCase() === (line.description || '').toLowerCase() &&
              (i.batchNo || '').toLowerCase() === (line.batchNo || '').toLowerCase()
          );

        if (!matchedItem || (Number(matchedItem.quantity) || 0) <= 0) {
          zeroStockErrors.push(
            `• ${line.description}: 0 quantity available in ${fromBranch.name}`
          );
        } else {
          const prevPlanned = deductionCheck.get(matchedItem.id) || 0;
          const nextTotal = prevPlanned + line.quantity;
          if (nextTotal > matchedItem.quantity) {
            stockWarnings.push(
              `• ${matchedItem.description}: Only ${matchedItem.quantity} ${matchedItem.uom} on hand (Req: ${nextTotal})`
            );
          }
          deductionCheck.set(matchedItem.id, nextTotal);
        }
      }

      if (zeroStockErrors.length > 0) {
        showErrorAlert(
          '0-Quantity Item Not Allowed',
          `Items with 0 quantity cannot be selected or submitted in a new STR (${fromBranch.name}): ${zeroStockErrors.join(' ')}`
        );
        return;
      }

      if (stockWarnings.length > 0) {
        const warnResult = await yellowCabSwal.fire({
          icon: 'warning',
          title: 'Requested Quantity Exceeds Available Stock',
          html: `<div style="font-size:12px;text-align:left;line-height:1.5;">
            <p style="margin-bottom:6px;">These requested items exceed current balance in <strong>${fromBranch.name}</strong>:</p>
            <div style="background:#fff1f2;border:1px solid #fecdd3;border-radius:8px;padding:8px 10px;color:#9f1239;font-family:monospace;font-size:11px;max-height:140px;overflow:auto;">
              ${stockWarnings.join('<br/>')}
            </div>
            <p style="margin-top:8px;">Submit as <strong>PENDING</strong> anyway so Super Admin can adjust quantities or review?</p>
          </div>`,
          showCancelButton: true,
          confirmButtonText: 'Submit Pending STR',
          cancelButtonText: 'Go Back & Edit',
        });
        if (!warnResult.isConfirmed) {
          return;
        }
      }
    }

    setIsSubmittingStr(true);
    try {
      const approvedReviewer = isSuperAdmin ? reviewedBy.trim() || undefined : undefined;
      const created = await onCreateStockTransfer({
        transferNumber:
          transferNumInput.trim() || generateNextTransferNumber(strDate, stockTransfers),
        strRefNumber: strRefInput.trim(),
        date: strDate,
        fromBranchCode: fromBranch.code,
        fromBranchName: fromBranch.name,
        toBranchCode: toBranch.code,
        toBranchName: toBranch.name,
        items: cleanedLines,
        preparedBy: preparedBy.trim(),
        reviewedBy: approvedReviewer,
        receivedBy: '',
        remarks: strRemarks.trim() || undefined,
      });

      showActionSuccessToast(
        `STR ${strRefInput.trim()} submitted as PENDING (${fromBranch.name} → ${toBranch.name})`
      );

      setLineItems([
        {
          id: `line-${Date.now()}`,
          itemId: '',
          itemCode: '',
          description: '',
          category: categoryOptions[0] || 'BEVERAGE',
          batchNo: '',
          uom: 'Pack',
          unitPrice: 0,
          quantity: 1,
        },
      ]);
      setReviewedBy('');
      setStrRemarks('');

      const tempList: StockTransferRequisition[] = created
        ? [created, ...stockTransfers]
        : [
            {
              id: 'tmp',
              transferNumber: transferNumInput.trim(),
              strRefNumber: strRefInput.trim(),
              date: strDate,
              fromBranchCode: fromBranch.code,
              fromBranchName: fromBranch.name,
              toBranchCode: toBranch.code,
              toBranchName: toBranch.name,
              items: cleanedLines,
              preparedBy: preparedBy.trim(),
              reviewedBy: approvedReviewer,
              receivedBy: '',
              status: 'PENDING',
              createdAt: new Date().toISOString(),
            },
            ...stockTransfers,
          ];
      const prefixBranch = prefixBasis === 'FROM' ? fromBranchCode : toBranchCode;
      setStrRefInput(generateNextStrRef(prefixBranch, tempList));
      setTransferNumInput(generateNextTransferNumber(strDate, tempList));

      if (created) {
        setPrintableTransfer(created);
        setIsPrintModalOpen(true);
      }
    } finally {
      setIsSubmittingStr(false);
    }
  };

  const getLineKey = (line: StockTransferLineItem, idx: number) =>
    line.id || `line-idx-${idx}`;

  const getReviewLineStockInfo = (
    trf: StockTransferRequisition,
    line: StockTransferLineItem
  ) => {
    const isFromMonitored = isMonitoredWarehouseBranch(trf.fromBranchCode);
    if (!isFromMonitored) {
      return {
        isFromMonitored: false,
        matchedItem: undefined as WarehouseInventoryItem | undefined,
        currentOnHand: 0,
        reservedByStr: 0,
        effectiveAvailable: 0,
        isUnavailable: false,
        statusLabel: 'Unmonitored Store Branch',
      };
    }

    const lineDesc = (line.description || '').toLowerCase();
    const lineBatch = (line.batchNo || '').toLowerCase();

    const matchedItem =
      inventoryItems.find(
        (i) => line.itemId && i.id === line.itemId && i.branchCode === trf.fromBranchCode
      ) ||
      inventoryItems.find(
        (i) =>
          i.branchCode === trf.fromBranchCode &&
          (i.description || '').toLowerCase() === lineDesc &&
          (i.batchNo || '').toLowerCase() === lineBatch
      ) ||
      inventoryItems.find(
        (i) =>
          i.branchCode === trf.fromBranchCode &&
          (i.description || '').toLowerCase() === lineDesc
      );

    const origLineIndex = (trf.items || []).findIndex(
      (orig, i) => getLineKey(orig, i) === line.id
    );
    const origLine = origLineIndex >= 0 ? trf.items[origLineIndex] : undefined;
    const isOrigActive = Boolean(origLine && origLine.itemStatus !== 'CANCELLED');

    const origOutMov = isOrigActive
      ? stockMovements.find(
          (m) =>
            m.movementType === 'TRANSFER_OUT' &&
            m.refNumber === trf.strRefNumber &&
            m.transferNumber === trf.transferNumber &&
            m.branchCode === trf.fromBranchCode &&
            (m.description || '').toLowerCase() === lineDesc &&
            (m.batchNo || '').toLowerCase() === (lineBatch || 'general')
        ) ||
        stockMovements.find(
          (m) =>
            m.movementType === 'TRANSFER_OUT' &&
            m.refNumber === trf.strRefNumber &&
            m.transferNumber === trf.transferNumber &&
            m.branchCode === trf.fromBranchCode &&
            (m.description || '').toLowerCase() === lineDesc
        )
      : undefined;

    const reservedByStr = isOrigActive
      ? origOutMov
        ? Math.max(0, (Number(origOutMov.previousQty) || 0) - (Number(origOutMov.newQty) || 0))
        : Number(origLine?.quantity) || 0
      : 0;
    const currentOnHand = matchedItem ? Number(matchedItem.quantity) || 0 : 0;
    const effectiveAvailable = currentOnHand + reservedByStr;

    if (!matchedItem) {
      return {
        isFromMonitored: true,
        matchedItem,
        currentOnHand: 0,
        reservedByStr: 0,
        effectiveAvailable: 0,
        isUnavailable: true,
        statusLabel: 'Not in Issuing Inventory',
      };
    }

    if (effectiveAvailable <= 0) {
      return {
        isFromMonitored: true,
        matchedItem,
        currentOnHand,
        reservedByStr,
        effectiveAvailable,
        isUnavailable: true,
        statusLabel: 'Out of Stock (0)',
      };
    }

    if (effectiveAvailable < line.quantity) {
      return {
        isFromMonitored: true,
        matchedItem,
        currentOnHand,
        reservedByStr,
        effectiveAvailable,
        isUnavailable: true,
        statusLabel: `Insufficient (${effectiveAvailable} avail vs ${line.quantity} req)`,
      };
    }

    return {
      isFromMonitored: true,
      matchedItem,
      currentOnHand,
      reservedByStr,
      effectiveAvailable,
      isUnavailable: false,
      statusLabel: `Available (${effectiveAvailable} total / ${currentOnHand} on hand)`,
    };
  };

  const handleConfirmReviewStr = (trf: StockTransferRequisition) => {
    if (!isSuperAdmin) {
      showErrorAlert(
        'Restricted Action',
        'Only Super Admin has access to review and approve STR items.'
      );
      return;
    }
    const initialCancelled = new Set<string>();
    const initialReasons: Record<string, string> = {};
    const initialDraft = (trf.items || []).map((item, idx) => {
      const key = getLineKey(item, idx);
      if (item.itemStatus === 'CANCELLED') {
        initialCancelled.add(key);
        if (item.cancelReason) initialReasons[key] = item.cancelReason;
      }
      return {
        ...item,
        id: key,
        quantity: Math.max(1, Number(item.quantity) || 1),
      };
    });
    setReviewingTransfer(trf);
    setReviewDraftItems(initialDraft);
    setReviewAddedLineIds(new Set());
    setReviewCancelledIds(initialCancelled);
    setReviewCancelReasons(initialReasons);
    setIsReviewAddPickerOpen(false);
    setReviewPickerSearch('');
    setReviewPickerCategory('ALL');
  };

  const handleToggleReviewCancelItem = (itemId: string) => {
    setReviewCancelledIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const handleUpdateReviewLineQty = (lineKey: string, nextQtyRaw: number) => {
    const cleanQty = Math.max(0, Math.floor(Number(nextQtyRaw) || 0));
    setReviewDraftItems((prev) =>
      prev.map((item, idx) =>
        getLineKey(item, idx) === lineKey ? { ...item, quantity: cleanQty } : item
      )
    );
  };

  const handleRemoveAddedReviewLine = (lineKey: string) => {
    if (!reviewAddedLineIds.has(lineKey)) return;
    setReviewDraftItems((prev) =>
      prev.filter((item, idx) => getLineKey(item, idx) !== lineKey)
    );
    setReviewAddedLineIds((prev) => {
      const next = new Set(prev);
      next.delete(lineKey);
      return next;
    });
    setReviewCancelledIds((prev) => {
      const next = new Set(prev);
      next.delete(lineKey);
      return next;
    });
  };

  const handleAddItemToReviewStr = (chosen: WarehouseInventoryItem) => {
    if (!reviewingTransfer) return;
    if (
      isMonitoredWarehouseBranch(reviewingTransfer.fromBranchCode) &&
      (Number(chosen.quantity) || 0) <= 0
    ) {
      showErrorAlert(
        'Out of Stock (0 Quantity)',
        `"${chosen.description}" has 0 quantity in ${reviewingTransfer.fromBranchName}.`
      );
      return;
    }

    const existingIdx = reviewDraftItems.findIndex(
      (line) =>
        (line.itemId && line.itemId === chosen.id) ||
        ((line.description || '').toLowerCase() === (chosen.description || '').toLowerCase() &&
          (line.batchNo || '').toLowerCase() === (chosen.batchNo || '').toLowerCase())
    );

    if (existingIdx >= 0) {
      const existingLine = reviewDraftItems[existingIdx];
      const existingKey = getLineKey(existingLine, existingIdx);
      setReviewDraftItems((prev) =>
        prev.map((line, i) =>
          i === existingIdx ? { ...line, quantity: (Number(line.quantity) || 0) + 1 } : line
        )
      );
      if (reviewCancelledIds.has(existingKey)) {
        handleToggleReviewCancelItem(existingKey);
      }
      showActionSuccessToast(`Added +1 quantity to "${chosen.description}"`);
      setIsReviewAddPickerOpen(false);
      return;
    }

    const newKey = `rev-line-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newLine: StockTransferLineItem = {
      id: newKey,
      itemId: chosen.id,
      itemCode: chosen.itemCode,
      description: chosen.description,
      category: chosen.category,
      batchNo: chosen.batchNo,
      uom: chosen.uom,
      unitPrice: Number(chosen.unitPrice) || 0,
      quantity: 1,
      itemStatus: 'APPROVED',
    };
    setReviewDraftItems((prev) => [...prev, newLine]);
    setReviewAddedLineIds((prev) => {
      const next = new Set(prev);
      next.add(newKey);
      return next;
    });
    showActionSuccessToast(`Added "${chosen.description}" to STR review`);
    setIsReviewAddPickerOpen(false);
  };

  const handleAutoMarkUnavailableReview = () => {
    if (!reviewingTransfer) return;
    const nextCancelled = new Set(reviewCancelledIds);
    const nextReasons = { ...reviewCancelReasons };
    let markedCount = 0;

    reviewDraftItems.forEach((line, idx) => {
      const key = getLineKey(line, idx);
      const info = getReviewLineStockInfo(reviewingTransfer, line);
      if (info.isUnavailable) {
        nextCancelled.add(key);
        if (!nextReasons[key]) {
          nextReasons[key] = info.statusLabel;
        }
        markedCount++;
      }
    });

    setReviewCancelledIds(nextCancelled);
    setReviewCancelReasons(nextReasons);
    if (markedCount === 0) {
      showActionSuccessToast('All requested items are available in inventory.');
    } else {
      showActionSuccessToast(`Marked ${markedCount} unavailable item(s) for cancellation.`);
    }
  };

  const handleSubmitReviewStrModal = async () => {
    if (!reviewingTransfer || isSavingReview) return;

    const invalidActiveLines = reviewDraftItems.filter((line, idx) => {
      const key = getLineKey(line, idx);
      return !reviewCancelledIds.has(key) && (Number(line.quantity) || 0) < 1;
    });

    if (invalidActiveLines.length > 0) {
      showErrorAlert(
        'Invalid Quantity',
        `Approved item "${invalidActiveLines[0].description}" must have a quantity of at least 1 (or mark it as Cancel Item).`
      );
      return;
    }

    const overRequestedLines = reviewDraftItems.filter((line, idx) => {
      const key = getLineKey(line, idx);
      if (reviewCancelledIds.has(key)) return false;
      const info = getReviewLineStockInfo(reviewingTransfer, line);
      return info.isFromMonitored && line.quantity > info.effectiveAvailable;
    });

    if (overRequestedLines.length > 0) {
      const warnConfirm = await yellowCabSwal.fire({
        icon: 'warning',
        title: 'Quantity Exceeds Issuing Stock',
        html: `<div style="font-size:12px;text-align:left;line-height:1.5;">
          <p style="margin-bottom:6px;">${overRequestedLines.length} approved line(s) exceed available inventory in <strong>${reviewingTransfer.fromBranchName}</strong>:</p>
          <ul style="padding-left:18px;margin:0;color:#9f1239;">
            ${overRequestedLines
              .slice(0, 4)
              .map((l) => `<li><strong>${l.description}</strong> (Req: ${l.quantity} ${l.uom})</li>`)
              .join('')}
          </ul>
          <p style="margin-top:8px;">Proceed and save reviewed STR anyway?</p>
        </div>`,
        showCancelButton: true,
        confirmButtonText: 'Save Anyway',
        cancelButtonText: 'Go Back & Adjust',
      });
      if (!warnConfirm.isConfirmed) return;
    }

    setIsSavingReview(true);
    try {
      const cancelledIds = Array.from(reviewCancelledIds);
      await onReviewStockTransfer(
        reviewingTransfer.id,
        cancelledIds,
        reviewCancelReasons,
        reviewDraftItems
      );
      const totalLines = reviewDraftItems.length;
      const approvedCount = Math.max(0, totalLines - cancelledIds.length);
      showActionSuccessToast(
        approvedCount === 0
          ? `STR ${reviewingTransfer.strRefNumber} marked CANCELLED (all items cancelled)`
          : `STR ${reviewingTransfer.strRefNumber} reviewed (${approvedCount} approved, ${cancelledIds.length} cancelled)`
      );
      setReviewingTransfer(null);
      setReviewDraftItems([]);
      setReviewAddedLineIds(new Set());
      setReviewCancelledIds(new Set());
      setReviewCancelReasons({});
      setIsReviewAddPickerOpen(false);
    } catch (err) {
      console.error('Failed reviewing STR:', err);
      showErrorAlert('Review Failed', 'Could not save STR review. Please try again.');
    } finally {
      setIsSavingReview(false);
    }
  };

  const handleConfirmReceiveStr = async (trf: StockTransferRequisition) => {
    const activeCount = (trf.items || []).filter((i) => i.itemStatus !== 'CANCELLED').length;
    const result = await yellowCabSwal.fire({
      icon: 'question',
      title: `Mark ${trf.strRefNumber} as Received?`,
      html: `<div style="font-size:13px;">Confirm receipt at <strong>${trf.toBranchName}</strong>?<br/>This will add <strong>${activeCount} active item(s)</strong> to ${trf.toBranchName} stock and record <strong>${currentUser.name}</strong> with the current date & time.</div>`,
      showCancelButton: true,
      confirmButtonText: 'Confirm Received',
      cancelButtonText: 'Cancel',
    });
    if (result.isConfirmed) {
      try {
        await onMarkStockTransferReceived(trf.id);
        showActionSuccessToast(`STR ${trf.strRefNumber} marked as RECEIVED by ${currentUser.name}`);
      } catch (err) {
        console.error('Failed marking STR received:', err);
        showErrorAlert('Update Failed', 'Could not mark STR as received. Please try again.');
      }
    }
  };

  const formatStrDateTime = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString('en-PH', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const pendingTransfersCount = useMemo(
    () => stockTransfers.filter((t) => t.status === 'PENDING').length,
    [stockTransfers]
  );

  // Ledger Branch From / To display helpers
  const getLedgerBranchFrom = (mov: StockMovementEntry): string => {
    if (mov.fromBranchName) return mov.fromBranchName;
    if (mov.movementType === 'TRANSFER_OUT') return mov.branchName;
    if (mov.movementType === 'TRANSFER_IN') return mov.counterpartyBranchName || '—';
    if (mov.movementType === 'STOCK_OUT') return mov.branchName;
    return 'Supplier / Stock In';
  };

  const getLedgerBranchTo = (mov: StockMovementEntry): string => {
    if (mov.toBranchName) return mov.toBranchName;
    if (mov.movementType === 'TRANSFER_OUT') return mov.counterpartyBranchName || '—';
    if (mov.movementType === 'TRANSFER_IN') return mov.branchName;
    if (mov.movementType === 'STOCK_IN') return mov.branchName;
    return 'Store Usage / Out';
  };

  // Super Admin Ledger Add / Edit / Delete Handlers
  const handleOpenAddLedgerModal = () => {
    if (!isSuperAdmin) return;
    const branch =
      ledgerBranchFilter !== 'ALL'
        ? (ledgerBranchFilter as WarehouseBranchCode)
        : defaultUserBranch;
    const branchName = getBranchByCode(branch)?.name || 'YC-Ebloc';
    setEditingLedgerEntry(null);
    setLedgerFormDate(new Date().toISOString().slice(0, 10));
    setLedgerFormType('STOCK_IN');
    setLedgerFormStatus('COMPLETED');
    setLedgerFormBranch(branch);
    setLedgerFormFromBranch('Supplier / Stock In');
    setLedgerFormToBranch(branchName);
    setLedgerFormRef(`LED-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}`);
    setLedgerFormTransferNum('');
    setLedgerFormItemId('');
    setLedgerFormItemCode('');
    setLedgerFormDesc('');
    setLedgerFormCat(categoryOptions[0] || 'BEVERAGE');
    setLedgerFormBatch('');
    setLedgerFormUom('Pack');
    setLedgerFormPrevQty('0');
    setLedgerFormQty('1');
    setLedgerFormNewQty('1');
    setLedgerFormBy(currentUser.name || '');
    setLedgerFormNotes('');
    setShowLedgerModal(true);
  };

  const handleOpenEditLedgerModal = (mov: StockMovementEntry) => {
    if (!isSuperAdmin) return;
    setEditingLedgerEntry(mov);
    setLedgerFormDate(mov.date);
    setLedgerFormType(mov.movementType);
    setLedgerFormStatus(getLedgerEntryStatus(mov).status);
    setLedgerFormBranch(mov.branchCode);
    setLedgerFormFromBranch(getLedgerBranchFrom(mov));
    setLedgerFormToBranch(getLedgerBranchTo(mov));
    setLedgerFormRef(mov.refNumber);
    setLedgerFormTransferNum(mov.transferNumber || '');
    setLedgerFormItemId(mov.itemId || '');
    const resolvedCode =
      (mov.itemCode || '').trim() ||
      findStockReferenceByDescription(mov.description, inventoryItems, mov.branchCode)
        ?.itemCode ||
      '';
    setLedgerFormItemCode(resolvedCode);
    setLedgerFormDesc(mov.description);
    setLedgerFormCat(mov.category);
    setLedgerFormBatch(mov.batchNo || '');
    setLedgerFormUom(mov.uom);
    setLedgerFormPrevQty(String(mov.previousQty ?? 0));
    setLedgerFormQty(String(mov.quantity ?? 0));
    setLedgerFormNewQty(String(mov.newQty ?? 0));
    setLedgerFormBy(mov.performedBy || '');
    setLedgerFormNotes(mov.notes || '');
    setShowLedgerModal(true);
  };

  const handlePickLedgerStockItem = (itemId: string) => {
    setLedgerFormItemId(itemId);
    const chosen = inventoryItems.find((i) => i.id === itemId);
    if (!chosen) return;
    const resolvedCode =
      (chosen.itemCode || '').trim() ||
      findStockReferenceByDescription(chosen.description, inventoryItems, chosen.branchCode)
        ?.itemCode ||
      '';
    setLedgerFormBranch(chosen.branchCode);
    setLedgerFormItemCode(resolvedCode);
    setLedgerFormDesc(chosen.description);
    setLedgerFormCat(chosen.category);
    setLedgerFormBatch(chosen.batchNo || '');
    setLedgerFormUom(chosen.uom);
    const prev = Number(chosen.quantity) || 0;
    const qty = Number(ledgerFormQty) || 0;
    const isIn = ledgerFormType === 'STOCK_IN' || ledgerFormType === 'TRANSFER_IN';
    setLedgerFormPrevQty(String(prev));
    setLedgerFormNewQty(String(isIn ? prev + qty : Math.max(0, prev - qty)));
    if (ledgerFormType === 'STOCK_IN') {
      setLedgerFormToBranch(chosen.branchName);
    } else if (ledgerFormType === 'STOCK_OUT') {
      setLedgerFormFromBranch(chosen.branchName);
    }
  };

  const handleLedgerCodeChange = (nextCode: string) => {
    setLedgerFormItemCode(nextCode);
    const match = findStockReferenceByCode(nextCode, inventoryItems, ledgerFormBranch);
    if (!match) return;
    const branchMatch = inventoryItems.find(
      (i) =>
        i.branchCode === ledgerFormBranch &&
        ((i.itemCode || '').trim().toLowerCase() === (match.itemCode || '').toLowerCase() ||
          (i.description || '').trim().toLowerCase() === (match.description || '').toLowerCase())
    );
    const activeItem = branchMatch || match.matchedItem;
    setLedgerFormItemId(branchMatch?.id || '');
    setLedgerFormDesc(match.description);
    if (match.category && categoryOptions.includes(match.category)) {
      setLedgerFormCat(match.category);
    }
    if (match.batchNo) setLedgerFormBatch(match.batchNo);
    if (match.uom) setLedgerFormUom(match.uom);
    if (activeItem && !editingLedgerEntry) {
      const prev = Number(activeItem.quantity) || 0;
      const qty = Number(ledgerFormQty) || 0;
      const isIn = ledgerFormType === 'STOCK_IN' || ledgerFormType === 'TRANSFER_IN';
      setLedgerFormPrevQty(String(prev));
      setLedgerFormNewQty(String(isIn ? prev + qty : Math.max(0, prev - qty)));
    }
  };

  const handleLedgerDescChange = (nextDesc: string) => {
    setLedgerFormDesc(nextDesc);
    const match = findStockReferenceByDescription(nextDesc, inventoryItems, ledgerFormBranch);
    if (!match) return;
    if (match.itemCode && (!editingLedgerEntry || !ledgerFormItemCode.trim())) {
      setLedgerFormItemCode(match.itemCode);
    }
    if (!editingLedgerEntry) {
      if (match.matchedItem && match.matchedItem.branchCode === ledgerFormBranch) {
        setLedgerFormItemId(match.matchedItem.id);
        const prev = Number(match.matchedItem.quantity) || 0;
        const qty = Number(ledgerFormQty) || 0;
        const isIn = ledgerFormType === 'STOCK_IN' || ledgerFormType === 'TRANSFER_IN';
        setLedgerFormPrevQty(String(prev));
        setLedgerFormNewQty(String(isIn ? prev + qty : Math.max(0, prev - qty)));
      }
      if (match.category && categoryOptions.includes(match.category)) {
        setLedgerFormCat(match.category);
      }
      if (match.uom) setLedgerFormUom(match.uom);
    }
  };

  const handleSubmitLedgerModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin) return;
    const branch = getBranchByCode(ledgerFormBranch);
    if (!branch) return;

    if (!ledgerFormDesc.trim() || !ledgerFormRef.trim()) {
      showErrorAlert('Missing Fields', 'Item Description and Ref # are required.');
      return;
    }

    const prevQ = Number(ledgerFormPrevQty) || 0;
    const qtyVal = Number(ledgerFormQty) || 0;
    const newQ = Number(ledgerFormNewQty) || 0;
    const resolvedItemCode =
      ledgerFormItemCode.trim() ||
      findStockReferenceByDescription(ledgerFormDesc.trim(), inventoryItems, branch.code)
        ?.itemCode ||
      undefined;

    const payload: Omit<StockMovementEntry, 'id' | 'timestamp'> = {
      date: ledgerFormDate,
      movementType: ledgerFormType,
      status: ledgerFormStatus,
      branchCode: branch.code,
      branchName: branch.name,
      fromBranchName: ledgerFormFromBranch.trim() || undefined,
      toBranchName: ledgerFormToBranch.trim() || undefined,
      counterpartyBranchName:
        ledgerFormType === 'TRANSFER_OUT'
          ? ledgerFormToBranch.trim() || undefined
          : ledgerFormType === 'TRANSFER_IN'
          ? ledgerFormFromBranch.trim() || undefined
          : undefined,
      itemId: ledgerFormItemId || `manual-${Date.now()}`,
      itemCode: resolvedItemCode,
      description: ledgerFormDesc.trim(),
      category: ledgerFormCat,
      batchNo: ledgerFormBatch.trim(),
      uom: ledgerFormUom,
      unitPrice: editingLedgerEntry?.unitPrice ?? 0,
      quantity: qtyVal,
      previousQty: prevQ,
      newQty: newQ,
      refNumber: ledgerFormRef.trim(),
      transferNumber: ledgerFormTransferNum.trim() || undefined,
      performedBy: ledgerFormBy.trim() || currentUser.name,
      notes: ledgerFormNotes.trim() || undefined,
    };

    if (editingLedgerEntry) {
      await onUpdateLedgerEntry({
        ...editingLedgerEntry,
        ...payload,
      });
      showActionSuccessToast(`Updated ledger entry ${payload.refNumber}`);
    } else {
      await onAddLedgerEntry(payload);
      showActionSuccessToast(`Added ledger entry ${payload.refNumber}`);
    }
    setShowLedgerModal(false);
  };

  const handleConfirmDeleteLedgerEntry = async (mov: StockMovementEntry) => {
    if (!isSuperAdmin) return;
    const result = await yellowCabSwal.fire({
      icon: 'warning',
      title: 'Delete Ledger Entry?',
      html: `<div style="font-size:13px;">Remove <strong>${mov.refNumber}</strong> (${mov.description}) from the Stock Movement Ledger?</div>`,
      showCancelButton: true,
      confirmButtonText: 'Delete Entry',
      cancelButtonText: 'Cancel',
    });
    if (result.isConfirmed) {
      await onDeleteLedgerEntry(mov.id);
      showActionSuccessToast(`Deleted ledger entry ${mov.refNumber}`);
    }
  };

  const formatMovementBadge = (type: StockMovementType) => {
    switch (type) {
      case 'STOCK_IN':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
            In
          </span>
        );
      case 'STOCK_OUT':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-50 text-rose-700 border border-rose-200">
            Out
          </span>
        );
      case 'TRANSFER_IN':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-50 text-amber-800 border border-amber-300">
            Trf In
          </span>
        );
      case 'TRANSFER_OUT':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-zinc-100 text-zinc-800 border border-zinc-300">
            Trf Out
          </span>
        );
    }
  };

  const formatLedgerStatusBadge = (mov: StockMovementEntry) => {
    const resolved = getLedgerEntryStatus(mov);
    switch (resolved.status) {
      case 'CANCELLED':
        return (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black uppercase bg-rose-100 text-rose-800 border border-rose-300"
            title={resolved.detail || 'Cancelled'}
          >
            <X className="w-3 h-3" /> {resolved.label}
          </span>
        );
      case 'PENDING':
        return (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black uppercase bg-amber-100 text-amber-900 border border-amber-300"
            title={resolved.detail || 'Pending'}
          >
            <Clock className="w-3 h-3" /> {resolved.label}
          </span>
        );
      case 'RECEIVED':
        return (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-300"
            title={resolved.detail || 'Received'}
          >
            <CheckCircle2 className="w-3 h-3" /> {resolved.label}
          </span>
        );
      case 'COMPLETED':
      default:
        return (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-50 text-emerald-800 border border-emerald-200"
            title={resolved.detail || 'Completed'}
          >
            <Check className="w-3 h-3" /> {resolved.label}
          </span>
        );
    }
  };

  return (
    <div className="space-y-3">
      <datalist id="warehouse-item-code-list">
        {itemModalReferences
          .filter((r) => Boolean(r.itemCode))
          .map((r) => (
            <option key={`item-code-${r.itemCode}-${r.description}`} value={r.itemCode}>
              {r.description}
            </option>
          ))}
      </datalist>
      <datalist id="warehouse-item-desc-list">
        {itemModalReferences.map((r) => (
          <option key={`item-desc-${r.description}-${r.itemCode}`} value={r.description}>
            {r.itemCode ? `${r.itemCode} · ${r.category}` : r.category}
          </option>
        ))}
      </datalist>
      {/* Compact Single-Row Top Toolbar */}
      <div className="bg-white rounded-xl border border-zinc-200 px-4 py-2.5 shadow-2xs flex flex-col xl:flex-row xl:items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-3 min-w-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-zinc-950 text-amber-400 flex items-center justify-center shrink-0">
              <Package className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-black uppercase tracking-tight text-zinc-950">
              Warehouse & STR
            </h2>
          </div>

          <div className="hidden sm:block h-4 w-px bg-zinc-200" />

          {/* Sub-navigation Tabs inline */}
          <div className="flex flex-wrap items-center gap-1 bg-zinc-100 p-0.5 rounded-lg">
            <button
              type="button"
              onClick={() => setSubTab('inventory')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                subTab === 'inventory'
                  ? 'bg-zinc-950 text-amber-400 shadow-2xs'
                  : 'text-zinc-600 hover:text-zinc-950'
              }`}
            >
              Stock Items
              <span className="font-mono text-[10px] opacity-80 tabular-nums">
                ({monitoredInventoryItems.length})
              </span>
            </button>
            <button
              type="button"
              onClick={() => setSubTab('str')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                subTab === 'str'
                  ? 'bg-zinc-950 text-amber-400 shadow-2xs'
                  : 'text-zinc-600 hover:text-zinc-950'
              }`}
            >
              STR Transfers
              <span className="font-mono text-[10px] opacity-80 tabular-nums">
                ({stockTransfers.length})
              </span>
              {pendingTransfersCount > 0 && (
                <span className="px-1.5 py-0.5 rounded bg-amber-400 text-zinc-950 font-mono text-[9.5px] font-black tabular-nums">
                  {pendingTransfersCount} Pending
                </span>
              )}
            </button>
            {canViewLedger && (
              <button
                type="button"
                onClick={() => setSubTab('ledger')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                  subTab === 'ledger'
                    ? 'bg-zinc-950 text-amber-400 shadow-2xs'
                    : 'text-zinc-600 hover:text-zinc-950'
                }`}
              >
                Ledger
                <span className="font-mono text-[10px] opacity-80 tabular-nums">
                  ({stockMovements.length})
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Right Action Buttons */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowCategoryModal(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border border-zinc-300 text-xs font-bold whitespace-nowrap cursor-pointer transition-colors"
          >
            <FolderCog className="w-3.5 h-3.5 text-zinc-600" />
            Categories ({categories.length})
          </button>

          <button
            type="button"
            onClick={handleCopyGoogleSheetTsv}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white hover:bg-zinc-50 text-zinc-700 border border-zinc-300 text-xs font-bold whitespace-nowrap cursor-pointer transition-colors"
            title="Copy STR rows as TSV for Google Sheets"
          >
            <ClipboardCopy className="w-3.5 h-3.5 text-amber-600" />
            <span className="hidden sm:inline">Copy Sheet</span>
          </button>

          <button
            type="button"
            onClick={() => handleExportGoogleSheetXlsx()}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold whitespace-nowrap cursor-pointer transition-colors"
            title="Export STR Transfers to Excel"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            STR .xlsx
          </button>

          {isSuperAdmin && (
            <>
              <button
                type="button"
                onClick={handleExportStockItemsXlsx}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold whitespace-nowrap cursor-pointer transition-colors"
                title="Export Stock Items to Excel (Super Admin)"
              >
                <Download className="w-3.5 h-3.5 text-amber-400" />
                Export Stock
              </button>
              <button
                type="button"
                onClick={handleOpenImportModal}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-amber-400 border border-zinc-950 text-xs font-bold whitespace-nowrap cursor-pointer transition-colors"
                title="Import Excel/CSV for Quick Add Stock Items (Super Admin)"
              >
                <Upload className="w-3.5 h-3.5" />
                Import Stock
              </button>
              {onAutoFillMissingCodes && fillableMissingCodeCount > 0 && (
                <button
                  type="button"
                  disabled={isAutoFillingCodes}
                  onClick={handleBatchAutoFillMissingCodes}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-zinc-950 border border-amber-400 text-xs font-bold whitespace-nowrap cursor-pointer transition-colors disabled:opacity-50"
                  title="Automatically fill missing item codes from matching Stock Items & catalog"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-600" />
                  {isAutoFillingCodes
                    ? 'Filling Codes...'
                    : `Auto-Fill Codes (${fillableMissingCodeCount})`}
                </button>
              )}
            </>
          )}

          <button
            type="button"
            onClick={handleOpenAddItemModal}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 border border-zinc-950 text-xs font-black whitespace-nowrap cursor-pointer transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Item
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: STOCK ITEMS & BALANCES                                         */}
      {/* ===================================================================== */}
      {subTab === 'inventory' && (
        <div className="bg-white rounded-xl border border-zinc-200 shadow-2xs overflow-hidden">
          {/* Compact Filter Strip */}
          <div className="px-3.5 py-2.5 border-b border-zinc-200 bg-zinc-50/70 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <div className="relative flex-1 min-w-[160px] w-full sm:w-auto sm:max-w-xs">
                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search code, item, batch..."
                  className="w-full pl-8 pr-2.5 py-1.5 rounded-lg border border-zinc-300 bg-white text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>

              <select
                value={branchFilter}
                onChange={(e) => {
                  setBranchFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full sm:w-auto px-2.5 py-1.5 rounded-lg border border-zinc-300 bg-white text-xs font-bold text-zinc-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                <option value="ALL">All 6 Warehouse Branches</option>
                {WAREHOUSE_BRANCHES.map((b) => (
                  <option key={b.code} value={b.code}>
                    {b.name} ({b.code} · {b.strPrefix})
                  </option>
                ))}
              </select>

              <select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full sm:w-auto sm:max-w-[230px] px-2.5 py-1.5 rounded-lg border border-zinc-300 bg-white text-xs font-bold text-zinc-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                <option value="ALL">All Categories ({categoryOptions.length})</option>
                {categoryOptions.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>

              <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-zinc-300 bg-white text-xs font-semibold text-zinc-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={inStockOnly}
                  onChange={(e) => {
                    setInStockOnly(e.target.checked);
                    setCurrentPage(1);
                  }}
                  className="accent-amber-500"
                />
                In Stock Only
              </label>

              <button
                type="button"
                onClick={() => {
                  setLowStockOnly((prev) => !prev);
                  setCurrentPage(1);
                }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-bold cursor-pointer transition-colors ${
                  lowStockOnly
                    ? 'bg-rose-600 text-white border-rose-700'
                    : activeScopeLowStockCount > 0
                    ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-300'
                    : 'bg-white text-zinc-500 border-zinc-300'
                }`}
                title="Show items where quantity is below reorder level"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                Low Stock
                <span className="font-mono text-[11px] tabular-nums">
                  ({activeScopeLowStockCount})
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setNearExpiryOnly((prev) => !prev);
                  setCurrentPage(1);
                }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-bold cursor-pointer transition-colors ${
                  nearExpiryOnly
                    ? 'bg-amber-600 text-white border-amber-700'
                    : activeScopeNearExpiryCount > 0
                    ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300'
                    : 'bg-white text-zinc-500 border-zinc-300'
                }`}
                title={`Show items expired or expiring within ${NEAR_EXPIRY_THRESHOLD_DAYS} days`}
              >
                <CalendarClock className="w-3.5 h-3.5" />
                Near Expiry
                <span className="font-mono text-[11px] tabular-nums">
                  ({activeScopeNearExpiryCount})
                </span>
              </button>
            </div>

            <div className="text-[11px] font-mono text-zinc-500 tabular-nums">
              Showing {filteredInventory.length.toLocaleString()} item(s)
            </div>
          </div>

          {/* Per-Branch Low Stock Alert Strip */}
          {totalLowStockCount > 0 && (
            <div className="px-3.5 py-2 border-b border-rose-200 bg-rose-50/80 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wide text-rose-700 mr-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Low Stock Alerts:
                </span>
                {lowStockByBranch
                  .filter((b) => b.count > 0)
                  .map((b) => {
                    const isActive = branchFilter === b.code && lowStockOnly;
                    return (
                      <button
                        key={b.code}
                        type="button"
                        onClick={() => {
                          if (isActive) {
                            setLowStockOnly(false);
                          } else {
                            setBranchFilter(b.code);
                            setLowStockOnly(true);
                            setNearExpiryOnly(false);
                            setInStockOnly(false);
                          }
                          setCurrentPage(1);
                        }}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] font-bold cursor-pointer transition-colors ${
                          isActive
                            ? 'bg-rose-600 text-white border-rose-700'
                            : 'bg-white hover:bg-rose-100 text-rose-800 border-rose-200'
                        }`}
                      >
                        <span>{b.name}</span>
                        <span className="font-mono tabular-nums">({b.count})</span>
                      </button>
                    );
                  })}
              </div>

              {lowStockOnly && (
                <button
                  type="button"
                  onClick={() => {
                    setLowStockOnly(false);
                    setCurrentPage(1);
                  }}
                  className="text-[11px] font-bold text-rose-700 hover:text-rose-950 underline cursor-pointer"
                >
                  Clear Low Stock Filter
                </button>
              )}
            </div>
          )}

          {/* Per-Branch Near Expiry & Expired Alert Strip */}
          {totalNearExpiryCount > 0 && (
            <div className="px-3.5 py-2 border-b border-amber-200 bg-amber-50/90 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wide text-amber-900 mr-1">
                  <CalendarClock className="w-3.5 h-3.5 text-amber-700" />
                  Near Expiry Alerts (≤{NEAR_EXPIRY_THRESHOLD_DAYS}d):
                </span>
                {totalExpiredCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded bg-rose-600 text-white text-[10px] font-black uppercase tracking-wider">
                    {totalExpiredCount} Expired
                  </span>
                )}
                {nearExpiryByBranch
                  .filter((b) => b.count > 0)
                  .map((b) => {
                    const isActive = branchFilter === b.code && nearExpiryOnly;
                    return (
                      <button
                        key={`exp-${b.code}`}
                        type="button"
                        onClick={() => {
                          if (isActive) {
                            setNearExpiryOnly(false);
                          } else {
                            setBranchFilter(b.code);
                            setNearExpiryOnly(true);
                            setLowStockOnly(false);
                            setInStockOnly(false);
                          }
                          setCurrentPage(1);
                        }}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] font-bold cursor-pointer transition-colors ${
                          isActive
                            ? 'bg-amber-600 text-white border-amber-700'
                            : b.expiredCount > 0
                            ? 'bg-white hover:bg-rose-50 text-rose-800 border-rose-300'
                            : 'bg-white hover:bg-amber-100 text-amber-900 border-amber-300'
                        }`}
                      >
                        <span>{b.name}</span>
                        <span className="font-mono tabular-nums">({b.count})</span>
                      </button>
                    );
                  })}
              </div>

              <div className="flex items-center gap-2">
                {!nearExpiryOnly && (
                  <button
                    type="button"
                    onClick={() => {
                      setNearExpiryOnly(true);
                      setLowStockOnly(false);
                      setCurrentPage(1);
                    }}
                    className="text-[11px] font-black text-amber-900 hover:text-zinc-950 underline cursor-pointer"
                  >
                    Filter Near Expiry
                  </button>
                )}
                {nearExpiryOnly && (
                  <button
                    type="button"
                    onClick={() => {
                      setNearExpiryOnly(false);
                      setCurrentPage(1);
                    }}
                    className="text-[11px] font-bold text-amber-900 hover:text-zinc-950 underline cursor-pointer"
                  >
                    Clear Near Expiry Filter
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Empty State */}
          {filteredInventory.length === 0 ? (
            <div className="p-8 text-center space-y-2.5">
              <div className="text-sm font-bold text-zinc-800">
                No stock items match your current filter
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {branchFilter !== 'ALL' && (
                  <button
                    type="button"
                    disabled={isSeedingBranch}
                    onClick={async () => {
                      setIsSeedingBranch(true);
                      try {
                        await onSeedBranchCatalog(branchFilter as WarehouseBranchCode);
                        showActionSuccessToast(
                          `Loaded default catalog to ${getBranchByCode(branchFilter)?.name}`
                        );
                      } finally {
                        setIsSeedingBranch(false);
                      }
                    }}
                    className="px-3.5 py-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 text-amber-400 text-xs font-bold cursor-pointer disabled:opacity-50"
                  >
                    {isSeedingBranch
                      ? 'Loading Catalog...'
                      : `Load Default Catalog to ${getBranchByCode(branchFilter)?.name}`}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleOpenAddItemModal}
                  className="px-3.5 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 border border-zinc-950 text-xs font-black cursor-pointer"
                >
                  + Add New Item
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Mobile Stock Item Cards */}
              <div className="md:hidden divide-y divide-zinc-200">
                {paginatedInventory.map((item) => {
                  const reorderLevel = getItemReorderLevel(item);
                  const isLow = isItemLowStock(item);
                  const expiryInfo = evaluateItemExpiry(item);
                  const isExpired = expiryInfo.isAlertActive && expiryInfo.status === 'EXPIRED';
                  const isNearExp = expiryInfo.isAlertActive && expiryInfo.status === 'NEAR_EXPIRY';
                  return (
                    <div
                      key={`mob-${item.id}`}
                      className={`p-3.5 space-y-2.5 ${
                        isLow || isExpired
                          ? 'bg-rose-50/75'
                          : isNearExp
                          ? 'bg-amber-50/75'
                          : 'bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-mono text-[10px] font-bold text-zinc-500">
                              {item.itemCode || 'NO CODE'}
                            </span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-700 border border-zinc-200">
                              {item.category}
                            </span>
                            {isLow && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-rose-600 text-white text-[9px] font-black uppercase tracking-wider">
                                <AlertTriangle className="w-2.5 h-2.5" /> Low
                              </span>
                            )}
                            {expiryInfo.isAlertActive && (
                              <span
                                className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                                  isExpired
                                    ? 'bg-rose-700 text-white'
                                    : 'bg-amber-500 text-zinc-950'
                                }`}
                              >
                                <CalendarClock className="w-2.5 h-2.5" /> {expiryInfo.label}
                              </span>
                            )}
                          </div>
                          <div className="font-bold text-sm text-zinc-950 mt-0.5 break-words">
                            {item.description}
                          </div>
                          <div className="text-[11px] text-zinc-600 mt-0.5">
                            <span className="font-bold text-zinc-800">{item.branchName}</span>{' '}
                            <span className="font-mono text-[10px] text-zinc-400">
                              ({item.branchCode})
                            </span>
                            {item.batchNo ? ` · Batch ${item.batchNo}` : ''}
                            {expiryInfo.expiryDate ? ` · Exp ${expiryInfo.expiryDate}` : ''}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-[10px] font-black uppercase text-zinc-400">
                            On Hand
                          </div>
                          <div
                            className={`font-mono text-base font-black tabular-nums ${
                              isLow
                                ? 'text-rose-700'
                                : item.quantity > 0
                                ? 'text-zinc-950'
                                : 'text-zinc-400'
                            }`}
                          >
                            {Number(item.quantity).toLocaleString()}
                          </div>
                          <div className="text-[10px] font-semibold text-zinc-500">{item.uom}</div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-200/80">
                        <div className="text-[11px] text-zinc-600 flex items-center gap-1.5">
                          <span className="font-bold uppercase text-[10px] text-zinc-500">
                            Min:
                          </span>
                          {editingMinItemId === item.id ? (
                            <div className="inline-flex items-center gap-1">
                              <input
                                type="number"
                                min={0}
                                step="1"
                                autoFocus
                                value={editingMinVal}
                                onChange={(e) => setEditingMinVal(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleSaveInlineMin(item);
                                  } else if (e.key === 'Escape') {
                                    setEditingMinItemId(null);
                                  }
                                }}
                                className="w-14 px-1.5 py-0.5 rounded border border-amber-400 bg-white font-mono text-[11px] font-bold text-right text-zinc-950 focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveInlineMin(item)}
                                className="p-1 rounded bg-emerald-600 text-white hover:bg-emerald-500 cursor-pointer"
                                title="Save Min"
                              >
                                <Check className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingMinItemId(null)}
                                className="p-1 rounded bg-zinc-200 text-zinc-700 hover:bg-zinc-300 cursor-pointer"
                                title="Cancel"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingMinItemId(item.id);
                                setEditingMinVal(String(reorderLevel));
                              }}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-100 hover:bg-amber-100 text-zinc-800 font-mono text-[11px] font-bold cursor-pointer"
                              title="Tap to set Min reorder level"
                            >
                              <span>{reorderLevel}</span>
                              <Pencil className="w-2.5 h-2.5 text-zinc-500" />
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          {isSuperAdmin && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenAdjustModal(item, 'STOCK_IN')}
                                className="px-2.5 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[11px] font-bold whitespace-nowrap cursor-pointer"
                              >
                                + In
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenAdjustModal(item, 'STOCK_OUT')}
                                className="px-2.5 py-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-[11px] font-bold whitespace-nowrap cursor-pointer"
                              >
                                - Out
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => handleOpenEditItemModal(item)}
                            className="p-1.5 rounded border border-zinc-200 hover:bg-zinc-100 text-zinc-700 cursor-pointer"
                            title="Edit Stock Item"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleConfirmDeleteItem(item)}
                            className="p-1.5 rounded border border-rose-200 hover:bg-rose-100 text-rose-600 cursor-pointer"
                            title="Delete Stock Item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Stock Items Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-zinc-950 text-amber-400 uppercase text-[10px] tracking-wider">
                      <th className="px-3 py-2 font-black w-24">Code</th>
                      <th className="px-3 py-2 font-black">Stock Item</th>
                      <th className="px-3 py-2 font-black">Category</th>
                      <th className="px-3 py-2 font-black">Branch</th>
                      <th className="px-3 py-2 font-black">Batch / Exp</th>
                      <th className="px-3 py-2 font-black text-center">UOM</th>
                      <th className="px-3 py-2 font-black text-right">Min</th>
                      <th className="px-3 py-2 font-black text-right">Qty</th>
                      <th className="px-3 py-2 font-black text-right w-40">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {paginatedInventory.map((item) => {
                      const reorderLevel = getItemReorderLevel(item);
                      const isLow = isItemLowStock(item);
                      const expiryInfo = evaluateItemExpiry(item);
                      const isExpired = expiryInfo.isAlertActive && expiryInfo.status === 'EXPIRED';
                      const isNearExp = expiryInfo.isAlertActive && expiryInfo.status === 'NEAR_EXPIRY';
                      return (
                        <tr
                          key={item.id}
                          className={`transition-colors ${
                            isLow || isExpired
                              ? 'bg-rose-50/75 hover:bg-rose-100/60'
                              : isNearExp
                              ? 'bg-amber-50/70 hover:bg-amber-100/60'
                              : 'hover:bg-amber-50/40'
                          }`}
                        >
                          <td className="px-3 py-2 font-mono text-[11px] text-zinc-500 whitespace-nowrap">
                            {item.itemCode || '—'}
                          </td>
                          <td className="px-3 py-2 font-semibold text-zinc-900">
                            <div className="flex items-center gap-1.5">
                              {isLow && (
                                <span
                                  className="inline-flex shrink-0"
                                  title={`Below reorder level (${reorderLevel})`}
                                >
                                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                                </span>
                              )}
                              {!isLow && expiryInfo.isAlertActive && (
                                <span
                                  className="inline-flex shrink-0"
                                  title={expiryInfo.label}
                                >
                                  <CalendarClock
                                    className={`w-3.5 h-3.5 ${
                                      isExpired ? 'text-rose-600' : 'text-amber-600'
                                    }`}
                                  />
                                </span>
                              )}
                              <span>{item.description}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-[11px] font-medium text-zinc-600 whitespace-nowrap">
                            {item.category}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <span className="font-bold text-zinc-800">{item.branchName}</span>
                            <span className="ml-1 font-mono text-[10px] text-zinc-400">
                              {item.branchCode}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-mono text-[11px] text-zinc-600 whitespace-nowrap">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span>
                                {item.batchNo || expiryInfo.expiryDate || '—'}
                              </span>
                              {item.batchNo &&
                                expiryInfo.expiryDate &&
                                item.expiryDate &&
                                item.batchNo !== item.expiryDate && (
                                  <span className="text-[10px] text-zinc-500">
                                    ({expiryInfo.expiryDate})
                                  </span>
                                )}
                              {expiryInfo.isAlertActive && (
                                <span
                                  className={`px-1.5 py-0.5 rounded font-sans text-[9px] font-black uppercase tracking-wider ${
                                    isExpired
                                      ? 'bg-rose-600 text-white'
                                      : 'bg-amber-500 text-zinc-950'
                                  }`}
                                >
                                  {expiryInfo.label}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-center font-semibold text-zinc-700 whitespace-nowrap">
                            {item.uom}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-[11px] text-zinc-600 tabular-nums whitespace-nowrap">
                            {editingMinItemId === item.id ? (
                              <div className="inline-flex items-center gap-1 justify-end">
                                <input
                                  type="number"
                                  min={0}
                                  step="1"
                                  autoFocus
                                  value={editingMinVal}
                                  onChange={(e) => setEditingMinVal(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleSaveInlineMin(item);
                                    } else if (e.key === 'Escape') {
                                      setEditingMinItemId(null);
                                    }
                                  }}
                                  className="w-12 px-1.5 py-0.5 rounded border border-amber-400 bg-white font-mono text-[11px] font-bold text-right text-zinc-950 focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSaveInlineMin(item)}
                                  className="p-0.5 rounded bg-emerald-600 text-white hover:bg-emerald-500 cursor-pointer"
                                  title="Save Min"
                                >
                                  <Check className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingMinItemId(null)}
                                  className="p-0.5 rounded bg-zinc-200 text-zinc-700 hover:bg-zinc-300 cursor-pointer"
                                  title="Cancel"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingMinItemId(item.id);
                                  setEditingMinVal(String(reorderLevel));
                                }}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-amber-100 text-zinc-700 hover:text-zinc-950 font-mono text-[11px] font-bold cursor-pointer group"
                                title="Click to set Min reorder level"
                              >
                                <span>{reorderLevel}</span>
                                <Pencil className="w-2.5 h-2.5 text-zinc-400 group-hover:text-zinc-900" />
                              </button>
                            )}
                          </td>
                          <td
                            className={`px-3 py-2 text-right font-mono font-black tabular-nums whitespace-nowrap ${
                              isLow
                                ? 'text-rose-700'
                                : item.quantity > 0
                                ? 'text-zinc-950'
                                : 'text-zinc-400'
                            }`}
                          >
                            <div className="inline-flex items-center justify-end gap-1.5">
                              {isLow && (
                                <span className="px-1.5 py-0.5 rounded bg-rose-600 text-white text-[9px] font-black uppercase tracking-wider">
                                  Low
                                </span>
                              )}
                              <span>{Number(item.quantity).toLocaleString()}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1">
                              {isSuperAdmin && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenAdjustModal(item, 'STOCK_IN')}
                                    className="px-2 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-bold cursor-pointer"
                                    title="Stock In (Super Admin)"
                                  >
                                    + In
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenAdjustModal(item, 'STOCK_OUT')}
                                    className="px-2 py-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-[10px] font-bold cursor-pointer"
                                    title="Stock Out (Super Admin)"
                                  >
                                    - Out
                                  </button>
                                </>
                              )}
                              <button
                                type="button"
                                onClick={() => handleOpenEditItemModal(item)}
                                className="p-1 rounded hover:bg-zinc-200 text-zinc-600 hover:text-zinc-950 cursor-pointer"
                                title="Edit Stock Item"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleConfirmDeleteItem(item)}
                                className="p-1 rounded hover:bg-rose-100 text-zinc-400 hover:text-rose-700 cursor-pointer"
                                title="Delete Stock Item"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Compact Pagination Bar */}
              {totalPages > 1 && (
                <div className="px-3.5 py-2 border-t border-zinc-200 bg-zinc-50 flex items-center justify-between text-xs">
                  <span className="text-zinc-500 font-mono text-[11px] tabular-nums">
                    Page {safePage} of {totalPages} · {(safePage - 1) * ITEMS_PER_PAGE + 1}–
                    {Math.min(safePage * ITEMS_PER_PAGE, filteredInventory.length)} of{' '}
                    {filteredInventory.length}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={safePage <= 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className="p-1.5 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-100 disabled:opacity-40 cursor-pointer"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={safePage >= totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      className="p-1.5 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-100 disabled:opacity-40 cursor-pointer"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: STOCK TRANSFER REQUISITION (STR)                               */}
      {/* ===================================================================== */}
      {subTab === 'str' && (
        <div className="space-y-4">
          <form
            onSubmit={handleSubmitStr}
            className="bg-white rounded-xl border border-zinc-200 shadow-2xs overflow-hidden"
          >
            <div className="px-4 py-2.5 bg-zinc-950 text-white flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-amber-400">
                New Stock Transfer Requisition (STR)
              </span>
              <div className="flex items-center gap-1 text-[11px]">
                <span className="text-zinc-400">STR Prefix:</span>
                <button
                  type="button"
                  onClick={() => {
                    setPrefixBasis('FROM');
                    refreshStrNumbers(fromBranchCode, toBranchCode, 'FROM', strDate);
                  }}
                  className={`px-2 py-0.5 rounded font-bold cursor-pointer ${
                    prefixBasis === 'FROM'
                      ? 'bg-amber-400 text-zinc-950'
                      : 'bg-zinc-800 text-zinc-300'
                  }`}
                >
                  From Branch
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPrefixBasis('TO');
                    refreshStrNumbers(fromBranchCode, toBranchCode, 'TO', strDate);
                  }}
                  className={`px-2 py-0.5 rounded font-bold cursor-pointer ${
                    prefixBasis === 'TO'
                      ? 'bg-amber-400 text-zinc-950'
                      : 'bg-zinc-800 text-zinc-300'
                  }`}
                >
                  To Branch
                </button>
              </div>
            </div>

            <div className="p-4 space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase text-zinc-600 mb-1">
                    From Branch (Issuing)
                  </label>
                  <select
                    value={fromBranchCode}
                    onChange={(e) => {
                      const nextFrom = e.target.value as WarehouseBranchCode;
                      setFromBranchCode(nextFrom);
                      refreshStrNumbers(nextFrom, toBranchCode, prefixBasis, strDate);
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-300 text-xs font-bold text-zinc-950 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  >
                    <optgroup label="Warehouse Branches (Monitored)">
                      {WAREHOUSE_BRANCHES.map((b) => (
                        <option key={b.code} value={b.code}>
                          {b.name} ({b.strPrefix})
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Store Branches">
                      {STORE_BRANCHES.map((b) => (
                        <option key={b.code} value={b.code}>
                          {b.name} ({b.strPrefix})
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-zinc-600 mb-1">
                    Requesting Branch (To)
                  </label>
                  <select
                    value={toBranchCode}
                    onChange={(e) => {
                      const nextTo = e.target.value as WarehouseBranchCode;
                      setToBranchCode(nextTo);
                      refreshStrNumbers(fromBranchCode, nextTo, prefixBasis, strDate);
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-300 text-xs font-bold text-zinc-950 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  >
                    <optgroup label="Warehouse Branches (Monitored)">
                      {WAREHOUSE_BRANCHES.map((b) => (
                        <option key={b.code} value={b.code}>
                          {b.name} ({b.strPrefix})
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Store Branches">
                      {STORE_BRANCHES.map((b) => (
                        <option key={b.code} value={b.code}>
                          {b.name} ({b.strPrefix})
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-zinc-600 mb-1">
                    STR Ref #
                  </label>
                  <input
                    type="text"
                    required
                    value={strRefInput}
                    onChange={(e) => setStrRefInput(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-300 bg-amber-50/40 font-mono text-xs font-black text-zinc-950 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-zinc-600 mb-1">
                    Transfer #
                  </label>
                  <input
                    type="text"
                    required
                    value={transferNumInput}
                    onChange={(e) => setTransferNumInput(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-300 font-mono text-xs font-bold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-zinc-600 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    required
                    value={strDate}
                    onChange={(e) => {
                      setStrDate(e.target.value);
                      setTransferNumInput(
                        generateNextTransferNumber(e.target.value, stockTransfers)
                      );
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-300 font-mono text-xs font-bold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
              </div>

              {/* Line Items */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase text-zinc-700">
                    Line Items ({lineItems.length})
                  </span>
                  <button
                    type="button"
                    onClick={handleAddLineRow}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-950 hover:bg-zinc-800 text-amber-400 text-[11px] font-bold cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> Add Line
                  </button>
                </div>

                <datalist id="str-item-code-list">
                  {(isMonitoredWarehouseBranch(fromBranchCode)
                    ? issuingBranchStock
                        .filter((s) => Boolean(s.itemCode) && (Number(s.quantity) || 0) > 0)
                        .map((s) => (
                          <option key={`str-code-${s.id}`} value={s.itemCode}>
                            {s.description} ({s.quantity} {s.uom})
                          </option>
                        ))
                    : strReferences
                        .filter((r) => Boolean(r.itemCode))
                        .map((r) => (
                          <option key={`str-code-${r.itemCode}-${r.description}`} value={r.itemCode}>
                            {r.description}
                          </option>
                        )))}
                </datalist>

                {/* Mobile STR Line Items Cards */}
                <div className="md:hidden space-y-2.5">
                  {lineItems.map((line, idx) => {
                    const matchedStock =
                      issuingBranchStock.find((s) => s.id === line.itemId) ||
                      (line.itemCode
                        ? issuingBranchStock.find(
                            (s) =>
                              (s.itemCode || '').trim().toLowerCase() ===
                              (line.itemCode || '').trim().toLowerCase()
                          )
                        : undefined) ||
                      (line.description
                        ? issuingBranchStock.find(
                            (s) =>
                              (s.description || '').toLowerCase() === (line.description || '').toLowerCase() &&
                              (s.batchNo || '').toLowerCase() === (line.batchNo || '').toLowerCase()
                          )
                        : undefined);
                    const isLineLowStock = matchedStock ? isItemLowStock(matchedStock) : false;

                    return (
                      <div
                        key={`mob-line-${line.id}`}
                        className="p-3 rounded-lg border border-zinc-200 bg-zinc-50/70 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-[11px] font-black text-zinc-500">
                            Line #{idx + 1}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenItemPicker(idx)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-950 hover:bg-zinc-800 text-amber-400 text-[11px] font-bold whitespace-nowrap cursor-pointer"
                            >
                              <Search className="w-3 h-3" />
                              {line.description ? 'Change Item' : 'Search Item'}
                            </button>
                            <button
                              type="button"
                              disabled={lineItems.length <= 1}
                              onClick={() => handleRemoveLineRow(idx)}
                              className="p-1.5 rounded border border-zinc-200 bg-white text-zinc-400 hover:text-rose-600 disabled:opacity-30 cursor-pointer"
                              title="Remove line"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {line.description ? (
                          <div className="bg-white rounded-md border border-zinc-200 px-2.5 py-1.5">
                            <div className="font-bold text-xs text-zinc-950 break-words">
                              {line.description}
                            </div>
                            <div className="text-[10px] font-mono text-zinc-500">
                              {line.itemCode ? `Code ${line.itemCode} · ` : ''}
                              {line.category}
                              {line.batchNo ? ` · Batch ${line.batchNo}` : ''}
                            </div>
                          </div>
                        ) : (
                          <div className="text-[11px] text-zinc-400 italic">
                            Enter Item Code or tap Search Item
                          </div>
                        )}

                        <div className="grid grid-cols-3 gap-2 items-start">
                          <div>
                            <label className="block text-[9px] font-black uppercase text-zinc-500 mb-0.5">
                              Item Code
                            </label>
                            <input
                              type="text"
                              list="str-item-code-list"
                              value={line.itemCode || ''}
                              onChange={(e) => handleStrLineCodeChange(idx, e.target.value)}
                              placeholder="01-0601"
                              className="w-full px-2 py-1.5 rounded-lg border border-zinc-300 bg-white font-mono text-[11px] font-bold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-black uppercase text-zinc-500 mb-0.5">
                              UOM
                            </label>
                            <div className="w-full px-2 py-1.5 rounded-lg border border-zinc-200 bg-zinc-100 text-xs font-bold text-zinc-800 text-center">
                              {matchedStock?.uom || (line.description ? line.uom : '—')}
                            </div>
                          </div>
                          <div>
                            <label className="block text-[9px] font-black uppercase text-zinc-500 mb-0.5">
                              Qty
                            </label>
                            <input
                              type="number"
                              min={1}
                              step="1"
                              required
                              value={line.quantity}
                              onChange={(e) =>
                                handleUpdateLineItem(
                                  idx,
                                  'quantity',
                                  Number(e.target.value) || 0
                                )
                              }
                              className="w-full px-2 py-1.5 rounded-lg border border-zinc-300 bg-white font-mono text-xs font-black text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-amber-400"
                            />
                            {matchedStock && (
                              <div
                                className={`text-[10px] font-mono text-right mt-0.5 ${
                                  isLineLowStock ? 'text-rose-600 font-bold' : 'text-zinc-500'
                                }`}
                              >
                                Bal: {matchedStock.quantity}
                                {isLineLowStock ? ' (LOW)' : ''}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop STR Line Items Table */}
                <div className="hidden md:block overflow-x-auto border border-zinc-200 rounded-lg">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-zinc-100 text-zinc-700 uppercase text-[10px] font-black">
                        <th className="px-3 py-1.5 w-10 text-center">#</th>
                        <th className="px-2 py-1.5 w-28">Item Code</th>
                        <th className="px-3 py-1.5">Pick Item</th>
                        <th className="px-3 py-1.5 w-28">UOM</th>
                        <th className="px-3 py-1.5 w-28 text-right">Qty</th>
                        <th className="px-3 py-1.5 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200">
                      {lineItems.map((line, idx) => {
                        const matchedStock =
                          issuingBranchStock.find((s) => s.id === line.itemId) ||
                          (line.itemCode
                            ? issuingBranchStock.find(
                                (s) =>
                                  (s.itemCode || '').trim().toLowerCase() ===
                                  (line.itemCode || '').trim().toLowerCase()
                              )
                            : undefined) ||
                          (line.description
                            ? issuingBranchStock.find(
                                (s) =>
                                  (s.description || '').toLowerCase() ===
                                    (line.description || '').toLowerCase() &&
                                  (s.batchNo || '').toLowerCase() ===
                                    (line.batchNo || '').toLowerCase()
                              )
                            : undefined);
                        const isLineLowStock = matchedStock
                          ? isItemLowStock(matchedStock)
                          : false;

                        return (
                          <tr key={line.id}>
                            <td className="px-3 py-2 text-center font-mono text-[11px] text-zinc-400">
                              {idx + 1}
                            </td>
                            <td className="p-1.5">
                              <input
                                type="text"
                                list="str-item-code-list"
                                value={line.itemCode || ''}
                                onChange={(e) => handleStrLineCodeChange(idx, e.target.value)}
                                placeholder="e.g. 01-0601"
                                className="w-full px-2 py-1.5 rounded-lg border border-zinc-300 font-mono text-[11px] font-bold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                              />
                            </td>
                            <td className="p-1.5">
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  {line.description ? (
                                    <div>
                                      <div className="font-bold text-zinc-900 truncate">
                                        {line.description}
                                      </div>
                                      <div className="text-[10px] font-mono text-zinc-500 truncate">
                                        {line.itemCode ? `Code ${line.itemCode} · ` : ''}
                                        {line.category}
                                        {line.batchNo ? ` · Batch ${line.batchNo}` : ''}
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-zinc-400 italic">
                                      Enter Item Code or click Search Item
                                    </span>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleOpenItemPicker(idx)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 text-amber-400 text-[11px] font-bold cursor-pointer shrink-0 transition-colors"
                                >
                                  <Search className="w-3.5 h-3.5" />
                                  {line.description ? 'Change Item' : 'Search Item'}
                                </button>
                              </div>
                            </td>
                            <td className="p-1.5">
                              <div
                                className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-200 bg-zinc-100 text-xs font-bold text-zinc-800 text-center whitespace-nowrap"
                                title="UOM is locked to the stock item's UOM"
                              >
                                {matchedStock?.uom || (line.description ? line.uom : '—')}
                              </div>
                            </td>
                            <td className="p-1.5">
                              <input
                                type="number"
                                min={1}
                                step="1"
                                required
                                value={line.quantity}
                                onChange={(e) =>
                                  handleUpdateLineItem(
                                    idx,
                                    'quantity',
                                    Number(e.target.value) || 0
                                  )
                                }
                                className="w-full px-2 py-1.5 rounded-lg border border-zinc-300 font-mono text-xs font-black text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-amber-400"
                              />
                              {matchedStock && (
                                <div
                                  className={`text-[10px] font-mono text-right mt-0.5 ${
                                    isLineLowStock ? 'text-rose-600 font-bold' : 'text-zinc-500'
                                  }`}
                                >
                                  Bal: {matchedStock.quantity}
                                  {isLineLowStock ? ' (LOW)' : ''}
                                </div>
                              )}
                            </td>
                            <td className="p-1.5 text-center">
                              <button
                                type="button"
                                disabled={lineItems.length <= 1}
                                onClick={() => handleRemoveLineRow(idx)}
                                className="p-1 rounded text-zinc-400 hover:text-rose-600 disabled:opacity-30 cursor-pointer"
                                title="Remove line"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                <div>
                  <label className="block text-[10px] font-black uppercase text-zinc-600 mb-1">
                    Prepared By
                  </label>
                  <input
                    type="text"
                    required
                    value={preparedBy}
                    onChange={(e) => setPreparedBy(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-300 text-xs font-bold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-zinc-600 mb-1">
                    Reviewed By (Super Admin Approval)
                  </label>
                  <input
                    type="text"
                    disabled={!isSuperAdmin}
                    value={isSuperAdmin ? reviewedBy : ''}
                    onChange={(e) => setReviewedBy(e.target.value)}
                    placeholder={
                      isSuperAdmin
                        ? 'Super Admin approval (optional on draft)'
                        : 'Super Admin approval required'
                    }
                    className={`w-full px-2.5 py-1.5 rounded-lg border border-zinc-300 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-amber-400 ${
                      isSuperAdmin
                        ? 'bg-white text-zinc-900'
                        : 'bg-zinc-100 text-zinc-400 cursor-not-allowed'
                    }`}
                  />
                </div>
                <div className="flex flex-col sm:flex-row sm:items-end gap-2">
                  <div className="flex-1">
                    <label className="block text-[10px] font-black uppercase text-zinc-600 mb-1">
                      Remarks
                    </label>
                    <input
                      type="text"
                      value={strRemarks}
                      onChange={(e) => setStrRemarks(e.target.value)}
                      placeholder="Optional note"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-300 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSubmittingStr}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-1.5 h-[32px] rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 border border-zinc-950 text-xs font-black uppercase whitespace-nowrap cursor-pointer shrink-0 disabled:opacity-50"
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                    {isSubmittingStr ? 'Saving...' : 'Submit STR'}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>
                  Submitted STRs stay <strong className="text-zinc-800">PENDING</strong> until a
                  logged-in user marks the STR as <strong className="text-emerald-700">Received</strong>.
                </span>
              </div>
            </div>
          </form>

          {/* Transfer History */}
          <div className="bg-white rounded-xl border border-zinc-200 shadow-2xs overflow-hidden">
            <div className="px-4 py-2.5 border-b border-zinc-200 bg-zinc-50 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-900">
                  STR History ({filteredTransfers.length})
                </span>
                {pendingTransfersCount > 0 && (
                  <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black uppercase">
                    {pendingTransfersCount} Pending Receipt
                  </span>
                )}
              </div>
              <div className="relative w-full sm:w-auto sm:min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={strSearch}
                  onChange={(e) => setStrSearch(e.target.value)}
                  placeholder="Search STR #, branch, item..."
                  className="w-full pl-8 pr-2.5 py-1 rounded-lg border border-zinc-300 bg-white text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
            </div>

            {filteredTransfers.length === 0 ? (
              <div className="p-6 text-center text-xs text-zinc-500">
                No Stock Transfer Requisitions recorded yet.
              </div>
            ) : (
              <>
                {/* Mobile STR History Cards */}
                <div className="md:hidden divide-y divide-zinc-200">
                  {filteredTransfers.map((trf) => {
                    const safeLines = Array.isArray(trf.items) ? trf.items : [];
                    const activeItems = safeLines.filter((i) => i.itemStatus !== 'CANCELLED');
                    const cancelledItemsCount = safeLines.length - activeItems.length;
                    const totalQty = activeItems.reduce(
                      (s, item) => s + (Number(item.quantity) || 0),
                      0
                    );
                    const isPending = trf.status === 'PENDING';
                    const isCancelled = trf.status === 'CANCELLED';
                    const displayItems = activeItems.length > 0 ? activeItems : safeLines;

                    return (
                      <div
                        key={`mob-trf-${trf.id}`}
                        className={`p-3.5 space-y-2.5 ${
                          isCancelled
                            ? 'bg-rose-50/40'
                            : isPending
                            ? 'bg-amber-50/40'
                            : 'bg-white'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-mono font-black text-sm text-zinc-950">
                              {trf.strRefNumber}
                            </div>
                            <div className="font-mono text-[10px] text-zinc-500">
                              {trf.date} · {trf.transferNumber}
                            </div>
                          </div>
                          {isCancelled ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300 text-[10px] font-black uppercase shrink-0">
                              <X className="w-3 h-3" /> Cancelled
                            </span>
                          ) : isPending ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black uppercase shrink-0">
                              <Clock className="w-3 h-3" /> Pending
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-black uppercase shrink-0">
                              <CheckCircle2 className="w-3 h-3" /> Received
                            </span>
                          )}
                        </div>

                        <div className="text-xs font-bold text-zinc-900">
                          {trf.fromBranchName} → {trf.toBranchName}
                        </div>

                        {/* Items block with inline 1/4 STR button */}
                        <div className="p-2.5 rounded-lg bg-zinc-50 border border-zinc-200 flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-semibold text-zinc-900 break-words">
                              {displayItems[0]?.description || '—'}
                              {displayItems.length > 1
                                ? ` (+${displayItems.length - 1})`
                                : ''}
                            </div>
                            <div className="text-[10px] font-mono text-zinc-500 tabular-nums flex flex-wrap items-center gap-1.5 mt-0.5">
                              <span>
                                {activeItems.length} active line(s) · Qty: {totalQty}
                              </span>
                              {cancelledItemsCount > 0 && (
                                <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 border border-rose-200 font-bold">
                                  {cancelledItemsCount} cancelled
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setPrintableTransfer(trf);
                              setIsPrintModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-zinc-950 hover:bg-zinc-800 text-amber-400 text-[10px] font-bold uppercase whitespace-nowrap cursor-pointer shrink-0"
                          >
                            <Printer className="w-3 h-3" /> 1/4 STR
                          </button>
                        </div>

                        <div className="text-[11px] text-zinc-700 space-y-0.5">
                          <div>
                            Prep: <strong>{trf.preparedBy}</strong> · Rev:{' '}
                            {trf.reviewedBy ? (
                              <strong className="text-zinc-900">
                                {trf.reviewedBy}
                                {trf.reviewedAt && (
                                  <span className="ml-1 font-mono font-normal text-[10px] text-zinc-500">
                                    ({formatStrDateTime(trf.reviewedAt)})
                                  </span>
                                )}
                              </strong>
                            ) : (
                              <span className="text-amber-700 italic">
                                Awaiting Super Admin review
                              </span>
                            )}
                          </div>
                          <div>
                            {isCancelled ? (
                              <span className="text-rose-700 font-semibold">
                                Cancelled during Super Admin review
                              </span>
                            ) : isPending ? (
                              <span className="text-amber-700 font-semibold">
                                Recv: Pending receipt confirmation
                              </span>
                            ) : (
                              <span className="text-emerald-800">
                                Recv: <strong>{trf.receivedBy}</strong>
                                {trf.receivedAt && (
                                  <span className="ml-1 font-mono text-[10px] text-zinc-500">
                                    · {formatStrDateTime(trf.receivedAt)}
                                  </span>
                                )}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-end gap-1.5 pt-2 border-t border-zinc-200/80">
                          {isSuperAdmin && isPending && !trf.reviewedBy && (
                            <button
                              type="button"
                              onClick={() => handleConfirmReviewStr(trf)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-400 hover:bg-amber-300 text-zinc-950 border border-zinc-950 text-[10px] font-black uppercase whitespace-nowrap cursor-pointer"
                            >
                              Review Items
                            </button>
                          )}
                          {isPending && (
                            <button
                              type="button"
                              onClick={() => handleConfirmReceiveStr(trf)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase whitespace-nowrap cursor-pointer"
                            >
                              <Check className="w-3 h-3" /> Mark Received
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleExportGoogleSheetXlsx([trf])}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[10px] font-bold whitespace-nowrap cursor-pointer"
                          >
                            <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop STR History Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-zinc-950 text-amber-400 uppercase text-[10px] tracking-wider">
                        <th className="px-3 py-2 font-black">Date</th>
                        <th className="px-3 py-2 font-black">STR Ref #</th>
                        <th className="px-3 py-2 font-black">Status</th>
                        <th className="px-3 py-2 font-black">From → To</th>
                        <th className="px-3 py-2 font-black">Items</th>
                        <th className="px-3 py-2 font-black">Signatories & Receipt Details</th>
                        <th className="px-3 py-2 font-black text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200">
                      {filteredTransfers.map((trf) => {
                        const safeLines = Array.isArray(trf.items) ? trf.items : [];
                        const activeItems = safeLines.filter((i) => i.itemStatus !== 'CANCELLED');
                        const cancelledItemsCount = safeLines.length - activeItems.length;
                        const totalQty = activeItems.reduce(
                          (s, item) => s + (Number(item.quantity) || 0),
                          0
                        );
                        const isPending = trf.status === 'PENDING';
                        const isCancelled = trf.status === 'CANCELLED';
                        const displayItems = activeItems.length > 0 ? activeItems : safeLines;
                        return (
                          <tr
                            key={trf.id}
                            className={
                              isCancelled
                                ? 'bg-rose-50/40 hover:bg-rose-50/70'
                                : isPending
                                ? 'bg-amber-50/40 hover:bg-amber-50/80'
                                : 'hover:bg-amber-50/40'
                            }
                          >
                            <td className="px-3 py-2 font-mono text-zinc-700 whitespace-nowrap">
                              {trf.date}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              <div className="font-mono font-black text-zinc-950">
                                {trf.strRefNumber}
                              </div>
                              <div className="font-mono text-[10px] text-zinc-400">
                                {trf.transferNumber}
                              </div>
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              {isCancelled ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300 text-[10px] font-black uppercase">
                                  <X className="w-3 h-3" /> Cancelled
                                </span>
                              ) : isPending ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black uppercase">
                                  <Clock className="w-3 h-3" /> Pending
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-black uppercase">
                                  <CheckCircle2 className="w-3 h-3" /> Received
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap font-bold text-zinc-900">
                              {trf.fromBranchName} → {trf.toBranchName}
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="font-semibold text-zinc-900">
                                    {displayItems[0]?.description || '—'}
                                    {displayItems.length > 1
                                      ? ` (+${displayItems.length - 1})`
                                      : ''}
                                  </div>
                                  <div className="text-[10px] font-mono text-zinc-500 tabular-nums flex flex-wrap items-center gap-1.5">
                                    <span>
                                      {activeItems.length} active line(s) · Qty: {totalQty}
                                    </span>
                                    {cancelledItemsCount > 0 && (
                                      <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 border border-rose-200 font-bold">
                                        {cancelledItemsCount} cancelled
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPrintableTransfer(trf);
                                    setIsPrintModalOpen(true);
                                  }}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded bg-zinc-950 hover:bg-zinc-800 text-amber-400 text-[10px] font-bold uppercase cursor-pointer shrink-0"
                                  title="Open 1/4 Letter STR Preview"
                                >
                                  <Printer className="w-3 h-3" /> 1/4 STR
                                </button>
                              </div>
                            </td>
                            <td className="px-3 py-2 text-[11px] text-zinc-700 space-y-0.5">
                              <div>
                                Prep: <strong>{trf.preparedBy}</strong> · Rev:{' '}
                                {trf.reviewedBy ? (
                                  <strong className="text-zinc-900">
                                    {trf.reviewedBy}
                                    {trf.reviewedAt && (
                                      <span className="ml-1 font-mono font-normal text-[10px] text-zinc-500">
                                        ({formatStrDateTime(trf.reviewedAt)})
                                      </span>
                                    )}
                                  </strong>
                                ) : (
                                  <span className="text-amber-700 italic">
                                    Awaiting Super Admin review
                                  </span>
                                )}
                              </div>
                              <div>
                                {isCancelled ? (
                                  <span className="text-rose-700 font-semibold">
                                    Cancelled during Super Admin review
                                  </span>
                                ) : isPending ? (
                                  <span className="text-amber-700 font-semibold">
                                    Recv: Pending receipt confirmation
                                  </span>
                                ) : (
                                  <span className="text-emerald-800">
                                    Recv: <strong>{trf.receivedBy}</strong>
                                    {trf.receivedAt && (
                                      <span className="ml-1 font-mono text-[10px] text-zinc-500">
                                        · {formatStrDateTime(trf.receivedAt)}
                                      </span>
                                    )}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-1">
                                {isSuperAdmin && isPending && !trf.reviewedBy && (
                                  <button
                                    type="button"
                                    onClick={() => handleConfirmReviewStr(trf)}
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-amber-400 hover:bg-amber-300 text-zinc-950 border border-zinc-950 text-[10px] font-black uppercase cursor-pointer"
                                    title="Check requested items & cancel unavailable stock (Super Admin only)"
                                  >
                                    Review Items
                                  </button>
                                )}
                                {isPending && (
                                  <button
                                    type="button"
                                    onClick={() => handleConfirmReceiveStr(trf)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase cursor-pointer"
                                    title={`Mark as Received by ${currentUser.name}`}
                                  >
                                    <Check className="w-3 h-3" /> Mark Received
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleExportGoogleSheetXlsx([trf])}
                                  className="p-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 cursor-pointer"
                                  title="Export STR to Excel"
                                >
                                  <FileSpreadsheet className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: STOCK MOVEMENT LEDGER                                          */}
      {/* ===================================================================== */}
      {subTab === 'ledger' && canViewLedger && (
        <div className="bg-white rounded-xl border border-zinc-200 shadow-2xs overflow-hidden">
          <div className="px-3.5 py-2.5 border-b border-zinc-200 bg-zinc-50 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <div className="relative flex-1 min-w-[160px] w-full sm:w-auto sm:max-w-xs">
                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={ledgerSearch}
                  onChange={(e) => setLedgerSearch(e.target.value)}
                  placeholder="Search Ref #, item, staff..."
                  className="w-full pl-8 pr-2.5 py-1.5 rounded-lg border border-zinc-300 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>

              <select
                value={ledgerBranchFilter}
                onChange={(e) => setLedgerBranchFilter(e.target.value)}
                className="w-full sm:w-auto px-2.5 py-1.5 rounded-lg border border-zinc-300 bg-white text-xs font-bold text-zinc-800"
              >
                <option value="ALL">All Branches</option>
                <optgroup label="Warehouse Branches (Monitored)">
                  {WAREHOUSE_BRANCHES.map((b) => (
                    <option key={b.code} value={b.code}>
                      {b.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Store Branches">
                  {STORE_BRANCHES.map((b) => (
                    <option key={b.code} value={b.code}>
                      {b.name}
                    </option>
                  ))}
                </optgroup>
              </select>

              <select
                value={ledgerTypeFilter}
                onChange={(e) => setLedgerTypeFilter(e.target.value)}
                className="w-full sm:w-auto px-2.5 py-1.5 rounded-lg border border-zinc-300 bg-white text-xs font-bold text-zinc-800"
              >
                <option value="ALL">All Movements</option>
                <option value="STOCK_IN">Stock In</option>
                <option value="STOCK_OUT">Stock Out</option>
                <option value="TRANSFER_IN">Transfer In</option>
                <option value="TRANSFER_OUT">Transfer Out</option>
              </select>

              <select
                value={ledgerStatusFilter}
                onChange={(e) => setLedgerStatusFilter(e.target.value)}
                className="w-full sm:w-auto px-2.5 py-1.5 rounded-lg border border-zinc-300 bg-white text-xs font-bold text-zinc-800"
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="RECEIVED">Received</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>

              <input
                type="date"
                value={ledgerDateFilter}
                onChange={(e) => setLedgerDateFilter(e.target.value)}
                className="w-full sm:w-auto px-2.5 py-1.5 rounded-lg border border-zinc-300 bg-white font-mono text-xs font-bold text-zinc-800"
              />
              {ledgerDateFilter && (
                <button
                  type="button"
                  onClick={() => setLedgerDateFilter('')}
                  className="px-2 py-1.5 rounded-lg bg-zinc-200 hover:bg-zinc-300 text-xs font-bold whitespace-nowrap cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>

            {isSuperAdmin && (
              <button
                type="button"
                onClick={handleOpenAddLedgerModal}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 border border-zinc-950 text-xs font-black whitespace-nowrap cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Entry
              </button>
            )}
          </div>

          {filteredMovements.length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-500">
              No stock movement entries recorded yet.
            </div>
          ) : (
            <>
              {/* Mobile Ledger Cards */}
              <div className="md:hidden divide-y divide-zinc-200">
                {filteredMovements.map((mov) => {
                  const isInbound =
                    mov.movementType === 'STOCK_IN' || mov.movementType === 'TRANSFER_IN';
                  const branchFrom = getLedgerBranchFrom(mov);
                  const branchTo = getLedgerBranchTo(mov);
                  const hasNotes = Boolean(mov.notes && mov.notes.trim().length > 0);
                  return (
                    <div key={`mob-mov-${mov.id}`} className="p-3.5 space-y-2.5 bg-white">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {formatMovementBadge(mov.movementType)}
                            {formatLedgerStatusBadge(mov)}
                          </div>
                          <div className="font-mono text-[11px] font-bold text-zinc-900 mt-1">
                            {mov.refNumber}
                            {mov.transferNumber ? (
                              <span className="ml-1.5 text-[10px] font-normal text-zinc-400">
                                ({mov.transferNumber})
                              </span>
                            ) : null}
                          </div>
                          <div className="font-mono text-[10px] text-zinc-500">{mov.date}</div>
                        </div>

                        <div className="text-right shrink-0">
                          <div
                            className={`font-mono text-base font-black tabular-nums ${
                              isInbound ? 'text-emerald-700' : 'text-rose-600'
                            }`}
                          >
                            {isInbound ? '+' : '-'}
                            {mov.quantity}
                          </div>
                          <div className="text-[10px] font-mono text-zinc-500 tabular-nums">
                            {mov.previousQty} → <strong className="text-zinc-950">{mov.newQty}</strong>{' '}
                            {mov.uom}
                          </div>
                        </div>
                      </div>

                      <div>
                        <div className="font-bold text-xs text-zinc-950 break-words">
                          {mov.description}
                        </div>
                        <div className="text-[10px] text-zinc-500 font-mono">
                          {mov.itemCode ? `${mov.itemCode} · ` : ''}
                          {mov.category} · {mov.batchNo || '—'} · {mov.uom}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 p-2 rounded-lg bg-zinc-50 border border-zinc-200 text-[11px]">
                        <div>
                          <span className="block text-[9px] font-black uppercase text-zinc-400">
                            Branch From
                          </span>
                          <span className="font-semibold text-zinc-800">{branchFrom}</span>
                        </div>
                        <div>
                          <span className="block text-[9px] font-black uppercase text-zinc-400">
                            Branch To
                          </span>
                          <span className="font-semibold text-zinc-800">{branchTo}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-zinc-100">
                        <span className="text-[11px] text-zinc-600">
                          By: <strong className="text-zinc-900">{mov.performedBy}</strong>
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setViewingRemarksEntry(mov)}
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-[10px] font-bold whitespace-nowrap cursor-pointer ${
                              hasNotes
                                ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300'
                                : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-500 border-zinc-200'
                            }`}
                          >
                            <Eye className="w-3 h-3" />
                            View Remarks
                          </button>
                          {isSuperAdmin && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenEditLedgerModal(mov)}
                                className="p-1.5 rounded border border-zinc-200 hover:bg-zinc-100 text-zinc-700 cursor-pointer"
                                title="Edit Ledger Entry"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleConfirmDeleteLedgerEntry(mov)}
                                className="p-1.5 rounded border border-rose-200 hover:bg-rose-100 text-rose-600 cursor-pointer"
                                title="Delete Ledger Entry"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Ledger Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-zinc-950 text-amber-400 uppercase text-[10px] tracking-wider">
                      <th className="px-3 py-2 font-black">Date</th>
                      <th className="px-3 py-2 font-black">Type</th>
                      <th className="px-3 py-2 font-black">Status</th>
                      <th className="px-3 py-2 font-black">Branch From</th>
                      <th className="px-3 py-2 font-black">Branch To</th>
                      <th className="px-3 py-2 font-black">Ref #</th>
                      <th className="px-3 py-2 font-black">Item & Batch</th>
                      <th className="px-3 py-2 font-black text-right">Prev</th>
                      <th className="px-3 py-2 font-black text-right">Qty</th>
                      <th className="px-3 py-2 font-black text-right">New</th>
                      <th className="px-3 py-2 font-black text-center">Remarks</th>
                      <th className="px-3 py-2 font-black">By</th>
                      {isSuperAdmin && (
                        <th className="px-3 py-2 font-black text-right">Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {filteredMovements.map((mov) => {
                      const isInbound =
                        mov.movementType === 'STOCK_IN' || mov.movementType === 'TRANSFER_IN';
                      const branchFrom = getLedgerBranchFrom(mov);
                      const branchTo = getLedgerBranchTo(mov);
                      const hasNotes = Boolean(mov.notes && mov.notes.trim().length > 0);
                      return (
                        <tr key={mov.id} className="hover:bg-amber-50/40">
                          <td className="px-3 py-2 font-mono text-zinc-700 whitespace-nowrap">
                            {mov.date}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {formatMovementBadge(mov.movementType)}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {formatLedgerStatusBadge(mov)}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-zinc-700 font-medium">
                            {branchFrom}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-zinc-700 font-medium">
                            {branchTo}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <div className="font-mono font-bold text-zinc-950">
                              {mov.refNumber}
                            </div>
                            {mov.transferNumber && (
                              <div className="font-mono text-[10px] text-zinc-400">
                                {mov.transferNumber}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <div className="font-semibold text-zinc-900">{mov.description}</div>
                            <div className="text-[10px] text-zinc-500 font-mono">
                              {mov.itemCode ? `${mov.itemCode} · ` : ''}
                              {mov.category} · {mov.batchNo || '—'} · {mov.uom}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums text-zinc-500">
                            {mov.previousQty}
                          </td>
                          <td
                            className={`px-3 py-2 text-right font-mono font-black tabular-nums ${
                              isInbound ? 'text-emerald-700' : 'text-rose-600'
                            }`}
                          >
                            {isInbound ? '+' : '-'}
                            {mov.quantity}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-black tabular-nums text-zinc-950">
                            {mov.newQty}
                          </td>
                          <td className="px-3 py-2 text-center whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => setViewingRemarksEntry(mov)}
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-[10px] font-bold cursor-pointer transition-colors ${
                                hasNotes
                                  ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300'
                                  : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-500 border-zinc-200'
                              }`}
                              title={hasNotes ? 'View remarks' : 'No remarks recorded — click for details'}
                            >
                              <Eye className="w-3 h-3" />
                              View
                            </button>
                          </td>
                          <td className="px-3 py-2 text-zinc-700 whitespace-nowrap">
                            {mov.performedBy}
                          </td>
                          {isSuperAdmin && (
                            <td className="px-3 py-2 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditLedgerModal(mov)}
                                  className="p-1 rounded hover:bg-zinc-200 text-zinc-600 hover:text-zinc-950 cursor-pointer"
                                  title="Edit Ledger Entry"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleConfirmDeleteLedgerEntry(mov)}
                                  className="p-1 rounded hover:bg-rose-100 text-zinc-400 hover:text-rose-700 cursor-pointer"
                                  title="Delete Ledger Entry"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* CATEGORY MANAGER MODAL (ADD / EDIT / DELETE)                          */}
      {/* ===================================================================== */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/75 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl border-2 border-zinc-950 shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[85vh]">
            <div className="bg-zinc-950 text-amber-400 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderCog className="w-4 h-4" />
                <h3 className="text-xs font-black uppercase tracking-wider">
                  Manage Categories ({categories.length})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowCategoryModal(false);
                  setEditingCategoryId(null);
                }}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={handleSubmitNewCategory}
              className="p-3 border-b border-zinc-200 bg-zinc-50 flex items-center gap-2"
            >
              <input
                type="text"
                required
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="New category name (e.g. FROZEN GOODS)"
                className="flex-1 px-2.5 py-1.5 rounded-lg border border-zinc-300 bg-white text-xs font-bold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 border border-zinc-950 text-xs font-black cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </form>

            <div className="overflow-y-auto divide-y divide-zinc-200 p-2">
              {categories.map((cat) => {
                const count = inventoryItems.filter((i) => i.category === cat.name).length;
                const isEditing = editingCategoryId === cat.id;

                return (
                  <div
                    key={cat.id}
                    className="flex items-center justify-between gap-2 px-2 py-2 hover:bg-zinc-50 rounded-lg"
                  >
                    {isEditing ? (
                      <div className="flex items-center gap-1.5 flex-1">
                        <input
                          type="text"
                          value={editingCategoryName}
                          onChange={(e) => setEditingCategoryName(e.target.value)}
                          className="flex-1 px-2 py-1 rounded border border-amber-400 text-xs font-bold text-zinc-950 focus:outline-none"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveCategoryRename(cat.id)}
                          className="p-1 rounded bg-emerald-600 text-white hover:bg-emerald-500 cursor-pointer"
                          title="Save"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingCategoryId(null)}
                          className="p-1 rounded bg-zinc-200 text-zinc-700 hover:bg-zinc-300 cursor-pointer"
                          title="Cancel"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="min-w-0 flex-1">
                          <span className="text-xs font-bold text-zinc-900">{cat.name}</span>
                          <span className="ml-2 font-mono text-[10px] text-zinc-400 tabular-nums">
                            ({count})
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCategoryId(cat.id);
                              setEditingCategoryName(cat.name);
                            }}
                            className="p-1 rounded hover:bg-zinc-200 text-zinc-600 hover:text-zinc-950 cursor-pointer"
                            title="Rename Category"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleConfirmDeleteCategory(cat)}
                            className="p-1 rounded hover:bg-rose-100 text-zinc-400 hover:text-rose-700 cursor-pointer"
                            title="Delete Category"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* ADD / EDIT STOCK ITEM MODAL                                           */}
      {/* ===================================================================== */}
      {showItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/75 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-xl border-2 border-zinc-950 shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="bg-zinc-950 text-amber-400 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4" />
                <h3 className="text-xs font-black uppercase tracking-wider">
                  {editingItem ? 'Edit Stock Item' : 'Add New Stock Item'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowItemModal(false)}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitItemModal} className="p-4 space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase text-zinc-600 mb-1">
                    Branch
                  </label>
                  <select
                    value={itemBranch}
                    onChange={(e) => setItemBranch(e.target.value as WarehouseBranchCode)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-300 font-bold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  >
                    {WAREHOUSE_BRANCHES.map((b) => (
                      <option key={b.code} value={b.code}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-zinc-600 mb-1">
                    Item Code (Auto-fills from Stock Items)
                  </label>
                  <input
                    type="text"
                    list="warehouse-item-code-list"
                    value={itemCode}
                    onChange={(e) => handleItemCodeInputChange(e.target.value)}
                    placeholder="e.g. 01-0601"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-300 font-mono text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-zinc-600 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  required
                  list="warehouse-item-desc-list"
                  value={itemDesc}
                  onChange={(e) => handleItemDescInputChange(e.target.value)}
                  placeholder="Type or pick item description to auto-fill code"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-300 font-semibold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
                {itemAutoFillHint && (
                  <p className="mt-1 text-[11px] font-medium text-emerald-700">
                    {itemAutoFillHint}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase text-zinc-600 mb-1">
                    Category
                  </label>
                  <select
                    value={itemCategory}
                    onChange={(e) => setItemCategory(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-300 font-semibold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  >
                    {categoryOptions.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-zinc-600 mb-1">
                    Batch / Exp
                  </label>
                  <input
                    type="text"
                    value={itemBatch}
                    onChange={(e) => {
                      const val = e.target.value;
                      setItemBatch(val);
                      const parsed = normalizeExpiryDate(val);
                      if (parsed && !itemExpiryDate) {
                        setItemExpiryDate(parsed);
                      }
                    }}
                    placeholder="e.g. 10-31-28"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-300 font-mono text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-zinc-600 mb-1">
                    UOM
                  </label>
                  <select
                    value={itemUom}
                    onChange={(e) => setItemUom(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-300 font-bold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  >
                    {WAREHOUSE_UOMS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-zinc-600 mb-1">
                  Expiry Date (Near-Expiry Alerts ≤{NEAR_EXPIRY_THRESHOLD_DAYS} Days)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={itemExpiryDate}
                    onChange={(e) => setItemExpiryDate(e.target.value)}
                    className="flex-1 px-2.5 py-1.5 rounded-lg border border-zinc-300 font-mono text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                  {itemExpiryDate && (
                    <button
                      type="button"
                      onClick={() => setItemExpiryDate('')}
                      className="px-2 py-1.5 rounded-lg border border-zinc-300 bg-zinc-50 hover:bg-zinc-100 text-[11px] font-bold text-zinc-600 cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
                {(() => {
                  const previewEval = evaluateItemExpiry({
                    expiryDate: itemExpiryDate || undefined,
                    batchNo: itemBatch,
                    quantity: Number(itemQty) || 1,
                  });
                  if (previewEval.status === 'EXPIRED' || previewEval.status === 'NEAR_EXPIRY') {
                    return (
                      <p
                        className={`mt-1 inline-flex items-center gap-1 text-[11px] font-bold ${
                          previewEval.status === 'EXPIRED' ? 'text-rose-700' : 'text-amber-800'
                        }`}
                      >
                        <CalendarClock className="w-3.5 h-3.5 shrink-0" />
                        Alert: {previewEval.label} ({previewEval.expiryDate})
                      </p>
                    );
                  }
                  return null;
                })()}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase text-zinc-600 mb-1">
                    Price (₱)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={itemPrice}
                    onChange={(e) => setItemPrice(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-300 font-mono tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-zinc-600 mb-1">
                    Quantity {Boolean(editingItem) && !isSuperAdmin && '(Super Admin)'}
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    required
                    disabled={Boolean(editingItem) && !isSuperAdmin}
                    value={itemQty}
                    onChange={(e) => setItemQty(e.target.value)}
                    className={`w-full px-2.5 py-1.5 rounded-lg border border-zinc-300 font-mono font-bold tabular-nums ${
                      Boolean(editingItem) && !isSuperAdmin
                        ? 'bg-zinc-100 text-zinc-400 cursor-not-allowed'
                        : ''
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-zinc-600 mb-1">
                    Min Level
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="1"
                    value={itemReorder}
                    onChange={(e) => setItemReorder(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-300 font-mono tabular-nums"
                  />
                </div>
              </div>

              {!editingItem && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-zinc-600 mb-1">
                      Initial Ref #
                    </label>
                    <input
                      type="text"
                      value={itemRef}
                      onChange={(e) => setItemRef(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-300 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-zinc-600 mb-1">
                      Notes
                    </label>
                    <input
                      type="text"
                      value={itemNotes}
                      onChange={(e) => setItemNotes(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-300"
                    />
                  </div>
                </div>
              )}

              <div className="pt-2.5 border-t border-zinc-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowItemModal(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-zinc-300 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold uppercase cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 font-black uppercase border border-zinc-950 cursor-pointer"
                >
                  {editingItem ? 'Save Changes' : 'Add Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* STOCK IN / OUT MODAL                                                  */}
      {/* ===================================================================== */}
      {adjustTargetItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/75 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl border-2 border-zinc-950 shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="bg-zinc-950 text-amber-400 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {adjustType === 'STOCK_IN' ? (
                  <ArrowDownToLine className="w-4 h-4 text-emerald-400" />
                ) : (
                  <ArrowUpFromLine className="w-4 h-4 text-rose-400" />
                )}
                <h3 className="text-xs font-black uppercase tracking-wider">
                  {adjustType === 'STOCK_IN' ? 'Stock In' : 'Stock Out'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setAdjustTargetItem(null)}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitAdjustment} className="p-4 space-y-3 text-xs">
              <div className="p-2.5 rounded-lg bg-zinc-50 border border-zinc-200">
                <div className="font-bold text-zinc-950">{adjustTargetItem.description}</div>
                <div className="text-[11px] font-mono text-zinc-600 mt-0.5">
                  {adjustTargetItem.branchName} · On Hand:{' '}
                  <strong>
                    {adjustTargetItem.quantity} {adjustTargetItem.uom}
                  </strong>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] font-black uppercase text-zinc-600 mb-1">
                    Qty ({adjustTargetItem.uom})
                  </label>
                  <input
                    type="number"
                    min={0.01}
                    step="any"
                    required
                    value={adjustQty}
                    onChange={(e) => setAdjustQty(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-300 font-mono font-black tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-zinc-600 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    required
                    value={adjustDate}
                    onChange={(e) => setAdjustDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-300 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-zinc-600 mb-1">
                  Reference #
                </label>
                <input
                  type="text"
                  required
                  value={adjustRef}
                  onChange={(e) => setAdjustRef(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-300 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-zinc-600 mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  value={adjustNotes}
                  onChange={(e) => setAdjustNotes(e.target.value)}
                  placeholder="Delivery / store usage / wastage"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-300"
                />
              </div>

              <div className="pt-2 border-t border-zinc-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAdjustTargetItem(null)}
                  className="px-3.5 py-1.5 rounded-lg border border-zinc-300 bg-zinc-100 text-zinc-800 font-bold uppercase cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 font-black uppercase border border-zinc-950 cursor-pointer"
                >
                  Confirm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* STR SEARCH & PICK ITEM MODAL                                          */}
      {/* ===================================================================== */}
      {pickerLineIdx !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/75 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl border-2 border-zinc-950 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="bg-zinc-950 text-amber-400 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4" />
                <h3 className="text-xs font-black uppercase tracking-wider">
                  Pick Item · Line #{pickerLineIdx + 1} ({getBranchByCode(fromBranchCode)?.name})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPickerLineIdx(null)}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 border-b border-zinc-200 bg-zinc-50 space-y-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    autoFocus
                    value={pickerSearch}
                    onChange={(e) => setPickerSearch(e.target.value)}
                    placeholder="Search item description, code, category, batch..."
                    className="w-full pl-8 pr-2.5 py-1.5 rounded-lg border border-zinc-300 bg-white text-xs font-medium text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>

                <select
                  value={pickerCategory}
                  onChange={(e) => setPickerCategory(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-zinc-300 bg-white text-xs font-bold text-zinc-800 max-w-[210px] focus:outline-none focus:ring-2 focus:ring-amber-400"
                >
                  <option value="ALL">All Categories ({categoryOptions.length})</option>
                  {categoryOptions.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setPickerSource('ISSUING')}
                  className={`px-2.5 py-1 rounded-md font-bold cursor-pointer transition-colors ${
                    pickerSource === 'ISSUING'
                      ? 'bg-zinc-950 text-amber-400'
                      : 'bg-white border border-zinc-300 text-zinc-700 hover:bg-zinc-100'
                  }`}
                >
                  Issuing Branch Stock ({issuingBranchStock.length})
                </button>
                <button
                  type="button"
                  onClick={() => setPickerSource('CATALOG')}
                  className={`px-2.5 py-1 rounded-md font-bold cursor-pointer transition-colors ${
                    pickerSource === 'CATALOG'
                      ? 'bg-zinc-950 text-amber-400'
                      : 'bg-white border border-zinc-300 text-zinc-700 hover:bg-zinc-100'
                  }`}
                >
                  Master Catalog ({DEFAULT_STOCK_CATALOG.length})
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1">
              {pickerSource === 'ISSUING' ? (
                filteredPickerStock.length === 0 ? (
                  <div className="p-8 text-center text-xs text-zinc-500 space-y-2">
                    <div>No matching stock items found in {getBranchByCode(fromBranchCode)?.name}.</div>
                    <button
                      type="button"
                      onClick={() => setPickerSource('CATALOG')}
                      className="px-3 py-1.5 rounded-lg bg-amber-400 text-zinc-950 font-bold border border-zinc-950 cursor-pointer"
                    >
                      Search Master Catalog Instead
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="md:hidden divide-y divide-zinc-200">
                      {filteredPickerStock.slice(0, 120).map((item) => {
                        const qty = Number(item.quantity) || 0;
                        const isZeroQty = qty <= 0;
                        const isLow = isItemLowStock(item);
                        const expEval = evaluateItemExpiry(item);
                        return (
                          <button
                            key={`mob-pick-${item.id}`}
                            type="button"
                            disabled={isZeroQty}
                            onClick={() => handleSelectStockItemForLine(item)}
                            className={`w-full text-left p-3 flex items-start justify-between gap-2 transition-colors ${
                              isZeroQty
                                ? 'bg-zinc-100 opacity-60 cursor-not-allowed'
                                : isLow || (expEval.isAlertActive && expEval.status === 'EXPIRED')
                                ? 'bg-rose-50/70 hover:bg-amber-100/70 cursor-pointer'
                                : expEval.isAlertActive
                                ? 'bg-amber-50/70 hover:bg-amber-100/70 cursor-pointer'
                                : 'hover:bg-amber-50 cursor-pointer'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="font-bold text-xs text-zinc-900 break-words">
                                {item.description}
                              </div>
                              <div className="text-[10px] font-mono text-zinc-500 mt-0.5">
                                {item.itemCode || '—'} · {item.category}
                                {item.batchNo ? ` · Batch ${item.batchNo}` : ''}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div
                                className={`font-mono text-xs font-black tabular-nums ${
                                  isZeroQty
                                    ? 'text-zinc-500'
                                    : isLow
                                    ? 'text-rose-700'
                                    : 'text-zinc-950'
                                }`}
                              >
                                {item.quantity} {item.uom}
                              </div>
                              <div className="flex items-center justify-end gap-1">
                                {isZeroQty ? (
                                  <span className="text-[9px] font-black uppercase text-rose-700">
                                    0 Stock · Disabled
                                  </span>
                                ) : (
                                  isLow && (
                                    <span className="text-[9px] font-black uppercase text-rose-600">
                                      Low
                                    </span>
                                  )
                                )}
                                {expEval.isAlertActive && (
                                  <span
                                    className={`text-[9px] font-black uppercase ${
                                      expEval.status === 'EXPIRED'
                                        ? 'text-rose-700'
                                        : 'text-amber-700'
                                    }`}
                                  >
                                    {expEval.label}
                                  </span>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    <table className="hidden md:table w-full text-left border-collapse text-xs">
                      <thead className="sticky top-0 bg-zinc-100 text-zinc-700 uppercase text-[10px] font-black border-b border-zinc-200">
                        <tr>
                          <th className="px-3 py-2 w-24">Code</th>
                          <th className="px-3 py-2">Item Description</th>
                          <th className="px-3 py-2">Category</th>
                          <th className="px-3 py-2">Batch / Exp</th>
                          <th className="px-3 py-2 text-center">UOM</th>
                          <th className="px-3 py-2 text-right">On Hand</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200">
                        {filteredPickerStock.slice(0, 120).map((item) => {
                          const qty = Number(item.quantity) || 0;
                          const isZeroQty = qty <= 0;
                          const isLow = isItemLowStock(item);
                          const expEval = evaluateItemExpiry(item);
                          return (
                            <tr
                              key={item.id}
                              aria-disabled={isZeroQty}
                              onClick={() => {
                                if (!isZeroQty) handleSelectStockItemForLine(item);
                              }}
                              className={`transition-colors ${
                                isZeroQty
                                  ? 'bg-zinc-100 opacity-60 cursor-not-allowed'
                                  : isLow || (expEval.isAlertActive && expEval.status === 'EXPIRED')
                                  ? 'bg-rose-50/70 hover:bg-amber-100/70 cursor-pointer'
                                  : expEval.isAlertActive
                                  ? 'bg-amber-50/70 hover:bg-amber-100/70 cursor-pointer'
                                  : 'hover:bg-amber-50 cursor-pointer'
                              }`}
                            >
                              <td className="px-3 py-2 font-mono text-[11px] text-zinc-500 whitespace-nowrap">
                                {item.itemCode || '—'}
                              </td>
                              <td className="px-3 py-2 font-bold text-zinc-900">
                                {item.description}
                              </td>
                              <td className="px-3 py-2 text-[11px] text-zinc-600 whitespace-nowrap">
                                {item.category}
                              </td>
                              <td className="px-3 py-2 font-mono text-[11px] text-zinc-500 whitespace-nowrap">
                                <span>{item.batchNo || expEval.expiryDate || '—'}</span>
                                {expEval.isAlertActive && (
                                  <span
                                    className={`ml-1.5 px-1 py-0.5 rounded font-sans text-[9px] font-black uppercase ${
                                      expEval.status === 'EXPIRED'
                                        ? 'bg-rose-600 text-white'
                                        : 'bg-amber-400 text-zinc-950'
                                    }`}
                                  >
                                    {expEval.label}
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-center font-semibold text-zinc-700 whitespace-nowrap">
                                {item.uom}
                              </td>
                              <td
                                className={`px-3 py-2 text-right font-mono font-black tabular-nums whitespace-nowrap ${
                                  isZeroQty
                                    ? 'text-zinc-500'
                                    : isLow
                                    ? 'text-rose-700'
                                    : 'text-zinc-950'
                                }`}
                              >
                                <span>{item.quantity}</span>
                                {isZeroQty && (
                                  <span className="ml-1.5 px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-sans text-[9px] font-black uppercase">
                                    0 Stock
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </>
                )
              ) : filteredPickerCatalog.length === 0 ? (
                <div className="p-8 text-center text-xs text-zinc-500">
                  No matching items in the master catalog.
                </div>
              ) : (
                <>
                  <div className="md:hidden divide-y divide-zinc-200">
                    {filteredPickerCatalog.slice(0, 120).map((catItem, idx) => {
                      const matchedIssuing = issuingBranchStock.find(
                        (s) =>
                          (s.description || '').toLowerCase() ===
                            (catItem.description || '').toLowerCase() &&
                          (s.batchNo || '').toLowerCase() ===
                            (catItem.batchNo || '').toLowerCase()
                      );
                      const onHandQty = matchedIssuing ? Number(matchedIssuing.quantity) || 0 : 0;
                      const isBlockedZero =
                        isMonitoredWarehouseBranch(fromBranchCode) && onHandQty <= 0;
                      return (
                        <button
                          key={`mob-cat-${catItem.itemCode}-${idx}`}
                          type="button"
                          disabled={isBlockedZero}
                          onClick={() => handleSelectCatalogItemForLine(catItem)}
                          className={`w-full text-left p-3 flex items-start justify-between gap-2 transition-colors ${
                            isBlockedZero
                              ? 'bg-zinc-100 opacity-60 cursor-not-allowed'
                              : 'hover:bg-amber-50 cursor-pointer'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-xs text-zinc-900 break-words">
                              {catItem.description}
                            </div>
                            <div className="text-[10px] font-mono text-zinc-500 mt-0.5">
                              {catItem.itemCode} · {catItem.category}
                              {catItem.batchNo ? ` · Batch ${catItem.batchNo}` : ''}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="font-mono text-[11px] font-bold text-zinc-700 block">
                              {isMonitoredWarehouseBranch(fromBranchCode)
                                ? `${onHandQty} ${catItem.uom}`
                                : catItem.uom}
                            </span>
                            {isBlockedZero && (
                              <span className="text-[9px] font-black uppercase text-rose-700">
                                0 Stock · Disabled
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <table className="hidden md:table w-full text-left border-collapse text-xs">
                    <thead className="sticky top-0 bg-zinc-100 text-zinc-700 uppercase text-[10px] font-black border-b border-zinc-200">
                      <tr>
                        <th className="px-3 py-2 w-24">Code</th>
                        <th className="px-3 py-2">Item Description</th>
                        <th className="px-3 py-2">Category</th>
                        <th className="px-3 py-2">Batch</th>
                        <th className="px-3 py-2 text-center">UOM</th>
                        {isMonitoredWarehouseBranch(fromBranchCode) && (
                          <th className="px-3 py-2 text-right">On Hand</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200">
                      {filteredPickerCatalog.slice(0, 120).map((catItem, idx) => {
                        const matchedIssuing = issuingBranchStock.find(
                          (s) =>
                            (s.description || '').toLowerCase() ===
                              (catItem.description || '').toLowerCase() &&
                            (s.batchNo || '').toLowerCase() ===
                              (catItem.batchNo || '').toLowerCase()
                        );
                        const onHandQty = matchedIssuing ? Number(matchedIssuing.quantity) || 0 : 0;
                        const isBlockedZero =
                          isMonitoredWarehouseBranch(fromBranchCode) && onHandQty <= 0;
                        return (
                          <tr
                            key={`${catItem.itemCode}-${idx}`}
                            aria-disabled={isBlockedZero}
                            onClick={() => {
                              if (!isBlockedZero) handleSelectCatalogItemForLine(catItem);
                            }}
                            className={`transition-colors ${
                              isBlockedZero
                                ? 'bg-zinc-100 opacity-60 cursor-not-allowed'
                                : 'hover:bg-amber-50 cursor-pointer'
                            }`}
                          >
                            <td className="px-3 py-2 font-mono text-[11px] text-zinc-500 whitespace-nowrap">
                              {catItem.itemCode}
                            </td>
                            <td className="px-3 py-2 font-bold text-zinc-900">
                              {catItem.description}
                            </td>
                            <td className="px-3 py-2 text-[11px] text-zinc-600 whitespace-nowrap">
                              {catItem.category}
                            </td>
                            <td className="px-3 py-2 font-mono text-[11px] text-zinc-500 whitespace-nowrap">
                              {catItem.batchNo || '—'}
                            </td>
                            <td className="px-3 py-2 text-center font-semibold text-zinc-700 whitespace-nowrap">
                              {catItem.uom}
                            </td>
                            {isMonitoredWarehouseBranch(fromBranchCode) && (
                              <td
                                className={`px-3 py-2 text-right font-mono font-black tabular-nums whitespace-nowrap ${
                                  isBlockedZero ? 'text-zinc-500' : 'text-zinc-950'
                                }`}
                              >
                                <span>{onHandQty}</span>
                                {isBlockedZero && (
                                  <span className="ml-1.5 px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-sans text-[9px] font-black uppercase">
                                    0 Stock
                                  </span>
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </>
              )}
            </div>

            <div className="px-4 py-2 border-t border-zinc-200 bg-zinc-50 flex items-center justify-between text-[11px] text-zinc-500">
              <span>
                Click any item row to pick it for STR line #{pickerLineIdx + 1}.
              </span>
              <button
                type="button"
                onClick={() => setPickerLineIdx(null)}
                className="px-3 py-1 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-100 text-zinc-800 font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* LEDGER REMARKS VIEW MODAL                                             */}
      {/* ===================================================================== */}
      {viewingRemarksEntry && canViewLedger && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/75 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl border-2 border-zinc-950 shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-zinc-950 text-amber-400 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4" />
                <h3 className="text-xs font-black uppercase tracking-wider">
                  Ledger Remarks · {viewingRemarksEntry.refNumber}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setViewingRemarksEntry(null)}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 p-2.5 rounded-lg bg-zinc-50 border border-zinc-200">
                <div>
                  <span className="text-[10px] font-black uppercase text-zinc-500 block">
                    Date
                  </span>
                  <span className="font-mono font-bold text-zinc-900">
                    {viewingRemarksEntry.date}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-zinc-500 block">
                    Type & Status
                  </span>
                  <div className="flex flex-wrap items-center gap-1 mt-0.5">
                    {formatMovementBadge(viewingRemarksEntry.movementType)}
                    {formatLedgerStatusBadge(viewingRemarksEntry)}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-zinc-500 block">
                    Branch From
                  </span>
                  <span className="font-bold text-zinc-900">
                    {getLedgerBranchFrom(viewingRemarksEntry)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-zinc-500 block">
                    Branch To
                  </span>
                  <span className="font-bold text-zinc-900">
                    {getLedgerBranchTo(viewingRemarksEntry)}
                  </span>
                </div>
                <div className="col-span-2 pt-1 border-t border-zinc-200">
                  <span className="text-[10px] font-black uppercase text-zinc-500 block">
                    Item & Quantity
                  </span>
                  <span className="font-bold text-zinc-950">
                    {viewingRemarksEntry.description}
                  </span>{' '}
                  <span className="font-mono text-zinc-600">
                    ({viewingRemarksEntry.quantity} {viewingRemarksEntry.uom} · Prev:{' '}
                    {viewingRemarksEntry.previousQty} → New: {viewingRemarksEntry.newQty})
                  </span>
                </div>
              </div>

              <div>
                <span className="text-[10px] font-black uppercase text-zinc-600 block mb-1">
                  Remarks / Notes
                </span>
                <div className="p-3 rounded-lg border border-zinc-200 bg-amber-50/40 text-zinc-900 min-h-[70px] whitespace-pre-wrap leading-relaxed">
                  {viewingRemarksEntry.notes?.trim()
                    ? viewingRemarksEntry.notes
                    : 'No remarks recorded for this movement.'}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-zinc-200 text-[11px] text-zinc-500">
                <span>
                  Recorded by: <strong className="text-zinc-800">{viewingRemarksEntry.performedBy}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setViewingRemarksEntry(null)}
                  className="px-3.5 py-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 text-amber-400 text-xs font-bold uppercase cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUPER ADMIN ADD / EDIT LEDGER ENTRY MODAL                             */}
      {/* ===================================================================== */}
      {showLedgerModal && isSuperAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/75 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-xl border-2 border-zinc-950 shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="bg-zinc-950 text-amber-400 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4" />
                <h3 className="text-xs font-black uppercase tracking-wider">
                  {editingLedgerEntry ? 'Edit Ledger Entry' : 'Add Ledger Entry'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowLedgerModal(false)}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitLedgerModal} className="p-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div>
                  <label className="block text-[10px] font-black uppercase text-zinc-600 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    required
                    value={ledgerFormDate}
                    onChange={(e) => setLedgerFormDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-300 font-mono text-zinc-900"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-zinc-600 mb-1">
                    Movement Type
                  </label>
                  <select
                    value={ledgerFormType}
                    onChange={(e) => setLedgerFormType(e.target.value as StockMovementType)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-300 font-bold text-zinc-900 bg-white"
                  >
                    <option value="STOCK_IN">Stock In</option>
                    <option value="STOCK_OUT">Stock Out</option>
                    <option value="TRANSFER_IN">Transfer In</option>
                    <option value="TRANSFER_OUT">Transfer Out</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-zinc-600 mb-1">
                    Status
                  </label>
                  <select
                    value={ledgerFormStatus}
                    onChange={(e) =>
                      setLedgerFormStatus(e.target.value as StockMovementStatus)
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-300 font-bold text-zinc-900 bg-white"
                  >
                    <option value="COMPLETED">Completed</option>
                    <option value="PENDING">Pending</option>
                    <option value="RECEIVED">Received</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-zinc-600 mb-1">
                    Branch
                  </label>
                  <select
                    value={ledgerFormBranch}
                    onChange={(e) =>
                      setLedgerFormBranch(e.target.value as WarehouseBranchCode)
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-300 font-bold text-zinc-900 bg-white"
                  >
                    <optgroup label="Warehouse Branches (Monitored)">
                      {WAREHOUSE_BRANCHES.map((b) => (
                        <option key={b.code} value={b.code}>
                          {b.name}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Store Branches">
                      {STORE_BRANCHES.map((b) => (
                        <option key={b.code} value={b.code}>
                          {b.name}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] font-black uppercase text-zinc-600 mb-1">
                    Branch From
                  </label>
                  <input
                    type="text"
                    value={ledgerFormFromBranch}
                    onChange={(e) => setLedgerFormFromBranch(e.target.value)}
                    placeholder="e.g. YC-Ebloc or Supplier"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-300 font-semibold text-zinc-900"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-zinc-600 mb-1">
                    Branch To
                  </label>
                  <input
                    type="text"
                    value={ledgerFormToBranch}
                    onChange={(e) => setLedgerFormToBranch(e.target.value)}
                    placeholder="e.g. YC-Ramos or Store Usage"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-300 font-semibold text-zinc-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] font-black uppercase text-zinc-600 mb-1">
                    Ref #
                  </label>
                  <input
                    type="text"
                    required
                    value={ledgerFormRef}
                    onChange={(e) => setLedgerFormRef(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-300 font-mono font-bold text-zinc-900"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-zinc-600 mb-1">
                    Transfer # (Optional)
                  </label>
                  <input
                    type="text"
                    value={ledgerFormTransferNum}
                    onChange={(e) => setLedgerFormTransferNum(e.target.value)}
                    placeholder="TRF-..."
                    className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-300 font-mono text-zinc-900"
                  />
                </div>
              </div>

              {!editingLedgerEntry && (
                <div>
                  <label className="block text-[10px] font-black uppercase text-zinc-600 mb-1">
                    Quick Fill from Stock Item (Optional)
                  </label>
                  <select
                    value={ledgerFormItemId}
                    onChange={(e) => handlePickLedgerStockItem(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-300 bg-zinc-50 text-zinc-900 font-medium"
                  >
                    <option value="">-- Select Stock Item or enter manually below --</option>
                    {inventoryItems
                      .filter((i) => i.branchCode === ledgerFormBranch)
                      .slice(0, 500)
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.description} ({item.quantity} {item.uom})
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[10px] font-black uppercase text-zinc-600 mb-1">
                    Item Code
                  </label>
                  <input
                    type="text"
                    list="warehouse-item-code-list"
                    value={ledgerFormItemCode}
                    onChange={(e) => handleLedgerCodeChange(e.target.value)}
                    placeholder="e.g. 01-0601"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-300 font-mono text-zinc-900"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-black uppercase text-zinc-600 mb-1">
                    Item Description
                  </label>
                  <input
                    type="text"
                    required
                    list="warehouse-item-desc-list"
                    value={ledgerFormDesc}
                    onChange={(e) => handleLedgerDescChange(e.target.value)}
                    placeholder="Enter or pick item to auto-fill code"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-300 font-semibold text-zinc-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[10px] font-black uppercase text-zinc-600 mb-1">
                    Category
                  </label>
                  <select
                    value={ledgerFormCat}
                    onChange={(e) => setLedgerFormCat(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-300 bg-white font-semibold text-zinc-900"
                  >
                    {categoryOptions.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-zinc-600 mb-1">
                    Batch No
                  </label>
                  <input
                    type="text"
                    value={ledgerFormBatch}
                    onChange={(e) => setLedgerFormBatch(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-300 font-mono text-zinc-900"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-zinc-600 mb-1">
                    UOM
                  </label>
                  <select
                    value={ledgerFormUom}
                    onChange={(e) => setLedgerFormUom(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-300 bg-white font-bold text-zinc-900"
                  >
                    {WAREHOUSE_UOMS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div>
                  <label className="block text-[10px] font-black uppercase text-zinc-600 mb-1">
                    Prev Qty
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={ledgerFormPrevQty}
                    onChange={(e) => setLedgerFormPrevQty(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-300 font-mono tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-zinc-600 mb-1">
                    Qty
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    required
                    value={ledgerFormQty}
                    onChange={(e) => setLedgerFormQty(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-300 font-mono font-bold tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-zinc-600 mb-1">
                    New Qty
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={ledgerFormNewQty}
                    onChange={(e) => setLedgerFormNewQty(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-300 font-mono font-bold tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-zinc-600 mb-1">
                    By
                  </label>
                  <input
                    type="text"
                    required
                    value={ledgerFormBy}
                    onChange={(e) => setLedgerFormBy(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-300 font-semibold text-zinc-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-zinc-600 mb-1">
                  Remarks
                </label>
                <textarea
                  rows={2}
                  value={ledgerFormNotes}
                  onChange={(e) => setLedgerFormNotes(e.target.value)}
                  placeholder="Enter remarks / transfer notes..."
                  className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-300 text-zinc-900"
                />
              </div>

              <div className="pt-2.5 border-t border-zinc-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowLedgerModal(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-zinc-300 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold uppercase cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 font-black uppercase border border-zinc-950 cursor-pointer"
                >
                  {editingLedgerEntry ? 'Save Entry' : 'Add Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUPER ADMIN QUICK-ADD STOCK ITEMS IMPORT MODAL                        */}
      {/* ===================================================================== */}
      {showImportModal && isSuperAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/75 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl border-2 border-zinc-950 shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[88vh]">
            <div className="bg-zinc-950 text-amber-400 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Upload className="w-4 h-4" />
                <h3 className="text-xs font-black uppercase tracking-wider">
                  Import Stock Items (Super Admin Quick Add)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 border-b border-zinc-200 bg-zinc-50 space-y-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-zinc-600">
                  Upload an <strong className="text-zinc-900">.xlsx / .xls / .csv</strong> file
                  exported from Stock Items or using the quick-add template.
                </div>
                <button
                  type="button"
                  onClick={handleDownloadStockImportTemplate}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-zinc-100 text-zinc-900 border border-zinc-300 text-xs font-bold cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-600" />
                  Download Template (.xlsx)
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-black uppercase text-zinc-600 mb-1">
                    Select Excel / CSV File
                  </label>
                  <label className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg border-2 border-dashed border-zinc-300 hover:border-amber-400 bg-white cursor-pointer">
                    <span className="truncate font-semibold text-zinc-800">
                      {importFileName || 'Choose .xlsx, .xls, or .csv file...'}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-zinc-950 text-amber-400 text-[10px] font-black uppercase shrink-0">
                      Browse
                    </span>
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleImportFileSelected}
                      className="hidden"
                    />
                  </label>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-zinc-600 mb-1">
                    Default Branch (if blank)
                  </label>
                  <select
                    value={importDefaultBranch}
                    onChange={(e) =>
                      setImportDefaultBranch(e.target.value as WarehouseBranchCode)
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-300 bg-white font-bold text-zinc-900"
                  >
                    {WAREHOUSE_BRANCHES.map((b) => (
                      <option key={b.code} value={b.code}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-zinc-600 mb-1">
                    If Item Exists
                  </label>
                  <select
                    value={importDuplicateMode}
                    onChange={(e) =>
                      setImportDuplicateMode(e.target.value as 'SKIP' | 'UPDATE')
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-300 bg-white font-bold text-zinc-900"
                  >
                    <option value="SKIP">Skip Existing (Quick Add New Only)</option>
                    <option value="UPDATE">Update Existing Items</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <label className="text-[10px] font-black uppercase text-zinc-600">
                    Ledger Ref #:
                  </label>
                  <input
                    type="text"
                    value={importRefNumber}
                    onChange={(e) => setImportRefNumber(e.target.value)}
                    className="px-2 py-1 rounded border border-zinc-300 bg-white font-mono text-xs font-bold text-zinc-900 w-36"
                  />
                </div>

                {parsedImportPreview.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono font-bold">
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                      New: {parsedImportPreview.filter((r) => r.status === 'NEW').length}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200">
                      Update: {parsedImportPreview.filter((r) => r.status === 'UPDATE').length}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-zinc-200 text-zinc-700">
                      Skip: {parsedImportPreview.filter((r) => r.status === 'SKIP').length}
                    </span>
                    {parsedImportPreview.some((r) => r.status === 'INVALID') && (
                      <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-700 border border-rose-200">
                        Invalid: {parsedImportPreview.filter((r) => r.status === 'INVALID').length}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-auto">
              {parsedImportPreview.length === 0 ? (
                <div className="p-8 text-center text-xs text-zinc-500 space-y-1">
                  <div className="font-bold text-zinc-700">No file loaded yet</div>
                  <div>
                    Expected columns: <span className="font-mono">Branch, Item Code, Description, Category, Batch / Exp, UOM, Price, Min, Qty</span>
                  </div>
                </div>
              ) : (
                <>
                  {/* Mobile Import Preview Cards */}
                  <div className="md:hidden divide-y divide-zinc-200">
                    {parsedImportPreview.map((row) => (
                      <div
                        key={`mob-imp-${row.rowNumber}`}
                        className={`p-3 space-y-1.5 text-xs ${
                          row.status === 'INVALID'
                            ? 'bg-rose-50/70'
                            : row.status === 'SKIP'
                            ? 'bg-zinc-50 text-zinc-500'
                            : 'bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-[10px] font-bold text-zinc-500">
                            Row #{row.rowNumber} · {row.branchName}
                          </span>
                          {row.status === 'NEW' && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase">
                              New
                            </span>
                          )}
                          {row.status === 'UPDATE' && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] font-black uppercase">
                              Update
                            </span>
                          )}
                          {row.status === 'SKIP' && (
                            <span className="px-1.5 py-0.5 rounded bg-zinc-200 text-zinc-600 text-[10px] font-bold uppercase">
                              Skip
                            </span>
                          )}
                          {row.status === 'INVALID' && (
                            <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 text-[10px] font-black uppercase">
                              {row.error}
                            </span>
                          )}
                        </div>
                        <div className="font-bold text-zinc-950 break-words">
                          {row.description || <span className="italic text-rose-600">Empty</span>}
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-zinc-600">
                          <span>
                            {row.itemCode || '—'}
                            {row.codeAutoFilled ? ' (auto)' : ''} · {row.category}
                          </span>
                          <span className="font-bold text-zinc-900">
                            Qty {row.quantity} {row.uom} (Min {row.reorderLevel})
                            {row.expiryDate ? ` · Exp ${row.expiryDate}` : ''}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop Import Preview Table */}
                  <table className="hidden md:table w-full text-left border-collapse text-xs">
                    <thead className="sticky top-0 bg-zinc-950 text-amber-400 uppercase text-[10px]">
                      <tr>
                        <th className="px-3 py-2 font-black w-12">Row</th>
                        <th className="px-3 py-2 font-black w-20">Action</th>
                        <th className="px-3 py-2 font-black">Branch</th>
                        <th className="px-3 py-2 font-black">Code</th>
                        <th className="px-3 py-2 font-black">Description</th>
                        <th className="px-3 py-2 font-black">Category</th>
                        <th className="px-3 py-2 font-black">Expiry</th>
                        <th className="px-3 py-2 font-black text-center">UOM</th>
                        <th className="px-3 py-2 font-black text-right">Min</th>
                        <th className="px-3 py-2 font-black text-right">Qty</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200">
                      {parsedImportPreview.map((row) => (
                        <tr
                          key={row.rowNumber}
                          className={
                            row.status === 'INVALID'
                              ? 'bg-rose-50/70'
                              : row.status === 'SKIP'
                              ? 'bg-zinc-50 text-zinc-400'
                              : 'hover:bg-amber-50/40'
                          }
                        >
                          <td className="px-3 py-1.5 font-mono text-[11px] text-zinc-500">
                            {row.rowNumber}
                          </td>
                          <td className="px-3 py-1.5 whitespace-nowrap">
                            {row.status === 'NEW' && (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase">
                                New
                              </span>
                            )}
                            {row.status === 'UPDATE' && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] font-black uppercase">
                                Update
                              </span>
                            )}
                            {row.status === 'SKIP' && (
                              <span className="px-1.5 py-0.5 rounded bg-zinc-200 text-zinc-600 text-[10px] font-bold uppercase">
                                Skip
                              </span>
                            )}
                            {row.status === 'INVALID' && (
                              <span
                                className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 text-[10px] font-black uppercase"
                                title={row.error}
                              >
                                {row.error}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-1.5 whitespace-nowrap font-bold">
                            {row.branchName}
                          </td>
                          <td className="px-3 py-1.5 font-mono text-[11px] whitespace-nowrap">
                            <span>{row.itemCode || '—'}</span>
                            {row.codeAutoFilled && (
                              <span className="ml-1 text-[10px] font-sans font-semibold text-emerald-700">
                                (auto)
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-1.5 font-semibold">
                            {row.description || <span className="italic text-rose-600">Empty</span>}
                          </td>
                          <td className="px-3 py-1.5 text-[11px] whitespace-nowrap">
                            {row.category}
                          </td>
                          <td className="px-3 py-1.5 font-mono text-[11px] whitespace-nowrap">
                            {row.expiryDate || row.batchNo || '—'}
                          </td>
                          <td className="px-3 py-1.5 text-center font-semibold">{row.uom}</td>
                          <td className="px-3 py-1.5 text-right font-mono tabular-nums">
                            {row.reorderLevel}
                          </td>
                          <td className="px-3 py-1.5 text-right font-mono font-bold tabular-nums">
                            {row.quantity}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>

            <div className="px-4 py-3 border-t border-zinc-200 bg-zinc-50 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] text-zinc-500">
                Missing categories in your file will be created automatically.
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-100 text-zinc-800 text-xs font-bold uppercase whitespace-nowrap cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={
                    isImportingStock ||
                    parsedImportPreview.filter((r) => r.status === 'NEW' || r.status === 'UPDATE')
                      .length === 0
                  }
                  onClick={handleConfirmImportStockItems}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 border border-zinc-950 text-xs font-black uppercase whitespace-nowrap cursor-pointer disabled:opacity-40"
                >
                  <Upload className="w-3.5 h-3.5" />
                  {isImportingStock
                    ? 'Importing...'
                    : `Import ${
                        parsedImportPreview.filter(
                          (r) => r.status === 'NEW' || r.status === 'UPDATE'
                        ).length
                      } Item(s)`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUPER ADMIN STR ITEM-BY-ITEM REVIEW & CANCELLATION MODAL              */}
      {/* ===================================================================== */}
      {reviewingTransfer && isSuperAdmin && (() => {
        const reviewBranchStock = inventoryItems
          .filter((item) => item.branchCode === reviewingTransfer.fromBranchCode)
          .sort((a, b) => (a.description || '').localeCompare(b.description || ''));
        const reviewPickerQuery = reviewPickerSearch.trim().toLowerCase();
        const filteredReviewAddStock = reviewBranchStock.filter((item) => {
          if (reviewPickerCategory !== 'ALL' && item.category !== reviewPickerCategory) {
            return false;
          }
          if (!reviewPickerQuery) return true;
          return (
            (item.description || '').toLowerCase().includes(reviewPickerQuery) ||
            (item.itemCode || '').toLowerCase().includes(reviewPickerQuery) ||
            (item.batchNo || '').toLowerCase().includes(reviewPickerQuery) ||
            (item.category || '').toLowerCase().includes(reviewPickerQuery)
          );
        });

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/75 backdrop-blur-xs p-4">
            <div className="bg-white rounded-xl border-2 border-zinc-950 shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh]">
              <div className="bg-zinc-950 text-amber-400 px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <div className="min-w-0">
                    <h3 className="text-xs font-black uppercase tracking-wider truncate">
                      Review STR Items · {reviewingTransfer.strRefNumber}
                    </h3>
                    <div className="text-[11px] font-mono text-zinc-300 truncate">
                      {reviewingTransfer.fromBranchName} → {reviewingTransfer.toBranchName} · Prep by{' '}
                      {reviewingTransfer.preparedBy}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setReviewingTransfer(null)}
                  className="text-zinc-400 hover:text-white cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="px-4 py-2.5 border-b border-zinc-200 bg-zinc-50 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="text-zinc-600">
                  Edit requested quantities, add additional items, or cancel unavailable items from{' '}
                  <strong className="text-zinc-900">{reviewingTransfer.fromBranchName}</strong>.
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsReviewAddPickerOpen((prev) => !prev)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-black uppercase cursor-pointer shrink-0 transition-colors ${
                      isReviewAddPickerOpen
                        ? 'bg-zinc-950 text-amber-400 border-zinc-950'
                        : 'bg-amber-400 hover:bg-amber-300 text-zinc-950 border-zinc-950'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {isReviewAddPickerOpen ? 'Hide Add Item' : 'Add Item / Qty'}
                  </button>
                  <button
                    type="button"
                    onClick={handleAutoMarkUnavailableReview}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 text-[11px] font-black uppercase cursor-pointer shrink-0"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Auto-Cancel Unavailable
                  </button>
                </div>
              </div>

              {/* Inline Add Item to STR Review Picker Drawer */}
              {isReviewAddPickerOpen && (
                <div className="p-3 bg-amber-50/70 border-b border-amber-300 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] font-black uppercase text-zinc-900">
                      Add Item from {reviewingTransfer.fromBranchName} Stock (Click item to add or +1)
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsReviewAddPickerOpen(false)}
                      className="text-[11px] font-bold text-zinc-600 hover:text-zinc-950 cursor-pointer"
                    >
                      Close Picker
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative flex-1 min-w-[200px]">
                      <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={reviewPickerSearch}
                        onChange={(e) => setReviewPickerSearch(e.target.value)}
                        placeholder="Search description, code, category..."
                        className="w-full pl-8 pr-2.5 py-1.5 rounded-lg border border-zinc-300 bg-white text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </div>
                    <select
                      value={reviewPickerCategory}
                      onChange={(e) => setReviewPickerCategory(e.target.value)}
                      className="px-2.5 py-1.5 rounded-lg border border-zinc-300 bg-white text-xs font-bold text-zinc-800 max-w-[200px] focus:outline-none focus:ring-2 focus:ring-amber-400"
                    >
                      <option value="ALL">All Categories</option>
                      {categoryOptions.map((cat) => (
                        <option key={`rev-cat-${cat}`} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="max-h-48 overflow-y-auto rounded-lg border border-zinc-200 bg-white divide-y divide-zinc-100">
                    {filteredReviewAddStock.length === 0 ? (
                      <div className="p-4 text-center text-xs text-zinc-500">
                        No matching items found in {reviewingTransfer.fromBranchName}.
                      </div>
                    ) : (
                      filteredReviewAddStock.slice(0, 60).map((item) => {
                        const qty = Number(item.quantity) || 0;
                        const isZero =
                          isMonitoredWarehouseBranch(reviewingTransfer.fromBranchCode) && qty <= 0;
                        return (
                          <button
                            key={`rev-add-${item.id}`}
                            type="button"
                            disabled={isZero}
                            onClick={() => handleAddItemToReviewStr(item)}
                            className={`w-full px-3 py-2 text-left flex items-center justify-between gap-2 text-xs transition-colors ${
                              isZero
                                ? 'bg-zinc-50 opacity-55 cursor-not-allowed'
                                : 'hover:bg-amber-50 cursor-pointer'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="font-bold text-zinc-900 truncate">
                                {item.description}
                              </div>
                              <div className="text-[10px] font-mono text-zinc-500 truncate">
                                {item.itemCode || '—'} · {item.category}
                                {item.batchNo ? ` · Batch ${item.batchNo}` : ''}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span
                                className={`font-mono text-[11px] font-black tabular-nums ${
                                  isZero ? 'text-rose-700' : 'text-zinc-900'
                                }`}
                              >
                                {qty} {item.uom}
                              </span>
                              {!isZero && (
                                <span className="px-2 py-0.5 rounded bg-amber-400 text-zinc-950 text-[10px] font-black uppercase">
                                  + Add
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              <div className="flex-1 overflow-y-auto">
                {/* Mobile Review STR Items Cards */}
                <div className="md:hidden divide-y divide-zinc-200">
                  {reviewDraftItems.map((line, idx) => {
                    const lineKey = getLineKey(line, idx);
                    const isMarkedCancelled = reviewCancelledIds.has(lineKey);
                    const isAddedInReview = reviewAddedLineIds.has(lineKey);
                    const origQty = (reviewingTransfer.items || []).find(
                      (orig, i) => getLineKey(orig, i) === lineKey
                    )?.quantity;
                    const stockInfo = getReviewLineStockInfo(reviewingTransfer, line);
                    return (
                      <div
                        key={`mob-rev-${lineKey}`}
                        className={`p-3.5 space-y-2.5 text-xs ${
                          isMarkedCancelled
                            ? 'bg-rose-50/70'
                            : stockInfo.isUnavailable
                            ? 'bg-amber-50/50'
                            : 'bg-white'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono text-[10px] font-bold text-zinc-500">
                                Line #{idx + 1}
                              </span>
                              {isAddedInReview && (
                                <span className="px-1.5 py-0.5 rounded bg-amber-200 text-zinc-950 text-[9px] font-black uppercase">
                                  Added in Review
                                </span>
                              )}
                            </div>
                            <div
                              className={`font-bold text-sm break-words ${
                                isMarkedCancelled ? 'line-through text-rose-700' : 'text-zinc-950'
                              }`}
                            >
                              {line.description}
                            </div>
                            <div className="text-[10px] font-mono text-zinc-500">
                              {line.category}
                              {line.batchNo ? ` · Batch: ${line.batchNo}` : ''}
                            </div>
                          </div>
                          {isAddedInReview && (
                            <button
                              type="button"
                              onClick={() => handleRemoveAddedReviewLine(lineKey)}
                              title="Remove added item"
                              className="p-1 rounded text-zinc-400 hover:text-rose-600 cursor-pointer shrink-0"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        {/* Editable Qty Stepper */}
                        <div className="flex items-center justify-between gap-2 bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-1.5">
                          <div className="text-[10px] font-black uppercase text-zinc-600">
                            Req Qty ({line.uom})
                            {typeof origQty === 'number' && origQty !== line.quantity && (
                              <span className="ml-1 text-amber-700">(Orig: {origQty})</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={isMarkedCancelled || line.quantity <= 1}
                              onClick={() =>
                                handleUpdateReviewLineQty(lineKey, (Number(line.quantity) || 1) - 1)
                              }
                              className="w-6 h-6 rounded border border-zinc-300 bg-white font-black text-zinc-800 hover:bg-zinc-100 disabled:opacity-40 cursor-pointer"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min={1}
                              step="1"
                              disabled={isMarkedCancelled}
                              value={line.quantity}
                              onChange={(e) =>
                                handleUpdateReviewLineQty(lineKey, Number(e.target.value))
                              }
                              className="w-16 px-1.5 py-1 rounded border border-zinc-300 bg-white font-mono text-xs font-black text-center tabular-nums disabled:bg-zinc-100 disabled:text-zinc-400"
                            />
                            <button
                              type="button"
                              disabled={isMarkedCancelled}
                              onClick={() =>
                                handleUpdateReviewLineQty(lineKey, (Number(line.quantity) || 0) + 1)
                              }
                              className="w-6 h-6 rounded border border-zinc-300 bg-white font-black text-zinc-800 hover:bg-zinc-100 disabled:opacity-40 cursor-pointer"
                            >
                              +
                            </button>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            {!stockInfo.isFromMonitored ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded bg-zinc-100 text-zinc-700 border border-zinc-200 text-[10px] font-bold">
                                {stockInfo.statusLabel}
                              </span>
                            ) : stockInfo.isUnavailable ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300 text-[10px] font-black">
                                <AlertTriangle className="w-3 h-3" />
                                {stockInfo.statusLabel}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-bold">
                                <CheckCircle2 className="w-3 h-3" />
                                {stockInfo.statusLabel}
                              </span>
                            )}
                          </div>

                          <div className="inline-flex rounded-lg overflow-hidden border border-zinc-300">
                            <button
                              type="button"
                              onClick={() => {
                                if (isMarkedCancelled) handleToggleReviewCancelItem(lineKey);
                              }}
                              className={`px-2.5 py-1 text-[10px] font-black uppercase whitespace-nowrap cursor-pointer transition-colors ${
                                !isMarkedCancelled
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-white text-zinc-600 hover:bg-zinc-100'
                              }`}
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (!isMarkedCancelled) handleToggleReviewCancelItem(lineKey);
                              }}
                              className={`px-2.5 py-1 text-[10px] font-black uppercase whitespace-nowrap cursor-pointer transition-colors ${
                                isMarkedCancelled
                                  ? 'bg-rose-600 text-white'
                                  : 'bg-white text-zinc-600 hover:bg-rose-50'
                              }`}
                            >
                              Cancel Item
                            </button>
                          </div>
                        </div>

                        {isMarkedCancelled && (
                          <input
                            type="text"
                            value={reviewCancelReasons[lineKey] || ''}
                            onChange={(e) =>
                              setReviewCancelReasons((prev) => ({
                                ...prev,
                                [lineKey]: e.target.value,
                              }))
                            }
                            placeholder="Reason (default: Not available in inventory)"
                            className="w-full px-2.5 py-1.5 rounded border border-rose-300 bg-white text-[11px] text-rose-900 placeholder:text-rose-300 focus:outline-none focus:ring-1 focus:ring-rose-400"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Desktop Review STR Items Table */}
                <table className="hidden md:table w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 bg-zinc-100 text-zinc-700 uppercase text-[10px] font-black border-b border-zinc-200">
                    <tr>
                      <th className="px-3 py-2 w-10 text-center">#</th>
                      <th className="px-3 py-2">Requested Item</th>
                      <th className="px-3 py-2 text-right w-40">Req Qty</th>
                      <th className="px-3 py-2">Inventory Check ({reviewingTransfer.fromBranchCode})</th>
                      <th className="px-3 py-2 text-center">Decision</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {reviewDraftItems.map((line, idx) => {
                      const lineKey = getLineKey(line, idx);
                      const isMarkedCancelled = reviewCancelledIds.has(lineKey);
                      const isAddedInReview = reviewAddedLineIds.has(lineKey);
                      const origQty = (reviewingTransfer.items || []).find(
                        (orig, i) => getLineKey(orig, i) === lineKey
                      )?.quantity;
                      const stockInfo = getReviewLineStockInfo(reviewingTransfer, line);
                      return (
                        <tr
                          key={lineKey}
                          className={
                            isMarkedCancelled
                              ? 'bg-rose-50/70'
                              : stockInfo.isUnavailable
                              ? 'bg-amber-50/50'
                              : 'hover:bg-zinc-50'
                          }
                        >
                          <td className="px-3 py-2 text-center font-mono text-zinc-500 align-top">
                            {idx + 1}
                          </td>
                          <td className="px-3 py-2 align-top">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={`font-bold ${
                                  isMarkedCancelled
                                    ? 'line-through text-rose-700'
                                    : 'text-zinc-950'
                                }`}
                              >
                                {line.description}
                              </span>
                              {isAddedInReview && (
                                <span className="px-1.5 py-0.5 rounded bg-amber-200 text-zinc-950 text-[9px] font-black uppercase">
                                  Added
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] font-mono text-zinc-500">
                              {line.category}
                              {line.batchNo ? ` · Batch: ${line.batchNo}` : ''}
                            </div>
                            {isMarkedCancelled && (
                              <input
                                type="text"
                                value={reviewCancelReasons[lineKey] || ''}
                                onChange={(e) =>
                                  setReviewCancelReasons((prev) => ({
                                    ...prev,
                                    [lineKey]: e.target.value,
                                  }))
                                }
                                placeholder="Reason (default: Not available in inventory)"
                                className="mt-1.5 w-full px-2 py-1 rounded border border-rose-300 bg-white text-[11px] text-rose-900 placeholder:text-rose-300 focus:outline-none focus:ring-1 focus:ring-rose-400"
                              />
                            )}
                          </td>
                          <td className="px-3 py-2 text-right align-top whitespace-nowrap">
                            <div className="inline-flex items-center justify-end gap-1">
                              <button
                                type="button"
                                disabled={isMarkedCancelled || line.quantity <= 1}
                                onClick={() =>
                                  handleUpdateReviewLineQty(lineKey, (Number(line.quantity) || 1) - 1)
                                }
                                className="w-6 h-6 rounded border border-zinc-300 bg-white font-black text-zinc-800 hover:bg-zinc-100 disabled:opacity-40 cursor-pointer"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min={1}
                                step="1"
                                disabled={isMarkedCancelled}
                                value={line.quantity}
                                onChange={(e) =>
                                  handleUpdateReviewLineQty(lineKey, Number(e.target.value))
                                }
                                className="w-16 px-1.5 py-1 rounded border border-zinc-300 bg-white font-mono text-xs font-black text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:bg-zinc-100 disabled:text-zinc-400"
                              />
                              <button
                                type="button"
                                disabled={isMarkedCancelled}
                                onClick={() =>
                                  handleUpdateReviewLineQty(lineKey, (Number(line.quantity) || 0) + 1)
                                }
                                className="w-6 h-6 rounded border border-zinc-300 bg-white font-black text-zinc-800 hover:bg-zinc-100 disabled:opacity-40 cursor-pointer"
                              >
                                +
                              </button>
                              <span className="text-[11px] font-semibold text-zinc-600 ml-0.5">
                                {line.uom}
                              </span>
                            </div>
                            {typeof origQty === 'number' && origQty !== line.quantity && (
                              <div className="text-[10px] font-mono text-amber-700 mt-0.5">
                                Orig: {origQty} {line.uom}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2 align-top whitespace-nowrap">
                            {!stockInfo.isFromMonitored ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded bg-zinc-100 text-zinc-700 border border-zinc-200 text-[10px] font-bold">
                                {stockInfo.statusLabel}
                              </span>
                            ) : stockInfo.isUnavailable ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300 text-[10px] font-black">
                                <AlertTriangle className="w-3 h-3" />
                                {stockInfo.statusLabel}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-bold">
                                <CheckCircle2 className="w-3 h-3" />
                                {stockInfo.statusLabel}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center align-top whitespace-nowrap">
                            <div className="inline-flex items-center gap-1">
                              <div className="inline-flex rounded-lg overflow-hidden border border-zinc-300">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (isMarkedCancelled) handleToggleReviewCancelItem(lineKey);
                                  }}
                                  className={`px-2 py-1 text-[10px] font-black uppercase cursor-pointer transition-colors ${
                                    !isMarkedCancelled
                                      ? 'bg-emerald-600 text-white'
                                      : 'bg-white text-zinc-600 hover:bg-zinc-100'
                                  }`}
                                >
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!isMarkedCancelled) handleToggleReviewCancelItem(lineKey);
                                  }}
                                  className={`px-2 py-1 text-[10px] font-black uppercase cursor-pointer transition-colors ${
                                    isMarkedCancelled
                                      ? 'bg-rose-600 text-white'
                                      : 'bg-white text-zinc-600 hover:bg-rose-50'
                                  }`}
                                >
                                  Cancel Item
                                </button>
                              </div>
                              {isAddedInReview && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveAddedReviewLine(lineKey)}
                                  title="Remove added item"
                                  className="p-1 rounded text-zinc-400 hover:text-rose-600 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="px-4 py-3 border-t border-zinc-200 bg-zinc-50 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex flex-wrap items-center gap-2 font-mono font-bold text-[11px]">
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Approved: {Math.max(0, reviewDraftItems.length - reviewCancelledIds.size)}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200">
                    Cancelled: {reviewCancelledIds.size}
                  </span>
                  {reviewAddedLineIds.size > 0 && (
                    <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                      Added: {reviewAddedLineIds.size}
                    </span>
                  )}
                  {reviewCancelledIds.size === reviewDraftItems.length && (
                    <span className="text-rose-700 font-sans font-bold">
                      All items cancelled — STR will be marked CANCELLED and reserved stock returned.
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setReviewingTransfer(null)}
                    className="px-3.5 py-1.5 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-100 text-zinc-800 font-bold uppercase cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    disabled={isSavingReview}
                    onClick={handleSubmitReviewStrModal}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 border border-zinc-950 font-black uppercase cursor-pointer disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" />
                    {isSavingReview ? 'Saving...' : 'Confirm Review'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 1/4 Letter Printable STR Modal */}
      <PrintableStrModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        transfer={printableTransfer}
      />
    </div>
  );
};
