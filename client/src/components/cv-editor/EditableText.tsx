import React, { useState, useRef, useEffect } from 'react';

interface EditableTextProps {
 value: string;
 onChange: (value: string) => void;
 placeholder?: string;
 className?: string;
 style?: React.CSSProperties;
 multiline?: boolean;
}

const EditableText: React.FC<EditableTextProps> = ({
 value,
 onChange,
 placeholder = 'Click to edit',
 className = '',
 style,
 multiline = false
}) => {
 const [isEditing, setIsEditing] = useState(false);
 const [editValue, setEditValue] = useState(value);
 const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

 useEffect(() => {
 setEditValue(value);
 }, [value]);

 useEffect(() => {
 if (isEditing && inputRef.current) {
 inputRef.current.focus();
 if (inputRef.current instanceof HTMLInputElement) {
 inputRef.current.select();
 }
 }
 }, [isEditing]);

 const handleClick = () => {
 setIsEditing(true);
 };

 const handleBlur = () => {
 setIsEditing(false);
 if (editValue !== value) {
 onChange(editValue);
 }
 };

 const handleKeyDown = (e: React.KeyboardEvent) => {
 if (e.key === 'Enter' && !multiline) {
 e.preventDefault();
 handleBlur();
 } else if (e.key === 'Escape') {
 setEditValue(value);
 setIsEditing(false);
 }
 };

 const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
 setEditValue(e.target.value);
 };

 if (isEditing) {
 const baseClasses = 'w-full bg-transparent border-b-2 border-blue-500 focus:outline-none focus:border-gold';
 const InputComponent = multiline ? 'textarea' : 'input';
 
 if (multiline) {
 return (
 <textarea
 ref={inputRef as React.RefObject<HTMLTextAreaElement>}
 value={editValue}
 onChange={handleChange}
 onBlur={handleBlur}
 onKeyDown={handleKeyDown}
 className={`${baseClasses} ${className}`}
 style={style}
 rows={3}
 />
 );
 } else {
 return (
 <input
 ref={inputRef as React.RefObject<HTMLInputElement>}
 type="text"
 value={editValue}
 onChange={handleChange}
 onBlur={handleBlur}
 onKeyDown={handleKeyDown}
 className={`${baseClasses} ${className}`}
 style={style}
 />
 );
 }
 }

 return (
 <span
 onClick={handleClick}
 className={`cursor-text hover:bg-[var(--bg-raised)] rounded px-1 py-0.5 transition-colors ${className}`}
 style={style}
 title="Click to edit"
 >
 {value || <span className="text-muted-color italic">{placeholder}</span>}
 </span>
 );
};

export default EditableText;
