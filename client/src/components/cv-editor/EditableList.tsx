import React, { useState } from 'react';
import EditableTextarea from './EditableTextarea';

interface EditableListProps {
 items: string[];
 onChange: (items: string[]) => void;
 placeholder?: string;
 className?: string;
 bulletChar?: string;
}

const EditableList: React.FC<EditableListProps> = ({
 items,
 onChange,
 placeholder = 'Add items (one per line)',
 className = '',
 bulletChar = '•'
}) => {
 const cleanItems = (rawItems: string[]) => {
 return rawItems.map(item => {
 return item.replace(/^(?:specialization|content|details|description|role|responsibilities|achievements|key responsibilities|key achievements|highlights):\s*/i, '');
 });
 };

 const cleanedItems = cleanItems(items);
 const [isEditing, setIsEditing] = useState(false);
 const [editValue, setEditValue] = useState(cleanedItems.join('\n'));

 React.useEffect(() => {
 if (!isEditing) {
 setEditValue(cleanedItems.join('\n'));
 }
 }, [items, isEditing]);

 const handleClick = () => {
 setIsEditing(true);
 };

 const handleBlur = () => {
 setIsEditing(false);
 const newItems = editValue
 .split('\n')
 .map(line => line.trim())
 .filter(line => line.length > 0);
 onChange(newItems);
 };

 const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
 setEditValue(e.target.value);
 };

 if (isEditing) {
 return (
 <textarea
 value={editValue}
 onChange={handleChange}
 onBlur={handleBlur}
 className={`w-full bg-transparent border-2 border-blue-500 rounded focus:outline-none focus:border-gold p-1 ${className}`}
 rows={Math.max(3, cleanedItems.length + 2)}
 placeholder={placeholder}
 />
 );
 }

 if (cleanedItems.length === 0) {
 return (
 <div
 onClick={handleClick}
 className={`cursor-text hover:bg-[var(--bg-raised)] rounded px-1 py-0.5 transition-colors text-muted-color italic ${className}`}
 title="Click to edit"
 >
 {placeholder}
 </div>
 );
 }

 return (
 <ul
 onClick={handleClick}
 className={`cursor-text hover:bg-[var(--bg-raised)] rounded px-1 py-0.5 transition-colors list-none ${className}`}
 title="Click to edit"
 >
 {cleanedItems.map((item, index) => (
 <li key={index} className="mb-1">
 <span className="mr-2">{bulletChar}</span>
 {item}
 </li>
 ))}
 </ul>
 );
};

export default EditableList;
