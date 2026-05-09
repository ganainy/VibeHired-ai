// JobChatWindow component - floating chat window (not full modal)
import React, { useState, useRef, useEffect } from 'react';
import { postChatMessage, getChatHistory, ChatMessage } from '../../services/chatApi';
import { useAuth } from '../../context/AuthContext';
import { Button, CreditsBadge } from '../common';
import Spinner from '../common/Spinner';
import ErrorAlert from '../common/ErrorAlert';

interface JobChatWindowProps {
 jobId: string;
 jobTitle: string;
 isOpen: boolean;
 onClose: () => void;
}

const JobChatWindow: React.FC<JobChatWindowProps> = ({
 jobId,
 jobTitle,
 isOpen,
 onClose
}) => {
 const { refreshUsage } = useAuth();
 const [messages, setMessages] = useState<ChatMessage[]>([]);
 const [inputText, setInputText] = useState<string>('');
 const [isLoading, setIsLoading] = useState<boolean>(false);
 const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);
 const [error, setError] = useState<string | null>(null);
 const messagesEndRef = useRef<HTMLDivElement>(null);
 const inputRef = useRef<HTMLTextAreaElement>(null);

 // Load chat history when window opens
 useEffect(() => {
 if (isOpen && jobId) {
 loadChatHistory();
 }
 }, [isOpen, jobId]);

 // Scroll to bottom when messages change
 useEffect(() => {
 messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
 }, [messages]);

 // Focus input when window opens
 useEffect(() => {
 if (isOpen && inputRef.current) {
 setTimeout(() => {
 inputRef.current?.focus();
 }, 100);
 }
 }, [isOpen]);

 const loadChatHistory = async () => {
 setIsLoadingHistory(true);
 setError(null);
 try {
 const response = await getChatHistory(jobId);
 setMessages(response.history || []);
 } catch (err: any) {
 console.error('Error loading chat history:', err);
 // Don't show error for empty history, just log it
 if (err.message && !err.message.includes('not found')) {
 setError('Failed to load chat history');
 }
 } finally {
 setIsLoadingHistory(false);
 }
 };

 const handleSendMessage = async (e: React.FormEvent) => {
 e.preventDefault();
 
 if (!inputText.trim() || isLoading) {
 return;
 }

 const userQuestion = inputText.trim();
 setInputText('');
 setError(null);

 // Add user message to chat immediately
 const userMessage: ChatMessage = { 
 sender: 'user', 
 text: userQuestion,
 timestamp: new Date().toISOString()
 };
 setMessages(prev => [...prev, userMessage]);

 setIsLoading(true);

 try {
 const response = await postChatMessage(jobId, userQuestion);
 const aiMessage: ChatMessage = { 
 sender: 'ai', 
 text: response.answer,
 timestamp: new Date().toISOString()
 };
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
<div className="fixed bottom-24 right-6 w-96 h-[600px] bg-white rounded-lg shadow-2xl border border-theme flex flex-col z-50">
  {/* Header */}
  <div className="flex justify-between items-center p-4 border-b border-theme rounded-t-lg" style={{background:"var(--accent)"}}>
 <div className="flex-1 min-w-0">
 <h2 className="text-lg font-semibold truncate">
 Chat with AI
 </h2>
 <p className="text-xs truncate mt-0.5 text-green-house/70">
 {jobTitle}
 </p>
 </div>
 <button
 onClick={onClose}
 disabled={isLoading}
 className="ml-2 text-green-house/90 hover:text-green-house disabled:opacity-50 transition-colors flex-shrink-0"
 aria-label="Close"
 >
 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
 </svg>
 </button>
 </div>

 {/* Messages Area */}
 <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0" style={{ background: 'var(--bg-elevated)' }}>
 {isLoadingHistory ? (
 <div className="flex items-center justify-center h-full">
 <Spinner size="md" />
 </div>
 ) : messages.length === 0 ? (
 <div className="text-center py-8 text-muted-color">
 <svg className="mx-auto h-10 w-10 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
 </svg>
 <p className="text-sm font-medium mb-1">Ask questions about this job</p>
 <p className="text-xs">Example: "What are the key responsibilities?"</p>
 </div>
 ) : (
 messages.map((message, index) => (
 <div
 key={index}
 className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
 >
 <div
 className={`max-w-[85%] rounded-lg px-3 py-2 ${
 message.sender === 'user' ? 'text-green-house'
 : 'bg-white text-primary-color border border-theme'
 }`}
 style={message.sender === 'user' ? {background: 'var(--accent)'} : {}}
 >
 <p className="text-sm whitespace-pre-wrap break-words">{message.text}</p>
 </div>
 </div>
 ))
 )}
 {isLoading && (
 <div className="flex justify-start">
<div className="bg-white border border-theme rounded-lg px-3 py-2">
  <div className="flex items-center gap-2">
  <Spinner size="sm" />
  <span className="text-xs text-secondary-color">AI is thinking...</span>
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
 <div className="border-t border-theme p-3 bg-white rounded-b-lg">
 <form onSubmit={handleSendMessage} className="flex gap-2">
 <textarea
 ref={inputRef}
 value={inputText}
 onChange={(e) => setInputText(e.target.value)}
 onKeyDown={handleKeyDown}
 placeholder="Ask a question..."
 disabled={isLoading}
 rows={2}
 className="flex-1 px-3 py-2 text-sm border border-theme rounded-lg bg-white text-primary-color focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold resize-none disabled:opacity-50 disabled:cursor-not-allowed"
 />
 <Button
 type="submit"
 disabled={!inputText.trim() || isLoading}
 className="rounded-lg flex items-center gap-1.5 justify-center flex-shrink-0 px-3 min-w-[96px]"
 title="Send message (1 credit)"
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
 <>
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
 </svg>
  <CreditsBadge amount="1 Credit" variant="gold" className="ml-1" />
 </>
 )}
 </Button>
 </form>
 </div>
 </div>
 );
};

export default JobChatWindow;

