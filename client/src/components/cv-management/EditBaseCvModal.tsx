import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, Input } from '../common';
import type { CVDocument } from '../../services/cvApi';

interface EditBaseCvModalProps {
    isOpen: boolean;
    cv: CVDocument | null;
    onClose: () => void;
    onSave: (payload: { displayName: string; category: string | null }) => Promise<boolean>;
}

const EditBaseCvModal: React.FC<EditBaseCvModalProps> = ({
    isOpen,
    cv,
    onClose,
    onSave,
}) => {
    const [displayName, setDisplayName] = useState('');
    const [category, setCategory] = useState('');
    const [errors, setErrors] = useState<{ displayName?: string; category?: string; form?: string }>({});
    const [isSaving, setIsSaving] = useState(false);

    const title = useMemo(() => cv?.displayName || cv?.category || 'Base CV', [cv]);

    useEffect(() => {
        if (!isOpen) return;
        setDisplayName(cv?.displayName || cv?.category || '');
        setCategory(cv?.category || '');
        setErrors({});
    }, [isOpen, cv]);

    useEffect(() => {
        if (!isOpen) return;

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !isSaving) {
                onClose();
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, isSaving, onClose]);

    if (!isOpen) return null;

    const validate = () => {
        const nextErrors: { displayName?: string; category?: string } = {};
        if (!displayName.trim()) {
            nextErrors.displayName = 'Base CV name is required.';
        }
        if (!category.trim()) {
            nextErrors.category = 'Job focus is required.';
        }
        setErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!validate()) return;
        setIsSaving(true);
        setErrors({});

        try {
            const success = await onSave({
                displayName: displayName.trim(),
                category: category.trim() || null,
            });
            if (success) {
                onClose();
            }
        } catch (error) {
            setErrors({ form: 'Failed to save changes. Please try again.' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div
            className="fixed inset-0 flex items-center justify-center z-[2000] p-4 animate-in fade-in duration-200"
            style={{ background: 'rgba(5, 5, 8, 0.85)', backdropFilter: 'blur(4px)' }}
            onClick={() => { if (!isSaving) onClose(); }}
        >
            <Card
                padding="none"
                className="w-full max-w-md overflow-hidden animate-in zoom-in duration-200"
                style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                    padding: 0,
                }}
                onClick={(event) => event.stopPropagation()}
            >
                <div className="px-6 py-5 border-b" style={{ borderColor: 'var(--border)' }}>
                    <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                        Edit Base CV
                    </p>
                    <h3 className="text-lg font-bold mt-1" style={{ color: 'var(--text-primary)' }}>
                        {title}
                    </h3>
                    <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>
                        Update the details shown in your base CV list.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-4">
                    <Input
                        label="Base CV name"
                        value={displayName}
                        onChange={(event) => setDisplayName(event.target.value)}
                        placeholder="e.g., IT Help Desk DE"
                        error={errors.displayName}
                        disabled={isSaving}
                    />
                    <Input
                        label="Job focus"
                        value={category}
                        onChange={(event) => setCategory(event.target.value)}
                        placeholder="e.g., IT Support, Security, Sales"
                        helperText="Helps you distinguish which roles this base CV targets."
                        error={errors.category}
                        disabled={isSaving}
                    />
                    {errors.form && (
                        <p className="text-sm" style={{ color: 'var(--rose)' }}>
                            {errors.form}
                        </p>
                    )}
                    <div className="flex gap-3 pt-2">
                        <Button
                            type="button"
                            variant="secondary"
                            className="flex-1"
                            onClick={onClose}
                            disabled={isSaving}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            variant="primary"
                            className="flex-1"
                            isLoading={isSaving}
                        >
                            Save changes
                        </Button>
                    </div>
                </form>
            </Card>
        </div>
    );
};

export default EditBaseCvModal;
