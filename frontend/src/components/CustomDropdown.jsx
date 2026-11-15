import React, { useState, useRef, useEffect } from 'react';

/**
 * Replaces the Windows native OS blue select dropdown with a sleek, rounded UI.
 */
export default function CustomDropdown({ value, onChange, options, icon = null, className = '' }) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find((opt) => opt.value === value);
  const displayLabel = selectedOption ? selectedOption.label : (options[0]?.label || 'Select...');

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`h-8.5 sm:h-9 px-2.5 sm:px-3 rounded-xl border text-[11px] sm:text-xs font-semibold flex items-center justify-between sm:justify-start gap-1 sm:gap-1.5 transition-all cursor-pointer shadow-2xs select-none w-full ${
          open
            ? 'bg-purple-100/90 border-purple-400 text-purple-950 ring-2 ring-purple-400/25'
            : value
            ? 'bg-purple-100/70 border-purple-300 text-purple-950 hover:bg-purple-100'
            : 'bg-purple-50/70 hover:bg-purple-100/80 border-purple-200 text-purple-900/80 hover:text-purple-950'
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          {icon && <span className="material-symbols-outlined text-[14px] sm:text-[15px] text-purple-600 shrink-0">{icon}</span>}
          <span className="truncate max-w-[100px] sm:max-w-[170px]">{displayLabel}</span>
        </div>
        <span className={`material-symbols-outlined text-[15px] sm:text-[16px] text-purple-600 transition-transform duration-200 shrink-0 ${open ? 'rotate-180' : ''}`}>
          expand_more
        </span>
      </button>

      {open && (
        <div className="absolute left-0 z-50 mt-1.5 min-w-[200px] max-w-[290px] p-1.5 bg-white rounded-2xl border border-purple-200 shadow-xl shadow-purple-500/15 backdrop-blur-md">
          <div className="max-h-52 overflow-y-auto overscroll-contain pr-1 space-y-0.5 [scrollbar-width:thin] [scrollbar-color:#c4b5fd_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-purple-300 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-purple-400">
            {options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={`w-full px-3 py-2 rounded-xl text-left text-xs font-medium flex items-center justify-between gap-2 transition-colors cursor-pointer select-none ${
                    isSelected
                      ? 'bg-purple-100 text-[#5122fe] font-bold'
                      : 'text-purple-900/80 hover:bg-purple-50 hover:text-purple-950'
                  }`}
                >
                  <span className="truncate">{opt.label}</span>
                  {isSelected && (
                    <span className="material-symbols-outlined text-[15px] text-[#5122fe] font-bold shrink-0">
                      check
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
