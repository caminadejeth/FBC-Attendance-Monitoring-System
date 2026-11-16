import {
  StockTransferRequisition,
  WarehouseBranchCode,
  WarehouseBranchInfo,
  WarehouseCategory,
  WarehouseInventoryItem,
} from '../types';
import {
  DEFAULT_STOCK_CATALOG,
  DEFAULT_WAREHOUSE_CATEGORY_NAMES,
} from './warehouseCatalog';

export const WAREHOUSE_BRANCHES: WarehouseBranchInfo[] = [
  { code: 'YC-EBLC', name: 'YC-Ebloc', strPrefix: 'STR E-', branchType: 'WAREHOUSE', isMonitored: true },
  { code: 'YC-RMOS', name: 'YC-Ramos', strPrefix: 'STR R-', branchType: 'WAREHOUSE', isMonitored: true },
  { code: 'YC-TLSY', name: 'YC-Talisay', strPrefix: 'STR T-', branchType: 'WAREHOUSE', isMonitored: true },
  { code: 'YC-CBA', name: 'YC-Ayala', strPrefix: 'STR A-', branchType: 'WAREHOUSE', isMonitored: true },
  { code: 'YC-CEB', name: 'YC-Banilad', strPrefix: 'STR B-', branchType: 'WAREHOUSE', isMonitored: true },
  { code: 'YC-SMSC', name: 'YC-SM Seaside', strPrefix: 'STR S-', branchType: 'WAREHOUSE', isMonitored: true },
];

export const STORE_BRANCHES: WarehouseBranchInfo[] = [
  { code: 'YC-EBLC-STORE', name: 'YC-Ebloc(STORE)', strPrefix: 'STR E-', branchType: 'STORE', isMonitored: false },
  { code: 'YC-RMOS-STORE', name: 'YC-Ramos(STORE)', strPrefix: 'STR R-', branchType: 'STORE', isMonitored: false },
  { code: 'YC-TLSY-STORE', name: 'YC-Talisay(STORE)', strPrefix: 'STR T-', branchType: 'STORE', isMonitored: false },
  { code: 'YC-CBA-STORE', name: 'YC-Ayala(STORE)', strPrefix: 'STR A-', branchType: 'STORE', isMonitored: false },
  { code: 'YC-CEB-STORE', name: 'YC-Banilad(STORE)', strPrefix: 'STR B-', branchType: 'STORE', isMonitored: false },
  { code: 'YC-SMSC-STORE', name: 'YC-SM Seaside(STORE)', strPrefix: 'STR S-', branchType: 'STORE', isMonitored: false },
];

export const ALL_TRANSFER_BRANCHES: WarehouseBranchInfo[] = [
  ...WAREHOUSE_BRANCHES,
  ...STORE_BRANCHES,
];

export function isMonitoredWarehouseBranch(code?: string | null): boolean {
  if (!code) return false;
  return WAREHOUSE_BRANCHES.some((b) => b.code === code);
}

export const WAREHOUSE_CATEGORIES: string[] = DEFAULT_WAREHOUSE_CATEGORY_NAMES;

export const WAREHOUSE_UOMS: string[] = [
  'Pack',
  'Case',
  'Pc',
  'Bot',
  'Box',
  'Bundle',
  'Roll',
  'Ream',
  'Bag',
  'Tin',
  'Gal',
  'Tank',
];

export function getBranchByCode(
  code?: string | null
): WarehouseBranchInfo | undefined {
  if (!code) return undefined;
  return ALL_TRANSFER_BRANCHES.find((b) => b.code === code);
}

export function mapDepartmentToBranchCode(
  deptOrBranch?: string | null
): WarehouseBranchCode | undefined {
  if (!deptOrBranch) return undefined;
  const val = deptOrBranch.toLowerCase().trim();
  const isStore = val.includes('store');
  if (val.includes('ebloc') || val.includes('eblc')) return isStore ? 'YC-EBLC-STORE' : 'YC-EBLC';
  if (val.includes('ramos') || val.includes('rmos')) return isStore ? 'YC-RMOS-STORE' : 'YC-RMOS';
  if (val.includes('talisay') || val.includes('tlsy')) return isStore ? 'YC-TLSY-STORE' : 'YC-TLSY';
  if (val.includes('ayala') || val.includes('cba')) return isStore ? 'YC-CBA-STORE' : 'YC-CBA';
  if (val.includes('banilad') || val.includes('ceb')) return isStore ? 'YC-CEB-STORE' : 'YC-CEB';
  if (val.includes('seaside') || val.includes('smsc')) return isStore ? 'YC-SMSC-STORE' : 'YC-SMSC';
  return undefined;
}

