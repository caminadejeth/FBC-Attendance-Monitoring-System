import React, { useRef } from 'react';
import { Calendar, X } from 'lucide-react';
import { formatDateMDYYYY, parseToYYYYMMDD } from '../utils/timeFormatters';

interface DatePickerInputProps {
  label?: string;
  value: string; // e.g. "2026-08-01" or "8/1/2026"
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
  id?: string;
}

export const DatePickerInput: React.FC<DatePickerInputProps> = ({
  label,
  value,
  onChange,
  placeholder = 'M/D/YYYY',
  className = '',
  required = false,
  id,
}) => {
  const nativeInputRef = useRef<HTMLInputElement>(null);

  // Convert to ISO string (YYYY-MM-DD) for native date input picker
  const isoValue = parseToYYYYMMDD(value);

  const handleOpenPicker = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (nativeInputRef.current) {
      if ('showPicker' in nativeInputRef.current) {
        try {
          (nativeInputRef.current as any).showPicker();
        } catch {
          nativeInputRef.current.focus();
          nativeInputRef.current.click();
        }
      } else {
        nativeInputRef.current.focus();
        nativeInputRef.current.click();
      }
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
  };

  return (
    <div className={`relative flex flex-col ${className}`}>
      {label && (
        <label className="block text-[10px] font-extrabold text-zinc-600 uppercase mb-1">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      <div className="relative flex items-center">
        {/* Calendar Icon Button with overlayed native input */}
        <div className="absolute left-2 flex items-center justify-center z-20">
          <button
            type="button"
            onClick={handleOpenPicker}
            className="p-1 text-amber-700 hover:text-amber-900 hover:bg-amber-100/80 rounded-md transition-colors cursor-pointer"
            title="Click to open calendar date picker"
          >
            <Calendar className="w-3.5 h-3.5" />
          </button>
          
          {/* Overlayed Native Date Input over icon area so clicking icon triggers browser picker natively */}
          <input
            ref={nativeInputRef}
            type="date"
            value={isoValue}
            onChange={(e) => {
              if (e.target.value) {
                onChange(formatDateMDYYYY(e.target.value));
              } else {
                onChange('');
              }
            }}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            title="Choose date from calendar"
          />
        </div>

        {/* Editable Text Field: Allows typing date manually (e.g., 8/5/2026 or 2026-08-05) */}
        <input
          id={id}
          type="text"
          value={value}
          placeholder={placeholder}
          required={required}
          onChange={(e) => onChange(e.target.value)}
          className="w-full pl-9 pr-8 py-1.5 bg-white border border-zinc-300 rounded-xl text-xs font-mono font-bold text-zinc-900 focus:ring-2 focus:ring-amber-400 focus:border-amber-400 focus:outline-none shadow-2xs transition-all z-10"
        />

        {/* Clear Button */}
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 p-1 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer z-20"
            title="Clear date"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};




