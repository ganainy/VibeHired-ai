import React, { useState, useRef, useEffect } from 'react';

interface EditableTextareaProps {
 value: string;
 onChange: (value: string) => void;
 placeholder?: string;
 className?: string;
 style?: React.CSSProperties;
 rows?: number;
}

const EditableTextarea: React.FC<EditableTextareaProps> = ({
 value,
 onChange,
 placeholder = 'Click to edit',
 className = '',
 style,
 rows = 3
}) => {
 const [isEditing, setIsEditing] = useState(false);
 const [editValue, setEditValue] = useState(value);
 const textareaRef = useRef<HTMLTextAreaElement>(null);

 useEffect(() => {
 setEditValue(value);
 }, [value]);

 useEffect(() => {
 if (isEditing && textareaRef.current) {
 textareaRef.current.focus();
 textareaRef.current.setSelectionRange(textareaRef.current.value.length, textareaRef.current.value.length);
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

 const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
 if (e.key === 'Escape') {
 setEditValue(value);
 setIsEditing(false);
 textareaRef.current?.blur();
 }
 };

 const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
 setEditValue(e.target.value);
 };

 if (isEditing) {
 return (
 <textarea
 ref={textareaRef}
 value={editValue}
 onChange={handleChange}
 onBlur={handleBlur}
 onKeyDown={handleKeyDown}
 className={`w-full bg-transparent border-2 border-blue-500 rounded focus:outline-none focus:border-gold p-1 ${className}`}
 style={style}
 rows={rows}
 />
 );
 }

 return (
 <div
 onClick={handleClick}
 className={`cursor-text hover:bg-[var(--bg-raised)] rounded px-1 py-0.5 transition-colors whitespace-pre-wrap ${className}`}
 style={style}
 title="Click to edit"
 >
 {value || <span className="text-muted-color italic">{placeholder}</span>}
 </div>
 );
};

export default EditableTextarea;
