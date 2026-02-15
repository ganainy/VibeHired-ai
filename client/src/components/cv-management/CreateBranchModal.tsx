// client/src/components/cv-management/CreateBranchModal.tsx
import React, { useState, useEffect } from 'react';
import { CVDocument } from '../../services/cvApi';

interface CreateBranchModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreateBranch: (sourceCvId: string, category: string, displayName: string) => Promise<void>;
    allCvs: CVDocument[];
    isLoading?: boolean;
}

const CreateBranchModal: React.FC<CreateBranchModalProps> = ({
    isOpen,
    onClose,
    onCreateBranch,
    allCvs,
    isLoading = false
}) => {
    const [sourceCvId, setSourceCvId] = useState('');
    const [category, setCategory] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [errors, setErrors] = useState<{ [key: string]: string }>({});

    // Reset form when modal opens
    useEffect(() => {
        if (isOpen) {
            setSourceCvId('');
            setCategory('');
            setDisplayName('');
            setErrors({});
        }
    }, [isOpen]);

    // Handle Escape key
    useEffect(() => {
        if (!isOpen) return;

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !isLoading) {
                onClose();
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, isLoading, onClose]);

    const validateForm = () => {
        const newErrors: { [key: string]: string } = {};

        if (!sourceCvId) {
            newErrors.sourceCvId = 'Please select a source CV';
        }
        if (!category.trim()) {
            newErrors.category = 'Category is required';
        }
        if (!displayName.trim()) {
            newErrors.displayName = 'Display name is required';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) return;

        try {
            await onCreateBranch(sourceCvId, category.trim(), displayName.trim());
            onClose();
        } catch (error) {
            console.error('Error creating branch:', error);
        }
    };

    const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget && !isLoading) {
            onClose();
        }
    };

    const availableSourceCvs = allCvs;

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-black bg-opacity-60 dark:bg-opacity-80 flex justify-center items-center z-50 transition-opacity duration-300 ease-in-out"
            onClick={handleBackdropClick}
        >
            <div
                className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4 sm:mx-0"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                        Create CV Branch
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Create a new CV version tailored for a specific career path
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="px-6 py-4">
                    {/* Source CV Selection */}
                    <div className="mb-4">
                        <label htmlFor="sourceCv" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Source CV
                        </label>
                        <select
                            id="sourceCv"
                            value={sourceCvId}
                            onChange={(e) => setSourceCvId(e.target.value)}
                            disabled={isLoading}
                            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600 ${
                                errors.sourceCvId ? 'border-red-500' : 'border-gray-300'
                            } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <option value="">Select a CV to branch from</option>
                            {availableSourceCvs.map((cv) => (
                                <option key={cv._id} value={cv._id}>
                                    {cv.isPrimary ? '⭐ Primary CV' : cv.displayName || cv.category || 'Unnamed CV'}
                                </option>
                            ))}
                        </select>
                        {errors.sourceCvId && (
                            <p className="text-red-500 text-sm mt-1">{errors.sourceCvId}</p>
                        )}
                    </div>

                    {/* Category */}
                    <div className="mb-4">
                        <label htmlFor="category" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Category
                        </label>
                        <input
                            type="text"
                            id="category"
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            disabled={isLoading}
                            placeholder="e.g., IT Helpdesk, Programming, Cybersecurity"
                            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600 ${
                                errors.category ? 'border-red-500' : 'border-gray-300'
                            } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                        />
                        {errors.category && (
                            <p className="text-red-500 text-sm mt-1">{errors.category}</p>
                        )}
                    </div>

                    {/* Display Name */}
                    <div className="mb-4">
                        <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Display Name
                        </label>
                        <input
                            type="text"
                            id="displayName"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            disabled={isLoading}
                            placeholder="e.g., Backend Developer CV"
                            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600 ${
                                errors.displayName ? 'border-red-500' : 'border-gray-300'
                            } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                        />
                        {errors.displayName && (
                            <p className="text-red-500 text-sm mt-1">{errors.displayName}</p>
                        )}
                    </div>

                    {/* Footer Buttons */}
                    <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isLoading}
                            className="px-4 py-2 bg-gray-500 dark:bg-gray-600 text-white rounded-md hover:bg-gray-600 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                        >
                            {isLoading ? (
                                <span className="flex items-center gap-2">
                                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Creating...
                                </span>
                            ) : (
                                'Create Branch'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateBranchModal;
