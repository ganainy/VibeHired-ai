// client/src/components/common/Toast.tsx
import React, { useEffect } from 'react';

interface ToastProps {
 message: string;
 type?: 'success' | 'error' | 'info';
 onClose: () => void;
 duration?: number;
}

const Toast: React.FC<ToastProps> = ({ message, type = 'success', onClose, duration }) => {
 // Calculate duration based on message length with minimum duration
 const calculate_duration = (msg: string): number => {
 const min_duration = 2000; // Minimum 2 seconds for short messages
 const chars_per_second = 16; // Average reading speed (~200 words/min = ~16 chars/sec)
 const calculated_duration = (msg.length / chars_per_second) * 1000;
 return Math.max(min_duration, calculated_duration);
 };

 const toast_duration = duration ?? calculate_duration(message);

 useEffect(() => {
 const timer = setTimeout(() => {
 onClose();
 }, toast_duration);

 return () => clearTimeout(timer);
 }, [toast_duration, onClose]);

 const typeStyles = {
success: 'bg-[var(--jade-bg)] text-green border-[var(--border)]',
    error: 'bg-[var(--rose-bg)] text-error border-error',
    info: 'bg-[var(--accent-bg)] text-green-house border-theme',
 };

 const icons = {
 success: (
 <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
 <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
 </svg>
 ),
 error: (
 <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
 <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
 </svg>
 ),
 info: (
 <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
 <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
 </svg>
 ),
 };

 return (
 <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg border flex items-center gap-3 min-w-[300px] max-w-md animate-slide-in ${typeStyles[type]}`}>
 <div className="flex-shrink-0">
 {icons[type]}
 </div>
 <p className="flex-1 text-sm font-medium">{message}</p>
 <button
 onClick={onClose}
 className="flex-shrink-0 text-current opacity-70 hover:opacity-100 transition-opacity"
 aria-label="Close"
 >
 <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
 <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
 </svg>
 </button>
 </div>
 );
};

export default Toast;

