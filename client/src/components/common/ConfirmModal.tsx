import React from 'react';
import { Button, Card } from './';
import { AlertCircle, CalendarDays, X, Info, CheckCircle2 } from 'lucide-react';

interface ConfirmModalProps {
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onClose: () => void;
    confirmLabel?: string;
    cancelLabel?: string;
    danger?: boolean;
    type?: 'confirm' | 'alert' | 'info';
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
    show,
    title,
    message,
    onConfirm,
    onClose,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    danger = false,
    type = 'confirm'
}) => {
    if (!show) return null;

    const isAlert = type === 'alert';
    const isInfo = type === 'info';

    const getIcon = () => {
        if (danger) return <AlertCircle size={24} />;
        if (isAlert) return <Info size={24} />;
        if (isInfo) return <CheckCircle2 size={24} />;
        return <CalendarDays size={24} />;
    };

    const getIconColor = () => {
        if (danger) return '#ef4444';
        if (isInfo) return 'var(--jade)';
        return 'var(--accent)';
    };

    const getIconBg = () => {
        if (danger) return 'rgba(239, 68, 68, 0.1)';
        if (isInfo) return 'rgba(16, 185, 129, 0.1)';
        return 'var(--accent-bg)';
    };

    const getIconBorder = () => {
        if (danger) return 'rgba(239, 68, 68, 0.2)';
        if (isInfo) return 'rgba(16, 185, 129, 0.2)';
        return 'var(--accent-dim)';
    };

    return (
        <div
            className="fixed inset-0 flex items-center justify-center z-[2000] p-4 animate-in fade-in duration-200"
            style={{ background: 'rgba(5, 5, 8, 0.85)', backdropFilter: 'blur(4px)' }}
            onClick={onClose}
        >
            <Card
                padding="none"
                className="w-full max-w-sm overflow-hidden animate-in zoom-in duration-200"
                style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                    padding: 0
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-end p-2">
                    <button
                        onClick={onClose}
                        className="p-1 rounded-lg hover:bg-white/5 transition-colors text-muted hover:text-white"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="px-6 pb-6 mt-[-8px]">
                    <div className="flex items-start gap-4 mb-5">
                        <div
                            style={{
                                width: 48,
                                height: 48,
                                borderRadius: 14,
                                background: getIconBg(),
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: getIconColor(),
                                border: `1px solid ${getIconBorder()}`,
                                flexShrink: 0
                            }}
                        >
                            {getIcon()}
                        </div>
                        <div>
                            <h3 className="text-lg font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{title}</h3>
                            <p className="text-sm" style={{ color: 'var(--text-muted)', lineHeight: '1.5' }}>{message}</p>
                        </div>
                    </div>
                    <div className="flex gap-3 mt-2">
                        {!isAlert && !isInfo && (
                            <Button variant="secondary" className="flex-1" onClick={onClose}>
                                {cancelLabel}
                            </Button>
                        )}
                        <Button
                            variant={danger ? 'danger' : 'primary'}
                            className="flex-1"
                            onClick={() => { onConfirm(); onClose(); }}
                        >
                            {isAlert || isInfo ? 'Got it' : confirmLabel}
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    );
};

export default ConfirmModal;
