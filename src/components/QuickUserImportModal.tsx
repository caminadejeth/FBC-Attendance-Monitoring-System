import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  User,
  UserRole,
} from '../types';
import {
  UserPlus,
  Zap,
  Download,
  Upload,
  FileSpreadsheet,
  Plus,
  Trash2,
  Check,
  X,
  AlertCircle,
  Sparkles,
  FileText,
  RefreshCw,
  Building2,
} from 'lucide-react';
import { showSuccessAlert, showErrorAlert } from '../utils/sweetAlerts';

interface QuickUserImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingUsers: User[];
  onAddUser: (user: User) => void;
  onUpdateUser: (user: User) => void;
}

interface QuickRowInput {
  tempId: string;
  employeeId: string;
  firstName: string;
  middleName: string;
  lastName: string;
  email: string;
  role: UserRole;
  department: string;
  position: string;
  pin: string;
  dateHired: string;
  status: 'ACTIVE' | 'INACTIVE';
}

const STORE_BRANCHES = [
  'YC Ebloc',
  'YC Ramos',
  'YC Talisay',
  'YC SM Seaside',
  'YC Ayala',
  'YC Banilad',
  'YC Main Office',
  'Store Operations',
];

export const downloadUserImportTemplate = () => {
  const templateRows = [
    {
      'Employee ID': 'YC-1090',
      'First Name': 'Juan',
      'Middle Name': 'D',
      'Last Name': 'Cruz',
      'Email': 'juan.cruz@fbcrestaurants.com',
      'Role': 'STAFF',
      'Department': 'YC Ayala',
      'Position': 'Kitchen Crew',
      'Passcode PIN': '1234',
      'Date Hired': new Date().toISOString().split('T')[0],
      'Status': 'ACTIVE',
    },
    {
      'Employee ID': 'YC-1091',
      'First Name': 'Maria',
      'Middle Name': 'S',
      'Last Name': 'Santos',
      'Email': 'maria.santos@fbcrestaurants.com',
      'Role': 'SHIFT_MANAGER',
      'Department': 'YC Ebloc',
      'Position': 'Shift Leader',
      'Passcode PIN': '5678',
      'Date Hired': new Date().toISOString().split('T')[0],
      'Status': 'ACTIVE',
    },
    {
      'Employee ID': 'YC-1092',
      'First Name': 'Alex',
      'Middle Name': 'R',
      'Last Name': 'Reyes',
      'Email': 'alex.reyes@fbcrestaurants.com',
      'Role': 'BRANCH_MANAGER',
      'Department': 'YC Banilad',
      'Position': 'Branch Manager',
      'Passcode PIN': '9012',
      'Date Hired': new Date().toISOString().split('T')[0],
      'Status': 'ACTIVE',
    },
  ];

  const ws = XLSX.utils.json_to_sheet(templateRows);
  // Auto column widths
  ws['!cols'] = [
    { wch: 14 }, // Emp ID
    { wch: 15 }, // First Name
    { wch: 12 }, // Middle Name
    { wch: 15 }, // Last Name
    { wch: 30 }, // Email
    { wch: 16 }, // Role
    { wch: 18 }, // Dept
    { wch: 18 }, // Position
    { wch: 14 }, // PIN
    { wch: 14 }, // Date Hired
    { wch: 10 }, // Status
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Users_Import_Template');
  XLSX.writeFile(wb, 'User_Accounts_Import_Template.xlsx');
};

export const exportUsersToExcel = (users: User[]) => {
  const exportRows = users.map((u) => ({
    'Employee ID': u.employeeId,
    'First Name': u.firstName || u.name.split(' ')[0] || '',
    'Middle Name': u.middleName || '',
    'Last Name': u.lastName || u.name.split(' ').slice(1).join(' ') || '',
    'Email': u.email || '',
    'Role': u.role,
    'Department': u.department,
    'Position': u.position,
    'Passcode PIN': u.pin,
    'Date Hired': u.dateHired || '',
    'Status': u.status,
  }));

  const ws = XLSX.utils.json_to_sheet(exportRows);
  ws['!cols'] = [
    { wch: 14 },
    { wch: 15 },
    { wch: 12 },
    { wch: 15 },
    { wch: 30 },
    { wch: 16 },
    { wch: 18 },
    { wch: 18 },
    { wch: 14 },
    { wch: 14 },
    { wch: 10 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'User Accounts');
  XLSX.writeFile(
    wb,
    `User_Accounts_Roster_${new Date().toISOString().split('T')[0]}.xlsx`
  );
};

export const QuickUserImportModal: React.FC<QuickUserImportModalProps> = ({
  isOpen,
  onClose,
  existingUsers,
  onAddUser,
  onUpdateUser,
}) => {
  const [activeTab, setActiveTab] = useState<'QUICK_ADD' | 'IMPORT_FILE'>(
    'QUICK_ADD'
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Generate next available Employee ID suggestion
  const getNextEmpId = (offset: number) => {
    const existingNums = existingUsers
      .map((u) => {
        const match = u.employeeId.match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
      })
      .filter((n) => n > 0);
    const maxNum = existingNums.length > 0 ? Math.max(...existingNums) : 1050;
    return `YC-${maxNum + 1 + offset}`;
  };

  const createDefaultRow = (offset: number): QuickRowInput => {
    return {
      tempId: `row-${Date.now()}-${offset}`,
      employeeId: getNextEmpId(offset),
      firstName: '',
      middleName: '',
      lastName: '',
      email: '',
      role: 'STAFF',
      department: 'YC Ayala',
      position: 'Staff Member',
      pin: String(Math.floor(1000 + Math.random() * 9000)),
      dateHired: new Date().toISOString().split('T')[0],
      status: 'ACTIVE',
    };
  };

  // State for Quick Add Rows
  const [rows, setRows] = useState<QuickRowInput[]>([
    createDefaultRow(0),
    createDefaultRow(1),
  ]);

  // State for File Import
  const [importedFile, setImportedFile] = useState<File | null>(null);
  const [parsedUsers, setParsedUsers] = useState<QuickRowInput[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [overwriteDuplicates, setOverwriteDuplicates] = useState(false);

  if (!isOpen) return null;

  // Add more rows to Quick Add table
  const handleAddMoreRows = (count: number = 1) => {
    const currentLen = rows.length;
    const newRows = Array.from({ length: count }, (_, i) =>
      createDefaultRow(currentLen + i)
    );
    setRows((prev) => [...prev, ...newRows]);
  };

  const handleRemoveRow = (tempId: string) => {
    if (rows.length <= 1) {
      setRows([createDefaultRow(0)]);
      return;
    }
    setRows((prev) => prev.filter((r) => r.tempId !== tempId));
  };

  const handleRowChange = (
    tempId: string,
    field: keyof QuickRowInput,
    value: string
  ) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.tempId !== tempId) return r;
        const updated = { ...r, [field]: value };
        // Auto update email if firstName or lastName changed and email is empty or auto-generated
        if (field === 'firstName' || field === 'lastName') {
          const fName = field === 'firstName' ? value : r.firstName;
          const lName = field === 'lastName' ? value : r.lastName;
          if (fName.trim()) {
            const cleanFName = fName.trim().toLowerCase().replace(/\s+/g, '');
            const cleanLName = lName.trim().toLowerCase().replace(/\s+/g, '');
            updated.email = cleanLName
              ? `${cleanFName}.${cleanLName}@fbcrestaurants.com`
              : `${cleanFName}@fbcrestaurants.com`;
          }
        }
        return updated;
      })
    );
  };

  const handleGenerateRandomPin = (tempId: string) => {
    const newPin = String(Math.floor(1000 + Math.random() * 9000));
    handleRowChange(tempId, 'pin', newPin);
  };

  // Submit Quick Add rows
  const handleSaveQuickRows = (e: React.FormEvent) => {
    e.preventDefault();

    // Filter valid filled rows
    const filledRows = rows.filter(
      (r) => r.firstName.trim() || r.lastName.trim() || r.employeeId.trim()
    );

    if (filledRows.length === 0) {
      showErrorAlert(
        'Empty Input',
        'Please fill in at least one employee record (First Name, Last Name, and Employee ID).'
      );
      return;
    }

    // Validate filled rows
    const invalidRows = filledRows.filter(
      (r) => !r.firstName.trim() || !r.lastName.trim() || !r.employeeId.trim() || !r.pin.trim()
    );

    if (invalidRows.length > 0) {
      showErrorAlert(
        'Incomplete Details',
        'Please ensure First Name, Last Name, Employee ID, and PIN are specified for all active rows.'
      );
      return;
    }

    // Process each user
    let addedCount = 0;
    let updatedCount = 0;

    filledRows.forEach((r) => {
      const fName = r.firstName.trim();
      const mName = r.middleName.trim();
      const lName = r.lastName.trim();
      const fullName = [fName, mName, lName].filter(Boolean).join(' ');

      const existing = existingUsers.find(
        (u) => u.employeeId.toLowerCase() === r.employeeId.trim().toLowerCase()
      );

      const newUserObj: User = {
        id: existing ? existing.id : `usr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        employeeId: r.employeeId.trim(),
        name: fullName,
        firstName: fName,
        middleName: mName,
        lastName: lName,
        email: r.email.trim() || `${fName.toLowerCase()}@fbcrestaurants.com`,
        pin: r.pin.trim(),
        role: r.role,
        department: r.role === 'STAFF' ? 'Store Operations' : r.department,
        position: r.position.trim() || 'Staff Member',
        hourlyRate: 120,
        dateHired: r.dateHired || new Date().toISOString().split('T')[0],
        status: r.status,
        avatarUrl:
          existing?.avatarUrl ||
          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      };

      if (existing) {
        onUpdateUser(newUserObj);
        updatedCount++;
      } else {
        onAddUser(newUserObj);
        addedCount++;
      }
    });

    showSuccessAlert(
      'Quick Add Successful!',
      `Added ${addedCount} new user account(s)${updatedCount > 0 ? ` and updated ${updatedCount} existing account(s)` : ''}.`
    );

    onClose();
  };

  // Handle File Selection
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportedFile(file);
    setIsParsing(true);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet);

      if (!jsonData || jsonData.length === 0) {
        showErrorAlert('Empty File', 'The uploaded sheet contains no readable data rows.');
        setIsParsing(false);
        return;
      }

      const parsedList: QuickRowInput[] = jsonData.map((row, idx) => {
        const empId = String(
          row['Employee ID'] ||
            row['EmployeeID'] ||
            row['ID'] ||
            row['Emp ID'] ||
            `YC-${1080 + idx}`
        ).trim();

        const fName = String(
          row['First Name'] ||
            row['FirstName'] ||
            row['First_Name'] ||
            row['Name']?.split(' ')[0] ||
            'Staff'
        ).trim();

        const mName = String(row['Middle Name'] || row['MiddleName'] || '').trim();

        const lName = String(
          row['Last Name'] ||
            row['LastName'] ||
            row['Last_Name'] ||
            row['Name']?.split(' ').slice(1).join(' ') ||
            'Member'
        ).trim();

        const email = String(
          row['Email'] ||
            row['Email Address'] ||
            `${fName.toLowerCase()}.${lName.toLowerCase()}@fbcrestaurants.com`
        ).trim();

        const rawRole = String(
          row['Role'] || row['User Role'] || row['Role Title'] || 'STAFF'
        )
          .toUpperCase()
          .replace(/\s+/g, '_');

        const validRoles: UserRole[] = [
          'ADMIN',
          'STAFF',
          'PAYROLL',
          'SHIFT_MANAGER',
          'BRANCH_MANAGER',
        ];
        const role: UserRole = validRoles.includes(rawRole as UserRole)
          ? (rawRole as UserRole)
          : 'STAFF';

        const department = String(
          row['Department'] || row['Branch'] || 'YC Ayala'
        ).trim();

        const position = String(
          row['Position'] || row['Position Title'] || 'Staff Member'
        ).trim();

        const pin = String(
          row['Passcode PIN'] ||
            row['PIN'] ||
            row['Passcode'] ||
            Math.floor(1000 + Math.random() * 9000)
        ).trim();

        const dateHired = String(
          row['Date Hired'] ||
            row['DateHired'] ||
            row['Hire Date'] ||
            new Date().toISOString().split('T')[0]
        ).trim();

        const status =
          String(row['Status'] || 'ACTIVE')
            .toUpperCase()
            .trim() === 'INACTIVE'
            ? 'INACTIVE'
            : 'ACTIVE';

        return {
          tempId: `import-${idx}-${Date.now()}`,
          employeeId: empId,
          firstName: fName,
          middleName: mName,
          lastName: lName,
          email,
          role,
          department,
          position,
          pin,
          dateHired,
          status,
        };
      });

      setParsedUsers(parsedList);
    } catch (err) {
      console.error('Failed to parse file:', err);
      showErrorAlert(
        'Parsing Error',
        'Failed to parse Excel/CSV file. Please ensure valid file format (.xlsx, .csv).'
      );
    } finally {
      setIsParsing(false);
    }
  };

  // Execute Batch Import
  const handleExecuteImport = () => {
    if (parsedUsers.length === 0) return;

    let addedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    parsedUsers.forEach((r) => {
      const existing = existingUsers.find(
        (u) => u.employeeId.toLowerCase() === r.employeeId.toLowerCase()
      );

      if (existing && !overwriteDuplicates) {
        skippedCount++;
        return;
      }

      const fName = r.firstName || 'Staff';
      const mName = r.middleName || '';
      const lName = r.lastName || 'Member';
      const fullName = [fName, mName, lName].filter(Boolean).join(' ');

      const newUserObj: User = {
        id: existing
          ? existing.id
          : `usr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        employeeId: r.employeeId,
        name: fullName,
        firstName: fName,
        middleName: mName,
        lastName: lName,
        email: r.email,
        pin: r.pin,
        role: r.role,
        department: r.role === 'STAFF' ? 'Store Operations' : r.department,
        position: r.position,
        hourlyRate: 120,
        dateHired: r.dateHired,
        status: r.status,
        avatarUrl:
          existing?.avatarUrl ||
          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      };

      if (existing) {
        onUpdateUser(newUserObj);
        updatedCount++;
      } else {
        onAddUser(newUserObj);
        addedCount++;
      }
    });

    showSuccessAlert(
      'Import Completed!',
      `Successfully imported ${addedCount} new user(s). ${updatedCount > 0 ? `Updated ${updatedCount} existing account(s). ` : ''}${skippedCount > 0 ? `Skipped ${skippedCount} duplicates.` : ''}`
    );

    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-5xl w-full shadow-2xl border border-gray-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* MODAL HEADER */}
        <div className="bg-[#2C3524] text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#656D4A] flex items-center justify-center text-amber-200 border border-amber-300/30 shrink-0">
              <Zap className="w-5 h-5 fill-amber-300 text-amber-300" />
            </div>
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                Quick Add & Batch Import User Accounts
              </h2>
              <p className="text-xs text-amber-100/80">
                Rapidly add multiple staff profiles or import directly via CSV / Excel template
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={downloadUserImportTemplate}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-400/20 hover:bg-amber-400/30 text-amber-200 text-xs font-bold transition-colors cursor-pointer border border-amber-300/30"
              title="Download empty Excel import template with headers"
            >
              <Download className="w-3.5 h-3.5" /> Download Template
            </button>
            <button
              onClick={() => exportUsersToExcel(existingUsers)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-zinc-100 text-xs font-bold transition-colors cursor-pointer border border-white/20"
              title="Export all current active users in Excel format"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" /> Export Roster
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer ml-2"
            >
              ✕
            </button>
          </div>
        </div>

        {/* TAB SWITCHER */}
        <div className="bg-[#F7F8F5] border-b border-gray-200 px-6 pt-3 flex gap-2">
          <button
            onClick={() => setActiveTab('QUICK_ADD')}
            className={`px-4 py-2 text-xs font-bold rounded-t-xl transition-all cursor-pointer border-t border-x ${
              activeTab === 'QUICK_ADD'
                ? 'bg-white text-[#2C3524] border-gray-200 shadow-xs'
                : 'bg-gray-100/80 text-gray-500 border-transparent hover:text-gray-800'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-600" />
              Quick Add Multi-Row Table
            </span>
          </button>

          <button
            onClick={() => setActiveTab('IMPORT_FILE')}
            className={`px-4 py-2 text-xs font-bold rounded-t-xl transition-all cursor-pointer border-t border-x ${
              activeTab === 'IMPORT_FILE'
                ? 'bg-white text-[#2C3524] border-gray-200 shadow-xs'
                : 'bg-gray-100/80 text-gray-500 border-transparent hover:text-gray-800'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Upload className="w-3.5 h-3.5 text-[#656D4A]" />
              Import CSV / Excel Sheet
            </span>
          </button>
        </div>

        {/* TAB 1: QUICK ADD MULTI-ROW TABLE */}
        {activeTab === 'QUICK_ADD' && (
          <form onSubmit={handleSaveQuickRows} className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-[#2C3524] uppercase tracking-wider">
                  Fast Staff Account Batch Creation
                </h3>
                <p className="text-[11px] text-gray-500">
                  Type staff information directly into the grid below. Passcode PINs are auto-generated or editable.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleAddMoreRows(1)}
                  className="px-3 py-1.5 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5 text-[#656D4A]" /> Add 1 Row
                </button>
                <button
                  type="button"
                  onClick={() => handleAddMoreRows(3)}
                  className="px-3 py-1.5 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5 text-[#656D4A]" /> Add 3 Rows
                </button>
              </div>
            </div>

            {/* INTERACTIVE INPUT GRID */}
            <div className="overflow-x-auto border border-gray-200 rounded-xl max-h-[380px] overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F7F8F5] text-[#4A543E] font-bold uppercase tracking-wider sticky top-0 z-10 border-b border-gray-200">
                  <tr>
                    <th className="p-2.5 w-8 text-center">#</th>
                    <th className="p-2.5 w-28">Emp ID *</th>
                    <th className="p-2.5">First Name *</th>
                    <th className="p-2.5">Last Name *</th>
                    <th className="p-2.5 w-32">Role</th>
                    <th className="p-2.5 w-36">Branch / Dept</th>
                    <th className="p-2.5 w-32">Position</th>
                    <th className="p-2.5 w-28">PIN *</th>
                    <th className="p-2.5 w-10 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium bg-white">
                  {rows.map((row, idx) => {
                    const isDuplicate = existingUsers.some(
                      (u) =>
                        u.employeeId.toLowerCase() ===
                        row.employeeId.trim().toLowerCase()
                    );

                    return (
                      <tr key={row.tempId} className="hover:bg-amber-50/40">
                        <td className="p-2 text-center text-gray-400 font-bold">
                          {idx + 1}
                        </td>

                        {/* EMP ID */}
                        <td className="p-1.5">
                          <input
                            type="text"
                            required
                            value={row.employeeId}
                            onChange={(e) =>
                              handleRowChange(row.tempId, 'employeeId', e.target.value)
                            }
                            placeholder="YC-1090"
                            className={`w-full px-2 py-1.5 border rounded-lg font-mono text-xs font-bold focus:ring-1 focus:ring-[#656D4A] focus:outline-none ${
                              isDuplicate
                                ? 'border-amber-400 bg-amber-50 text-amber-900'
                                : 'border-gray-300'
                            }`}
                          />
                        </td>

                        {/* FIRST NAME */}
                        <td className="p-1.5">
                          <input
                            type="text"
                            required
                            value={row.firstName}
                            onChange={(e) =>
                              handleRowChange(row.tempId, 'firstName', e.target.value)
                            }
                            placeholder="e.g. Juan"
                            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs font-bold focus:ring-1 focus:ring-[#656D4A] focus:outline-none"
                          />
                        </td>

                        {/* LAST NAME */}
                        <td className="p-1.5">
                          <input
                            type="text"
                            required
                            value={row.lastName}
                            onChange={(e) =>
                              handleRowChange(row.tempId, 'lastName', e.target.value)
                            }
                            placeholder="e.g. Cruz"
                            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs font-bold focus:ring-1 focus:ring-[#656D4A] focus:outline-none"
                          />
                        </td>

                        {/* ROLE */}
                        <td className="p-1.5">
                          <select
                            value={row.role}
                            onChange={(e) =>
                              handleRowChange(
                                row.tempId,
                                'role',
                                e.target.value as UserRole
                              )
                            }
                            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs font-bold focus:ring-1 focus:ring-[#656D4A] focus:outline-none bg-white"
                          >
                            <option value="STAFF">STAFF</option>
                            <option value="SHIFT_MANAGER">SHIFT_MANAGER</option>
                            <option value="BRANCH_MANAGER">BRANCH_MANAGER</option>
                            <option value="PAYROLL">PAYROLL</option>
                            <option value="ADMIN">ADMIN</option>
                          </select>
                        </td>

                        {/* DEPARTMENT / BRANCH */}
                        <td className="p-1.5">
                          <select
                            value={row.department}
                            onChange={(e) =>
                              handleRowChange(row.tempId, 'department', e.target.value)
                            }
                            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-1 focus:ring-[#656D4A] focus:outline-none bg-white"
                          >
                            {STORE_BRANCHES.map((b) => (
                              <option key={b} value={b}>
                                {b}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* POSITION */}
                        <td className="p-1.5">
                          <input
                            type="text"
                            value={row.position}
                            onChange={(e) =>
                              handleRowChange(row.tempId, 'position', e.target.value)
                            }
                            placeholder="e.g. Kitchen Crew"
                            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-1 focus:ring-[#656D4A] focus:outline-none"
                          />
                        </td>

                        {/* PIN */}
                        <td className="p-1.5">
                          <div className="relative flex items-center">
                            <input
                              type="text"
                              required
                              maxLength={6}
                              value={row.pin}
                              onChange={(e) =>
                                handleRowChange(row.tempId, 'pin', e.target.value)
                              }
                              placeholder="1234"
                              className="w-full pl-2 pr-7 py-1.5 border border-gray-300 rounded-lg font-mono text-xs font-bold focus:ring-1 focus:ring-[#656D4A] focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => handleGenerateRandomPin(row.tempId)}
                              title="Regenerate Random PIN"
                              className="absolute right-1 text-gray-400 hover:text-amber-600 p-0.5 cursor-pointer"
                            >
                              <RefreshCw className="w-3 h-3" />
                            </button>
                          </div>
                        </td>

                        {/* ACTION */}
                        <td className="p-1.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveRow(row.tempId)}
                            className="p-1 text-gray-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Remove row"
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

            {/* ACTION FOOTER */}
            <div className="flex items-center justify-between pt-2 border-t border-gray-200">
              <div className="text-xs text-gray-500">
                Total Rows: <strong className="text-[#2C3524]">{rows.length}</strong>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl border border-gray-300 text-xs font-bold text-gray-600 hover:bg-gray-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#656D4A] hover:bg-[#4A543E] text-white text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4 text-white" /> Save & Create Accounts
                </button>
              </div>
            </div>
          </form>
        )}

        {/* TAB 2: IMPORT CSV / EXCEL FILE */}
        {activeTab === 'IMPORT_FILE' && (
          <div className="p-6 space-y-5">
            {/* FILE UPLOAD DROPZONE */}
            <div className="border-2 border-dashed border-[#656D4A]/40 rounded-2xl p-6 bg-[#F7F8F5] text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-[#656D4A]/10 text-[#656D4A] flex items-center justify-center mx-auto">
                <FileSpreadsheet className="w-6 h-6" />
              </div>

              <div>
                <h3 className="text-sm font-bold text-[#2C3524]">
                  Upload User Accounts Excel or CSV File
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Supports .xlsx, .xls, and .csv files. Columns required: Employee ID, First Name, Last Name, Passcode PIN
                </p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileSelect}
                className="hidden"
              />

              <div className="flex items-center justify-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 rounded-xl bg-[#656D4A] hover:bg-[#4A543E] text-white text-xs font-bold cursor-pointer shadow-xs inline-flex items-center gap-1.5"
                >
                  <Upload className="w-4 h-4" /> Browse File
                </button>
                <button
                  type="button"
                  onClick={downloadUserImportTemplate}
                  className="px-4 py-2 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Download className="w-4 h-4 text-amber-700" /> Download Excel Format Template
                </button>
              </div>

              {importedFile && (
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-300 mt-2">
                  <Check className="w-3.5 h-3.5 text-emerald-600" /> Selected: {importedFile.name}
                </div>
              )}
            </div>

            {/* PREVIEW TABLE OF PARSED USERS */}
            {parsedUsers.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-600" />
                    <span className="text-xs font-bold text-[#2C3524]">
                      Parsed {parsedUsers.length} Employee Records from File
                    </span>
                  </div>

                  <label className="flex items-center gap-2 text-xs font-bold text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={overwriteDuplicates}
                      onChange={(e) => setOverwriteDuplicates(e.target.checked)}
                      className="rounded text-[#656D4A] focus:ring-[#656D4A]"
                    />
                    Overwrite existing profiles if Employee ID already exists
                  </label>
                </div>

                <div className="overflow-x-auto border border-gray-200 rounded-xl max-h-[260px] overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F7F8F5] text-[#4A543E] font-bold uppercase tracking-wider sticky top-0 z-10 border-b border-gray-200">
                      <tr>
                        <th className="p-2.5">Emp ID</th>
                        <th className="p-2.5">Name</th>
                        <th className="p-2.5">Role</th>
                        <th className="p-2.5">Branch / Dept</th>
                        <th className="p-2.5">Position</th>
                        <th className="p-2.5">PIN</th>
                        <th className="p-2.5">Import Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-medium bg-white">
                      {parsedUsers.map((u) => {
                        const isExisting = existingUsers.some(
                          (ex) =>
                            ex.employeeId.toLowerCase() ===
                            u.employeeId.toLowerCase()
                        );

                        return (
                          <tr key={u.tempId} className="hover:bg-gray-50">
                            <td className="p-2.5 font-mono font-bold text-[#2C3524]">
                              {u.employeeId}
                            </td>
                            <td className="p-2.5 font-bold text-[#2C3524]">
                              {[u.firstName, u.lastName].join(' ')}
                            </td>
                            <td className="p-2.5">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E6E8DE] text-[#2C3524]">
                                {u.role}
                              </span>
                            </td>
                            <td className="p-2.5">{u.department}</td>
                            <td className="p-2.5">{u.position}</td>
                            <td className="p-2.5 font-mono font-bold">{u.pin}</td>
                            <td className="p-2.5">
                              {isExisting ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                  {overwriteDuplicates ? 'Will Update' : 'Duplicate (Skip)'}
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                  New Account
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl border border-gray-300 text-xs font-bold text-gray-600 hover:bg-gray-100 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteImport}
                    className="px-5 py-2 rounded-xl bg-[#656D4A] hover:bg-[#4A543E] text-white text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
                  >
                    <Check className="w-4 h-4 text-white" /> Import {parsedUsers.length} User Records
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
