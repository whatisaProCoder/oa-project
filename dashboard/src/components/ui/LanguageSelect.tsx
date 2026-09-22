import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface LanguageOption {
  value: string;
  label: string;
}

const languages: LanguageOption[] = [
  { value: 'English', label: 'English' },
  { value: 'Hindi', label: 'हिंदी (Hindi)' },
  { value: 'Assamese', label: 'অসমীয়া (Assamese)' },
  { value: 'Bengali', label: 'বাংলা (Bengali)' },
];

interface LanguageSelectProps {
  value: string;
  onChange: (value: string) => void;
}

export const LanguageSelect: React.FC<LanguageSelectProps> = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedLabel = languages.find(l => l.value === value)?.label || value;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative hidden lg:block" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between min-w-[140px] px-4 py-1.5 text-sm font-bold text-slate-800 dark:text-slate-100 bg-white dark:bg-[#000000] border-2 border-primary rounded-full hover:bg-slate-50 dark:hover:bg-[#0a0000] transition-colors shadow-sm dark:shadow-[0_0_10px_rgba(255,51,51,0.2)] focus:outline-none focus:ring-2 focus:ring-accent cursor-pointer"
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ml-2 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-full min-w-[180px] z-50 bg-white/95 dark:bg-[#0a0a0a] border border-slate-200 dark:border-primary/50 rounded-xl shadow-lg dark:shadow-[0_4px_20px_rgba(0,0,0,0.8)] overflow-hidden backdrop-blur-md animate-in fade-in zoom-in-95 duration-100 origin-top-right">
          <div className="p-1">
            {languages.map((lang) => (
              <button
                key={lang.value}
                onClick={() => {
                  onChange(lang.value);
                  setIsOpen(false);
                }}
                className={`flex items-center justify-between w-full px-3 py-2 text-sm rounded-lg transition-colors cursor-pointer ${
                  value === lang.value 
                    ? 'bg-primary/20 text-primary dark:text-white font-bold' 
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span className="truncate">{lang.label}</span>
                {value === lang.value && <Check className="w-4 h-4 text-primary ml-2 shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
