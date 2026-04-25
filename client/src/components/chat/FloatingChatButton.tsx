// Floating chat button component - always visible on job page
import React from 'react';
import aiChatIcon from '../../assets/ai-chat-icon.svg';

interface FloatingChatButtonProps {
 onClick: () => void;
 hasUnread?: boolean;
}

const FloatingChatButton: React.FC<FloatingChatButtonProps> = ({ onClick, hasUnread = false }) => {
 return (
 <button
 onClick={onClick}
 className="fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center z-50 group text-green-house" style={{background:"var(--accent)"}}
 aria-label="Chat with AI"
 title="Chat with AI about this job"
 >
 <img 
 src={aiChatIcon} 
 alt="AI Chat" 
 className="w-8 h-8 brightness-0 invert"
 />
 {hasUnread && (
 <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white"></span>
 )}
 <span className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-20 transition-opacity" style={{background:"var(--accent)"}}></span>
 </button>
 );
};

export default FloatingChatButton;

