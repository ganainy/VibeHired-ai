// client/src/components/cv-management/CreateBranchModal.tsx
import React, { useState, useEffect } from 'react';
import { CVDocument } from '../../services/cvApi';
import { validateCvFile } from '../../lib/utils';

interface CreateBranchModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreateBranch: (sourceCvId: string, category: string, displayName: string) => Promise<void>;
    onUploadBranchFromFile?: (file: File, category: string, displayName: string) => Promise<void>;
    allCvs: CVDocument[];
    isLoading?: boolean;
}

const CreateBranchModal: React.FC<CreateBranchModalProps> = ({
    isOpen,
    onClose,
    onCreateBranch,
    onUploadBranchFromFile,
    allCvs,
    isLoading = false
}) => {
    const [mode, setMode] = useState<'existing' | 'upload'>('existing');
    const [sourceCvId, setSourceCvId] = useState('');
    const [category, setCategory] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [errors, setErrors] = useState<{ [key: string]: string }>({});

    // Reset form when modal opens
    useEffect(() => {
        if (isOpen) {
            setMode('existing');
            setSourceCvId('');
            setCategory('');
            setDisplayName('');
            setUploadedFile(null);
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

        if (mode === 'existing') {
            if (!sourceCvId) {
                newErrors.sourceCvId = 'Please select a source CV';
            }
        } else if (mode === 'upload') {
            if (!uploadedFile) {
                newErrors.uploadedFile = 'Please select a file to upload';
            }
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
            if (mode === 'existing') {
                await onCreateBranch(sourceCvId, category.trim(), displayName.trim());
            } else if (mode === 'upload' && uploadedFile && onUploadBranchFromFile) {
                await onUploadBranchFromFile(uploadedFile, category.trim(), displayName.trim());
            }
            onClose();
        } catch (error) {
            console.error('Error creating branch:', error);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] || null;
        if (file) {
            const validation = validateCvFile(file);
            if (!validation.isValid) {
                setErrors({ ...errors, uploadedFile: validation.errorMessage! });
                setUploadedFile(null);
                return;
            }
        }
        setUploadedFile(file);
        setErrors({ ...errors, uploadedFile: '' });
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
                        Create a Base CV
                    </h2>
                </div>

                {/* Info Banner */}
                <div className="mx-6 mt-4 mb-4 bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-sm text-gray-600 dark:text-gray-400">
                    <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">When to create another base CV:</p>
                    <ul className="list-disc list-inside space-y-0.5 ml-1">
                        <li>Different job focus (e.g., IT vs Sales)</li>
                        <li>Different language versions (e.g., English vs German)</li>
                        <li>Different experience levels to highlight</li>
                    </ul>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="px-6 py-4">
                    {/* Mode Toggle */}
                    <div className="mb-4">
                        <div className="flex rounded-lg bg-gray-100 dark:bg-gray-600 p-1">
                            <button
                                type="button"
                                onClick={() => setMode('existing')}
                                className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${mode === 'existing'
                                        ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                                    }`}
                            >
                                Use Existing CV
                            </button>
                            <button
                                type="button"
                                onClick={() => setMode('upload')}
                                className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${mode === 'upload'
                                        ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                                    }`}
                            >
                                Upload From Device
                            </button>
                        </div>
                    </div>

                    {/* Source CV Selection or File Upload */}
                    {mode === 'existing' ? (
                        <div className="mb-4">
                            <label htmlFor="sourceCv" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Source CV
                            </label>
                            <select
                                id="sourceCv"
                                value={sourceCvId}
                                onChange={(e) => setSourceCvId(e.target.value)}
                                disabled={isLoading}
                                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-600 dark:text-gray-100 dark:border-gray-600 ${errors.sourceCvId ? 'border-red-500' : 'border-gray-300'
                                    } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                <option value="">Select a CV to copy from</option>
                                {availableSourceCvs.map((cv) => (
                                    <option key={cv._id} value={cv._id}>
                                        {cv.displayName || cv.category || 'Unnamed CV'}
                                    </option>
                                ))}
                            </select>
                            {errors.sourceCvId && (
                                <p className="text-red-500 text-sm mt-1">{errors.sourceCvId}</p>
                            )}
                        </div>
                    ) : (
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Upload CV File
                            </label>
                            <div className="space-y-2">
                                <input
                                    type="file"
                                    accept=".pdf,.docx,.rtf"
                                    onChange={handleFileChange}
                                    disabled={isLoading}
                                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-600 dark:text-gray-100 dark:border-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-l-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 dark:file:bg-blue-900 dark:file:text-blue-300 ${errors.uploadedFile ? 'border-red-500' : 'border-gray-300'
                                        } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                                />
                                {uploadedFile && (
                                    <div className="flex items-center justify-between p-2 bg-blue-50 dark:bg-blue-900/20 rounded-md">
                                        <span className="text-sm text-blue-700 dark:text-blue-300">{uploadedFile.name}</span>
                                        <button
                                            type="button"
                                            onClick={() => setUploadedFile(null)}
                                            className="text-red-500 hover:text-red-700 text-sm"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                )}
                            </div>
                            {errors.uploadedFile && (
                                <p className="text-red-500 text-sm mt-1">{errors.uploadedFile}</p>
                            )}
                        </div>
                    )}

                    {/* Category */}
                    <div className="mb-4">
                        <label htmlFor="category" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Job Focus
                        </label>
                        <input
                            type="text"
                            id="category"
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            disabled={isLoading}
                            placeholder="e.g., IT Sysadmin, Sales, Designer"
                            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-600 dark:text-gray-100 dark:border-gray-600 ${errors.category ? 'border-red-500' : 'border-gray-300'
                                } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                        />
                        {errors.category && (
                            <p className="text-red-500 text-sm mt-1">{errors.category}</p>
                        )}
                    </div>

                    {/* Display Name */}
                    <div className="mb-4">
                        <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Base CV Name
                        </label>
                        <input
                            type="text"
                            id="displayName"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            disabled={isLoading}
                            placeholder="e.g., IT Sysadmin (EN), Sales (DE)"
                            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-600 dark:text-gray-100 dark:border-gray-600 ${errors.displayName ? 'border-red-500' : 'border-gray-300'
                                } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                        />
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Tip: include language in the name if you keep multiple base CVs.
                        </p>
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
                                'Create CV'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateBranchModal;
