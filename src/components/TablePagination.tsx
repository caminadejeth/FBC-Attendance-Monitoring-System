import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface TablePaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSizeOptions?: number[];
  className?: string;
}

export const TablePagination: React.FC<TablePaginationProps> = ({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [5, 10, 20, 50, 100],
  className = '',
}) => {
  if (totalItems === 0) return null;

  const startItem = Math.min((currentPage - 1) * pageSize + 1, totalItems);
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className={`flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-zinc-50 border-t border-zinc-200 text-xs text-zinc-700 ${className}`}>
      {/* Page Size Limiter Selector */}
      <div className="flex items-center gap-2">
        <span className="font-bold text-zinc-600 uppercase text-[11px] tracking-wider">Rows per page:</span>
        <select
          value={pageSize}
          onChange={(e) => {
            onPageSizeChange(Number(e.target.value));
            onPageChange(1);
          }}
          className="bg-white border border-zinc-300 rounded-lg px-2.5 py-1 font-bold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer text-xs shadow-2xs"
        >
          {pageSizeOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        <span className="text-[11px] text-zinc-500 font-medium hidden sm:inline ml-2">
          Showing <strong className="text-zinc-900">{startItem}</strong> - <strong className="text-zinc-900">{endItem}</strong> of <strong className="text-zinc-900">{totalItems}</strong> entries
        </span>
      </div>

      {/* Page Range Display (Mobile) */}
      <div className="text-[11px] text-zinc-500 font-medium sm:hidden">
        Showing <strong>{startItem}</strong>-<strong>{endItem}</strong> of <strong>{totalItems}</strong> entries
      </div>

      {/* Page Navigation Controls */}
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] font-bold text-zinc-600 mr-2">
          Page {currentPage} of {Math.max(1, totalPages)}
        </span>
        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(1)}
          className="p-1.5 rounded-lg border border-zinc-300 bg-white hover:bg-amber-100 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-700 transition-colors shadow-2xs"
          title="First Page"
        >
          <ChevronsLeft className="w-4 h-4" />
        </button>
        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="p-1.5 rounded-lg border border-zinc-300 bg-white hover:bg-amber-100 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-700 transition-colors shadow-2xs"
          title="Previous Page"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          type="button"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="p-1.5 rounded-lg border border-zinc-300 bg-white hover:bg-amber-100 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-700 transition-colors shadow-2xs"
          title="Next Page"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <button
          type="button"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(totalPages)}
          className="p-1.5 rounded-lg border border-zinc-300 bg-white hover:bg-amber-100 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-700 transition-colors shadow-2xs"
          title="Last Page"
        >
          <ChevronsRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
