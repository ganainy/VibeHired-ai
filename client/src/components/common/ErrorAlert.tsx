// client/src/components/common/ErrorAlert.tsx
import React from 'react';

interface ErrorAlertProps {
 message: string;
 onDismiss?: () => void;
 onRetry?: () => void;
 className?: string;
}

const ErrorAlert: React.FC<ErrorAlertProps> = ({ message, onDismiss, onRetry, className = '' }) => {
 return (
 <div className={`p-4 bg-red-100 text-red-700 rounded-lg border border-red-300 flex items-start justify-between ${className}`}>
 <div className="flex-1">
 <div className="flex items-center gap-2">
 <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
 <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
 </svg>
 <p className="text-sm font-medium">{message}</p>
 </div>
 </div>
 <div className="flex items-center gap-2 ml-4">
 {onRetry && (
 <button
 onClick={onRetry}
 className="px-3 py-1 text-sm bg-red-200 hover:bg-red-300 rounded transition-colors"
 >
 Retry
 </button>
 )}
 {onDismiss && (
 <button
 onClick={onDismiss}
 className="text-red-700 hover:text-red-900 transition-colors"
 aria-label="Dismiss error"
 >
 <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
 <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
 </svg>
 </button>
 )}
 </div>
 </div>
 );
};

export default ErrorAlert;

