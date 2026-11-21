import React, { useMemo, useState, useEffect } from 'react';
import {
  StoreTicket,
  StoreTicketCategory,
  StoreTicketPriority,
  StoreTicketStatus,
  User,
} from '../types';
import { formatRealtimeTimestamp } from '../utils/timeFormatters';
import {
  showErrorAlert,
  showSuccessAlert,
  yellowCabSwal,
} from '../utils/sweetAlerts';
import { TablePagination } from './TablePagination';
import {
  Ticket,
  PlusCircle,
  Search,
  Filter,
  Building2,
  Clock,
  CheckCircle2,
  PauseCircle,
  XCircle,
  Loader2,
  AlertTriangle,
  Eye,
  Edit3,
  Trash2,
  MessageSquareText,
  History,
  X,
  Wrench,
  Monitor,
  Package,
  Building,
  HelpCircle,
} from 'lucide-react';

export const STORE_TICKET_BRANCHES: string[] = [
  'YC Ebloc',
  'YC Ramos',
  'YC Talisay',
  'YC SM Seaside',
  'YC Ayala',
  'YC Banilad',
  'Central Warehouse',
  'Head Office / Admin',
];

export const STORE_TICKET_CATEGORIES: StoreTicketCategory[] = [
  'Equipment',
  'IT',
  'Supplies',
  'Facility',
  'Other',
];

export const STORE_TICKET_PRIORITIES: { value: StoreTicketPriority; label: string }[] = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
];

