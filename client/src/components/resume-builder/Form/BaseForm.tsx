import React from 'react';

interface BaseFormProps {
    children: React.ReactNode;
    className?: string;
}

/**
 * Base wrapper for form sections with consistent styling
 */
export const BaseForm: React.FC<BaseFormProps> = ({ children, className = '' }) => {
    return (
        <section
            className={`flex flex-col gap-3 bg-transparent p-0 transition-all duration-200 ${className}`}
        >
            {children}
        </section>
    );
};

export default BaseForm;
