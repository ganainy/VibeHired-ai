// client/src/components/jobs/SendToPhoneButton.tsx
import React, { useState } from 'react';

interface SendToPhoneButtonProps {
  phone: string;
  company?: string;
  jobTitle?: string;
  contactName?: string;
}

function buildMessage(phone: string, company?: string, jobTitle?: string, contactName?: string): string {
  const lines: string[] = ['📋 Job Contact'];
  if (company)      lines.push(`Company: ${company}`);
  if (jobTitle)     lines.push(`Role: ${jobTitle}`);
  if (contactName)  lines.push(`Contact: ${contactName}`);
  lines.push(`📞 ${phone}`);
  return lines.join('\n');
}

const SendToPhoneButton: React.FC<SendToPhoneButtonProps> = ({ phone, company, jobTitle, contactName }) => {
  const [feedback, setFeedback] = useState<'idle' | 'sent' | 'copied'>('idle');

  const handleShare = async () => {
    const message = buildMessage(phone, company, jobTitle, contactName);

    // Try Web Share API first (works natively on mobile)
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Job Contact', text: message });
        triggerFeedback('sent');
        return;
      } catch {
        // User cancelled or share failed — fall through to WhatsApp
      }
    }

    // Fallback: open WhatsApp Web with the message prefilled
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    triggerFeedback('sent');
  };

  const triggerFeedback = (type: 'sent' | 'copied') => {
    setFeedback(type);
    setTimeout(() => setFeedback('idle'), 1800);
  };

  return (
    <button
      onClick={handleShare}
      title="Send contact to phone"
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium transition-all duration-150 hover:opacity-80 active:scale-95"
      style={{
        color: 'var(--accent)',
        background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
        border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)',
      }}
    >
      {feedback === 'idle' ? (
        <>
          {/* Phone-share icon — inline SVG to avoid a library dep */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.59 1h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.56a16 16 0 0 0 5.53 5.53l.98-.98a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
            <line x1="18" y1="2" x2="22" y2="6" />
            <polyline points="15 2 22 2 22 9" />
          </svg>
          Send to phone
        </>
      ) : (
        <>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Sent!
        </>
      )}
    </button>
  );
};

export default SendToPhoneButton;