export function generateNextStrRef(
  branchCode: WarehouseBranchCode,
  existingTransfers: StockTransferRequisition[]
): string {
  const branch = getBranchByCode(branchCode);
  const prefix = branch?.strPrefix || 'STR ';

  let maxSeq = 0;
  existingTransfers.forEach((trf) => {
    if (trf.strRefNumber && trf.strRefNumber.startsWith(prefix)) {
      const remainder = trf.strRefNumber.slice(prefix.length).trim();
      const numMatch = remainder.match(/^(\d+)/);
      if (numMatch) {
        const parsed = parseInt(numMatch[1], 10);
        if (!Number.isNaN(parsed) && parsed > maxSeq) {
          maxSeq = parsed;
        }
      }
    }
  });

  const nextNum = String(maxSeq + 1).padStart(4, '0');
  return `${prefix}${nextNum}`;
}

export function generateNextTransferNumber(
  dateStr: string,
  existingTransfers: StockTransferRequisition[]
): string {
  const compactDate = (dateStr || new Date().toISOString().slice(0, 10)).replace(/-/g, '');
  const prefix = `TRF-${compactDate}-`;

  let maxSeq = 0;
  existingTransfers.forEach((trf) => {
    if (trf.transferNumber && trf.transferNumber.startsWith(prefix)) {
      const remainder = trf.transferNumber.slice(prefix.length).trim();
      const parsed = parseInt(remainder, 10);
      if (!Number.isNaN(parsed) && parsed > maxSeq) {
        maxSeq = parsed;
      }
    }
  });

  return `${prefix}${String(maxSeq + 1).padStart(3, '0')}`;
}

export function buildDefaultWarehouseCategories(
  updatedBy: string = 'System Default'
): WarehouseCategory[] {
  const nowIso = new Date().toISOString();
  return DEFAULT_WAREHOUSE_CATEGORY_NAMES.map((name, idx) => ({
    id: `cat-${String(idx + 1).padStart(2, '0')}-${name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')}`,
    name,
    sortOrder: idx + 1,
    updatedAt: nowIso,
    updatedBy,
  }));
}

export function buildDefaultCatalogItemsForBranch(
  branchCode: WarehouseBranchCode,
  performedBy: string = 'System Default',
  useDefaultQuantities: boolean = true
): WarehouseInventoryItem[] {
  const branch = getBranchByCode(branchCode) || WAREHOUSE_BRANCHES[0];
  const nowIso = new Date().toISOString();

  return DEFAULT_STOCK_CATALOG.map((item, idx) => ({
    id: `wh-${branch.code.toLowerCase()}-def-${String(idx + 1).padStart(3, '0')}`,
    itemCode: item.itemCode || undefined,
    description: item.description,
    category: item.category,
    batchNo: item.batchNo || '',
    uom: item.uom || 'Pc',
    unitPrice: 0,
    branchCode: branch.code,
    branchName: branch.name,
    quantity: useDefaultQuantities ? item.defaultQty : 0,
    reorderLevel: 2,
    updatedAt: nowIso,
    updatedBy: performedBy,
  }));
}

export interface StockReferenceMatch {
  itemCode: string;
  description: string;
  category: string;
  batchNo: string;
  uom: string;
  unitPrice: number;
  reorderLevel: number;
  source: 'BRANCH_STOCK' | 'OTHER_BRANCH_STOCK' | 'CATALOG';
  matchedItem?: WarehouseInventoryItem;
}

const mapInventoryItemToReference = (
  item: WarehouseInventoryItem,
  source: 'BRANCH_STOCK' | 'OTHER_BRANCH_STOCK'
): StockReferenceMatch => ({
  itemCode: (item.itemCode || '').trim(),
  description: item.description.trim(),
  category: item.category,
  batchNo: item.batchNo || '',
  uom: item.uom || 'Pack',
  unitPrice: Number(item.unitPrice) || 0,
  reorderLevel: item.reorderLevel ?? 2,
  source,
  matchedItem: item,
});

export function findStockReferenceByCode(
  code: string,
  inventoryItems: WarehouseInventoryItem[],
  preferredBranchCode?: string
): StockReferenceMatch | undefined {
  const norm = code.trim().toLowerCase();
  if (!norm) return undefined;

  if (preferredBranchCode) {
    const branchMatch = inventoryItems.find(
      (i) =>
        i.branchCode === preferredBranchCode &&
        (i.itemCode || '').trim().toLowerCase() === norm
    );
    if (branchMatch) return mapInventoryItemToReference(branchMatch, 'BRANCH_STOCK');
  }

  const anyStockMatch = inventoryItems.find(
    (i) => (i.itemCode || '').trim().toLowerCase() === norm
  );
  if (anyStockMatch) {
    return mapInventoryItemToReference(anyStockMatch, 'OTHER_BRANCH_STOCK');
  }

  const catMatch = DEFAULT_STOCK_CATALOG.find(
    (c) => (c.itemCode || '').trim().toLowerCase() === norm
  );
  if (catMatch) {
    return {
      itemCode: catMatch.itemCode.trim(),
      description: catMatch.description.trim(),
      category: catMatch.category,
      batchNo: catMatch.batchNo || '',
      uom: catMatch.uom || 'Pack',
      unitPrice: 0,
      reorderLevel: 2,
      source: 'CATALOG',
    };
  }

  return undefined;
}