export const STORE_TICKET_STATUSES: { value: StoreTicketStatus; label: string }[] = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'ON_HOLD', label: 'On Hold' },
  { value: 'DONE', label: 'Done' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

interface StoreTicketingDashboardProps {
  currentUser: User;
  tickets: StoreTicket[];
  onCreateTicket: (payload: {
    branch: string;
    category: StoreTicketCategory;
    priority: StoreTicketPriority;
    subject: string;
    description: string;
  }) => Promise<boolean>;
  onUpdateTicketStatus: (
    ticketId: string,
    newStatus: StoreTicketStatus,
    adminNotes: string
  ) => Promise<boolean>;
  onDeleteTicket: (ticketId: string) => Promise<boolean>;
}

const getStatusConfig = (status: StoreTicketStatus) => {
  switch (status) {
    case 'PENDING':
      return {
        label: 'Pending',
        className: 'bg-amber-100 text-amber-900 border-amber-300',
        Icon: Clock,
      };
    case 'IN_PROGRESS':
      return {
        label: 'In Progress',
        className: 'bg-sky-100 text-sky-900 border-sky-300',
        Icon: Loader2,
      };
    case 'ON_HOLD':
      return {
        label: 'On Hold',
        className: 'bg-orange-100 text-orange-900 border-orange-300',
        Icon: PauseCircle,
      };
    case 'DONE':
      return {
        label: 'Done',
        className: 'bg-emerald-100 text-emerald-900 border-emerald-300',
        Icon: CheckCircle2,
      };
    case 'CANCELLED':
      return {
        label: 'Cancelled',
        className: 'bg-zinc-200 text-zinc-700 border-zinc-300',
        Icon: XCircle,
      };
  }
};

const getPriorityConfig = (priority: StoreTicketPriority) => {
  switch (priority) {
    case 'URGENT':
      return {
        label: 'Urgent',
        className: 'bg-rose-100 text-rose-900 border-rose-300',
      };
    case 'HIGH':
      return {
        label: 'High',
        className: 'bg-orange-100 text-orange-900 border-orange-300',
      };
    case 'MEDIUM':
      return {
        label: 'Medium',
        className: 'bg-amber-50 text-amber-900 border-amber-300',
      };
    case 'LOW':
    default:
      return {
        label: 'Low',
        className: 'bg-zinc-100 text-zinc-700 border-zinc-300',
      };
  }
};

const getCategoryIcon = (category: StoreTicketCategory) => {
  switch (category) {
    case 'Equipment':
      return Wrench;
    case 'IT':
      return Monitor;
    case 'Supplies':
      return Package;
    case 'Facility':
      return Building;
    case 'Other':
    default:
      return HelpCircle;
  }
};

const getDefaultBranchForUser = (user: User): string => {
  const candidate = (user.branch || user.department || '').trim();
  const matched = STORE_TICKET_BRANCHES.find(
    (b) => b.toLowerCase() === candidate.toLowerCase()
  );
  return matched || STORE_TICKET_BRANCHES[0];
};

export const StoreTicketingDashboard: React.FC<StoreTicketingDashboardProps> = ({
  currentUser,
  tickets,
  onCreateTicket,
  onUpdateTicketStatus,
  onDeleteTicket,
}) => {
  const isAdmin = currentUser.role === 'ADMIN';

  // Filters & Pagination State
  const [searchQuery, setSearchQuery] = useState('');
  const [branchFilter, setBranchFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | StoreTicketCategory>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | StoreTicketPriority>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | StoreTicketStatus>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Create Ticket Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formBranch, setFormBranch] = useState<string>(() => getDefaultBranchForUser(currentUser));
  const [formCategory, setFormCategory] = useState<StoreTicketCategory>('Equipment');
  const [formPriority, setFormPriority] = useState<StoreTicketPriority>('MEDIUM');
  const [formSubject, setFormSubject] = useState('');
  const [formDescription, setFormDescription] = useState('');

  // Detail / Admin Update Modal State
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [modalStatus, setModalStatus] = useState<StoreTicketStatus>('PENDING');
  const [modalAdminNotes, setModalAdminNotes] = useState('');
  const [isUpdatingTicket, setIsUpdatingTicket] = useState(false);

  const selectedTicket = useMemo(
    () => tickets.find((t) => t.id === selectedTicketId) || null,
    [tickets, selectedTicketId]
  );

  // Available branches combining standard options + any existing branch values in tickets
  const availableBranchOptions = useMemo(() => {
    const set = new Set<string>(STORE_TICKET_BRANCHES);
    for (const t of tickets) {
      if (t.branch && t.branch.trim()) set.add(t.branch.trim());
    }
    return Array.from(set);
  }, [tickets]);

  // Status KPI counts
  const counts = useMemo(() => {
    return {
      total: tickets.length,
      pending: tickets.filter((t) => t.status === 'PENDING').length,
      inProgress: tickets.filter((t) => t.status === 'IN_PROGRESS').length,
      onHold: tickets.filter((t) => t.status === 'ON_HOLD').length,
      done: tickets.filter((t) => t.status === 'DONE').length,
      cancelled: tickets.filter((t) => t.status === 'CANCELLED').length,
    };
  }, [tickets]);

  // Filtered tickets list
  const filteredTickets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return tickets.filter((t) => {
      const matchesSearch =
        !q ||
        (t.ticketNumber || '').toLowerCase().includes(q) ||
        (t.branch || '').toLowerCase().includes(q) ||
        (t.subject || '').toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q) ||
        (t.requestedByName || '').toLowerCase().includes(q) ||
        (t.category || '').toLowerCase().includes(q) ||
        (t.adminNotes || '').toLowerCase().includes(q);

      const matchesBranch = branchFilter === 'ALL' || t.branch === branchFilter;
      const matchesCategory = categoryFilter === 'ALL' || t.category === categoryFilter;
      const matchesPriority = priorityFilter === 'ALL' || t.priority === priorityFilter;
      const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;

      return (
        matchesSearch &&
        matchesBranch &&
        matchesCategory &&
        matchesPriority &&
        matchesStatus
      );
    });
  }, [tickets, searchQuery, branchFilter, categoryFilter, priorityFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / pageSize));

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, branchFilter, categoryFilter, priorityFilter, statusFilter]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedTickets = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTickets.slice(start, start + pageSize);
  }, [filteredTickets, currentPage, pageSize]);

  const handleOpenCreateModal = () => {
    setFormBranch(getDefaultBranchForUser(currentUser));
    setFormCategory('Equipment');
    setFormPriority('MEDIUM');
    setFormSubject('');
    setFormDescription('');
    setShowCreateModal(true);
  };

  const handleSubmitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const cleanSubject = formSubject.trim();
    const cleanDescription = formDescription.trim();
    const cleanBranch = formBranch.trim();

    if (!cleanBranch || !cleanSubject || !cleanDescription) {
      showErrorAlert(
        'Incomplete Ticket Details',
        'Please select the requesting branch and fill in both the subject and concern details.'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const ok = await onCreateTicket({
        branch: cleanBranch,
        category: formCategory,
        priority: formPriority,
        subject: cleanSubject,
        description: cleanDescription,
      });

      if (!ok) {
        showErrorAlert(
          'Ticket Submission Failed',
          'Could not save your store concern ticket to the cloud database. Please try again.'
        );
        return;
      }

      setShowCreateModal(false);
      showSuccessAlert(
        'Store Ticket Submitted',
        `Your ${formCategory} concern for ${cleanBranch} has been sent to Admin with Pending status.`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenTicketDetail = (ticket: StoreTicket) => {
    setSelectedTicketId(ticket.id);
    setModalStatus(ticket.status);
    setModalAdminNotes(ticket.adminNotes || '');
  };

  const handleSaveAdminUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !isAdmin || isUpdatingTicket) return;

    setIsUpdatingTicket(true);
    try {
      const ok = await onUpdateTicketStatus(
        selectedTicket.id,
        modalStatus,
        modalAdminNotes.trim()
      );
      if (!ok) {
        showErrorAlert(
          'Update Failed',
          'Unable to save ticket status and resolution notes. Please try again.'
        );
        return;
      }

      const statusLabel = getStatusConfig(modalStatus).label;
      showSuccessAlert(
        'Ticket Updated',
        `${selectedTicket.ticketNumber} (${selectedTicket.branch}) is now marked as ${statusLabel}.`
      );
      setSelectedTicketId(null);
    } finally {
      setIsUpdatingTicket(false);
    }
  };

  const handleCancelOwnPendingTicket = async (ticket: StoreTicket) => {
    const confirm = await yellowCabSwal.fire({
      title: 'Cancel Store Ticket?',
      html: `<div style="text-align: left; font-size: 13px;">
        <p style="margin-bottom: 6px;">Are you sure you want to cancel ticket <strong>${ticket.ticketNumber}</strong>?</p>
        <p><strong>Branch:</strong> ${ticket.branch}</p>
        <p><strong>Concern:</strong> ${ticket.subject}</p>
      </div>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, Cancel Ticket',
      cancelButtonText: 'Keep Pending',
      confirmButtonColor: '#dc2626',
    });

    if (confirm.isConfirmed) {
      const ok = await onUpdateTicketStatus(
        ticket.id,
        'CANCELLED',
        ticket.adminNotes || `Cancelled by requester (${currentUser.name})`
      );
      if (ok) {
        showSuccessAlert('Ticket Cancelled', `${ticket.ticketNumber} has been marked as Cancelled.`);
        if (selectedTicketId === ticket.id) setSelectedTicketId(null);
      } else {
        showErrorAlert('Action Failed', 'Could not cancel ticket. Please try again.');
      }
    }
  };

  const handleDeleteTicketClick = async (ticket: StoreTicket) => {
    if (!isAdmin) return;
    const confirm = await yellowCabSwal.fire({
      title: 'Delete Store Ticket?',
      html: `<div style="text-align: left; font-size: 13px;">
        <p style="margin-bottom: 6px;">Permanently delete ticket <strong>${ticket.ticketNumber}</strong>?</p>
        <p><strong>Requesting Branch:</strong> ${ticket.branch}</p>
        <p><strong>Concern:</strong> ${ticket.subject}</p>
        <p style="color: #dc2626; font-weight: 700; margin-top: 8px;">This permanently removes the ticket record from the cloud database.</p>
      </div>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, Delete Ticket',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#dc2626',
    });

    if (confirm.isConfirmed) {
      const ok = await onDeleteTicket(ticket.id);
      if (ok) {
        showSuccessAlert('Ticket Deleted', `${ticket.ticketNumber} has been permanently removed.`);
        if (selectedTicketId === ticket.id) setSelectedTicketId(null);
      } else {
        showErrorAlert('Delete Failed', 'Could not delete ticket. Please try again.');
      }
    }
  };

  return (
    <div id="store-ticketing-dashboard" className="space-y-6">
      {/* Main Container */}
      <div className="bg-white rounded-2xl border border-[#D3D8C8] p-5 sm:p-6 shadow-xs space-y-5">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-zinc-950 text-amber-400 flex items-center justify-center shrink-0 border border-amber-400/40">
              <Ticket className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-black text-[#2C3524] tracking-tight">
                Store Concern Ticketing Portal
              </h1>
              <p className="text-xs text-zinc-500 mt-0.5">
                {isAdmin
                  ? 'Review store concerns across all Yellow Cab branches, update ticket statuses, and post resolution notes.'
                  : 'Submit store equipment, IT, supply, or facility requests to Admin and monitor live resolution status across branches.'}
              </p>
            </div>
          </div>

          <button
            id="btn-create-store-ticket"
            type="button"
            onClick={handleOpenCreateModal}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#656D4A] hover:bg-[#4A543E] text-white text-xs font-bold shadow-xs transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Submit Store Concern</span>
          </button>
        </div>

        {/* Status KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-3.5 rounded-xl border border-[#D3D8C8] bg-[#F7F8F5]">
            <span className="text-[11px] font-bold text-zinc-500 block">Total Tickets</span>
            <div className="text-xl font-black text-[#2C3524] font-mono tabular-nums mt-0.5">
              {counts.total}
            </div>
          </div>
          <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/70">
            <span className="text-[11px] font-bold text-amber-800 block">Pending</span>
            <div className="text-xl font-black text-amber-900 font-mono tabular-nums mt-0.5">
              {counts.pending}
            </div>
          </div>
          <div className="p-3.5 rounded-xl border border-sky-200 bg-sky-50/70">
            <span className="text-[11px] font-bold text-sky-800 block">In Progress</span>
            <div className="text-xl font-black text-sky-900 font-mono tabular-nums mt-0.5">
              {counts.inProgress}
            </div>
          </div>
          <div className="p-3.5 rounded-xl border border-orange-200 bg-orange-50/70">
            <span className="text-[11px] font-bold text-orange-800 block">On Hold</span>
            <div className="text-xl font-black text-orange-900 font-mono tabular-nums mt-0.5">
              {counts.onHold}
            </div>
          </div>
          <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/70">
            <span className="text-[11px] font-bold text-emerald-800 block">Done</span>
            <div className="text-xl font-black text-emerald-900 font-mono tabular-nums mt-0.5">
              {counts.done}
            </div>
          </div>
          <div className="p-3.5 rounded-xl border border-zinc-200 bg-zinc-50">
            <span className="text-[11px] font-bold text-zinc-600 block">Cancelled</span>
            <div className="text-xl font-black text-zinc-800 font-mono tabular-nums mt-0.5">
              {counts.cancelled}
            </div>
          </div>
        </div>

        {/* Search & Multi-Filter Bar */}
        <div className="space-y-3 bg-zinc-50 p-3.5 rounded-xl border border-zinc-200">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
            {/* Search Input */}
            <div className="relative md:col-span-5">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="input-search-store-tickets"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search ticket #, branch, subject, requester, or notes..."
                className="w-full pl-9 pr-8 py-2 bg-white border border-zinc-300 rounded-xl text-xs font-medium text-zinc-900 focus:ring-2 focus:ring-[#656D4A] focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 text-xs font-bold cursor-pointer"
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Branch Filter */}
            <div className="md:col-span-3 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-zinc-500 shrink-0 hidden sm:block" />
              <select
                id="select-filter-ticket-branch"
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="w-full bg-white border border-zinc-300 text-zinc-900 text-xs rounded-xl p-2 font-bold focus:ring-2 focus:ring-[#656D4A] focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Requesting Branches</option>
                {availableBranchOptions.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            {/* Category Filter */}
            <div className="md:col-span-2 flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-zinc-500 shrink-0 hidden sm:block" />
              <select
                id="select-filter-ticket-category"
                value={categoryFilter}
                onChange={(e) =>
                  setCategoryFilter(e.target.value as 'ALL' | StoreTicketCategory)
                }
                className="w-full bg-white border border-zinc-300 text-zinc-900 text-xs rounded-xl p-2 font-bold focus:ring-2 focus:ring-[#656D4A] focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Categories</option>
                {STORE_TICKET_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Priority Filter */}
            <div className="md:col-span-2">
              <select
                id="select-filter-ticket-priority"
                value={priorityFilter}
                onChange={(e) =>
                  setPriorityFilter(e.target.value as 'ALL' | StoreTicketPriority)
                }
                className="w-full bg-white border border-zinc-300 text-zinc-900 text-xs rounded-xl p-2 font-bold focus:ring-2 focus:ring-[#656D4A] focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Priorities</option>
                {STORE_TICKET_PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label} Priority
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Segmented Status Filter Bar */}
          <div className="flex items-center gap-1.5 pt-2 border-t border-zinc-200/70 overflow-x-auto">
            <span className="text-[11px] font-bold text-zinc-500 mr-1 whitespace-nowrap">
              Status:
            </span>
            {(
              [
                { id: 'ALL', label: `All (${counts.total})` },
                { id: 'PENDING', label: `Pending (${counts.pending})` },
                { id: 'IN_PROGRESS', label: `In Progress (${counts.inProgress})` },
                { id: 'ON_HOLD', label: `On Hold (${counts.onHold})` },
                { id: 'DONE', label: `Done (${counts.done})` },
                { id: 'CANCELLED', label: `Cancelled (${counts.cancelled})` },
              ] as const
            ).map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setStatusFilter(st.id)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 tabular-nums ${
                  statusFilter === st.id
                    ? 'bg-[#2C3524] text-white shadow-2xs'
                    : 'bg-zinc-200/70 hover:bg-zinc-200 text-zinc-700'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        {/* Empty State */}
        {filteredTickets.length === 0 ? (
          <div className="p-10 text-center bg-[#FAF9F5] rounded-xl border border-dashed border-zinc-300 space-y-3">
            <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto border border-amber-300">
              <Ticket className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-[#2C3524]">
                {tickets.length === 0
                  ? 'No store concern tickets submitted yet'
                  : 'No tickets match your selected filters'}
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                {tickets.length === 0
                  ? 'Click "Submit Store Concern" to report an equipment, IT, supply, or facility request to Admin.'
                  : 'Try clearing your search query or switching branch and status filters.'}
              </p>
            </div>
            {tickets.length === 0 ? (
              <button
                type="button"
                onClick={handleOpenCreateModal}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#656D4A] hover:bg-[#4A543E] text-white text-xs font-bold cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                Submit First Store Ticket
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setBranchFilter('ALL');
                  setCategoryFilter('ALL');
                  setPriorityFilter('ALL');
                  setStatusFilter('ALL');
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-700 text-xs font-bold cursor-pointer"
              >
                Reset Filters
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
              {paginatedTickets.map((t) => {
                const statusCfg = getStatusConfig(t.status);
                const priorityCfg = getPriorityConfig(t.priority);
                const StatusIcon = statusCfg.Icon;
                const CategoryIcon = getCategoryIcon(t.category);
                const canCancelOwn =
                  !isAdmin &&
                  t.status === 'PENDING' &&
                  t.requestedByEmployeeId === currentUser.employeeId;

                return (
                  <div
                    key={`mob-ticket-${t.id}`}
                    className="p-4 rounded-xl border border-zinc-200 bg-white space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs font-mono font-black text-zinc-900 tabular-nums">
                          {t.ticketNumber}
                        </div>
                        <div className="text-xs font-bold text-[#2C3524] flex items-center gap-1 mt-0.5">
                          <Building2 className="w-3.5 h-3.5 text-[#656D4A] shrink-0" />
                          <span className="truncate">{t.branch}</span>
                        </div>
                      </div>

                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-bold shrink-0 ${statusCfg.className}`}
                      >
                        <StatusIcon className="w-3.5 h-3.5" />
                        <span>{statusCfg.label}</span>
                      </span>
                    </div>

                    <div className="space-y-1">
                      <h3 className="text-sm font-bold text-zinc-900 leading-snug">
                        {t.subject}
                      </h3>
                      <p className="text-xs text-zinc-600 line-clamp-2">{t.description}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-600">
                      <span className="inline-flex items-center gap-1 font-semibold text-zinc-800">
                        <CategoryIcon className="w-3.5 h-3.5 text-zinc-500" />
                        {t.category}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-bold ${priorityCfg.className}`}
                      >
                        {priorityCfg.label}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>By {t.requestedByName}</span>
                    </div>

                    {t.adminNotes && (
                      <div className="p-2.5 rounded-lg bg-[#F7F8F5] border border-[#D3D8C8] text-xs text-[#2C3524]">
                        <span className="font-bold">Admin Note: </span>
                        <span>{t.adminNotes}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-zinc-100 text-[11px] text-zinc-500">
                      <span className="font-mono tabular-nums">
                        {formatRealtimeTimestamp(t.updatedAt || t.createdAt)}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenTicketDetail(t)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-800 text-xs font-bold cursor-pointer"
                        >
                          {isAdmin ? (
                            <>
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Manage</span>
                            </>
                          ) : (
                            <>
                              <Eye className="w-3.5 h-3.5" />
                              <span>Details</span>
                            </>
                          )}
                        </button>
                        {canCancelOwn && (
                          <button
                            type="button"
                            onClick={() => handleCancelOwnPendingTicket(t)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold cursor-pointer"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Cancel</span>
                          </button>
                        )}
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => handleDeleteTicketClick(t)}
                            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold cursor-pointer"
                            title="Delete Ticket"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Data Table */}
            <div className="hidden md:block overflow-x-auto border border-zinc-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F7F8F5] text-[#4A543E] font-bold uppercase tracking-wider border-b border-zinc-200">
                  <tr>
                    <th className="p-3 whitespace-nowrap">Ticket # / Submitted</th>
                    <th className="p-3 whitespace-nowrap">Requesting Branch</th>
                    <th className="p-3 whitespace-nowrap">Category &amp; Priority</th>
                    <th className="p-3">Store Concern</th>
                    <th className="p-3 whitespace-nowrap">Status</th>
                    <th className="p-3 whitespace-nowrap">Admin Notes &amp; Updated</th>
                    <th className="p-3 text-right whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {paginatedTickets.map((t) => {
                    const statusCfg = getStatusConfig(t.status);
                    const priorityCfg = getPriorityConfig(t.priority);
                    const StatusIcon = statusCfg.Icon;
                    const CategoryIcon = getCategoryIcon(t.category);
                    const canCancelOwn =
                      !isAdmin &&
                      t.status === 'PENDING' &&
                      t.requestedByEmployeeId === currentUser.employeeId;

                    return (
                      <tr
                        key={t.id}
                        className="hover:bg-zinc-50/90 transition-colors align-top"
                      >
                        <td className="p-3 whitespace-nowrap">
                          <div className="font-mono font-black text-zinc-900 tabular-nums">
                            {t.ticketNumber}
                          </div>
                          <div className="text-[11px] text-zinc-600 font-semibold mt-0.5">
                            {t.requestedByName}
                          </div>
                          <div className="text-[10px] font-mono text-zinc-400 tabular-nums">
                            {formatRealtimeTimestamp(t.createdAt)}
                          </div>
                        </td>

                        <td className="p-3 whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5 font-bold text-[#2C3524]">
                            <Building2 className="w-3.5 h-3.5 text-[#656D4A] shrink-0" />
                            <span>{t.branch}</span>
                          </div>
                        </td>

                        <td className="p-3 whitespace-nowrap">
                          <div className="space-y-1.5">
                            <div className="inline-flex items-center gap-1.5 font-semibold text-zinc-800">
                              <CategoryIcon className="w-3.5 h-3.5 text-zinc-500" />
                              <span>{t.category}</span>
                            </div>
                            <div>
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-bold ${priorityCfg.className}`}
                              >
                                {priorityCfg.label} Priority
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="p-3 max-w-[280px]">
                          <div className="font-bold text-zinc-900">{t.subject}</div>
                          <div
                            className="text-[11px] text-zinc-600 line-clamp-2 mt-0.5"
                            title={t.description}
                          >
                            {t.description}
                          </div>
                        </td>

                        <td className="p-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-bold ${statusCfg.className}`}
                          >
                            <StatusIcon className="w-3.5 h-3.5" />
                            <span>{statusCfg.label}</span>
                          </span>
                        </td>

                        <td className="p-3 max-w-[240px]">
                          {t.adminNotes ? (
                            <div
                              className="text-zinc-800 text-[11px] line-clamp-2"
                              title={t.adminNotes}
                            >
                              {t.adminNotes}
                            </div>
                          ) : (
                            <span className="text-[11px] text-zinc-400 italic">
                              No resolution notes yet
                            </span>
                          )}
                          <div className="text-[10px] font-mono text-zinc-500 tabular-nums mt-1">
                            {t.updatedAt
                              ? `Updated ${formatRealtimeTimestamp(t.updatedAt)}${
                                  t.updatedBy ? ` · ${t.updatedBy}` : ''
                                }`
                              : 'Awaiting review'}
                          </div>
                        </td>

                        <td className="p-3 text-right whitespace-nowrap">
                          <div className="inline-flex items-center justify-end gap-1">
                            <button
                              id={`btn-view-ticket-${t.id}`}
                              type="button"
                              onClick={() => handleOpenTicketDetail(t)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-zinc-300 bg-white hover:bg-amber-50 text-zinc-800 text-[11px] font-bold cursor-pointer transition-colors"
                              title={
                                isAdmin
                                  ? 'Update Status & Add Resolution Notes'
                                  : 'View Ticket Details & Resolution Notes'
                              }
                            >
                              {isAdmin ? (
                                <>
                                  <Edit3 className="w-3.5 h-3.5 text-[#656D4A]" />
                                  <span>Update</span>
                                </>
                              ) : (
                                <>
                                  <Eye className="w-3.5 h-3.5 text-[#656D4A]" />
                                  <span>View</span>
                                </>
                              )}
                            </button>

                            {canCancelOwn && (
                              <button
                                type="button"
                                onClick={() => handleCancelOwnPendingTicket(t)}
                                title="Cancel your pending ticket"
                                className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            )}

                            {isAdmin && (
                              <button
                                id={`btn-delete-ticket-${t.id}`}
                                type="button"
                                onClick={() => handleDeleteTicketClick(t)}
                                title="Delete Ticket Permanently"
                                className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <TablePagination
                currentPage={currentPage}
                totalPages={totalPages}
                pageSize={pageSize}
                totalItems={filteredTickets.length}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
              />
            </div>

            {/* Mobile Pagination */}
            <div className="md:hidden border border-zinc-200 rounded-xl overflow-hidden">
              <TablePagination
                currentPage={currentPage}
                totalPages={totalPages}
                pageSize={pageSize}
                totalItems={filteredTickets.length}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
              />
            </div>
          </>
        )}
      </div>

      {/* CREATE STORE TICKET MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-zinc-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-zinc-950 text-amber-400 flex items-center justify-center shrink-0">
                  <Ticket className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-black text-[#2C3524]">
                    Submit Store Concern Ticket
                  </h2>
                  <p className="text-xs text-zinc-500">
                    Report a store request or issue directly to Admin
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 text-zinc-400 hover:text-zinc-700 rounded-lg cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitCreate} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">
                  Requesting Branch <span className="text-rose-500">*</span>
                </label>
                <select
                  id="select-ticket-branch"
                  required
                  value={formBranch}
                  onChange={(e) => setFormBranch(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-xs font-bold text-zinc-900 focus:ring-2 focus:ring-[#656D4A] focus:outline-none bg-white"
                >
                  {STORE_TICKET_BRANCHES.map((branch) => (
                    <option key={branch} value={branch}>
                      {branch}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">
                    Concern Category <span className="text-rose-500">*</span>
                  </label>
                  <select
                    id="select-ticket-category"
                    value={formCategory}
                    onChange={(e) =>
                      setFormCategory(e.target.value as StoreTicketCategory)
                    }
                    className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-xs font-bold text-zinc-900 focus:ring-2 focus:ring-[#656D4A] focus:outline-none bg-white"
                  >
                    {STORE_TICKET_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">
                    Priority Level <span className="text-rose-500">*</span>
                  </label>
                  <select
                    id="select-ticket-priority"
                    value={formPriority}
                    onChange={(e) =>
                      setFormPriority(e.target.value as StoreTicketPriority)
                    }
                    className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-xs font-bold text-zinc-900 focus:ring-2 focus:ring-[#656D4A] focus:outline-none bg-white"
                  >
                    {STORE_TICKET_PRIORITIES.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">
                  Concern Subject <span className="text-rose-500">*</span>
                </label>
                <input
                  id="input-ticket-subject"
                  type="text"
                  required
                  maxLength={120}
                  value={formSubject}
                  onChange={(e) => setFormSubject(e.target.value)}
                  placeholder="e.g. Pizza oven thermostat malfunctioning / POS receipt printer offline"
                  className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-xs font-medium text-zinc-900 focus:ring-2 focus:ring-[#656D4A] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">
                  Detailed Description <span className="text-rose-500">*</span>
                </label>
                <textarea
                  id="input-ticket-description"
                  rows={4}
                  required
                  maxLength={1000}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Describe the store concern, affected equipment or area, and any urgent operational impact..."
                  className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-xs font-medium text-zinc-900 focus:ring-2 focus:ring-[#656D4A] focus:outline-none"
                />
              </div>

              <div className="bg-[#FAF9F5] border border-zinc-200 rounded-xl p-3 text-[11px] text-zinc-600 flex items-center justify-between gap-2">
                <span>
                  Submitted by <strong className="text-zinc-900">{currentUser.name}</strong> (
                  {currentUser.employeeId})
                </span>
                <span className="font-bold text-amber-800">Initial Status: Pending</span>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-200">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-bold text-zinc-600 rounded-xl hover:bg-zinc-100 cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  id="btn-submit-new-ticket"
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-[#656D4A] hover:bg-[#4A543E] text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer disabled:opacity-60"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TICKET DETAIL & ADMIN RESOLUTION MODAL */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-zinc-200 space-y-5 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 border-b border-zinc-200 pb-3.5">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-mono font-black text-zinc-900 tabular-nums">
                    {selectedTicket.ticketNumber}
                  </span>
                  <span aria-hidden="true" className="text-zinc-400">·</span>
                  <span className="font-bold text-[#2C3524] flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-[#656D4A]" />
                    {selectedTicket.branch}
                  </span>
                  <span aria-hidden="true" className="text-zinc-400">·</span>
                  <span className="font-semibold text-zinc-700">{selectedTicket.category}</span>
                </div>
                <h2 className="text-base sm:text-lg font-black text-[#2C3524]">
                  {selectedTicket.subject}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setSelectedTicketId(null)}
                className="p-1.5 text-zinc-400 hover:text-zinc-700 rounded-lg cursor-pointer shrink-0"
                aria-label="Close details"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Metadata Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#F7F8F5] p-3.5 rounded-xl border border-[#D3D8C8] text-xs">
              <div>
                <span className="text-[10px] font-bold uppercase text-zinc-500 block">
                  Current Status
                </span>
                <div className="mt-1">
                  {(() => {
                    const cfg = getStatusConfig(selectedTicket.status);
                    const Icon = cfg.Icon;
                    return (
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-bold ${cfg.className}`}
                      >
                        <Icon className="w-3 h-3" />
                        {cfg.label}
                      </span>
                    );
                  })()}
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase text-zinc-500 block">
                  Priority
                </span>
                <div className="mt-1">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded border text-[11px] font-bold ${
                      getPriorityConfig(selectedTicket.priority).className
                    }`}
                  >
                    {getPriorityConfig(selectedTicket.priority).label}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase text-zinc-500 block">
                  Requested By
                </span>
                <div className="font-bold text-zinc-900 mt-1 truncate">
                  {selectedTicket.requestedByName}
                </div>
                <div className="text-[10px] font-mono text-zinc-500">
                  {selectedTicket.requestedByEmployeeId}
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase text-zinc-500 block">
                  Submitted At
                </span>
                <div className="font-mono font-semibold text-zinc-800 mt-1 tabular-nums text-[11px]">
                  {formatRealtimeTimestamp(selectedTicket.createdAt)}
                </div>
                {selectedTicket.resolvedAt && (
                  <div className="text-[10px] font-mono text-emerald-700 font-bold tabular-nums">
                    Done: {formatRealtimeTimestamp(selectedTicket.resolvedAt)}
                  </div>
                )}
              </div>
            </div>

            {/* Store Concern Description */}
            <div className="space-y-1.5">
              <h3 className="text-xs font-bold text-zinc-700 uppercase tracking-wider">
                Store Concern Details
              </h3>
              <div className="p-3.5 rounded-xl border border-zinc-200 bg-white text-xs text-zinc-800 whitespace-pre-wrap leading-relaxed">
                {selectedTicket.description}
              </div>
            </div>

            {/* Admin Resolution Form (Admin Only) OR Read-only Admin Notes (All Other Users) */}
            {isAdmin ? (
              <form
                onSubmit={handleSaveAdminUpdate}
                className="space-y-3.5 bg-amber-50/50 p-4 rounded-xl border border-amber-200"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-[#2C3524] uppercase tracking-wider flex items-center gap-1.5">
                    <MessageSquareText className="w-4 h-4 text-amber-700" />
                    Admin Status &amp; Resolution Update
                  </h3>
                  {selectedTicket.updatedAt && (
                    <span className="text-[10px] font-mono text-zinc-500 tabular-nums">
                      Last updated {formatRealtimeTimestamp(selectedTicket.updatedAt)}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1">
                      Ticket Status
                    </label>
                    <select
                      id="select-admin-ticket-status"
                      value={modalStatus}
                      onChange={(e) =>
                        setModalStatus(e.target.value as StoreTicketStatus)
                      }
                      className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-xs font-bold text-zinc-900 focus:ring-2 focus:ring-[#656D4A] focus:outline-none bg-white"
                    >
                      {STORE_TICKET_STATUSES.map((st) => (
                        <option key={st.value} value={st.value}>
                          {st.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-end">
                    <div className="w-full px-3 py-2 rounded-xl bg-white border border-zinc-200 text-[11px] text-zinc-600">
                      <span className="block text-[10px] font-bold text-zinc-400 uppercase">
                        Updating As
                      </span>
                      <span className="font-bold text-zinc-900">{currentUser.name}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">
                    Admin Resolution Notes
                  </label>
                  <textarea
                    id="input-admin-ticket-notes"
                    rows={3}
                    value={modalAdminNotes}
                    onChange={(e) => setModalAdminNotes(e.target.value)}
                    placeholder="Enter action taken, repair schedule, reason for hold, or resolution summary..."
                    className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-xs font-medium text-zinc-900 focus:ring-2 focus:ring-[#656D4A] focus:outline-none bg-white"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => handleDeleteTicketClick(selectedTicket)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Ticket</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isUpdatingTicket}
                      onClick={() => setSelectedTicketId(null)}
                      className="px-4 py-2 text-xs font-bold text-zinc-600 rounded-xl hover:bg-zinc-100 cursor-pointer disabled:opacity-50"
                    >
                      Close
                    </button>
                    <button
                      id="btn-save-ticket-status"
                      type="submit"
                      disabled={isUpdatingTicket}
                      className="px-5 py-2 bg-[#656D4A] hover:bg-[#4A543E] text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer disabled:opacity-60"
                    >
                      {isUpdatingTicket ? 'Saving Update...' : 'Save Status & Notes'}
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <div className="space-y-2 bg-[#FAF9F5] p-4 rounded-xl border border-zinc-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-[#2C3524] uppercase tracking-wider flex items-center gap-1.5">
                    <MessageSquareText className="w-4 h-4 text-[#656D4A]" />
                    Admin Resolution Notes
                  </h3>
                  {selectedTicket.updatedAt && (
                    <span className="text-[10px] font-mono text-zinc-500 tabular-nums">
                      Updated {formatRealtimeTimestamp(selectedTicket.updatedAt)}
                      {selectedTicket.updatedBy ? ` by ${selectedTicket.updatedBy}` : ''}
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-800 whitespace-pre-wrap">
                  {selectedTicket.adminNotes
                    ? selectedTicket.adminNotes
                    : 'No admin resolution notes posted yet.'}
                </p>
              </div>
            )}

            {/* Status Update History Timeline */}
            <div className="space-y-2.5">
              <h3 className="text-xs font-bold text-zinc-700 uppercase tracking-wider flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-zinc-500" />
                Status Update History
              </h3>

              {selectedTicket.statusHistory && selectedTicket.statusHistory.length > 0 ? (
                <div className="border border-zinc-200 rounded-xl divide-y divide-zinc-100 bg-white">
                  {[...selectedTicket.statusHistory]
                    .slice()
                    .reverse()
                    .map((entry, idx) => {
                      const entryCfg = getStatusConfig(entry.status);
                      const EntryIcon = entryCfg.Icon;
                      return (
                        <div
                          key={`${selectedTicket.id}-hist-${idx}`}
                          className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                        >
                          <div className="space-y-0.5 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-bold ${entryCfg.className}`}
                              >
                                <EntryIcon className="w-3 h-3" />
                                {entryCfg.label}
                              </span>
                              <span className="font-bold text-zinc-800">
                                {entry.changedBy}
                              </span>
                              {entry.changedByRole && (
                                <span className="text-[10px] text-zinc-500">
                                  ({entry.changedByRole})
                                </span>
                              )}
                            </div>
                            {entry.note && (
                              <p className="text-[11px] text-zinc-600 mt-1">{entry.note}</p>
                            )}
                          </div>
                          <span className="text-[10px] font-mono text-zinc-500 tabular-nums shrink-0">
                            {formatRealtimeTimestamp(entry.changedAt)}
                          </span>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <div className="p-3 rounded-xl border border-zinc-200 text-xs text-zinc-500">
                  Submitted on{' '}
                  <span className="font-mono font-semibold text-zinc-800 tabular-nums">
                    {formatRealtimeTimestamp(selectedTicket.createdAt)}
                  </span>
                </div>
              )}
            </div>

            {!isAdmin && (
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-zinc-200">
                {selectedTicket.status === 'PENDING' &&
                selectedTicket.requestedByEmployeeId === currentUser.employeeId ? (
                  <button
                    type="button"
                    onClick={() => handleCancelOwnPendingTicket(selectedTicket)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold cursor-pointer"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Cancel Request</span>
                  </button>
                ) : (
                  <div />
                )}
                <button
                  type="button"
                  onClick={() => setSelectedTicketId(null)}
                  className="px-4 py-2 text-xs font-bold text-zinc-700 rounded-xl border border-zinc-300 hover:bg-zinc-100 cursor-pointer"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
