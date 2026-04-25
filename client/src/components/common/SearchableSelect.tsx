// client/src/components/common/SearchableSelect.tsx
import React, { useState, useRef, useEffect } from 'react';

interface SearchableSelectProps {
 id?: string;
 value: string;
 onChange: (value: string) => void;
 options: string[];
 placeholder?: string;
 disabled?: boolean;
 className?: string;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({
 id,
 value,
 onChange,
 options,
 placeholder = 'Select an option...',
 disabled = false,
 className = '',
}) => {
 const [isOpen, setIsOpen] = useState(false);
 const [searchTerm, setSearchTerm] = useState('');
 const [highlightedIndex, setHighlightedIndex] = useState(-1);
 const containerRef = useRef<HTMLDivElement>(null);
 const inputRef = useRef<HTMLInputElement>(null);
 const listRef = useRef<HTMLUListElement>(null);

 // Filter out empty values from options for display
 const displayOptions = options.filter(opt => opt.length > 0);

 // Filter options based on search term (exclude empty strings)
 const filteredOptions = displayOptions.filter((option) =>
 option.toLowerCase().includes(searchTerm.toLowerCase())
 );

 // Reset search when dropdown closes
 useEffect(() => {
 if (!isOpen) {
 setSearchTerm('');
 setHighlightedIndex(-1);
 }
 }, [isOpen]);

 // Close dropdown when clicking outside
 useEffect(() => {
 const handleClickOutside = (event: MouseEvent) => {
 if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
 setIsOpen(false);
 }
 };

 if (isOpen) {
 document.addEventListener('mousedown', handleClickOutside);
 return () => document.removeEventListener('mousedown', handleClickOutside);
 }
 }, [isOpen]);

 // Focus input when dropdown opens
 useEffect(() => {
 if (isOpen && inputRef.current) {
 inputRef.current.focus();
 }
 }, [isOpen]);

 // Handle keyboard navigation
 const handleKeyDown = (e: React.KeyboardEvent) => {
 if (disabled) return;

 switch (e.key) {
 case 'Enter':
 e.preventDefault();
 if (isOpen && highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
 handleSelect(filteredOptions[highlightedIndex]);
 } else if (!isOpen) {
 setIsOpen(true);
 }
 break;
 case 'ArrowDown':
 e.preventDefault();
 if (!isOpen) {
 setIsOpen(true);
 } else {
 setHighlightedIndex((prev) =>
 prev < filteredOptions.length - 1 ? prev + 1 : prev
 );
 }
 break;
 case 'ArrowUp':
 e.preventDefault();
 if (isOpen) {
 setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
 }
 break;
 case 'Escape':
 setIsOpen(false);
 break;
 }
 };

 // Scroll highlighted item into view
 useEffect(() => {
 if (highlightedIndex >= 0 && listRef.current) {
 const highlightedElement = listRef.current.children[highlightedIndex] as HTMLElement;
 if (highlightedElement) {
 highlightedElement.scrollIntoView({ block: 'nearest' });
 }
 }
 }, [highlightedIndex]);

 const handleSelect = (option: string) => {
 onChange(option);
 setIsOpen(false);
 setSearchTerm('');
 };

 // Handle empty value - show placeholder
 const displayValue = value || placeholder;
 const showPlaceholder = !value;

 return (
 <div ref={containerRef} className={`relative ${className}`}>
 {/* Trigger Button */}
 <button
 type="button"
 id={id}
 onClick={() => !disabled && setIsOpen(!isOpen)}
 onKeyDown={handleKeyDown}
 disabled={disabled}
className={`w-full px-4 py-2.5 pr-10 text-left border rounded-lg bg-white text-primary-color focus:outline-none focus:ring-2 focus:ring-gold transition-colors ${
  disabled
  ? 'opacity-50 cursor-not-allowed border-theme'
  : 'border-theme hover:border-slate-400'
  } ${showPlaceholder ? 'text-muted-color' : ''}`}
 >
 <span className="block truncate">{displayValue}</span>
 <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
 <svg
 className={`w-5 h-5 text-secondary-color transition-transform ${isOpen ? 'transform rotate-180' : ''}`}
 fill="none"
 stroke="currentColor"
 viewBox="0 0 24 24"
 >
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
 </svg>
 </span>
 </button>

 {/* Dropdown Menu */}
 {isOpen && !disabled && (
<div className="absolute z-50 w-full mt-1 bg-white border border-theme rounded-lg shadow-lg max-h-60 overflow-hidden">
  {/* Search Input */}
  <div className="p-2 border-b border-[var(--border-subtle)]">
 <input
 ref={inputRef}
 type="text"
 value={searchTerm}
 onChange={(e) => {
 setSearchTerm(e.target.value);
 setHighlightedIndex(-1);
 }}
 onKeyDown={handleKeyDown}
 placeholder="Search models..."
 className="w-full px-3 py-2 text-sm border border-theme rounded-md bg-white text-primary-color placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-gold"
 />
 </div>

 {/* Options List */}
 <ul
 ref={listRef}
 className="max-h-48 overflow-auto py-1"
 role="listbox"
 >
 {filteredOptions.length === 0 ? (
 <li className="px-4 py-2 text-sm text-secondary-color">
 No models found
 </li>
 ) : (
 filteredOptions.map((option, index) => (
 <li
 key={option}
 role="option"
 aria-selected={value === option}
 onClick={() => handleSelect(option)}
 onMouseEnter={() => setHighlightedIndex(index)}
 className={`px-4 py-2 text-sm cursor-pointer transition-colors ${
 value === option
? 'bg-[var(--accent-bg)] text-green-house'
  : highlightedIndex === index
  ? 'bg-[var(--bg-raised)] text-primary-color'
  : 'text-secondary-color hover:bg-elevated'
 }`}
 >
 {option}
 </li>
 ))
 )}
 </ul>
 </div>
 )}
 </div>
 );
};

export default SearchableSelect;