export function findStockReferenceByDescription(
  description: string,
  inventoryItems: WarehouseInventoryItem[],
  preferredBranchCode?: string
): StockReferenceMatch | undefined {
  const norm = description.trim().toLowerCase();
  if (!norm) return undefined;

  if (preferredBranchCode) {
    const branchWithCode = inventoryItems.find(
      (i) =>
        i.branchCode === preferredBranchCode &&
        i.description.trim().toLowerCase() === norm &&
        Boolean((i.itemCode || '').trim())
    );
    if (branchWithCode) return mapInventoryItemToReference(branchWithCode, 'BRANCH_STOCK');
  }

  const anyWithCode = inventoryItems.find(
    (i) =>
      i.description.trim().toLowerCase() === norm &&
      Boolean((i.itemCode || '').trim())
  );
  if (anyWithCode) {
    return mapInventoryItemToReference(
      anyWithCode,
      preferredBranchCode && anyWithCode.branchCode === preferredBranchCode
        ? 'BRANCH_STOCK'
        : 'OTHER_BRANCH_STOCK'
    );
  }

  const catWithCode = DEFAULT_STOCK_CATALOG.find(
    (c) =>
      c.description.trim().toLowerCase() === norm &&
      Boolean((c.itemCode || '').trim())
  );
  if (catWithCode) {
    return {
      itemCode: catWithCode.itemCode.trim(),
      description: catWithCode.description.trim(),
      category: catWithCode.category,
      batchNo: catWithCode.batchNo || '',
      uom: catWithCode.uom || 'Pack',
      unitPrice: 0,
      reorderLevel: 2,
      source: 'CATALOG',
    };
  }

  // Fallback without code (for category/UOM lookup)
  if (preferredBranchCode) {
    const branchMatch = inventoryItems.find(
      (i) =>
        i.branchCode === preferredBranchCode &&
        i.description.trim().toLowerCase() === norm
    );
    if (branchMatch) return mapInventoryItemToReference(branchMatch, 'BRANCH_STOCK');
  }

  const anyMatch = inventoryItems.find(
    (i) => i.description.trim().toLowerCase() === norm
  );
  if (anyMatch) return mapInventoryItemToReference(anyMatch, 'OTHER_BRANCH_STOCK');

  const catMatch = DEFAULT_STOCK_CATALOG.find(
    (c) => c.description.trim().toLowerCase() === norm
  );
  if (catMatch) {
    return {
      itemCode: (catMatch.itemCode || '').trim(),
      description: catMatch.description.trim(),
      category: catMatch.category,
      batchNo: catMatch.batchNo || '',
      uom: catMatch.uom || 'Pack',
      unitPrice: 0,
      reorderLevel: 2,
      source: 'CATALOG',
    };
  }

  return undefined;
}

export function getUniqueStockReferences(
  inventoryItems: WarehouseInventoryItem[],
  preferredBranchCode?: string
): StockReferenceMatch[] {
  const byKey = new Map<string, StockReferenceMatch>();

  const register = (ref: StockReferenceMatch) => {
    const codeKey = ref.itemCode.toLowerCase();
    const descKey = ref.description.toLowerCase();
    const key = codeKey || `desc::${descKey}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, ref);
      return;
    }
    // Fill missing code or prefer branch match
    if (!existing.itemCode && ref.itemCode) {
      byKey.set(key, ref);
    }
  };

  if (preferredBranchCode) {
    inventoryItems
      .filter((i) => i.branchCode === preferredBranchCode)
      .forEach((i) => register(mapInventoryItemToReference(i, 'BRANCH_STOCK')));
  }

  inventoryItems.forEach((i) =>
    register(
      mapInventoryItemToReference(
        i,
        preferredBranchCode && i.branchCode === preferredBranchCode
          ? 'BRANCH_STOCK'
          : 'OTHER_BRANCH_STOCK'
      )
    )
  );

  DEFAULT_STOCK_CATALOG.forEach((c) =>
    register({
      itemCode: (c.itemCode || '').trim(),
      description: c.description.trim(),
      category: c.category,
      batchNo: c.batchNo || '',
      uom: c.uom || 'Pack',
      unitPrice: 0,
      reorderLevel: 2,
      source: 'CATALOG',
    })
  );

  return Array.from(byKey.values()).sort((a, b) =>
    a.description.localeCompare(b.description)
  );
}
