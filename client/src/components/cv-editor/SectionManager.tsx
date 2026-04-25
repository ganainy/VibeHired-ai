import React from 'react';

interface SectionManagerProps {
 onAdd: () => void;
 onDelete?: () => void;
 sectionName: string;
 showDelete?: boolean;
}

const SectionManager: React.FC<SectionManagerProps> = ({
 onAdd,
 onDelete,
 sectionName,
 showDelete = false
}) => {
 return (
 <div className="flex items-center gap-2 mt-2 mb-4">
 <button
 onClick={onAdd}
 className="px-3 py-1 text-xs bg-green text-white rounded hover:bg-green-accent transition-colors flex items-center gap-1"
 title={`Add ${sectionName}`}
 >
 <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
 </svg>
 Add {sectionName}
 </button>
 {showDelete && onDelete && (
 <button
 onClick={onDelete}
 className="px-3 py-1 text-xs bg-error text-white rounded hover:bg-error transition-colors flex items-center gap-1"
 title={`Delete ${sectionName}`}
 >
 <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
 </svg>
 Delete
 </button>
 )}
 </div>
 );
};

export default SectionManager;
