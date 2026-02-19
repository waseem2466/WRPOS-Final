import { Search, ChevronDown } from 'lucide-react';
import React, { useRef, useState, useEffect } from 'react';

interface SearchableDropdownProps<T> {
  options: T[];
  value: string;
  onChange: (id: string) => void;
  getLabel: (item: T) => string;
  getId: (item: T) => string;
  placeholder?: string;
  label?: string;
  className?: string;
}

export function SearchableDropdown<T>({
  options,
  value,
  onChange,
  getLabel,
  getId,
  placeholder = "Search...",
  label,
  className = ""
}: SearchableDropdownProps<T>) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sync search with selected value
  useEffect(() => {
    const selected = options.find(opt => getId(opt) === value);
    if (selected && !isOpen) {
      setSearch(getLabel(selected));
    }
  }, [value, options, isOpen]);

  const filtered = options.filter(opt =>
    getLabel(opt).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={`relative ${className}`} ref={wrapperRef}>
      {label && (
        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 mb-2 block">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          className="w-full glass-input rounded-2xl px-5 py-4 pr-10 text-xs font-black uppercase outline-none focus:border-blue-500 transition-all"
          placeholder={placeholder}
          value={search}
          onChange={e => {
            setSearch(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
        />
        <ChevronDown 
          size={16} 
          className={`absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </div>
      
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-[#0f172a] border border-white/10 rounded-2xl shadow-3xl max-h-60 overflow-y-auto custom-scrollbar z-[100]">
          {filtered.length === 0 ? (
            <div className="p-4 text-center text-[10px] text-gray-600 uppercase">
              No results found
            </div>
          ) : (
            filtered.map(opt => (
              <div
                key={getId(opt)}
                onClick={() => {
                  onChange(getId(opt));
                  setSearch(getLabel(opt));
                  setIsOpen(false);
                }}
                className="p-4 hover:bg-blue-600/20 cursor-pointer border-b border-white/5 last:border-0 transition-all"
              >
                <p className="text-[10px] font-black text-white uppercase">
                  {getLabel(opt)}
                </p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
