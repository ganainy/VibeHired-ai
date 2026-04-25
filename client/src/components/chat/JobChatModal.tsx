// JobChatModal component for AI-powered job description Q&A
import React, { useState, useRef, useEffect } from 'react';
import { postChatMessage } from '../../services/chatApi';
import { useAuth } from '../../context/AuthContext';
import Spinner from '../common/Spinner';
import ErrorAlert from '../common/ErrorAlert';

interface Message {
 sender: 'user' | 'ai';
 text: string;
}

interface JobChatModalProps {
 jobId: string;
 jobTitle: string;
 isOpen: boolean;
 onClose: () => void;
}

const JobChatModal: React.FC<JobChatModalProps> = ({
 jobId,
 jobTitle,
 isOpen,
 onClose
}) => {
 const { refreshUsage } = useAuth();
 const [messages, setMessages] = useState<Message[]>([]);
 const [inputText, setInputText] = useState<string>('');
 const [isLoading, setIsLoading] = useState<boolean>(false);
 const [error, setError] = useState<string | null>(null);
 const messagesEndRef = useRef<HTMLDivElement>(null);
 const inputRef = useRef<HTMLTextAreaElement>(null);

 // Scroll to bottom when messages change
 useEffect(() => {
 messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
 }, [messages]);

 // Focus input when modal opens
 useEffect(() => {
 if (isOpen && inputRef.current) {
 inputRef.current.focus();
 }
 }, [isOpen]);

 // Reset state when modal closes
 useEffect(() => {
 if (!isOpen) {
 setMessages([]);
 setInputText('');
 setError(null);
 }
 }, [isOpen]);

 const handleSendMessage = async (e: React.FormEvent) => {
 e.preventDefault();
 
 if (!inputText.trim() || isLoading) {
 return;
 }

 const userQuestion = inputText.trim();
 setInputText('');
 setError(null);

 // Add user message to chat
 const userMessage: Message = { sender: 'user', text: userQuestion };
 setMessages(prev => [...prev, userMessage]);

 setIsLoading(true);

 try {
 const response = await postChatMessage(jobId, userQuestion);
 const aiMessage: Message = { sender: 'ai', text: response.answer };
 setMessages(prev => [...prev, aiMessage]);
 try {
 await refreshUsage();
 } catch (usageErr) {
 console.error('Failed to refresh credits after chat message:', usageErr);
 }
 } catch (err: any) {
 console.error('Error sending chat message:', err);
 setError(err.message || 'Failed to get AI response. Please try again.');
 // Remove the user message if there was an error
 setMessages(prev => prev.slice(0, -1));
 } finally {
 setIsLoading(false);
 }
 };

 const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
 if (e.key === 'Enter' && !e.shiftKey) {
 e.preventDefault();
 handleSendMessage(e);
 }
 };

 if (!isOpen) return null;

 return (
 <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50">
 <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 sm:mx-0 max-h-[90vh] flex flex-col">
 {/* Header */}
 <div className="flex justify-between items-center p-4 border-b border-theme">
 <div>
 <h2 className="text-xl font-semibold text-primary-color">
 Chat with AI
 </h2>
 <p className="text-sm text-secondary-color mt-1">
 {jobTitle}
 </p>
 </div>
 <button
 onClick={onClose}
 disabled={isLoading}
 className="text-secondary-color hover:text-secondary-color disabled:opacity-50 transition-colors"
 aria-label="Close"
 >
 <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
 </svg>
 </button>
 </div>

 {/* Messages Area */}
 <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
 {messages.length === 0 ? (
 <div className="text-center py-8 text-secondary-color">
 <svg className="mx-auto h-12 w-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
 </svg>
 <p className="text-sm">Ask questions about this job posting</p>
 <p className="text-xs mt-2">Example: "What are the key responsibilities?"</p>
 </div>
 ) : (
 messages.map((message, index) => (
 <div
 key={index}
 className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
 >
 <div
 className={`max-w-[80%] rounded-lg px-4 py-2 ${
 message.sender === 'user'
? 'bg-green text-white'
  : 'bg-[var(--bg-raised)] text-primary-color'
 }`}
 >
 <p className="text-sm whitespace-pre-wrap break-words">{message.text}</p>
 </div>
 </div>
 ))
 )}
 {isLoading && (
 <div className="flex justify-start">
<div className="bg-[var(--bg-raised)] rounded-lg px-4 py-2">
<div className="flex items-center gap-2">
<Spinner size="sm" />
<span className="text-sm text-secondary-color">AI is thinking...</span>
 </div>
 </div>
 </div>
 )}
 <div ref={messagesEndRef} />
 </div>

 {/* Error Display */}
 {error && (
 <div className="px-4 pb-2">
 <ErrorAlert
 message={error}
 onDismiss={() => setError(null)}
 />
 </div>
 )}

 {/* Input Area */}
 <div className="border-t border-theme p-4">
 <form onSubmit={handleSendMessage} className="flex gap-2">
 <textarea
 ref={inputRef}
 value={inputText}
 onChange={(e) => setInputText(e.target.value)}
 onKeyDown={handleKeyDown}
 placeholder="Ask a question about this job..."
 disabled={isLoading}
 rows={2}
 className="flex-1 px-3 py-2 border border-theme rounded-lg bg-white text-primary-color focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent resize-none disabled:opacity-50 disabled:cursor-not-allowed"
 />
 <button
 type="submit"
 disabled={!inputText.trim() || isLoading}
 className="px-4 py-2 bg-green text-white rounded-lg hover:bg-green-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5 min-w-[108px]"
 >
 {isLoading ? (
 <>
 <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
 <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" className="opacity-30" />
 <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="opacity-90" />
 </svg>
 <span className="text-xs font-medium">Sending…</span>
 </>
 ) : (
 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
 </svg>
 )}
 </button>
 </form>
 </div>
 </div>
 </div>
 );
};

export default JobChatModal;

